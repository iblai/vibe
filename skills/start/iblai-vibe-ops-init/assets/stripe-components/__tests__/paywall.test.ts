import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * lib/paywall.ts is the server-side trust boundary for the app paywall: it
 * turns the browser's `Authorization: Token <dm_token>` into a verified
 * platform identity (never trusting a client-sent username) and calls the DM
 * Stripe proxy as that user with the org-wide Api-Token key. These tests pin
 * the proxy URL composition, the two auth schemes staying on their own rails,
 * and the ~60s identity cache (one token/verify fetch, not one per request).
 */

const ENV_KEYS = [
  "NEXT_PUBLIC_API_BASE_URL",
  "NEXT_PUBLIC_PLATFORM_BASE_DOMAIN",
  "NEXT_PUBLIC_MAIN_TENANT_KEY",
  "IBLAI_API_KEY",
  "PAYWALL_APP_SLUG",
] as const;

const saved: Record<string, string | undefined> = {};

// paywall.ts (and the config it imports) capture process.env at module scope,
// so each test re-imports a fresh module instance after arranging the env.
const loadPaywall = async () => await import("../lib/paywall");

beforeEach(() => {
  vi.resetModules();
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
  process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.edu";
  process.env.NEXT_PUBLIC_MAIN_TENANT_KEY = "testorg";
  process.env.IBLAI_API_KEY = "platform-key";
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

const stubFetch = (impl: (url: string, init?: RequestInit) => Response | Promise<Response>) => {
  const mock = vi.fn(async (input: string | URL | Request, init?: RequestInit) =>
    impl(String(input), init),
  );
  vi.stubGlobal("fetch", mock);
  return mock;
};

describe("dmPaywallFetch", () => {
  it("composes the DM proxy URL from config and the encoded username", async () => {
    const mock = stubFetch(() => Response.json({}));
    const { dmPaywallFetch } = await loadPaywall();

    await dmPaywallFetch("j.doe+x", "/paywall/access/?app=demo");

    expect(mock).toHaveBeenCalledTimes(1);
    const [url, init] = mock.mock.calls[0];
    expect(String(url)).toBe(
      "https://api.example.edu/dm/api/ai-mentor/orgs/testorg" +
        "/users/j.doe%2Bx/providers/stripe/payments/paywall/access/?app=demo",
    );
    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Api-Token platform-key");
    expect(headers["Content-Type"]).toBe("application/json");
    expect(init?.cache).toBe("no-store");
  });
});

describe("userFromRequest", () => {
  it("resolves a Token authorization header via token/verify", async () => {
    const mock = stubFetch(() => Response.json({ username: "jane", email: "jane@x.io" }));
    const { userFromRequest } = await loadPaywall();

    const req = new Request("http://app.test/api/paywall/access", {
      headers: { Authorization: "Token dm-abc" },
    });
    expect(await userFromRequest(req)).toEqual({ username: "jane", email: "jane@x.io" });

    const [url, init] = mock.mock.calls[0];
    expect(String(url)).toBe("https://api.example.edu/dm/api/core/token/verify/");
    // The user's own token, never the org-wide Api-Token.
    expect((init?.headers as Record<string, string>).Authorization).toBe("Token dm-abc");
  });

  it("rejects missing or non-Token schemes without touching the network", async () => {
    const mock = stubFetch(() => Response.json({ username: "jane", email: "" }));
    const { userFromRequest } = await loadPaywall();

    expect(await userFromRequest(new Request("http://app.test/"))).toBeNull();
    expect(
      await userFromRequest(
        new Request("http://app.test/", { headers: { Authorization: "Bearer dm-abc" } }),
      ),
    ).toBeNull();
    expect(mock).not.toHaveBeenCalled();
  });
});

describe("resolveUser identity cache", () => {
  it("fetches token/verify once, then serves the ~60s cache", async () => {
    const mock = stubFetch(() => Response.json({ username: "jane", email: "jane@x.io" }));
    const { resolveUser } = await loadPaywall();

    const first = await resolveUser("dm-abc");
    const second = await resolveUser("dm-abc");

    expect(first).toEqual({ username: "jane", email: "jane@x.io" });
    expect(second).toEqual(first);
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it("does not cache verify failures — the token may be mid-refresh", async () => {
    const mock = stubFetch(() => new Response("invalid", { status: 401 }));
    const { resolveUser } = await loadPaywall();

    expect(await resolveUser("dm-bad")).toBeNull();
    expect(await resolveUser("dm-bad")).toBeNull();
    expect(mock).toHaveBeenCalledTimes(2);
  });
});
