import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * The /api/paywall/admin routes are the app's only server rail and the only
 * writer of the paywall choice, so their contracts are load-bearing:
 * sign-in-first 401s; a LOUD 500 when this app's own slug or organization is
 * missing; the admin's OWN token going to the platform on their own path (the
 * app holds no platform key); a paid answer refused before any Stripe call
 * while the organization has no Stripe source, or one without a publishable
 * key; the Stripe objects created in order on that source; a record from before
 * the setup screen retired like any other; the choice (with the source's
 * publishable key and account) recorded only after the platform said yes, every
 * key written because the platform cannot delete one; free making zero Stripe
 * or connect calls; and the connect relay passing verbs, bodies and statuses
 * through verbatim.
 */

const ENV_KEYS = [
  "NEXT_PUBLIC_API_BASE_URL",
  "NEXT_PUBLIC_PLATFORM_BASE_DOMAIN",
  "NEXT_PUBLIC_MAIN_TENANT_KEY",
  "NEXT_PUBLIC_PAYWALL_APP_SLUG",
  "NEXT_PUBLIC_APP_NAME",
] as const;

const saved: Record<string, string | undefined> = {};

// The handlers (and the libs they import) capture process.env and keep caches
// at module scope — arrange env first, then import a fresh instance.
const loadSetup = async () => await import("../app/api/paywall/admin/setup/route");
const loadConnect = async () => await import("../app/api/paywall/admin/connect/route");

const DM = "https://api.example.edu/dm";
const META_URL = `${DM}/api/core/orgs/testorg/metadata/`;
// Every platform call runs on the admin's own path.
const PROXY = `${DM}/api/ai-mentor/orgs/testorg/users/jane/providers/stripe/payments`;
const CONNECT_URL = `${DM}/api/ai-mentor/orgs/testorg/users/jane/providers/stripe/connect/`;

/** The platform's connect status on a connected account. */
const CONNECTED = {
  connected: true,
  available: true,
  key_credential_set: false,
  source: "connected",
  publishable_key: "pk_test_platform",
  stripe_account: "acct_1",
  account_id: "acct_1",
  livemode: false,
  charges_enabled: true,
  details_submitted: true,
  business_name: "Acme",
  email: "jane@x.io",
  connected_at: "2026-09-09T00:00:00.000Z",
  stale: false,
};
/** …on the organization's own pasted key (it wins; no account, its own publishable key). */
const OWN_KEY = {
  connected: false,
  available: true,
  key_credential_set: true,
  source: "key",
  publishable_key: "pk_live_own",
  stripe_account: null,
};
/** …with nothing yet. */
const NO_SOURCE = {
  connected: false,
  available: true,
  key_credential_set: false,
  source: null,
  publishable_key: "",
  stripe_account: null,
};

let dmCalls: { url: string; init?: RequestInit }[] = [];
let metaReads = 0;
let metaWrites: { headers: Record<string, string>; body: any }[] = [];
let connectCalls: { headers: Record<string, string>; init?: RequestInit }[] = [];

const monthly = (over: Record<string, unknown> = {}) => ({
  version: 1,
  access: "monthly",
  amount: 2900,
  currency: "usd",
  stripe: {
    product_id: "prod_1",
    price_id: "price_1",
    publishable_key: "pk_test_platform",
    stripe_account: "acct_1",
  },
  updated_at: "2026-09-04T00:00:00.000Z",
  updated_by: "jane",
  ...over,
});

/**
 * fetch stub: token/verify answers the caller's identity; the organization's
 * metadata URL answers with `apps` (and records PUTs); the connect URL answers
 * the Stripe source (and records calls); everything else is "the DM" (Stripe
 * proxy). Every stub starts a fresh call log — tests re-stub mid-test.
 */
