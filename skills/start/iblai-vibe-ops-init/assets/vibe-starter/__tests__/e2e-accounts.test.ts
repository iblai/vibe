import { describe, expect, it } from "vitest";
import dotenv from "dotenv";
import { mergeEnv, newAccount, resolveOrg } from "../e2e/create-accounts.mjs";

/** e2e/create-accounts.mjs — Playwright must read back exactly what the script wrote. */
describe("mergeEnv", () => {
  it("replaces a key in place, appends a missing one, keeps the rest", () => {
    const before = "# c\nAPP_HOST=http://localhost:3000\nPLAYWRIGHT_USERNAME=\n";
    const after = mergeEnv(before, { PLAYWRIGHT_USERNAME: "a@example.com", PLAYWRIGHT_PASSWORD: "x$&y" });
    expect(after).toBe("# c\nAPP_HOST=http://localhost:3000\nPLAYWRIGHT_USERNAME=a@example.com\nPLAYWRIGHT_PASSWORD=x$&y\n");
    expect(mergeEnv(after, { PLAYWRIGHT_PASSWORD: "x$&y" })).toBe(after);
  });
});

describe("resolveOrg", () => {
  it("prefers the connected organization and refuses the shared one and placeholders", () => {
    expect(resolveOrg({ iblai: { PLATFORM: "acme" }, local: { NEXT_PUBLIC_MAIN_TENANT_KEY: "main" } })).toBe("acme");
    expect(resolveOrg({ env: { IBLAI_ORG: "acme" } })).toBe("acme");
    expect(resolveOrg({ local: { NEXT_PUBLIC_MAIN_TENANT_KEY: "acme" } })).toBe("acme");
    expect(() => resolveOrg({ local: { NEXT_PUBLIC_MAIN_TENANT_KEY: "main" } })).toThrow(/"main"/);
    expect(() => resolveOrg({ iblai: { PLATFORM: "your-platform" } })).toThrow(/your-platform/);
    expect(() => resolveOrg({})).toThrow(/connect/);
  });
});

describe("newAccount", () => {
  it("makes distinct platform-safe usernames and passwords that survive dotenv", () => {
    for (let i = 0; i < 50; i++) {
      const { username, email, password } = newAccount("e2e-mem");
      expect(username).toMatch(/^e2e-mem-[0-9a-f]{8}$/);
      expect(email).toBe(`${username}@example.com`);
      expect(dotenv.parse(mergeEnv("", { P: password })).P).toBe(password);
    }
    expect(newAccount("e2e-adm").username).not.toBe(newAccount("e2e-adm").username);
  });
});
