import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * lib/paywall-client.ts is the buyer rail: the browser talks to the platform
 * itself, with the signed-in member's own token on their own username path,
 * and reads what is for sale from the organization's public metadata. These
 * tests pin the URLs and bodies on the wire, that no platform key exists
 * anywhere, that nothing for sale grants without asking the platform, that only
 * an explicit grant lets a member in, that a record from before the setup
 * screen still sells, that a missing slug fails before any request, and that a
 * refusal rejects with the platform's own words — never a silent pass.
 */

const ENV: Record<string, string> = {
  NEXT_PUBLIC_API_BASE_URL: "https://api.example.edu",
  NEXT_PUBLIC_MAIN_TENANT_KEY: "testorg",
  NEXT_PUBLIC_PAYWALL_APP_SLUG: "demo-app",
};
const savedEnv: Record<string, string | undefined> = {};

const DM = "https://api.example.edu/dm";
const META_URL = `${DM}/api/core/orgs/testorg/metadata/`;
const PAYWALL = `${DM}/api/ai-mentor/orgs/testorg/users/jane/providers/stripe/payments/paywall`;

const info = (over: Record<string, unknown> = {}) => ({
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

const metadataResponse = (apps: Record<string, unknown>) =>
  Response.json({ platform_key: "testorg", platform_name: "Acme", metadata: { apps } });

let calls: { url: string; init?: RequestInit }[] = [];

/** fetch stub: the metadata URL answers `apps`; the paywall calls answer `dm`. */
const stubFetch = (
  apps: Record<string, unknown>,
  dm: (url: string, init?: RequestInit) => Response = () => Response.json({}),
) => {
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
      calls.push({ url, init });
      return url === META_URL ? metadataResponse(apps) : dm(url, init);
    }),
  );
};

const paywallCalls = () => calls.filter((c) => c.url !== META_URL);

/** A Storage-shaped Map: what the SDK leaves in localStorage, and the session's own. */
const storage = (entries: [string, string][] = []) => {
  const store = new Map(entries);
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
  };
};

// The module (and the config it imports) captures process.env and keeps
// caches at module scope: arrange env and the browser globals, then import a
// fresh instance.
const load = async () => import("../lib/paywall-client");

beforeEach(() => {
  vi.resetModules();
  for (const [k, v] of Object.entries(ENV)) {
    savedEnv[k] = process.env[k];
    process.env[k] = v;
  }
  vi.stubGlobal("window", {});
  vi.stubGlobal(
    "localStorage",
    storage([
      ["dm_token", "dm-abc"],
      ["userData", JSON.stringify({ user_nicename: "jane", user_email: "jane@x.io" })],
    ]),
  );
  vi.stubGlobal("sessionStorage", storage());
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  for (const k of Object.keys(ENV)) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});

describe("paywallSlug", () => {
  it("is the pinned NEXT_PUBLIC_PAYWALL_APP_SLUG, and anything else fails before a single request", async () => {
    for (const slug of ["demo-app", "My_App-2", "a".repeat(64)]) {
      process.env.NEXT_PUBLIC_PAYWALL_APP_SLUG = slug;
      const { paywallSlug } = await load();
      expect(paywallSlug()).toBe(slug);
    }
    // No default: a shared one would give two apps on one organization each
    // other's payments, and the platform takes only a 1–64 character slug.
    for (const slug of [undefined, "", "   ", "a".repeat(65), "my app", "a/b"]) {
      vi.resetModules();
      if (slug === undefined) delete process.env.NEXT_PUBLIC_PAYWALL_APP_SLUG;
      else process.env.NEXT_PUBLIC_PAYWALL_APP_SLUG = slug;
      stubFetch({ "demo-app": info() });
      const { fetchCatalogue, checkAccess } = await load();
      await expect(fetchCatalogue()).rejects.toMatchObject({
        status: 0,
        message: expect.stringContaining("NEXT_PUBLIC_PAYWALL_APP_SLUG"),
      });
      await expect(checkAccess()).rejects.toMatchObject({ status: 0 });
      expect(calls).toHaveLength(0);
    }
  });
});

