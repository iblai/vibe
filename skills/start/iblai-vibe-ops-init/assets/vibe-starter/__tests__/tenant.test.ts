import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * lib/iblai/tenant.ts — admin detection reads the `tenants` list the sign-in
 * persisted and matches it against the app's pinned org, never the SDK's
 * notion of "current tenant".
 */

const load = async () => await import("../lib/iblai/tenant");

function stubWindow(store: Record<string, string>) {
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

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
  process.env.NEXT_PUBLIC_MAIN_TENANT_KEY = "acme";
});

describe("isTenantAdmin", () => {
  it("is true only when the pinned org's entry says is_admin", async () => {
    stubWindow({ tenants: JSON.stringify([{ key: "main" }, { key: "acme", is_admin: true }]) });
    const { isTenantAdmin } = await load();
    expect(isTenantAdmin()).toBe(true);
  });

  it("is false for a member, for another org's admin, and when signed out", async () => {
    stubWindow({ tenants: JSON.stringify([{ key: "acme", is_admin: false }, { key: "other", is_admin: true }]) });
    let mod = await load();
    expect(mod.isTenantAdmin()).toBe(false);

    vi.resetModules();
    stubWindow({});
    mod = await load();
    expect(mod.isTenantAdmin()).toBe(false);
  });

  it("survives a corrupt tenants entry", async () => {
    stubWindow({ tenants: "{not json" });
    const { isTenantAdmin, readTenants } = await load();
    expect(readTenants()).toEqual([]);
    expect(isTenantAdmin()).toBe(false);
  });
});
