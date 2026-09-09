import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * The two /api/paywall route handlers are the only holders of the org-wide
 * Api-Token, so their contracts are load-bearing: auth-first 401s, a LOUD 500
 * when PAYWALL_APP_SLUG is missing (the components install without it —
 * misconfiguration must fail visibly the moment they are actually used, never
 * silently grant), the PAYWALL_PRICE_IDS allowlist, Stripe's literal
 * {CHECKOUT_SESSION_ID} placeholder in success_url, and verbatim DM
 * passthrough (DM 4xx bodies are actionable).
 */

const ENV_KEYS = [
  "NEXT_PUBLIC_API_BASE_URL",
  "NEXT_PUBLIC_PLATFORM_BASE_DOMAIN",
  "NEXT_PUBLIC_MAIN_TENANT_KEY",
  "IBLAI_API_KEY",
  "PAYWALL_APP_SLUG",
  "PAYWALL_PRICE_IDS",
] as const;

const saved: Record<string, string | undefined> = {};

// The handlers (and lib/paywall.ts they import) capture process.env at module
// scope — arrange env first, then dynamically import a fresh module instance.
const loadAccess = async () => await import("../app/api/paywall/access/route");
const loadCheckout = async () => await import("../app/api/paywall/checkout/route");

let dmCalls: { url: string; init?: RequestInit }[] = [];

/** fetch stub: token/verify answers identity; everything else is "the DM". */
const stubFetch = ({
  member = true,
  dm = () => Response.json({}),
}: { member?: boolean; dm?: () => Response } = {}) =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/core/token/verify/"))
        return member
          ? Response.json({ username: "jane", email: "jane@x.io" })
          : new Response("invalid token", { status: 401 });
      dmCalls.push({ url, init });
      return dm();
    }),
  );

beforeEach(() => {
  vi.resetModules();
  dmCalls = [];
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
  process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.edu";
  process.env.NEXT_PUBLIC_MAIN_TENANT_KEY = "testorg";
  process.env.IBLAI_API_KEY = "platform-key";
  process.env.PAYWALL_APP_SLUG = "demo-app";
  process.env.PAYWALL_PRICE_IDS = "price_a,price_b";
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

const authed = { Authorization: "Token dm-abc" };

describe("POST /api/paywall/checkout", () => {
  const post = (body: string, headers: Record<string, string> = {}) =>
    new NextRequest("http://localhost:3000/api/paywall/checkout", {
      method: "POST",
      headers,
      body,
    });

  it("401s without a platform member token", async () => {
    stubFetch();
    const { POST } = await loadCheckout();
    const res = await POST(post(JSON.stringify({ price_id: "price_a" })));
    expect(res.status).toBe(401);
    expect(dmCalls).toHaveLength(0);
  });

  it("400s a price_id outside PAYWALL_PRICE_IDS without calling the DM", async () => {
    stubFetch();
    const { POST } = await loadCheckout();
    const res = await POST(post(JSON.stringify({ price_id: "price_evil" }), authed));
    expect(res.status).toBe(400);
    expect(dmCalls).toHaveLength(0);
  });

  it("400s an unparseable body instead of crashing", async () => {
    stubFetch();
    const { POST } = await loadCheckout();
    const res = await POST(post("not json", authed));
    expect(res.status).toBe(400);
  });

  it("mints the session via the DM with origin-derived URLs and returns checkout_url", async () => {
    stubFetch({
      dm: () => Response.json({ checkout_url: "https://checkout.stripe.com/c/pay/cs_123" }),
    });
    const { POST } = await loadCheckout();

    const res = await POST(
      post(JSON.stringify({ price_id: "price_a" }), {
        ...authed,
        origin: "https://demo.vercel.app",
      }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      checkout_url: "https://checkout.stripe.com/c/pay/cs_123",
    });

    expect(dmCalls).toHaveLength(1);
    expect(dmCalls[0].url).toBe(
      "https://api.example.edu/dm/api/ai-mentor/orgs/testorg" +
        "/users/jane/providers/stripe/payments/paywall/checkout/",
    );
    expect(dmCalls[0].init?.method).toBe("POST");
    const sent = JSON.parse(String(dmCalls[0].init?.body));
    expect(sent).toEqual({
      price_id: "price_a",
      app: "demo-app",
      // Literal Stripe placeholder — Stripe substitutes it, the app never does.
      success_url: "https://demo.vercel.app/paywall/return?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "https://demo.vercel.app/paywall",
    });
  });
});

describe("GET /api/paywall/access", () => {
  const get = (qs = "", headers: Record<string, string> = {}) =>
    new NextRequest(`http://localhost:3000/api/paywall/access${qs}`, { headers });

  it("401s when token/verify rejects the token (non-member)", async () => {
    stubFetch({ member: false });
    const { GET } = await loadAccess();
    const res = await GET(get("", authed));
    expect(res.status).toBe(401);
    expect(dmCalls).toHaveLength(0);
  });

  it("500s loudly when PAYWALL_APP_SLUG is unset — unconfigured routes fail visibly when used", async () => {
    delete process.env.PAYWALL_APP_SLUG;
    stubFetch();
    const { GET } = await loadAccess();
    const res = await GET(get("", authed));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "PAYWALL_APP_SLUG not set" });
    expect(dmCalls).toHaveLength(0);
  });

  it("passes the DM's JSON and status through verbatim, forwarding session_id", async () => {
    stubFetch({ dm: () => Response.json({ has_access: true, source: "recorded" }) });
    const { GET } = await loadAccess();

    const res = await GET(get("?session_id=cs_42", authed));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ has_access: true, source: "recorded" });
    expect(dmCalls).toHaveLength(1);
    expect(dmCalls[0].url).toBe(
      "https://api.example.edu/dm/api/ai-mentor/orgs/testorg" +
        "/users/jane/providers/stripe/payments/paywall/access/?app=demo-app&session_id=cs_42",
    );
  });

  it("passes non-200 DM statuses through too", async () => {
    stubFetch({ dm: () => Response.json({ detail: "Not found." }, { status: 404 }) });
    const { GET } = await loadAccess();
    const res = await GET(get("", authed));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ detail: "Not found." });
  });
});