describe("fetchCatalogue", () => {
  it("reads apps.<slug> from the public metadata, with no credential, once per minute", async () => {
    stubFetch({ "demo-app": info() });
    const { fetchCatalogue } = await load();
    const first = await fetchCatalogue();
    const second = await fetchCatalogue();
    expect(first).toEqual({
      paywall: true,
      decided: true,
      settings: { access: "monthly", amount: 2900 },
      price: { id: "price_1", unitAmount: 2900, currency: "usd", interval: "month" },
    });
    expect(second).toBe(first);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(META_URL);
    expect((calls[0].init?.headers ?? {}) as Record<string, string>).not.toHaveProperty(
      "Authorization",
    );
  });

  it("is undecided with no entry, decided and free for a free choice, one-time without an interval", async () => {
    stubFetch({});
    let { fetchCatalogue } = await load();
    expect(await fetchCatalogue()).toEqual({
      paywall: false,
      decided: false,
      settings: null,
      price: null,
    });

    vi.resetModules();
    stubFetch({
      "demo-app": info({
        access: "free",
        amount: null,
        currency: null,
        stripe: { product_id: "prod_1", price_id: null },
      }),
    });
    ({ fetchCatalogue } = await load());
    expect(await fetchCatalogue()).toEqual({
      paywall: false,
      decided: true,
      settings: { access: "free", amount: null },
      price: null,
    });

    vi.resetModules();
    stubFetch({ "demo-app": info({ access: "one_time", amount: 4900 }) });
    ({ fetchCatalogue } = await load());
    expect((await fetchCatalogue()).price).toEqual({
      id: "price_1",
      unitAmount: 4900,
      currency: "usd",
      interval: null,
    });
  });

  it("keeps selling the price a record from before the setup screen holds, without calling it decided", async () => {
    // What the previous release's setup wrote: the price, and no answer. Read
    // as nothing for sale, every member of an upgraded app would walk in.
    stubFetch({
      "demo-app": {
        stripe: {
          product_id: "prod_1",
          price_id: "price_old",
          publishable_key: "pk_1",
          stripe_account: null,
        },
      },
    });
    const { fetchCatalogue } = await load();
    expect(await fetchCatalogue()).toEqual({
      paywall: true,
      decided: false,
      settings: null,
      price: { id: "price_old", unitAmount: null, currency: "usd", interval: null },
    });
  });

  it("passes the platform's refusal through instead of pretending the app is free, and does not cache it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ detail: "Not found." }, { status: 404 })),
    );
    const { fetchCatalogue, PaywallRequestError } = await load();
    await expect(fetchCatalogue()).rejects.toMatchObject({ status: 404, message: "Not found." });
    await expect(fetchCatalogue()).rejects.toBeInstanceOf(PaywallRequestError);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

describe("startCheckout", () => {
  it("mints the member's own embedded session on their own path with their own token", async () => {
    stubFetch({ "demo-app": info() }, () =>
      Response.json({
        client_secret: "cs_1_secret",
        session_id: "cs_1",
        publishable_key: "pk_test_platform",
        stripe_account: "acct_1",
      }),
    );
    const { startCheckout } = await load();
    expect(await startCheckout("price_1")).toEqual({
      client_secret: "cs_1_secret",
      session_id: "cs_1",
      publishable_key: "pk_test_platform",
      stripe_account: "acct_1",
    });
    expect(paywallCalls()).toHaveLength(1);
    const { url, init } = paywallCalls()[0];
    expect(url).toBe(`${PAYWALL}/checkout/`);
    expect(init?.method).toBe("POST");
    expect(init?.headers).toEqual({
      Authorization: "Token dm-abc",
      "Content-Type": "application/json",
    });
    expect(JSON.parse(init?.body as string)).toEqual({
      app: "demo-app",
      price_id: "price_1",
      ui_mode: "embedded",
      payment_method_types: ["card"],
    });
  });

  it("surfaces the platform's 400 (not the recorded price, no publishable key) verbatim", async () => {
    stubFetch({ "demo-app": info() }, () =>
      Response.json(
        { error: "price_id is not the price recorded for app demo-app" },
        { status: 400 },
      ),
    );
    const { startCheckout } = await load();
    await expect(startCheckout("price_evil")).rejects.toMatchObject({
      status: 400,
      message: "price_id is not the price recorded for app demo-app",
    });
  });

  it("asks nothing without a username or a token in the session: status 0 says what is missing", async () => {
    stubFetch({ "demo-app": info() });
    vi.stubGlobal("localStorage", storage([["dm_token", "dm-abc"]]));
    let { startCheckout } = await load();
    await expect(startCheckout("price_1")).rejects.toMatchObject({
      status: 0,
      message: expect.stringContaining("username"),
    });

    vi.resetModules();
    vi.stubGlobal(
      "localStorage",
      storage([["userData", JSON.stringify({ user_nicename: "jane" })]]),
    );
    ({ startCheckout } = await load());
    await expect(startCheckout("price_1")).rejects.toMatchObject({
      status: 0,
      message: expect.stringContaining("token"),
    });
    expect(calls).toHaveLength(0);
  });
});

describe("checkAccess", () => {
  it("asks the platform on the member's own path, with the session they just completed when given", async () => {
    stubFetch({ "demo-app": info() }, () => Response.json({ has_access: true, mode: "payment" }));
    const { checkAccess } = await load();
    expect(await checkAccess()).toMatchObject({ has_access: true });
    expect(await checkAccess("cs_42")).toMatchObject({ has_access: true });
    expect(paywallCalls().map((c) => c.url)).toEqual([
      `${PAYWALL}/access/?app=demo-app`,
      `${PAYWALL}/access/?app=demo-app&session_id=cs_42`,
    ]);
    for (const { init } of paywallCalls()) {
      expect(init?.method ?? "GET").toBe("GET");
      expect(((init?.headers ?? {}) as Record<string, string>).Authorization).toBe("Token dm-abc");
    }
  });
});

describe("hasPaidAccess", () => {
  it("grants without asking the platform while there is nothing for sale (undecided or free)", async () => {
    stubFetch({});
    let { hasPaidAccess } = await load();
    expect(await hasPaidAccess()).toBe(true);
    expect(paywallCalls()).toHaveLength(0);

    vi.resetModules();
    stubFetch({
      "demo-app": info({ access: "free", stripe: { product_id: "prod_1", price_id: null } }),
    });
    ({ hasPaidAccess } = await load());
    expect(await hasPaidAccess()).toBe(true);
    expect(paywallCalls()).toHaveLength(0);
  });

  it("answers from the platform while something is for sale, once per minute", async () => {
    stubFetch({ "demo-app": info() }, () => Response.json({ has_access: false, mode: null }));
    const { hasPaidAccess } = await load();
    expect(await hasPaidAccess()).toBe(false);
    expect(await hasPaidAccess()).toBe(false);
    expect(paywallCalls().map((c) => c.url)).toEqual([`${PAYWALL}/access/?app=demo-app`]);
  });

  it("lets a member in only on an explicit has_access: true", async () => {
    stubFetch({ "demo-app": info() }, () => Response.json({}));
    const { hasPaidAccess } = await load();
    expect(await hasPaidAccess()).toBe(false);
  });

  it("rejects with the platform's words on a refusal — never a silent pass — and does not cache it", async () => {
    stubFetch({ "demo-app": info() }, () =>
      Response.json({ error: "Permission denied" }, { status: 403 }),
    );
    const { hasPaidAccess, resetPaidAccess } = await load();
    await expect(hasPaidAccess()).rejects.toMatchObject({
      status: 403,
      message: "Permission denied",
    });
    await expect(hasPaidAccess()).rejects.toMatchObject({ status: 403 });
    expect(paywallCalls()).toHaveLength(2);
    resetPaidAccess();
    await expect(hasPaidAccess()).rejects.toMatchObject({ status: 403 });
    expect(paywallCalls()).toHaveLength(3);
  });

  it("restoreAccess asks the platform again instead of answering from the verdict held here", async () => {
    let paid = false;
    stubFetch({ "demo-app": info() }, () => Response.json({ has_access: paid }));
    const { hasPaidAccess, restoreAccess } = await load();
    expect(await hasPaidAccess()).toBe(false);
    paid = true;
    expect(await hasPaidAccess()).toBe(false);
    expect(await restoreAccess()).toBe(true);
    expect(paywallCalls()).toHaveLength(2);
  });
});

describe("checkPaywallSetup", () => {
  it("is undecided on a first run, decided — and remembered for the session — once answered, unknown on a hiccup", async () => {
    stubFetch({});
    let mod = await load();
    expect(await mod.checkPaywallSetup()).toBe("undecided");
    expect(mod.setupSettled()).toBe(false);

    vi.resetModules();
    stubFetch({ "demo-app": info() });
    mod = await load();
    expect(await mod.checkPaywallSetup()).toBe("decided");
    expect(mod.setupSettled()).toBe(true);

    // A hiccup must not read as a first run: that would send an admin to the
    // question they already answered.
    vi.resetModules();
    vi.stubGlobal("sessionStorage", storage());
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ error: "down" }, { status: 502 })),
    );
    mod = await load();
    expect(await mod.checkPaywallSetup()).toBe("unknown");
    expect(mod.setupSettled()).toBe(false);
  });
});

