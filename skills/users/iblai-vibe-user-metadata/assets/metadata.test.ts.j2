import { describe, it, expect } from "vitest";
import { APP_SLUG, mergeAppNamespace, readAppNamespace } from "../lib/iblai/metadata-core";

/**
 * lib/iblai/metadata-core.ts — the namespace rules both stores rely on:
 * everything this app writes lives under `apps.<slug>`, and a merge never
 * drops keys that belong to the OS or to other apps (the org metadata PUT
 * replaces the whole object, so this is what keeps it safe).
 */

// Another app's key: never a slug, so it cannot collide with APP_SLUG.
const OTHER = "other_app";

describe("APP_SLUG", () => {
  it("is a lowercase slug, as /iblai-vibe-ops-init sets it", () => {
    expect(APP_SLUG).toMatch(/^[a-z0-9][a-z0-9-]{0,63}$/);
  });
});

describe("readAppNamespace", () => {
  it("returns this app's object, or {} when absent or malformed", () => {
    expect(readAppNamespace(null)).toEqual({});
    expect(readAppNamespace({})).toEqual({});
    expect(readAppNamespace({ apps: { [OTHER]: { x: 1 } } })).toEqual({});
    expect(readAppNamespace({ apps: { [APP_SLUG]: "nope" } })).toEqual({});
    expect(readAppNamespace({ apps: { [APP_SLUG]: { theme: "dark" } } })).toEqual({ theme: "dark" });
  });
});

describe("mergeAppNamespace", () => {
  const os = {
    overall_default_mentor: "abc",
    help_center_url: "https://docs.ibl.ai",
    auth_web_mentorai: { title: "Acme" },
    apps: { [OTHER]: { access: "monthly" }, [APP_SLUG]: { theme: "light", onboardingStep: 2 } },
  };

  it("merges the patch into this app's namespace only", () => {
    const out = mergeAppNamespace(os, { theme: "dark" });
    expect(out.apps).toEqual({
      [OTHER]: { access: "monthly" },
      [APP_SLUG]: { theme: "dark", onboardingStep: 2 },
    });
  });

  it("preserves every key that is not ours (the OS's own settings, other apps)", () => {
    const out = mergeAppNamespace(os, { theme: "dark" });
    expect(out.overall_default_mentor).toBe("abc");
    expect(out.help_center_url).toBe("https://docs.ibl.ai");
    expect(out.auth_web_mentorai).toEqual({ title: "Acme" });
    expect((out.apps as any)[OTHER]).toEqual({ access: "monthly" });
  });

  it("removes only the keys asked for", () => {
    const out = mergeAppNamespace(os, {}, ["onboardingStep"]);
    expect((out.apps as any)[APP_SLUG]).toEqual({ theme: "light" });
  });

  it("does not mutate the input", () => {
    const before = JSON.stringify(os);
    mergeAppNamespace(os, { theme: "dark" }, ["onboardingStep"]);
    expect(JSON.stringify(os)).toBe(before);
  });

  it("starts from scratch when the store is empty", () => {
    expect(mergeAppNamespace(undefined, { a: 1 })).toEqual({ apps: { [APP_SLUG]: { a: 1 } } });
  });
});