const stubFetch = ({
  member = true,
  apps = {} as Record<string, unknown>,
  dm = () => Response.json({}),
  connect = () => Response.json(CONNECTED),
}: {
  member?: boolean;
  apps?: Record<string, unknown>;
  dm?: (url: string, init?: RequestInit) => Response;
  connect?: (init?: RequestInit) => Response;
} = {}) => {
  dmCalls = [];
  metaReads = 0;
  metaWrites = [];
  connectCalls = [];
  return vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
      const headers = (init?.headers ?? {}) as Record<string, string>;
      if (url.includes("/api/core/token/verify/"))
        return member
          ? Response.json({ user_id: 7, username: "jane", email: "jane@x.io" })
          : new Response("invalid token", { status: 401 });
      if (url === META_URL) {
        if (init?.method === "PUT") {
          metaWrites.push({ headers, body: JSON.parse(init.body as string) });
          return Response.json({ platform_key: "testorg", platform_name: "Acme", metadata: {} });
        }
        metaReads++;
        return Response.json({
          platform_key: "testorg",
          platform_name: "Acme",
          metadata: { apps },
        });
      }
      if (url === CONNECT_URL) {
        connectCalls.push({ headers, init });
        return connect(init);
      }
      dmCalls.push({ url, init });
      return dm(url, init);
    }),
  );
};

/**
 * A DM that answers Stripe-proxy calls by "METHOD path" (path relative to the
 * admin's own proxy); unknown calls are a test bug.
 */
const stripeDm =
  (answers: Record<string, (init?: RequestInit) => unknown>) =>
  (url: string, init?: RequestInit) => {
    const path = url.startsWith(PROXY) ? url.slice(PROXY.length) : url;
    const key = `${init?.method ?? "GET"} ${path}`;
    if (!(key in answers)) throw new Error(`unexpected DM call ${key}`);
    const answer = answers[key](init);
    return answer instanceof Response ? answer : Response.json(answer);
  };

