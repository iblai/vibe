import { describe, it, expect } from "vitest";
import { mergeAppNamespace, readAppNamespace, slugify } from "../lib/iblai/metadata-core";

/**
 * lib/iblai/metadata-core.ts — the namespace rules both stores rely on:
 * everything this app writes lives under `apps.<slug>`, and a merge never
 * drops keys that belong to the OS or to other apps (the org metadata PUT
 * replaces the whole object, so this is what keeps it safe).
 */

describe("slugify", () => {
  it("turns an app name into a stable key", () => {
    expect(slugify("Acme Support")).toBe("acme-support");
    expect(slugify("  My  App!! ")).toBe("my-app");
    expect(slugify("")).toBe("app");
  });
});

describe("readAppNamespace", () => {
  it("returns this app's object, or {} when absent or malformed", () => {
    expect(readAppNamespace(null)).toEqual({});
    expect(readAppNamespace({})).toEqual({});
    expect(readAppNamespace({ apps: { other: { x: 1 } } })).toEqual({});
    expect(readAppNamespace({ apps: { "vibe-starter": "nope" } })).toEqual({});
    expect(readAppNamespace({ apps: { "vibe-starter": { theme: "dark" } } })).toEqual({ theme: "dark" });
  });
});

describe("mergeAppNamespace", () => {
  const os = {
    overall_default_mentor: "abc",
    help_center_url: "https://docs.ibl.ai",
    auth_web_mentorai: { title: "Acme" },
    apps: { "vibe-agent": { access: "monthly" }, "vibe-starter": { theme: "light", onboardingStep: 2 } },
  };

  it("merges the patch into this app's namespace only", () => {
    const out = mergeAppNamespace(os, { theme: "dark" });
    expect(out.apps).toEqual({
      "vibe-agent": { access: "monthly" },
      "vibe-starter": { theme: "dark", onboardingStep: 2 },
    });
  });

  it("preserves every key that is not ours (the OS's own settings, other apps)", () => {
    const out = mergeAppNamespace(os, { theme: "dark" });
    expect(out.overall_default_mentor).toBe("abc");
    expect(out.help_center_url).toBe("https://docs.ibl.ai");
    expect(out.auth_web_mentorai).toEqual({ title: "Acme" });
    expect((out.apps as any)["vibe-agent"]).toEqual({ access: "monthly" });
  });

  it("removes only the keys asked for", () => {
    const out = mergeAppNamespace(os, {}, ["onboardingStep"]);
    expect((out.apps as any)["vibe-starter"]).toEqual({ theme: "light" });
  });

  it("does not mutate the input", () => {
    const before = JSON.stringify(os);
    mergeAppNamespace(os, { theme: "dark" }, ["onboardingStep"]);
    expect(JSON.stringify(os)).toBe(before);
  });

  it("starts from scratch when the store is empty", () => {
    expect(mergeAppNamespace(undefined, { a: 1 })).toEqual({ apps: { "vibe-starter": { a: 1 } } });
  });
});
