/**
 * Supported UI locales.
 *
 * ibl.ai sets a shared language cookie on the registrable parent domain so a
 * locale chosen in any platform app carries across its subdomains. Reading the
 * same cookie here means an app scaffolded from this starter joins that
 * contract instead of inventing its own — see `iblai/os`'s `i18n/config.ts`,
 * which this mirrors.
 *
 * Add a locale by extending SUPPORTED_LOCALES and adding the matching
 * `messages/<locale>.json`.
 */
export const SUPPORTED_LOCALES = ["en", "fr"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** This app's own language cookie (no URL routing). */
export const LOCALE_COOKIE = "NEXT_LOCALE";

/** Shared platform language preference, set on the parent domain. */
export const OPENEDX_LOCALE_COOKIE = "openedx-language-preference";

/** Labels for a language selector. */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  fr: "Français",
};

/**
 * Narrow an arbitrary string to a supported locale, falling back to default.
 * Normalizes region/script subtags so platform codes resolve too, e.g.
 * `fr-FR`/`fr_CA` → `fr`, `en-US` → `en`.
 */
export function resolveLocale(value: string | undefined | null): Locale {
  if (!value) return DEFAULT_LOCALE;
  const v = value.toLowerCase().trim();
  const supported = SUPPORTED_LOCALES as readonly string[];
  if (supported.includes(v)) return v as Locale;
  const base = v.split(/[-_]/)[0];
  if (supported.includes(base)) return base as Locale;
  return DEFAULT_LOCALE;
}
