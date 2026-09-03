
/**
 * ibl.ai runtime configuration.
 *
 * Hosted-iblai.app defaults live in code: with no env vars at all, every
 * service routes through https://api.iblai.app. `.env.local` (copied from
 * `.env.example`) holds the tenant key, IBLAI_API_KEY, and any self-hosted
 * overrides.
 *
 * Supports two modes:
 *   1. Consolidated API (default on hosted iblai.app): NEXT_PUBLIC_API_BASE_URL
 *      is a single origin; LMS, DM, and AXD endpoints are derived as /lms,
 *      /dm, /axd path prefixes.
 *   2. Distributed (self-hosted only): set NEXT_PUBLIC_PLATFORM_BASE_DOMAIN
 *      to your own domain and leave NEXT_PUBLIC_API_BASE_URL unset — each
 *      service resolves to its own subdomain (learn.{domain},
 *      base.manager.{domain}). Not available on hosted iblai.app: its
 *      per-service hosts reject the session tokens the Auth SPA issues
 *      (iblai/vibe#155).
 *
 * Priority: runtime window.__ENV__ → build-time process.env → fallback.
 */

// Static env declarations — Next.js inlines NEXT_PUBLIC_* values at build
// time only when they appear as literal process.env.NEXT_PUBLIC_* references.
const env = {
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  NEXT_PUBLIC_AUTH_URL: process.env.NEXT_PUBLIC_AUTH_URL,
  NEXT_PUBLIC_BASE_WS_URL: process.env.NEXT_PUBLIC_BASE_WS_URL,
  NEXT_PUBLIC_LEGACY_LMS_URL: process.env.NEXT_PUBLIC_LEGACY_LMS_URL,
  NEXT_PUBLIC_MFE_URL: process.env.NEXT_PUBLIC_MFE_URL,
  NEXT_PUBLIC_PLATFORM_BASE_DOMAIN:
    process.env.NEXT_PUBLIC_PLATFORM_BASE_DOMAIN,
  NEXT_PUBLIC_MAIN_TENANT_KEY: process.env.NEXT_PUBLIC_MAIN_TENANT_KEY,
  NEXT_PUBLIC_TAURI_CUSTOM_SCHEME: process.env.NEXT_PUBLIC_TAURI_CUSTOM_SCHEME,
};

declare global {
  interface Window {
    __ENV__?: Record<string, string>;
  }
}

const runtimeEnv = () =>
  typeof window !== "undefined" ? window.__ENV__ || {} : {};

const getEnv = (key: keyof typeof env, fallback = ""): string =>
  runtimeEnv()[key] ?? env[key] ?? fallback;

const domain = () =>
  getEnv("NEXT_PUBLIC_PLATFORM_BASE_DOMAIN", "iblai.app");

// With no explicit NEXT_PUBLIC_API_BASE_URL, hosted iblai.app always routes
// through the consolidated API — its per-service subdomains reject the
// session tokens the Auth SPA issues (iblai/vibe#155). A non-iblai.app
// domain with no API base opts into distributed mode.
const apiBase = () => {
  const explicit = getEnv("NEXT_PUBLIC_API_BASE_URL");
  if (explicit) return explicit;
  return domain() === "iblai.app" ? "https://api.iblai.app" : "";
};

const config = {
  authUrl: () => getEnv("NEXT_PUBLIC_AUTH_URL", `https://login.${domain()}`),

  lmsUrl: () => {
    const base = apiBase();
    if (base) return `${base}/lms`;
    return `https://learn.${domain()}`;
  },

  dmUrl: () => {
    const base = apiBase();
    if (base) return `${base}/dm`;
    return `https://base.manager.${domain()}`;
  },

  axdUrl: () => {
    const base = apiBase();
    if (base) return `${base}/axd`;
    return `https://base.manager.${domain()}`;
  },

  // Dedicated edX LMS host (learn.*): edX page routes (xblock iframes,
  // bookmarks, instructor) and the data layer's legacy-LMS endpoints live
  // here, NOT under the consolidated API base.
  legacyLmsUrl: () =>
    getEnv("NEXT_PUBLIC_LEGACY_LMS_URL", `https://learn.${domain()}`),

  // Learner micro-frontend (progress, dates, discussions pages).
  mfeUrl: () =>
    getEnv("NEXT_PUBLIC_MFE_URL", `https://apps.learn.${domain()}`),

  baseWsUrl: () =>
    getEnv("NEXT_PUBLIC_BASE_WS_URL", `wss://asgi.data.${domain()}`),

  wsUrl: () =>
    getEnv("NEXT_PUBLIC_BASE_WS_URL", `wss://asgi.data.${domain()}`),

  mainTenantKey: () => getEnv("NEXT_PUBLIC_MAIN_TENANT_KEY", ""),
  tauriCustomScheme: () => getEnv("NEXT_PUBLIC_TAURI_CUSTOM_SCHEME", ""),
  platformBaseDomain: () => domain(),

  // Server-only: IBLAI_API_KEY is a secret and not NEXT_PUBLIC_*, so Next.js
  // never inlines it into the client bundle — in the browser this returns "".
  // Use it from route handlers / server components for platform API calls
  // (`Authorization: Api-Token <key>`; on the OpenAI-compatible endpoints,
  // `https://asgi.data.<domain>/api/ai-mentor/orgs/<tenant>/v1/*`, the same
  // key is also a standard OpenAI `Bearer` api key). Deliberately not routed
  // through getEnv/window.__ENV__, which are client-visible.
  apiKey: () => process.env.IBLAI_API_KEY ?? "",
};

export default config;
export { getEnv };
