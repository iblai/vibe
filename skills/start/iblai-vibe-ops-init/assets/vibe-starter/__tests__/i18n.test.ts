import { describe, it, expect } from "vitest";
import { SUPPORTED_LOCALES, resolveLocale } from "../i18n/config";
import en from "../messages/en.json";
import es from "../messages/es.json";
import fr from "../messages/fr.json";
import zh from "../messages/zh.json";

/** i18n/config.ts + messages/ — cookie values resolve, catalogs stay in parity. */

const flat = (o: object, p = ""): string[] =>
  Object.entries(o).flatMap(([k, v]) =>
    typeof v === "object" ? flat(v, `${p}${k}.`) : [`${p}${k}`],
  );

describe("resolveLocale", () => {
  it("accepts every supported locale and its region/script variants", () => {
    for (const l of SUPPORTED_LOCALES) expect(resolveLocale(l)).toBe(l);
    expect(resolveLocale("fr-FR")).toBe("fr");
    expect(resolveLocale("es_MX")).toBe("es");
    expect(resolveLocale("zh-CN")).toBe("zh");
    expect(resolveLocale("zh-Hans")).toBe("zh");
    expect(resolveLocale(" EN-us ")).toBe("en");
  });

  it("falls back to English", () => {
    expect(resolveLocale(undefined)).toBe("en");
    expect(resolveLocale("")).toBe("en");
    expect(resolveLocale("de-DE")).toBe("en");
  });
});

describe("messages", () => {
  it("has one catalog per locale with the same keys", () => {
    const catalogs: Record<string, object> = { en, es, fr, zh };
    expect(Object.keys(catalogs).sort()).toEqual([...SUPPORTED_LOCALES].sort());
    const keys = flat(en).sort();
    for (const l of SUPPORTED_LOCALES)
      expect(flat(catalogs[l]).sort()).toEqual(keys);
  });
});