describe("the admin's words", () => {
  it("connectFailure never tells an admin a refused code merely expired, and prints unknown codes raw", async () => {
    const { connectFailure } = await load();
    expect(connectFailure("invalid_grant")).not.toMatch(/expired/i);
    expect(connectFailure("invalid_grant")).toContain("contact ibl.ai support");
    expect(connectFailure("access_denied")).toBe("You cancelled on Stripe.");
    expect(connectFailure("weird_code")).toBe("Stripe connection failed (weird_code).");
    expect(connectFailure("")).toBe("Stripe connection failed (unknown).");
  });

  it("sourceWarning says nothing until there is a source, then names the fix for that source", async () => {
    const { sourceWarning } = await load();
    // The platform answers publishable_key "" whenever nothing is linked yet.
    expect(sourceWarning(null)).toBe("");
    expect(sourceWarning({ source: null, publishable_key: "" })).toBe("");
    expect(sourceWarning({ source: "key", publishable_key: "pk_live_1" })).toBe("");
    expect(sourceWarning({ source: "connected", publishable_key: "pk_live_1" })).toBe("");
    expect(sourceWarning({ source: "key", publishable_key: "" })).toContain("pk_…");
    expect(sourceWarning({ source: "connected", publishable_key: "" })).toContain(
      "contact ibl.ai support",
    );
  });

  it("priceText prices a month or a single payment, and says nothing when the amount is unknown", async () => {
    const { priceText } = await load();
    const price = { id: "price_1", currency: "usd" };
    expect(priceText({ ...price, unitAmount: 2900, interval: "month" })).toBe("$29 a month");
    expect(priceText({ ...price, unitAmount: 4950, interval: null })).toBe("$49.50 once");
    expect(priceText({ ...price, unitAmount: null, interval: null })).toBe("");
    expect(priceText(null)).toBe("");
  });

  it("errorWithStatus adds the status to a message a person has to act on, and none to one never sent", async () => {
    const { errorWithStatus, PaywallRequestError, errorMessage } = await load();
    expect(errorWithStatus(new PaywallRequestError(403, "Permission denied"))).toBe(
      "Permission denied (403)",
    );
    expect(errorWithStatus(new PaywallRequestError(0, "Sign in again."))).toBe("Sign in again.");
    expect(errorWithStatus(new Error("boom"))).toBe("boom");
    expect(errorMessage("junk")).toBe("Something went wrong; try again.");
  });
});