beforeEach(() => {
  vi.resetModules();
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
  process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.edu";
  process.env.NEXT_PUBLIC_MAIN_TENANT_KEY = "testorg";
  process.env.NEXT_PUBLIC_PAYWALL_APP_SLUG = "demo-app";
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

const authed = { Authorization: "Token dm-abc" };
const calledPaths = () =>
  dmCalls.map((c) => `${c.init?.method ?? "GET"} ${c.url.slice(PROXY.length)}`);
const sentHeaders = (i: number) => dmCalls[i].init?.headers as Record<string, string>;
const sentBody = (i: number) => JSON.parse(dmCalls[i].init?.body as string);

describe("POST /api/paywall/admin/setup", () => {
  const post = (body: unknown, headers: Record<string, string> = {}) =>
    new NextRequest("http://localhost:3000/api/paywall/admin/setup", {
      method: "POST",
      headers: { ...authed, ...headers },
      body: JSON.stringify(body),
    });

  it("401s without a sign-in and validates before any platform call", async () => {
    stubFetch();
    const { POST } = await loadSetup();
    expect((await POST(post({ access: "free" }, { Authorization: "" }))).status).toBe(401);
    for (const bad of [
      { access: "weekly" },
      { access: "monthly" },
      { access: "one_time", amount: 0 },
      { access: "monthly", amount: 29.5 },
    ]) {
      expect((await POST(post(bad))).status).toBe(400);
    }
    expect(dmCalls).toHaveLength(0);
    expect(connectCalls).toHaveLength(0);
    expect(metaReads).toBe(0);
    expect(metaWrites).toHaveLength(0);
  });

  it("500s loudly, asking the platform nothing, while the slug or the organization is missing", async () => {
    for (const [key, value] of [
      ["NEXT_PUBLIC_PAYWALL_APP_SLUG", ""],
      ["NEXT_PUBLIC_PAYWALL_APP_SLUG", "not a slug"],
      ["NEXT_PUBLIC_MAIN_TENANT_KEY", ""],
    ] as const) {
      vi.resetModules();
      process.env.NEXT_PUBLIC_PAYWALL_APP_SLUG = "demo-app";
      process.env.NEXT_PUBLIC_MAIN_TENANT_KEY = "testorg";
      process.env[key] = value;
      stubFetch({ dm: stripeDm({}) });
      const { POST } = await loadSetup();
      const res = await POST(post({ access: "monthly", amount: 2900 }));
      expect(res.status).toBe(500);
      expect((await res.json()).error).toContain(key);
      expect(dmCalls).toHaveLength(0);
      expect(connectCalls).toHaveLength(0);
      expect(metaWrites).toHaveLength(0);
    }
  });

  it("free: records the choice without any Stripe or connect call, even after a paid plan — the price written as null", async () => {
    stubFetch({
      apps: { "demo-app": monthly() },
      // Any proxy or connect call throws: free must never need a Stripe account.
      dm: stripeDm({}),
      connect: () => {
        throw new Error("unexpected connect call");
      },
    });
    const { POST } = await loadSetup();
    const res = await POST(post({ access: "free" }, { "Idempotency-Key": "k" }));
    expect(res.status).toBe(200);
    expect(dmCalls).toHaveLength(0);
    expect(connectCalls).toHaveLength(0);
    expect(metaWrites).toHaveLength(1);
    expect(metaWrites[0].headers.Authorization).toBe("Token dm-abc");
    // Every key, nulls included: the platform merges and cannot delete one, so
    // a price left out would stay recorded — and stay for sale.
    expect(metaWrites[0].body).toEqual({
      metadata: {
        apps: {
          "demo-app": {
            version: 1,
            access: "free",
            amount: null,
            currency: null,
            // The tagged product is kept for a later paid answer; no source recorded.
            stripe: {
              product_id: "prod_1",
              price_id: null,
              publishable_key: null,
              stripe_account: null,
            },
            updated_at: expect.any(String),
            updated_by: "jane",
          },
        },
      },
    });
    expect((await res.json()).info.access).toBe("free");
  });

  it("names the product after the starter's own /setup answer, else NEXT_PUBLIC_APP_NAME, else the platform", async () => {
    const products = () => ({
      "POST /products/": () => ({ id: "prod_new" }),
      "POST /prices/": () => ({ id: "price_new" }),
    });
    // The starter keeps its settings under apps.<slugified NEXT_PUBLIC_APP_NAME>,
    // `vibe-starter` while that is unset (lib/iblai/metadata-core.ts).
    stubFetch({ apps: { "vibe-starter": { appName: "Caveman Coach" } }, dm: stripeDm(products()) });
    let { POST } = await loadSetup();
    expect((await POST(post({ access: "monthly", amount: 2900 }))).status).toBe(200);
    expect(sentBody(0)).toEqual({ name: "Caveman Coach", metadata: { app: "demo-app" } });

    vi.resetModules();
    process.env.NEXT_PUBLIC_APP_NAME = "Search Craft";
    stubFetch({ dm: stripeDm(products()) });
    ({ POST } = await loadSetup());
    expect((await POST(post({ access: "monthly", amount: 2900 }))).status).toBe(200);
    expect(sentBody(0).name).toBe("Search Craft");

    vi.resetModules();
    delete process.env.NEXT_PUBLIC_APP_NAME;
    stubFetch({ dm: stripeDm(products()) });
    ({ POST } = await loadSetup());
    expect((await POST(post({ access: "monthly", amount: 2900 }))).status).toBe(200);
    expect(sentBody(0).name).toBe("Acme");
  });

  it("monthly, first time: asks the platform for its Stripe source with the admin's own token, creates the product (tagged) and a recurring USD price, and records the source", async () => {
    stubFetch({
      dm: stripeDm({
        "POST /products/": () => ({ id: "prod_new", name: "Acme" }),
        "POST /prices/": () => ({ id: "price_new" }),
      }),
    });
    const { POST } = await loadSetup();
    const res = await POST(post({ access: "monthly", amount: 2900 }, { "Idempotency-Key": "k" }));
    expect(res.status).toBe(200);
    expect(connectCalls).toHaveLength(1);
    expect(connectCalls[0].init?.method ?? "GET").toBe("GET");
    expect(connectCalls[0].headers.Authorization).toBe("Token dm-abc");
    expect(calledPaths()).toEqual(["POST /products/", "POST /prices/"]);
    // Every Stripe call on the admin's own path with the admin's own token.
    for (let i = 0; i < dmCalls.length; i++) {
      expect(dmCalls[i].url.startsWith(PROXY)).toBe(true);
      expect(sentHeaders(i).Authorization).toBe("Token dm-abc");
    }
    expect(sentBody(0)).toEqual({ name: "Acme", metadata: { app: "demo-app" } });
    expect(sentHeaders(0)["Idempotency-Key"]).toBe("k-product");
    expect(sentBody(1)).toEqual({
      product: "prod_new",
      unit_amount: 2900,
      currency: "usd",
      nickname: "Monthly access",
      recurring: { interval: "month" },
    });
    expect(sentHeaders(1)["Idempotency-Key"]).toBe("k-price");
    expect(metaWrites[0].body.metadata.apps["demo-app"]).toMatchObject({
      access: "monthly",
      amount: 2900,
      currency: "usd",
      // The connected account's publishable key (the platform's own) and account id.
      stripe: {
        product_id: "prod_new",
        price_id: "price_new",
        publishable_key: "pk_test_platform",
        stripe_account: "acct_1",
      },
    });
  });

  it("one-time, changing plan: archives the old price, reuses the still-tagged product, no recurring", async () => {
    stubFetch({
      apps: { "demo-app": monthly() },
      dm: stripeDm({
        "POST /prices/price_1/": () => ({ id: "price_1", active: false }),
        "GET /products/prod_1/": () => ({
          id: "prod_1",
          active: true,
          metadata: { app: "demo-app" },
        }),
        "POST /prices/": () => ({ id: "price_2" }),
      }),
    });
    const { POST } = await loadSetup();
    const res = await POST(post({ access: "one_time", amount: 4900 }));
    expect(res.status).toBe(200);
    expect(calledPaths()).toEqual([
      "POST /prices/price_1/",
      "GET /products/prod_1/",
      "POST /prices/",
    ]);
    expect(sentBody(0)).toEqual({ active: false });
    expect(sentBody(2)).toEqual({
      product: "prod_1",
      unit_amount: 4900,
      currency: "usd",
      nickname: "One-time access",
    });
    expect(metaWrites[0].body.metadata.apps["demo-app"]).toMatchObject({
      access: "one_time",
      amount: 4900,
      stripe: { product_id: "prod_1", price_id: "price_2" },
    });
  });

  it("retires the price a record from before the setup screen left behind, and reuses its product", async () => {
    // The previous release recorded `stripe` alone, with no answer beside it.
    stubFetch({
      apps: { "demo-app": { stripe: { product_id: "prod_1", price_id: "price_old" } } },
      dm: stripeDm({
        "POST /prices/price_old/": () => ({ id: "price_old", active: false }),
        "GET /products/prod_1/": () => ({
          id: "prod_1",
          active: true,
          metadata: { app: "demo-app" },
        }),
        "POST /prices/": () => ({ id: "price_new" }),
      }),
    });
    const { POST } = await loadSetup();
    expect((await POST(post({ access: "monthly", amount: 2900 }))).status).toBe(200);
    expect(calledPaths()).toEqual([
      "POST /prices/price_old/",
      "GET /products/prod_1/",
      "POST /prices/",
    ]);
    expect(metaWrites[0].body.metadata.apps["demo-app"].stripe).toMatchObject({
      product_id: "prod_1",
      price_id: "price_new",
    });
  });

  it("replaces a product that is gone or no longer tagged", async () => {
    for (const product of [
      () => Response.json({ detail: "Not found." }, { status: 404 }),
      () => Response.json({ id: "prod_old", active: true, metadata: { app: "another-app" } }),
      () => Response.json({ id: "prod_old", active: false, metadata: { app: "demo-app" } }),
    ]) {
      stubFetch({
        apps: { "demo-app": monthly({ stripe: { product_id: "prod_old", price_id: null } }) },
        dm: (url, init) =>
          url.endsWith("/products/prod_old/")
            ? product()
            : Response.json(
                init?.method === "POST" && url.endsWith("/products/")
                  ? { id: "prod_new" }
                  : { id: "price_new" },
              ),
      });
      const { POST } = await loadSetup();
      const res = await POST(post({ access: "monthly", amount: 100 }));
      expect(res.status).toBe(200);
      expect(metaWrites[0].body.metadata.apps["demo-app"].stripe).toEqual({
        product_id: "prod_new",
        price_id: "price_new",
        publishable_key: "pk_test_platform",
        stripe_account: "acct_1",
      });
    }
  });

  it("saves after a reconnect to another Stripe account: the old price's 404 is not an error", async () => {
    stubFetch({
      apps: { "demo-app": monthly({ stripe: { product_id: "prod_old", price_id: "price_old" } }) },
      dm: (url, init) =>
        url.endsWith("/prices/price_old/") || url.endsWith("/products/prod_old/")
          ? Response.json(
              { error: "No such price: 'price_old'", code: "resource_missing" },
              { status: 404 },
            )
          : Response.json(
              init?.method === "POST" && url.endsWith("/products/")
                ? { id: "prod_new" }
                : { id: "price_new" },
            ),
    });
    const { POST } = await loadSetup();
    const res = await POST(post({ access: "monthly", amount: 100 }));
    expect(res.status).toBe(200);
    expect(metaWrites[0].body.metadata.apps["demo-app"].stripe).toMatchObject({
      product_id: "prod_new",
      price_id: "price_new",
    });
  });

  it("still fails the save when retiring the old price fails for any other reason", async () => {
    stubFetch({
      apps: { "demo-app": monthly({ stripe: { product_id: "prod_1", price_id: "price_1" } }) },
      dm: (url) =>
        url.endsWith("/prices/price_1/")
          ? Response.json({ error: "Stripe is unreachable or failing" }, { status: 502 })
          : Response.json({ id: "x" }),
    });
    const { POST } = await loadSetup();
    const res = await POST(post({ access: "monthly", amount: 100 }));
    expect(res.status).toBe(502);
    expect(metaWrites).toHaveLength(0);
  });

  it("records the organization's own publishable key and no account when it runs on a pasted key", async () => {
    stubFetch({
      connect: () => Response.json(OWN_KEY),
      dm: stripeDm({
        "POST /products/": () => ({ id: "prod_new" }),
        "POST /prices/": () => ({ id: "price_new" }),
      }),
    });
    const { POST } = await loadSetup();
    expect((await POST(post({ access: "monthly", amount: 2900 }))).status).toBe(200);
    expect(metaWrites[0].body.metadata.apps["demo-app"].stripe).toEqual({
      product_id: "prod_new",
      price_id: "price_new",
      publishable_key: "pk_live_own",
      stripe_account: null,
    });
  });

  it("400s a paid answer while there is no Stripe source, before any Stripe call", async () => {
    stubFetch({ connect: () => Response.json(NO_SOURCE), dm: stripeDm({}) });
    const { POST } = await loadSetup();
    const res = await POST(post({ access: "monthly", amount: 2900 }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Connect a Stripe account first" });
    expect(dmCalls).toHaveLength(0);
    expect(metaWrites).toHaveLength(0);
  });

  it("400s a paid answer while the Stripe source has no publishable key, naming the fix", async () => {
    for (const [source, fix] of [
      [{ ...CONNECTED, publishable_key: "" }, "contact ibl.ai support"],
      [{ ...OWN_KEY, publishable_key: "" }, "pk_…"],
    ] as const) {
      stubFetch({ connect: () => Response.json(source), dm: stripeDm({}) });
      const { POST } = await loadSetup();
      const res = await POST(post({ access: "one_time", amount: 500 }));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toContain(fix);
      expect(dmCalls).toHaveLength(0);
      expect(metaWrites).toHaveLength(0);
    }
  });

  it("passes the platform's 403 through (not an admin) and records nothing", async () => {
    stubFetch({ dm: () => Response.json({ error: "Permission denied" }, { status: 403 }) });
    const { POST } = await loadSetup();
    const res = await POST(post({ access: "monthly", amount: 2900 }));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Permission denied" });
    expect(metaWrites).toHaveLength(0);

    vi.resetModules();
    stubFetch({ connect: () => Response.json({ error: "Permission denied" }, { status: 403 }) });
    const fresh = await loadSetup();
    expect((await fresh.POST(post({ access: "monthly", amount: 2900 }))).status).toBe(403);
    expect(dmCalls).toHaveLength(0);
    expect(metaWrites).toHaveLength(0);
  });
});

describe("/api/paywall/admin/connect", () => {
  const request = (method: string, body?: unknown, headers: Record<string, string> = authed) =>
    new NextRequest("http://localhost:3000/api/paywall/admin/connect", {
      method,
      headers,
      ...(body !== undefined && { body: JSON.stringify(body) }),
    });

  it("401s without a sign-in and asks the platform nothing", async () => {
    stubFetch();
    const { GET, POST, DELETE } = await loadConnect();
    expect((await GET(request("GET", undefined, {}))).status).toBe(401);
    expect((await POST(request("POST", { return_url: "x" }, {}))).status).toBe(401);
    expect((await DELETE(request("DELETE", undefined, {}))).status).toBe(401);
    expect(connectCalls).toHaveLength(0);
  });

  it("GET relays the platform's status with the admin's own token on their own path", async () => {
    stubFetch();
    const { GET } = await loadConnect();
    const res = await GET(request("GET"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(CONNECTED);
    expect(connectCalls).toHaveLength(1);
    expect(connectCalls[0].init?.method ?? "GET").toBe("GET");
    expect(connectCalls[0].headers.Authorization).toBe("Token dm-abc");
  });

  it("POST forwards return_url and hands back Stripe's authorize URL", async () => {
    stubFetch({
      connect: () =>
        Response.json({ authorize_url: "https://connect.stripe.com/oauth/authorize?x" }),
    });
    const { POST } = await loadConnect();
    const res = await POST(
      request("POST", { return_url: "http://localhost:3000/paywall/setup/connect" }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      authorize_url: "https://connect.stripe.com/oauth/authorize?x",
    });
    expect(connectCalls[0].init?.method).toBe("POST");
    expect(JSON.parse(connectCalls[0].init?.body as string)).toEqual({
      return_url: "http://localhost:3000/paywall/setup/connect",
    });
    expect(connectCalls[0].headers).toMatchObject({
      Authorization: "Token dm-abc",
      "Content-Type": "application/json",
    });
  });

  it("DELETE passes the platform's 204 through as a 204", async () => {
    stubFetch({ connect: () => new Response(null, { status: 204 }) });
    const { DELETE } = await loadConnect();
    const res = await DELETE(request("DELETE"));
    expect(res.status).toBe(204);
    expect(connectCalls[0].init?.method).toBe("DELETE");
  });

  it("passes the platform's refusals through verbatim: 409 connected already, 503 not available, 502 Stripe unreachable", async () => {
    const { POST, DELETE } = await loadConnect();
    for (const [status, body] of [
      [409, { error: "already connected", code: "already_connected" }],
      [503, { error: "Stripe Connect needs migration 0366 of ibl_ai_mentor applied" }],
      [502, { error: "Stripe could not be reached", code: "stripe_unreachable" }],
    ] as const) {
      stubFetch({ connect: () => Response.json(body, { status }) });
      const res = await POST(
        request("POST", { return_url: "http://localhost:3000/paywall/setup/connect" }),
      );
      expect(res.status).toBe(status);
      expect(await res.json()).toEqual(body);
      const gone = await DELETE(request("DELETE"));
      expect(gone.status).toBe(status);
    }
  });
});
