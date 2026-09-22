import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * lib/paywall-connect.ts — the browser half of "Connect with Stripe". It is the
 * one paywall module that calls the platform directly on the admin's own
 * session token, so what matters is: the path it builds (org + the signed-in
 * member, never a client-supplied name), that a missing identity or token
 * fails BEFORE any request rather than sending a half-built URL, and that the
 * platform's own 4xx/5xx messages reach the admin verbatim — a 502 on
 * disconnect in particular means the account is still connected.
 */

const load = async () => await import("../lib/paywall-connect");

let store: Record<string, string> = {};
let calls: { url: string; init?: RequestInit }[] = [];

function stubWindow(next: Record<string, string>) {
  store = next;
  const ls = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
  };
  vi.stubGlobal("window", { localStorage: ls });
  vi.stubGlobal("localStorage", ls);
}

/** Signed in as an admin of `acme`, with a session token. */
const signedIn = (extra: Record<string, string> = {}) =>
  stubWindow({
    dm_token: "dm-abc",
    userData: JSON.stringify({ user_nicename: "jane" }),
    ...extra,
  });

const stubFetch = (respond: () => Response) =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(input), init });
      return respond();
    }),
  );

const CONNECT =
  "https://api.example.edu/dm/api/ai-mentor/orgs/acme/users/jane/providers/stripe/connect/";

const CONNECTED = {
  connected: true,
  available: true,
  key_credential_set: false,
  source: "connected",
  publishable_key: "pk_test_1",
  stripe_account: "acct_1",
  charges_enabled: true,
};

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
  calls = [];
  process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.edu";
  process.env.NEXT_PUBLIC_MAIN_TENANT_KEY = "acme";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("connectUrl", () => {
  it("names the app's org and the signed-in member", async () => {
    signedIn();
    const { connectUrl } = await load();
    expect(connectUrl()).toBe(CONNECT);
  });

  it("is empty when the session carries no username — nothing to build a path from", async () => {
    stubWindow({ dm_token: "dm-abc" });
    const { connectUrl } = await load();
    expect(connectUrl()).toBe("");
  });
});

describe("getConnectStatus", () => {
  it("reads the status on the admin's own token", async () => {
    signedIn();
    stubFetch(() => Response.json(CONNECTED));
    const { getConnectStatus } = await load();

    expect(await getConnectStatus()).toMatchObject({
      source: "connected",
      stripe_account: "acct_1",
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(CONNECT);
    expect((calls[0].init?.headers as Record<string, string>).Authorization).toBe("Token dm-abc");
  });

  it("asks Stripe for a fresh snapshot only when told to", async () => {
    signedIn();
    stubFetch(() => Response.json(CONNECTED));
    const { getConnectStatus } = await load();

    await getConnectStatus(true);
    expect(calls[0].url).toBe(`${CONNECT}?refresh=1`);
  });

  it("throws the platform's own message, not a generic one", async () => {
    signedIn();
    stubFetch(() => Response.json({ error: "No Stripe account is connected" }, { status: 404 }));
    const { getConnectStatus, ConnectError } = await load();

    await expect(getConnectStatus()).rejects.toThrowError(ConnectError);
    await expect(getConnectStatus()).rejects.toThrowError("No Stripe account is connected");
  });

  it("fails before asking when there is no session token", async () => {
    stubWindow({ userData: JSON.stringify({ user_nicename: "jane" }) });
    stubFetch(() => Response.json(CONNECTED));
    const { getConnectStatus } = await load();

    await expect(getConnectStatus()).rejects.toThrowError(/Sign in again/);
    expect(calls).toHaveLength(0);
  });
});

describe("startConnect", () => {
  it("posts the return URL and hands back Stripe's authorize URL", async () => {
    signedIn();
    stubFetch(() =>
      Response.json({
        authorize_url: "https://connect.stripe.com/oauth/authorize?x=1",
      }),
    );
    const { startConnect } = await load();

    const url = await startConnect("https://app.example.com/paywall/setup");

    expect(url).toBe("https://connect.stripe.com/oauth/authorize?x=1");
    expect(calls[0].init?.method).toBe("POST");
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({
      return_url: "https://app.example.com/paywall/setup",
    });
  });

  it("surfaces 409 already-connected and 503 no-state-store verbatim", async () => {
    signedIn();
    stubFetch(() => Response.json({ error: "An account is already connected" }, { status: 409 }));
    let mod = await load();
    await expect(mod.startConnect("https://app.example.com/paywall/setup")).rejects.toThrowError(
      "An account is already connected",
    );

    vi.resetModules();
    stubFetch(() => Response.json({ error: "no state store" }, { status: 503 }));
    mod = await load();
    await expect(mod.startConnect("https://app.example.com/paywall/setup")).rejects.toThrowError(
      "no state store",
    );
  });

  it("refuses a 200 with no authorize_url instead of redirecting nowhere", async () => {
    signedIn();
    stubFetch(() => Response.json({}));
    const { startConnect } = await load();
    await expect(startConnect("https://app.example.com/paywall/setup")).rejects.toThrowError(
      /no authorize_url/,
    );
  });
});

describe("disconnect", () => {
  it("treats 204 and 404 as done — nothing connected is the desired state", async () => {
    signedIn();
    stubFetch(() => new Response(null, { status: 204 }));
    let mod = await load();
    await expect(mod.disconnect()).resolves.toBeUndefined();

    vi.resetModules();
    stubFetch(() => Response.json({ error: "No Stripe account is connected" }, { status: 404 }));
    mod = await load();
    await expect(mod.disconnect()).resolves.toBeUndefined();
  });

  it("surfaces a 502 — Stripe could not confirm it, so the account is STILL connected", async () => {
    signedIn();
    stubFetch(() => Response.json({ error: "Stripe could not be reached" }, { status: 502 }));
    const { disconnect } = await load();
    await expect(disconnect()).rejects.toThrowError("Stripe could not be reached");
  });
});

describe("reasonText", () => {
  it("explains the codes Stripe sends back through the platform", async () => {
    const { reasonText } = await load();
    expect(reasonText("access_denied")).toMatch(/cancelled/i);
    expect(reasonText("account_linked_elsewhere")).toMatch(/another organization/i);
  });

  it("prints an unknown code rather than swallowing it", async () => {
    const { reasonText } = await load();
    expect(reasonText("brand_new_code")).toContain("brand_new_code");
    expect(reasonText("")).toMatch(/no reason given/);
  });
});
