import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * lib/iblai/platform.ts — the server-side platform helper: header scheme,
 * gateway base, error mapping, caller verification.
 */

const KEY = "IBLAI_API_KEY";
let saved: string | undefined;

const load = async () => await import("../lib/iblai/platform");

beforeEach(() => {
  vi.resetModules();
  saved = process.env[KEY];
  process.env[KEY] = "test-api-token";
  delete process.env.NEXT_PUBLIC_API_BASE_URL;
  delete process.env.NEXT_PUBLIC_PLATFORM_BASE_DOMAIN;
  process.env.NEXT_PUBLIC_MAIN_TENANT_KEY = "acme";
});

afterEach(() => {
  if (saved === undefined) delete process.env[KEY];
  else process.env[KEY] = saved;
  vi.unstubAllGlobals();
});

function mockFetch(status: number, body: unknown) {
  const fn = vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
    json: async () => body,
  }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("platformFetch", () => {
  it("calls the consolidated gateway with the Api-Token scheme and JSON body", async () => {
    const fetchMock = mockFetch(200, { ok: true });
    const { platformFetch } = await load();
    const data = await platformFetch("/dm/api/x/", { method: "POST", body: { a: 1 } });
    expect(data).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.iblai.app/dm/api/x/");
    expect((init.headers as Record<string, string>).Authorization).toBe("Api-Token test-api-token");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    expect(init.body).toBe(JSON.stringify({ a: 1 }));
  });

  it("throws PlatformError carrying the platform's status and body", async () => {
    mockFetch(403, { error: "nope" });
    const { platformFetch, PlatformError } = await load();
    await expect(platformFetch("/dm/api/x/")).rejects.toMatchObject({ status: 403, body: { error: "nope" } });
    await expect(platformFetch("/dm/api/x/")).rejects.toBeInstanceOf(PlatformError);
  });

  it("refuses to run without IBLAI_API_KEY", async () => {
    delete process.env[KEY];
    const { platformFetch } = await load();
    await expect(platformFetch("/dm/api/x/")).rejects.toMatchObject({ status: 500 });
  });
});

describe("platformFailure", () => {
  it("passes 4xx the browser must act on through and maps the rest to 502", async () => {
    const { platformFailure, PlatformError } = await load();
    expect(platformFailure(new PlatformError(429, { detail: "cap" })).status).toBe(429);
    expect(platformFailure(new PlatformError(403, { error: "x" })).status).toBe(403);
    expect(platformFailure(new PlatformError(500, "boom")).status).toBe(502);
  });

  it("rethrows anything that is not a PlatformError", async () => {
    const { platformFailure } = await load();
    expect(() => platformFailure(new Error("bug"))).toThrow("bug");
  });
});

describe("verifyCaller", () => {
  it("returns null without a Token header", async () => {
    mockFetch(200, { username: "u" });
    const { verifyCaller } = await load();
    expect(await verifyCaller(new Request("http://x/"))).toBeNull();
  });

  it("resolves the username from token/verify", async () => {
    const fetchMock = mockFetch(200, { username: "jane" });
    const { verifyCaller } = await load();
    const req = new Request("http://x/", { headers: { Authorization: "Token abc" } });
    expect(await verifyCaller(req)).toEqual({ username: "jane", token: "abc" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.iblai.app/dm/api/core/token/verify/");
    expect((init.headers as Record<string, string>).Authorization).toBe("Token abc");
  });
});
