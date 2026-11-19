import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * lib/iblai/auth-utils.ts: the login-return URL the plan picker hands Stripe.
 * The pricing session only accepts a return URL on a domain it allows, and the
 * login host is one — the app's own origin rides along, nested, so the login
 * page can consume the checkout's sign-in token and come back to the app.
 */

const ENV_KEYS = ["NEXT_PUBLIC_AUTH_URL", "NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_PLATFORM_BASE_DOMAIN"] as const;
const saved: Record<string, string | undefined> = {};

// config.ts captures process.env at module scope, so each test re-imports a
// fresh module instance after arranging the env.
const load = async () => import("../lib/iblai/auth-utils");

beforeEach(() => {
  vi.resetModules();
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe("loginReturnUrl", () => {
  it("nests the app's origin inside the login page on the auth host", async () => {
    process.env.NEXT_PUBLIC_AUTH_URL = "https://login.example.test";
    process.env.NEXT_PUBLIC_APP_URL = "https://acme.iblai.me";
    const { loginReturnUrl } = await load();
    const url = new URL(loginReturnUrl());
    expect(`${url.origin}${url.pathname}`).toBe("https://login.example.test/login");
    expect(url.searchParams.get("app")).toBe("custom");
    expect(url.searchParams.get("redirect-to")).toBe("https://acme.iblai.me");
  });

  it("takes an explicit origin", async () => {
    const { loginReturnUrl } = await load();
    const url = new URL(loginReturnUrl("http://localhost:3000"));
    expect(url.searchParams.get("redirect-to")).toBe("http://localhost:3000");
  });

  it("defaults to the hosted login page", async () => {
    const { loginReturnUrl } = await load();
    expect(loginReturnUrl("https://acme.example.test").startsWith("https://login.iblai.app/login?")).toBe(true);
  });
});
