// lib/paywall.ts — server-only helpers for the admin routes
// (app/api/paywall/admin/*): the caller's identity from their own DM token,
// the platform's Stripe proxy and Connect endpoint on the admin's own path with
// that same token, and the organization-metadata record of the paywall choice.
// The app holds no platform key: every call here carries the caller's token.
// Never import from a client component.
// Relative imports (not @/): __tests__ load this module under vitest, which
// resolves no path alias.
import { NextResponse } from "next/server";
import config from "./iblai/config";
import { APP_SLUG } from "./iblai/metadata-core";
import { PaywallRequestError, paywallSlug, type Access } from "./paywall-client";

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
  // token/verify returns the token's own user: {username, email, …}. Admin
  // rights are not checked here: the platform decides on every call the
  // routes make with this token.
  const user = body?.username ? { username: body.username, email: body.email ?? "" } : null;
  identityCache.set(dmToken, { user, at: Date.now() });
  return user;
}

/** The `Authorization: Token …` value on the request, or "". */
export function tokenFromRequest(req: Request): string {
  const auth = req.headers.get("authorization") ?? "";
  return auth.startsWith("Token ") ? auth.slice(6).trim() : "";
}

export type AdminCaller = { token: string; username: string };

/** The caller's own token and verified username, or the 401 that says why not. */
export async function adminCaller(req: Request): Promise<AdminCaller | NextResponse> {
  const token = tokenFromRequest(req);
  const user = token ? await resolveUser(token) : null;
  if (!user) return NextResponse.json({ error: "Not a platform member" }, { status: 401 });
  return { token, username: user.username };
}

export const isResponse = (x: unknown): x is NextResponse => x instanceof NextResponse;

/** Parse a JSON body; garbage is an empty object, so field checks 400 instead of crashing. */
export async function jsonBody(req: Request): Promise<Record<string, unknown>> {
  const body = await req.json().catch(() => null);
  return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
}

/** A DM/Stripe failure to pass through verbatim (status + body). */
export class PaywallUpstreamError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    super(`DM responded ${status}`);
    this.name = "PaywallUpstreamError";
  }
}

/** Parse a DM response; anything but 2xx becomes a passthrough error. */
export async function dmJson(res: Response): Promise<any> {
  const body = await res.json().catch(() => null);
  if (!res.ok)
    throw new PaywallUpstreamError(res.status, body ?? { error: `DM responded ${res.status}` });
  return body;
}

/**
 * DM statuses pass through verbatim (403 = not an organization admin, 400 = no
 * Stripe source yet or a bad return URL, 409 = already connected, 502 = Stripe
 * rejected or could not be reached, 503 = Connect not available on this
 * platform yet). A missing organization or slug is this app's own
 * misconfiguration: a loud 500 naming it. Anything else is a real bug: rethrow.
 */
export function failure(e: unknown): NextResponse {
  if (e instanceof PaywallUpstreamError) return NextResponse.json(e.body, { status: e.status });
  if (e instanceof PaywallRequestError && e.status === 0)
    return NextResponse.json({ error: e.message }, { status: 500 });
  throw e;
}

/** The organization this app is pinned to — env on the server, as in the browser. */
function org(): string {
  const key = config.mainTenantKey();
  if (!key)
    throw new PaywallRequestError(
      0,
      "NEXT_PUBLIC_MAIN_TENANT_KEY is not set, so the paywall cannot tell which organization this is.",
    );
  return key;
}

/** RequestInit with plain-object headers, so they merge by spread. */
export type DmInit = Omit<RequestInit, "headers"> & { headers?: Record<string, string> };

const stripeBase = (username: string) =>
  `${config.dmUrl()}/api/ai-mentor/orgs/${org()}` +
  `/users/${encodeURIComponent(username)}/providers/stripe`;

function dmFetchAs(token: string, url: string, init?: DmInit) {
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Token ${token}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });
}

/**
 * The platform's Stripe proxy as {username} with the caller's OWN DM token —
 * the admin rail. The platform enforces admin-only itself (403 for anyone
 * else). It runs on whichever Stripe source the platform resolves: a pasted
 * `stripe` key when one is set, else the connected account.
 */
export function dmStripeFetchAs(token: string, username: string, path: string, init?: DmInit) {
  return dmFetchAs(token, `${stripeBase(username)}/payments${path}`, init);
}

/**
 * Connect with Stripe on the admin's own path with the admin's OWN token: GET
 * the status (`source`, the publishable key and account the browser needs),
 * POST `{return_url}` for Stripe's authorize URL, DELETE to disconnect. The
 * platform decides who may (403 otherwise).
 */
export function dmConnectFetchAs(token: string, username: string, init?: DmInit) {
  return dmFetchAs(token, `${stripeBase(username)}/connect/`, init);
}

// ---------------------------------------------------------------------------
// The paywall choice, kept in the organization's PUBLIC metadata under
// apps.<slug>. The platform's metadata is an unauthenticated read with an
// admin-only, deep-merging write — so only ids, amounts and public keys live
// here, never anything secret, and every key is written (nulls included)
// because the platform cannot delete keys.
// ---------------------------------------------------------------------------

export type AppPaymentInfo = {
  version: 1;
  access: Access;
  /** Minor units (cents); null when free. Always USD. */
  amount: number | null;
  currency: "usd" | null;
  /**
   * Public by design: the Stripe source when the choice was saved. The pay
   * modal takes the live values from the platform's checkout answer; these are
   * the record.
   */
  stripe: {
    product_id: string | null;
    price_id: string | null;
    /** What Stripe.js renders the checkout with: the platform's own on a connected account, the organization's on a pasted key. */
    publishable_key: string | null;
    /** The connected Stripe account, null on a pasted key. */
    stripe_account: string | null;
  };
  updated_at: string;
  updated_by: string;
};

/** The plan name buyers see (and the Stripe price nickname). */
export const planName = (access: Access) =>
  access === "monthly" ? "Monthly access" : "One-time access";

const metadataUrl = () => `${config.dmUrl()}/api/core/orgs/${org()}/metadata/`;

/**
 * What the setup needs from the organization's metadata — a public read, no
 * credential, never cached. `current` is raw on purpose: a record the previous
 * release of this paywall wrote has `stripe` and no `access`, and its price
 * still has to be retired and its product reused.
 */
export async function readAppPaymentInfo(): Promise<{
  current: Record<string, any> | null;
  platformName: string;
  appName: string;
}> {
  const body = await dmJson(await fetch(metadataUrl(), { cache: "no-store" }));
  const apps = body?.metadata?.apps;
  const current = apps?.[paywallSlug()];
  // The name the starter's own /setup gave the app (lib/iblai/metadata.ts).
  const appName = apps?.[APP_SLUG]?.appName;
  return {
    current: current && typeof current === "object" ? current : null,
    platformName: String(body?.platform_name ?? ""),
    appName: typeof appName === "string" ? appName.trim() : "",
  };
}

/** Record the choice as the admin (their own token; the platform checks the role). */
export async function writeAppPaymentInfo(token: string, info: AppPaymentInfo): Promise<void> {
  await dmJson(
    await fetch(metadataUrl(), {
      method: "PUT",
      headers: { Authorization: `Token ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ metadata: { apps: { [paywallSlug()]: info } } }),
      cache: "no-store",
    }),
  );
}
