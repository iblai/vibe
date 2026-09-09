// lib/paywall.ts — server-only paywall helpers. Uses IBLAI_API_KEY via
// config.apiKey(); never import from a client component.
// Relative import (not @/): __tests__ load this module under vitest, which
// resolves no path alias.
import config from "./iblai/config";

export const PAYWALL_APP_SLUG = process.env.PAYWALL_APP_SLUG ?? "";

export type PaywallUser = { username: string; email: string };

// ponytail: per-lambda Map cache, ~60s TTL — cold starts just re-fetch.
const identityCache = new Map<string, { user: PaywallUser | null; at: number }>();
const IDENTITY_TTL_MS = 60_000;

/** End-user identity from their DM token — the ONLY trusted identity source. */
export async function resolveUser(dmToken: string): Promise<PaywallUser | null> {
  const hit = identityCache.get(dmToken);
  if (hit && Date.now() - hit.at < IDENTITY_TTL_MS) return hit.user;

  const res = await fetch(`${config.dmUrl()}/api/core/token/verify/`, {
    headers: { Authorization: `Token ${dmToken}` },
    cache: "no-store",
  });
  if (!res.ok) return null; // don't cache failures — token may be mid-refresh

  const body = await res.json().catch(() => null);
  // token/verify returns the token's own user: {username, email, …}. Platform
  // membership is enforced server-side by the payments endpoints (404 for
  // non-members), so there is no client-side membership check to get wrong.
  const user = body?.username ? { username: body.username, email: body.email ?? "" } : null;
  identityCache.set(dmToken, { user, at: Date.now() });
  return user;
}

/** Extract `Authorization: Token …` from the request and resolve the member. */
export async function userFromRequest(req: Request): Promise<PaywallUser | null> {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Token ") ? auth.slice(6).trim() : "";
  return token ? resolveUser(token) : null;
}

/** Call a DM paywall endpoint as {username} with the org-wide Api-Token. */
export function dmPaywallFetch(username: string, path: string, init?: RequestInit) {
  const base =
    `${config.dmUrl()}/api/ai-mentor/orgs/${config.mainTenantKey()}` +
    `/users/${encodeURIComponent(username)}/providers/stripe/payments`;
  return fetch(`${base}${path}`, {
    ...init,
    headers: {
      Authorization: `Api-Token ${config.apiKey()}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });
}
