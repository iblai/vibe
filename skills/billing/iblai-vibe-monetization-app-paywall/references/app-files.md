# App files — complete drop-in bodies

Copy these verbatim into the app. Only `NEXT_PUBLIC_PAYWALL_APP_SLUG` in `.env.local` is
per-app; the price and the Stripe account are the admin's answers at `/paywall/setup`.

> **Prefer the ready-made copies**: the same files (plus their unit tests)
> ship as ops-init assets at
> `skills/start/iblai-vibe-ops-init/assets/stripe-components/`, where the render
> gate typechecks them and runs their tests against vibe-starter — SKILL.md
> Step 1 copies from there. This reference is the fallback for installs whose
> staged skills carry no `assets/`; keep it a byte mirror of the assets, never
> a second truth.

## 1. `lib/paywall-client.ts` (browser; the signed-in user's own session token)

```ts
// lib/paywall-client.ts — the browser side of the paywall. Two rails, one
// credential: the signed-in member's own DM token (`localStorage.dm_token`,
// written by the SDK at sign-in). The buyer rail goes straight from the
// browser to the platform on the member's own username path (what is for sale
// from the organization's public metadata, the embedded checkout, the access
// check); the admin rail is the app's own routes under /api/paywall/admin/*,
// which forward that same token. The app holds no platform key. The admin
// routes import the pure pieces (the slug, the setup texts); everything that
// touches a browser global does so inside a function.
// Relative imports (not @/): __tests__ load this module under vitest, which
// resolves no path alias.
import config from "./iblai/config";
import { resolveAppTenant } from "./iblai/tenant";

export type Access = "free" | "one_time" | "monthly";

export const ACCESS_VALUES: readonly Access[] = ["free", "one_time", "monthly"];

export type CataloguePrice = {
  id: string;
  /** Minor units (cents); null on a record written before the setup screen. */
  unitAmount: number | null;
  currency: string;
  interval: "month" | null;
};

export type Catalogue = {
  /** Something is for sale: a member has to pay to get in. */
  paywall: boolean;
  /** An admin has answered the setup question. */
  decided: boolean;
  settings: { access: Access; amount: number | null } | null;
  price: CataloguePrice | null;
};

/** The platform's answer to a checkout: what Stripe.js renders in the pay modal. */
export type CheckoutSession = {
  client_secret: string;
  session_id: string;
  /** The platform's own publishable key on a connected account, the organization's on a pasted key. */
  publishable_key: string;
  /** The connected Stripe account, null on a pasted key. Always passed to Stripe.js as given. */
  stripe_account: string | null;
};

export type AccessView = { has_access: boolean };

/** The organization's Stripe source right now (GET /api/paywall/admin/connect). */
export type ConnectStatus = {
  connected: boolean;
  /** Whether a NEW connect can be started — false while the platform has nowhere to keep its state. */
  available: boolean;
  key_credential_set: boolean;
  /** A pasted `stripe` key wins, else the connected account, else nothing. */
  source: "key" | "connected" | null;
  /** "" whenever there is no source — so it is only news once there is one. */
  publishable_key: string;
  stripe_account: string | null;
  account_id?: string;
  livemode?: boolean;
  charges_enabled?: boolean;
  details_submitted?: boolean;
  business_name?: string | null;
  email?: string | null;
  connected_at?: string;
  stale?: boolean;
};

/** A failed paywall request; status 0 means it was never sent — the message says what is missing. */
export class PaywallRequestError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "PaywallRequestError";
  }
}

const SLUG = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * What this app is called on the platform: its key under `apps.<slug>` in the
 * organization's metadata, the `metadata.app` tag on its Stripe product and the
 * `app` of every checkout and access check. Pinned once in
 * NEXT_PUBLIC_PAYWALL_APP_SLUG and never changed: payments are recorded under
 * it, so a new value strands everyone who paid. No default — a shared one would
 * give two apps on one organization each other's payments.
 */
export function paywallSlug(): string {
  const slug = (process.env.NEXT_PUBLIC_PAYWALL_APP_SLUG ?? "").trim();
  if (SLUG.test(slug)) return slug;
  throw new PaywallRequestError(
    0,
    slug
      ? `NEXT_PUBLIC_PAYWALL_APP_SLUG must be 1–64 letters, digits, "-" or "_" — "${slug}" is not.`
      : "NEXT_PUBLIC_PAYWALL_APP_SLUG is not set, so the paywall cannot tell which app this is.",
  );
}

export const dmToken = () =>
  typeof window === "undefined" ? "" : (localStorage.getItem("dm_token") ?? "");

/** The signed-in username the SDK stores at sign-in. */
export function readUsername(): string {
  if (typeof window === "undefined") return "";
  try {
    const parsed = JSON.parse(localStorage.getItem("userData") ?? "{}");
    return parsed.user_nicename ?? parsed.username ?? "";
  } catch {
    return "";
  }
}

/** The platform's message for a failed request, or a generic one. */
export const errorMessage = (e: unknown) =>
  e instanceof Error ? e.message : "Something went wrong; try again.";

/** The message with its status, for errors a person has to act on. */
export const errorWithStatus = (e: unknown) =>
  e instanceof PaywallRequestError && e.status ? `${e.message} (${e.status})` : errorMessage(e);

/** A response's JSON; a non-2xx throws the platform's own message (error/detail), never swallowed. */
async function answer<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => null);
  if (!res.ok)
    throw new PaywallRequestError(
      res.status,
      data?.error ?? data?.detail ?? `Request failed (${res.status})`,
    );
  return data as T;
}

/**
 * fetch() as the signed-in member — the app's own admin routes (a path) or the
 * platform itself (an absolute URL) — with `Authorization: Token`; a non-2xx
 * throws the server's message.
 */
export async function paywallFetch<T = unknown>(
  path: string,
  init: Omit<RequestInit, "headers"> & { headers?: Record<string, string>; json?: unknown } = {},
): Promise<T> {
  const token = dmToken();
  if (!token) throw new PaywallRequestError(0, "Sign in again: this session has no token.");
  const { json, headers, ...rest } = init;
  const res = await fetch(path, {
    ...rest,
    headers: {
      Authorization: `Token ${token}`,
      ...(json !== undefined && { "Content-Type": "application/json" }),
      ...headers,
    },
    ...(json !== undefined && { body: JSON.stringify(json) }),
  });
  return answer<T>(res);
}

/** The organization this app is pinned to. */
function org(): string {
  const key = resolveAppTenant();
  if (!key) throw new PaywallRequestError(0, "Sign in again: this session has no organization.");
  return key;
}

/** The platform's paywall on the member's OWN path: another user's path is a 403 by design. */
function paywallBase(): string {
  const me = readUsername();
  if (!me) throw new PaywallRequestError(0, "Sign in again: this session has no username.");
  return (
    `${config.dmUrl()}/api/ai-mentor/orgs/${org()}` +
    `/users/${encodeURIComponent(me)}/providers/stripe/payments/paywall`
  );
}

const CATALOGUE_TTL_MS = 60_000;
// ponytail: 60 s module cache; the setup screen invalidates after a save.
let catalogueCache: { at: number; value: Promise<Catalogue> } | null = null;

export function invalidateCatalogue(): void {
  catalogueCache = null;
}

/**
 * apps.<slug> from the organization's public metadata — no credential. A record
 * written before the setup screen (the skill used to record `stripe` alone)
 * still sells its price: only an explicit free answer means nothing is for
 * sale. Such a record is not `decided`, so an admin is still asked.
 */
export function fetchCatalogue(): Promise<Catalogue> {
  if (catalogueCache && Date.now() - catalogueCache.at < CATALOGUE_TTL_MS)
    return catalogueCache.value;
  const value = (async (): Promise<Catalogue> => {
    const slug = paywallSlug();
    const body = await answer<any>(
      await fetch(`${config.dmUrl()}/api/core/orgs/${org()}/metadata/`, { cache: "no-store" }),
    );
    const entry = body?.metadata?.apps?.[slug];
    const info = entry && typeof entry === "object" ? entry : null;
    const decided =
      !!info &&
      ACCESS_VALUES.includes(info.access) &&
      !!info.stripe &&
      typeof info.stripe === "object";
    const priceId = info && info.access !== "free" ? info.stripe?.price_id : null;
    const amount = decided && typeof info.amount === "number" ? info.amount : null;
    return {
      paywall: info?.access === "one_time" || info?.access === "monthly" || !!priceId,
      decided,
      settings: decided ? { access: info.access, amount } : null,
      price: priceId
        ? {
            id: String(priceId),
            unitAmount: amount,
            currency: String(info.currency ?? "usd"),
            interval: info.access === "monthly" ? "month" : null,
          }
        : null,
    };
  })();
  catalogueCache = { at: Date.now(), value };
  value.catch(() => {
    catalogueCache = null;
  });
  return value;
}

/**
 * Mint the member's own embedded Checkout Session on the organization's Stripe
 * source. Card fields only: each further method Stripe's dynamic list would add
 * is a row in the embedded form, and the modal has to fit a laptop screen.
 */
export async function startCheckout(priceId: string): Promise<CheckoutSession> {
  return paywallFetch<CheckoutSession>(`${paywallBase()}/checkout/`, {
    method: "POST",
    json: {
      app: paywallSlug(),
      price_id: priceId,
      ui_mode: "embedded",
      payment_method_types: ["card"],
    },
  });
}

/** The platform's verdict for the signed-in member; with sessionId, the session they just completed. */
export async function checkAccess(sessionId?: string): Promise<AccessView> {
  const query = new URLSearchParams({
    app: paywallSlug(),
    ...(sessionId && { session_id: sessionId }),
  });
  return paywallFetch<AccessView>(`${paywallBase()}/access/?${query}`);
}

const SETUP_OK_KEY = "paywall_setup_ok_at";
const SETUP_TTL_MS = 600_000;

/** This admin session already knows the paywall question has been answered. */
export function setupSettled(): boolean {
  return Date.now() - Number(sessionStorage.getItem(SETUP_OK_KEY) ?? 0) < SETUP_TTL_MS;
}
export const markSetupDone = () => sessionStorage.setItem(SETUP_OK_KEY, String(Date.now()));

/** "decided" (a choice exists), "undecided" (first run), "unknown" (hiccup). */
export async function checkPaywallSetup(): Promise<"decided" | "undecided" | "unknown"> {
  try {
    const { decided } = await fetchCatalogue();
    if (!decided) return "undecided";
    markSetupDone();
    return "decided";
  } catch (e) {
    console.error("[paywall] setup check failed:", e);
    return "unknown";
  }
}

const ACCESS_TTL_MS = 60_000;
let accessCache: { at: number; verdict: Promise<boolean> } | null = null;

/** A payment just went through: the next ask goes to the platform. */
export function resetPaidAccess(): void {
  accessCache = null;
}

/**
 * Does the signed-in member get in? Nothing for sale (free, or not decided yet)
 * lets everyone in without asking the platform; else the platform answers, once
 * per minute (it caches its own for as long, so a lapse shows within that).
 * Only an explicit `has_access: true` grants, and a refused or failed request
 * rejects, so the caller can say so: never a silent pass.
 */
export function hasPaidAccess(): Promise<boolean> {
  if (accessCache && Date.now() - accessCache.at < ACCESS_TTL_MS) return accessCache.verdict;
  const verdict = fetchCatalogue().then((c) =>
    c.paywall ? checkAccess().then((a) => a?.has_access === true) : true,
  );
  accessCache = { at: Date.now(), verdict };
  verdict.catch(() => {
    accessCache = null;
  });
  return verdict;
}

/** "Already paid?": forget the verdict held here and ask the platform again. */
export function restoreAccess(): Promise<boolean> {
  resetPaidAccess();
  return hasPaidAccess();
}

/** "$29 a month" or "$49 once"; "" when the amount is unknown (a record from before the setup screen). */
export function priceText(price: CataloguePrice | null): string {
  if (price?.unitAmount == null) return "";
  const amount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: price.currency.toUpperCase(),
    minimumFractionDigits: price.unitAmount % 100 ? 2 : 0,
  }).format(price.unitAmount / 100);
  return price.interval === "month" ? `${amount} a month` : `${amount} once`;
}

/**
 * What stops a paid plan on this Stripe source, or "" when nothing does. A
 * missing publishable key is only news once there is a source to have one: the
 * platform answers "" whenever nothing is linked. The setup route refuses a
 * paid save with the same words.
 */
export function sourceWarning(
  status: Pick<ConnectStatus, "source" | "publishable_key"> | null,
): string {
  if (!status?.source || status.publishable_key) return "";
  return status.source === "key"
    ? "This organization’s Stripe key has no publishable key beside it. Add its pk_… to the organization’s stripe credential on ibl.ai, then save again."
    : "The platform has no publishable key for connected accounts yet; contact ibl.ai support.";
}

const CONNECT_FAILURES: Record<string, string> = {
  access_denied: "You cancelled on Stripe.",
  already_connected: "A Stripe account is already connected.",
  account_linked_elsewhere: "That Stripe account is already connected to another organization.",
  not_configured: "Connect with Stripe is not set up on ibl.ai’s side yet; contact ibl.ai support.",
  stripe_unreachable: "Stripe could not be reached. Try again.",
  // Stripe refused the one-time code at the platform's exchange: a code spent
  // twice, or — when it repeats — ibl.ai's Connect credentials mixing test and
  // live mode. A retry cannot fix the second, so say who can, and the way round.
  invalid_grant:
    "Stripe refused to finish linking (invalid_grant). If it happens again, contact ibl.ai support, or add a restricted key and its publishable key as this organization’s stripe credential instead.",
  oauth_error: "Stripe did not finish linking. Try again.",
  platform_missing: "This organization no longer exists on the platform.",
};

/** Plain words for the platform's `?stripe_connect=error&reason=` codes; unknown ones print raw. */
export const connectFailure = (reason: string) =>
  CONNECT_FAILURES[reason] ?? `Stripe connection failed (${reason || "unknown"}).`;

/** The admin's message for a failed setup call. */
export function setupMessage(e: unknown): string {
  if (e instanceof PaywallRequestError) {
    if (e.status === 403) return "Only organization admins can set up payments.";
    if (e.status === 502)
      return `${e.message} (502). Stripe answered with an error for this organization’s account; check it in Stripe and try again.`;
  }
  return errorMessage(e);
}
```

## 2. `lib/paywall.ts` (server-only)

```ts
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
```

## 3. `app/api/paywall/admin/setup/route.ts`

```ts
import { NextRequest, NextResponse } from "next/server";
// Relative imports (not @/): __tests__ invoke this handler under vitest.
import config from "../../../../../lib/iblai/config";
import {
  ACCESS_VALUES,
  paywallSlug,
  sourceWarning,
  type Access,
} from "../../../../../lib/paywall-client";
import {
  PaywallUpstreamError,
  adminCaller,
  dmConnectFetchAs,
  dmJson,
  dmStripeFetchAs,
  failure,
  isResponse,
  jsonBody,
  planName,
  readAppPaymentInfo,
  writeAppPaymentInfo,
  type AppPaymentInfo,
  type DmInit,
} from "../../../../../lib/paywall";

/**
 * The whole paywall setup in one call: free, one-time or monthly (USD). Every
 * platform call carries the admin's OWN token, so the platform decides who may
 * do this (403 otherwise). Paid order: ask the platform which Stripe source it
 * runs on (none, or one without a publishable key → 400, nothing touched) →
 * retire the previous price (a 404 is nothing to retire: after a reconnect it
 * lives on another account) → reuse the product tagged for this app, or create
 * one → create the price → record the choice, with that source's publishable
 * key and account, in the organization's metadata. Free makes ZERO Stripe or
 * connect calls, ever — it only records the choice — because free must never
 * need a Stripe account. A client Idempotency-Key makes a retried submit safe.
 */
export async function POST(req: NextRequest) {
  const caller = await adminCaller(req);
  if (isResponse(caller)) return caller;
  const { access, amount } = await jsonBody(req);
  if (!ACCESS_VALUES.includes(access as Access))
    return NextResponse.json(
      { error: "access must be free, one_time or monthly" },
      { status: 400 },
    );
  const paid = access !== "free";
  if (paid && (!Number.isInteger(amount) || (amount as number) <= 0))
    return NextResponse.json(
      { error: "amount must be a positive integer (cents)" },
      { status: 400 },
    );

  const key = req.headers.get("idempotency-key");
  const idem = (suffix: string): Record<string, string> =>
    key ? { "Idempotency-Key": `${key}-${suffix}` } : {};
  const stripe = (path: string, init?: DmInit) =>
    dmStripeFetchAs(caller.token, caller.username, path, init).then(dmJson);

  try {
    const slug = paywallSlug();
    const { current, platformName, appName } = await readAppPaymentInfo();
    // The organization's Stripe source right now: what the product and price
    // are created on, and whose publishable key and account the record carries.
    const source = paid
      ? await dmJson(await dmConnectFetchAs(caller.token, caller.username))
      : null;
    if (paid && !source?.source)
      return NextResponse.json({ error: "Connect a Stripe account first" }, { status: 400 });
    // Embedded checkout renders with the source's publishable key: recording a
    // paid plan without one would let every member's checkout fail instead.
    const blocked = paid ? sourceWarning(source) : "";
    if (blocked) return NextResponse.json({ error: blocked }, { status: 400 });

    // Raw, not validated: the record the previous release wrote has no `access`.
    const recorded = current?.stripe && typeof current.stripe === "object" ? current.stripe : {};
    let productId: string | null = recorded.product_id ? String(recorded.product_id) : null;
    let priceId: string | null = null;

    if (paid) {
      // 1. The previous price stops being sellable. Paid only: archiving needs
      //    the Stripe source, which free must never require. A price left
      //    behind by a paid → free switch stays active on Stripe but is never
      //    sold — members can buy only the recorded price_id (null for free).
      if (recorded.price_id) {
        try {
          await stripe(`/prices/${encodeURIComponent(String(recorded.price_id))}/`, {
            method: "POST",
            headers: idem("archive"),
            body: JSON.stringify({ active: false }),
          });
        } catch (e) {
          // Gone (another Stripe account after a reconnect, or deleted):
          // nothing to retire. Anything else is real.
          if (!(e instanceof PaywallUpstreamError && e.status === 404)) throw e;
        }
      }
      // 2. The product: reuse ours while it is still active and tagged, else
      //    create one, named after the app — what Stripe's checkout shows.
      if (productId) {
        let product: any = null;
        try {
          product = await stripe(`/products/${encodeURIComponent(productId)}/`);
        } catch (e) {
          if (!(e instanceof PaywallUpstreamError && e.status === 404)) throw e;
        }
        if (product?.active === false || product?.metadata?.app !== slug) productId = null;
      }
      if (!productId) {
        const product = await stripe("/products/", {
          method: "POST",
          headers: idem("product"),
          body: JSON.stringify({
            name: appName || config.appName() || platformName || slug,
            metadata: { app: slug },
          }),
        });
        productId = String(product.id);
      }
      // 3. The price. USD only; monthly is a subscription.
      const price = await stripe("/prices/", {
        method: "POST",
        headers: idem("price"),
        body: JSON.stringify({
          product: productId,
          unit_amount: amount,
          currency: "usd",
          nickname: planName(access as Access),
          ...(access === "monthly" && { recurring: { interval: "month" } }),
        }),
      });
      priceId = String(price.id);
    }

    // 4. Record the choice, nulls included: the platform merges and cannot
    //    delete keys, so a price left out would stay recorded — and for sale.
    const info: AppPaymentInfo = {
      version: 1,
      access: access as Access,
      amount: paid ? (amount as number) : null,
      currency: paid ? "usd" : null,
      stripe: {
        product_id: productId,
        price_id: priceId,
        publishable_key: (paid && source.publishable_key) || null,
        stripe_account: (paid && source.stripe_account) || null,
      },
      updated_at: new Date().toISOString(),
      updated_by: caller.username,
    };
    await writeAppPaymentInfo(caller.token, info);
    return NextResponse.json({ info });
  } catch (e) {
    return failure(e);
  }
}
```

## 4. `app/api/paywall/admin/connect/route.ts`

```ts
import { NextRequest, NextResponse } from "next/server";
// Relative imports (not @/): __tests__ invoke this handler under vitest.
import {
  adminCaller,
  dmConnectFetchAs,
  dmJson,
  failure,
  isResponse,
  jsonBody,
  type DmInit,
} from "../../../../../lib/paywall";

/**
 * Connect with Stripe, relayed: the admin's OWN token goes to the platform's
 * connect endpoint on their own path, and the platform decides who may (403
 * otherwise). GET the status, POST `{return_url}` for Stripe's authorize URL,
 * DELETE to disconnect. Statuses and bodies pass through verbatim (a 409
 * "already connected", a 503 "not available" and a 502 "Stripe unreachable"
 * are the admin's to read), a 204 as a 204.
 */
async function relay(req: NextRequest, init?: DmInit) {
  const caller = await adminCaller(req);
  if (isResponse(caller)) return caller;
  try {
    const res = await dmConnectFetchAs(caller.token, caller.username, init);
    if (res.status === 204) return new NextResponse(null, { status: 204 });
    return NextResponse.json(await dmJson(res));
  } catch (e) {
    return failure(e);
  }
}

export async function GET(req: NextRequest) {
  return relay(req);
}

export async function POST(req: NextRequest) {
  const { return_url } = await jsonBody(req);
  return relay(req, { method: "POST", body: JSON.stringify({ return_url }) });
}

export async function DELETE(req: NextRequest) {
  return relay(req, { method: "DELETE" });
}
```

## 5. `components/paywall-gate.tsx`

```tsx
"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LoadingScreen } from "@/components/loading-screen";
import { isTenantAdmin } from "@/lib/iblai/tenant";
import {
  checkPaywallSetup,
  errorWithStatus,
  hasPaidAccess,
  setupSettled,
} from "@/lib/paywall-client";

/**
 * Wraps the (app) group. An organization admin is never charged: they go
 * straight in, and — one quiet check per session — an admin who has not
 * answered the paywall question yet is taken to it, whichever page they opened.
 * Everyone else goes in without a Stripe call while nothing is for sale;
 * otherwise the platform's verdict lets them in or sends them to /paywall. A
 * check that fails is shown with the platform's words, never a silent pass.
 */
export function PaywallGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  // Read once on the client: the providers hold this tree until mounted.
  const [admin] = useState(isTenantAdmin);
  const [state, setState] = useState<"checking" | "in" | "failed">(admin ? "in" : "checking");
  const [error, setError] = useState("");

  useEffect(() => {
    if (admin) {
      if (!setupSettled())
        void checkPaywallSetup().then((s) => {
          if (s === "undecided") router.replace("/paywall/setup");
        });
      return;
    }
    if (state !== "checking") return;
    let cancelled = false;
    hasPaidAccess()
      .then((ok) => {
        if (cancelled) return;
        if (ok) setState("in");
        else router.replace("/paywall");
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(errorWithStatus(e));
        setState("failed");
      });
    return () => {
      cancelled = true;
    };
  }, [admin, state, router]);

  if (state === "checking") return <LoadingScreen className="min-h-0 flex-1" />;
  if (state === "failed")
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <p role="alert" className="max-w-md text-sm text-destructive">
          {error}
        </p>
        <button
          onClick={() => setState("checking")}
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          Try again
        </button>
      </div>
    );
  return <>{children}</>;
}
```

## 6. `components/paywall-setup.tsx`

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  OnboardingShell,
  StepHeader,
  onboardingPrimaryButtonClass,
  onboardingSecondaryButtonClass,
} from "@iblai/iblai-js/web-containers";
import { LoadingScreen } from "@/components/loading-screen";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { isTenantAdmin } from "@/lib/iblai/tenant";
import {
  PaywallRequestError,
  connectFailure,
  errorMessage,
  fetchCatalogue,
  invalidateCatalogue,
  markSetupDone,
  paywallFetch,
  setupMessage,
  sourceWarning,
  type Access,
  type ConnectStatus,
} from "@/lib/paywall-client";

export type SetupStep = "access" | "connect";

const OPTIONS: { value: Access; title: string; detail: string }[] = [
  { value: "free", title: "Free access", detail: "Anyone signed in can use the app." },
  { value: "one_time", title: "One-time fee", detail: "Pay once, keep access." },
  { value: "monthly", title: "Monthly fee", detail: "A subscription, cancelled any time." },
];

/** A card that reads as a radio, the shape the starter's own /setup uses. */
const cardClass = (selected: boolean) =>
  cn(
    "flex w-full cursor-pointer flex-col items-start gap-0.5 rounded-xl border p-4 text-left transition-all focus-within:ring-2 focus-within:ring-[#2563EB]",
    selected
      ? "border-[#2563EB] bg-[#2563EB]/[0.06] ring-1 ring-[#2563EB]"
      : "border-gray-200 hover:border-gray-300",
  );

const CONNECT_ROUTE = "/api/paywall/admin/connect";
const SETUP_ROUTE = "/api/paywall/admin/setup";
/** The answer in progress survives the round trip to Stripe here; cleared after the save. */
const PENDING_KEY = "paywall_setup_pending";
const stepPath = (step: SetupStep) =>
  step === "connect" ? "/paywall/setup/connect" : "/paywall/setup";
/** The platform checks every member's access on the Stripe source, so unlinking locks them out. */
const LOCKOUT =
  "Members can’t get into the app until a Stripe account is linked again. To stop charging instead, choose Free access and save.";

type Pending = { access: Access; amount: string };

/** `?stripe_connect=connected|error&reason=…`: how the platform's callback lands the admin back here. */
function readReturn(): { result: string; reason: string } | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const result = params.get("stripe_connect");
  return result ? { result, reason: params.get("reason") ?? "" } : null;
}

function readPending(): Pending | null {
  try {
    return JSON.parse(sessionStorage.getItem(PENDING_KEY) ?? "null");
  } catch {
    return null;
  }
}

/**
 * The paywall's own setup, two steps in one component: how people get in (free,
 * a one-time fee or a monthly fee, USD) and — for a paid answer while the
 * organization has no Stripe source — Connect with Stripe (the platform's own
 * OAuth: the admin signs in on Stripe and comes back to /paywall/setup/connect).
 * Nothing is typed or copied. Save lets /api/paywall/admin/setup create the
 * product and price on that account and record the choice. Every call runs on
 * the admin's own token; the platform answers 403 to anyone else, and this
 * screen says so first.
 */
export function PaywallSetup({ step }: { step: SetupStep }) {
  const router = useRouter();
  // Read once on the client: the providers hold this tree until mounted.
  const [admin] = useState(isTenantAdmin);
  const [returned] = useState(readReturn);
  const [access, setAccess] = useState<Access | null>(null);
  const [amount, setAmount] = useState("29");
  /** Something is for sale right now — what unlinking Stripe would lock members out of. */
  const [selling, setSelling] = useState(false);
  const [status, setStatus] = useState<ConnectStatus | null>(null);
  /** The arrival work is done: the saved answer and the Stripe source are in. */
  const [loaded, setLoaded] = useState(false);
  /** The overlay's message while the page is busy; "" when it is not. */
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const loadStatus = () =>
    paywallFetch<ConnectStatus>(CONNECT_ROUTE).then((s) => {
      setStatus(s);
      return s;
    });

  const save = async (chosen: Access, price: string) => {
    const paid = chosen !== "free";
    setBusy("Saving…");
    setError("");
    try {
      await paywallFetch(SETUP_ROUTE, {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        json: { access: chosen, ...(paid && { amount: Math.round(Number(price) * 100) }) },
      });
      sessionStorage.removeItem(PENDING_KEY);
      invalidateCatalogue();
      markSetupDone();
      router.replace("/");
    } catch (e) {
      setError(setupMessage(e));
      setBusy("");
    }
  };

  // Once, on arrival: the saved answer, the Stripe source, and — back from
  // Stripe — the outcome, saving the answer in progress when it connected.
  useEffect(() => {
    if (!admin) return;
    // The answer in progress, stashed before leaving for the step next door or
    // for Stripe. Consumed on the question, kept on the Stripe step: that one
    // still needs it when the consent page returns.
    const pending = readPending();
    if (pending) {
      setAccess(pending.access);
      setAmount(pending.amount);
      if (step === "access") sessionStorage.removeItem(PENDING_KEY);
    }
    // Back from Stripe's consent page: drop the query so a reload does not replay it.
    if (returned) router.replace(stepPath(step));
    if (returned?.result === "error") setError(connectFailure(returned.reason));
    void (async () => {
      try {
        const [catalogue, source] = await Promise.all([fetchCatalogue(), loadStatus()]);
        setSelling(catalogue.paywall);
        if (!pending && catalogue.settings) {
          setAccess(catalogue.settings.access);
          if (catalogue.settings.amount) setAmount(String(catalogue.settings.amount / 100));
        }
        if (returned?.result === "connected" && pending && pending.access !== "free")
          await save(pending.access, pending.amount);
        // A source and nothing waiting to be saved: the question is where to go on.
        else if (step === "connect" && source.source) router.replace(stepPath("access"));
      } catch (e) {
        setError(errorMessage(e));
      } finally {
        // Whatever happened, the step may now be drawn — spinning forever would
        // hide the error that was just set.
        setLoaded(true);
      }
    })();
    // Once, on mount: `step`, `returned`, `admin` and `router` do not change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const paid = access === "one_time" || access === "monthly";
  const connectMissing = paid && status?.source === null;
  const cents = Math.round(Number(amount) * 100);
  const priceValid = !paid || (Number.isFinite(cents) && cents > 0);

  /** Keep the answer in progress across the step next door, and the trip to Stripe. */
  const stashPending = () => {
    if (access)
      sessionStorage.setItem(PENDING_KEY, JSON.stringify({ access, amount } satisfies Pending));
  };

  const onQuestionSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!access) return;
    if (!priceValid) {
      setError("Enter a price greater than zero.");
      return;
    }
    setError("");
    if (connectMissing) {
      stashPending();
      router.push(stepPath("connect"));
      return;
    }
    await save(access, amount);
  };

  /** Leave for Stripe's consent page; an answer in progress rides along for the return. */
  const startConnect = async () => {
    stashPending();
    setBusy("Redirecting to Stripe…");
    setError("");
    try {
      const { authorize_url } = await paywallFetch<{ authorize_url?: string }>(CONNECT_ROUTE, {
        method: "POST",
        // Stripe's consent returns to the step that sent them there: this one
        // holds the retry button, and a failure has to show where it can be
        // acted on.
        json: { return_url: `${window.location.origin}${stepPath("connect")}` },
      });
      if (!authorize_url) throw new Error("The platform answered without Stripe’s address.");
      window.location.href = authorize_url;
    } catch (e) {
      // Connected after all (another tab, an earlier round trip): go on.
      if (e instanceof PaywallRequestError && e.status === 409) {
        loadStatus().catch((err: unknown) => setError(setupMessage(err)));
        if (access) await save(access, amount);
        else setBusy("");
        return;
      }
      setError(setupMessage(e));
      // A reconnect has already disconnected by now: show where things stand.
      loadStatus().catch(() => {});
      setBusy("");
    }
  };

  /** Unlinking while something is for sale locks members out; say so first. */
  const lockoutAccepted = (question: string) =>
    !selling || window.confirm(`${question} ${LOCKOUT}`);

  /** The platform's 502 on a disconnect means Stripe could not confirm it: still connected. */
  const disconnectMessage = (e: unknown) =>
    e instanceof PaywallRequestError && e.status === 502
      ? "Stripe could not be reached; the account is still connected. Try again."
      : setupMessage(e);

  const disconnect = async () => {
    if (!lockoutAccepted("Disconnect this Stripe account?")) return;
    setBusy("Disconnecting…");
    setError("");
    try {
      await paywallFetch(CONNECT_ROUTE, { method: "DELETE" });
    } catch (e) {
      setError(disconnectMessage(e));
    }
    await loadStatus().catch(() => {});
    setBusy("");
  };

  /**
   * Another Stripe account (or the same one after revoking ibl.ai on Stripe):
   * disconnect, then the same round trip as Connect with Stripe; the return
   * re-saves a paid answer on the new account.
   */
  const reconnect = async () => {
    if (!lockoutAccepted("Link a different Stripe account? This one is disconnected first."))
      return;
    setBusy("Redirecting to Stripe…");
    setError("");
    try {
      await paywallFetch(CONNECT_ROUTE, { method: "DELETE" });
    } catch (e) {
      setError(disconnectMessage(e));
      setBusy("");
      return;
    }
    await startConnect();
  };

  const back = () => {
    setError("");
    router.push(stepPath("access"));
  };

  if (!admin)
    return (
      <OnboardingShell totalSteps={1} currentStep={1}>
        <p role="alert" className="text-sm text-destructive">
          Only organization admins can set up payments.
        </p>
      </OnboardingShell>
    );

  // Nothing paints before it can: a question that rearranges itself as its
  // answers arrive reads as a glitch. An error is the way out.
  if (!loaded && !error) return <LoadingScreen />;

  const errorLine = error && (
    <p role="alert" className="mt-4 text-sm text-destructive">
      {error}
    </p>
  );
  const warning = paid ? sourceWarning(status) : "";
  const account = status?.business_name || status?.email || status?.account_id;

  return (
    <OnboardingShell
      totalSteps={step === "connect" || connectMissing ? 2 : 1}
      currentStep={step === "connect" ? 2 : 1}
    >
      {/* Saving = creating the product and price; redirecting = leaving for
          Stripe: the page is busy and nothing here should be touched. */}
      {busy && <LoadingScreen overlay message={busy} />}
      {step === "access" && (
        <form onSubmit={onQuestionSubmit}>
          <StepHeader
            title="How should people get in?"
            subtitle="Free, or charge for access. You can change this any time."
          />
          <fieldset className="space-y-3">
            <legend className="sr-only">Access</legend>
            {OPTIONS.map((option) => {
              const selected = access === option.value;
              return (
                <label key={option.value} className={cardClass(selected)}>
                  <input
                    type="radio"
                    name="access"
                    value={option.value}
                    checked={selected}
                    onChange={() => setAccess(option.value)}
                    className="sr-only"
                  />
                  <span className="text-sm font-medium text-gray-900">{option.title}</span>
                  <span className="text-sm text-gray-500">{option.detail}</span>
                </label>
              );
            })}
          </fieldset>

          {paid && (
            <div className="mt-5 space-y-2">
              <Label htmlFor="price">
                {access === "monthly" ? "Price per month" : "Price"} (USD)
              </Label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
                  $
                </span>
                <Input
                  id="price"
                  type="number"
                  min="0.5"
                  step="0.01"
                  inputMode="decimal"
                  className="pl-7"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
            </div>
          )}

          {errorLine}
          <button
            type="submit"
            disabled={!access || !!busy || (paid && !status)}
            className={`mt-6 ${onboardingPrimaryButtonClass}`}
          >
            {connectMissing ? "Continue" : "Save"}
          </button>
          {status?.source === "connected" && (
            <p className="mt-4 text-center text-xs text-muted-foreground">
              Stripe account connected · {account}
              {status.livemode === false ? " (test mode)" : ""}
              {" · "}
              <button
                type="button"
                className="underline-offset-4 hover:underline"
                onClick={reconnect}
              >
                Reconnect
              </button>
              {" · "}
              <button
                type="button"
                className="underline-offset-4 hover:underline"
                onClick={disconnect}
              >
                Disconnect
              </button>
            </p>
          )}
          {status?.source === "connected" && status.charges_enabled === false && (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Stripe has not enabled payments on this account yet; finish setting it up in Stripe.
            </p>
          )}
          {status?.source === "key" && (
            <p className="mt-4 text-center text-xs text-muted-foreground">
              Payments use this organization’s own Stripe key, set on ibl.ai.
            </p>
          )}
          {warning && (
            <p role="alert" className="mt-2 text-center text-xs text-destructive">
              {warning}
            </p>
          )}
          {status && !status.source && !status.available && (
            <p className="mt-4 text-center text-xs text-muted-foreground">
              Connect with Stripe is not available on this platform yet.
            </p>
          )}
        </form>
      )}
      {step === "connect" && (
        <div>
          <StepHeader
            title="Monetize Your App"
            subtitle="Connect your Stripe account. Payments go straight to it; nothing to copy."
          />
          {errorLine}
          <div className="mt-6 space-y-3">
            <button
              type="button"
              disabled={!!busy}
              className={onboardingPrimaryButtonClass}
              onClick={startConnect}
            >
              Connect with Stripe
            </button>
            <button type="button" className={onboardingSecondaryButtonClass} onClick={back}>
              Back
            </button>
          </div>
        </div>
      )}
    </OnboardingShell>
  );
}
```

## 7. `components/pay-modal.tsx`

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { loadStripe, type StripeEmbeddedCheckout } from "@stripe/stripe-js";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { LoadingScreen } from "@/components/loading-screen";
import config from "@/lib/iblai/config";
import {
  type Access,
  checkAccess,
  errorMessage,
  errorWithStatus,
  fetchCatalogue,
  startCheckout,
} from "@/lib/paywall-client";

const POLL_MS = 3_000;
const DEADLINE_MS = 60_000;

type State = "loading" | "checkout" | "confirming" | "error";

/**
 * Stripe's checkout, rendered in a modal (embedded mode, no redirect) on the
 * organization's Stripe source — the session, the publishable key and the
 * connected account all come from the platform's own answer to the member's
 * checkout call, made from this browser with the member's own token. When
 * Stripe reports completion the platform verifies the session and {onPaid}
 * fires. Closing the modal changes nothing.
 */
export function PayModal({
  open,
  onClose,
  onPaid,
}: {
  open: boolean;
  onClose: () => void;
  onPaid: () => void;
}) {
  const [state, setState] = useState<State>("loading");
  const [error, setError] = useState("");
  const [access, setAccess] = useState<Access | null>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const checkoutRef = useRef<StripeEmbeddedCheckout | null>(null);
  const sessionRef = useRef("");
  const name = config.appName() || "this app";

  // Open: the price, the session (with the key and account), Stripe.js, then
  // the checkout. It mounts once its div is on screen (the effect below), and
  // is torn down on close.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const fail = (e: unknown) => {
      if (cancelled) return;
      setError(errorWithStatus(e));
      setState("error");
    };
    const confirm = async () => {
      setState("confirming");
      const deadline = Date.now() + DEADLINE_MS;
      let last = "We couldn’t confirm your payment yet.";
      while (!cancelled && Date.now() < deadline) {
        try {
          const { has_access } = await checkAccess(sessionRef.current);
          if (has_access === true) {
            onPaid();
            return;
          }
        } catch (e) {
          last = errorMessage(e);
        }
        await new Promise((resolve) => setTimeout(resolve, POLL_MS));
      }
      fail(new Error(last));
    };
    (async () => {
      const catalogue = await fetchCatalogue();
      if (!catalogue.price)
        throw new Error("Nothing is for sale yet; an admin sets the price at /paywall/setup.");
      setAccess(catalogue.settings?.access ?? null);
      // The platform's 400s (not the recorded price, no publishable key on its
      // Stripe source) surface verbatim: the admin who debugs them reads them.
      const session = await startCheckout(catalogue.price.id);
      if (!session.publishable_key)
        throw new Error("The organization’s Stripe source has no publishable key.");
      const stripe = await loadStripe(
        session.publishable_key,
        session.stripe_account ? { stripeAccount: session.stripe_account } : undefined,
      );
      if (!stripe) throw new Error("Stripe.js could not be loaded.");
      if (cancelled) return;
      sessionRef.current = session.session_id;
      const checkout = await stripe.createEmbeddedCheckoutPage({
        fetchClientSecret: async () => session.client_secret,
        onComplete: () => void confirm(),
      });
      if (cancelled) {
        checkout.destroy();
        return;
      }
      checkoutRef.current = checkout;
      setState("checkout");
    })().catch(fail);
    return () => {
      cancelled = true;
      checkoutRef.current?.destroy();
      checkoutRef.current = null;
    };
    // `onPaid` is read when the payment completes; the effect keys on open only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (state === "checkout" && mountRef.current && checkoutRef.current)
      checkoutRef.current.mount(mountRef.current);
  }, [state]);

  const close = () => {
    setState("loading");
    setError("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && state !== "confirming" && close()}>
      {/* Wide enough for Stripe's two-column layout (summary left, fields
          right), so the form fits a laptop screen; the viewport is the height
          cap, and scrolling is only the fallback on a short window. */}
      <DialogContent
        showCloseButton={false}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-[min(1080px,calc(100%-2rem))]"
      >
        <DialogTitle>Pay to continue</DialogTitle>
        {/* Stripe's form names the product and the price itself. */}
        {state !== "checkout" && (
          <DialogDescription>
            {access === "monthly"
              ? `A subscription unlocks ${name}; cancel any time.`
              : access === "one_time"
                ? `One payment unlocks ${name}.`
                : `Payment unlocks ${name}.`}
          </DialogDescription>
        )}
        {state === "loading" && <LoadingScreen className="min-h-0 py-6" />}
        {state === "confirming" && (
          <LoadingScreen className="min-h-0 py-6" message="Confirming your payment…" />
        )}
        <div ref={mountRef} className={state === "checkout" ? "" : "hidden"} />
        {state === "error" && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
        <DialogClose
          disabled={state === "confirming"}
          className="self-center text-xs text-muted-foreground underline-offset-4 hover:underline"
        >
          Not now
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
```

## 8. `app/paywall/page.tsx`

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoadingScreen } from "@/components/loading-screen";
import { PayModal } from "@/components/pay-modal";
import config from "@/lib/iblai/config";
import { isTenantAdmin } from "@/lib/iblai/tenant";
import {
  type Catalogue,
  errorWithStatus,
  fetchCatalogue,
  hasPaidAccess,
  priceText,
  resetPaidAccess,
  restoreAccess,
} from "@/lib/paywall-client";

/**
 * Where PaywallGate sends a member who has not paid. Outside the (app) group —
 * the gate would loop — but inside the providers, so everyone here is signed
 * in. An admin, a member whose payment grants, or anyone while nothing is for
 * sale goes straight back into the app; the price comes from what the admin
 * saved at /paywall/setup, and paying happens in the modal, on this page.
 */
export default function PaywallPage() {
  const router = useRouter();
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null);
  const [error, setError] = useState("");
  const [paying, setPaying] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (isTenantAdmin()) {
      router.replace("/");
      return;
    }
    hasPaidAccess()
      .then(async (ok) => {
        if (ok) router.replace("/");
        else setCatalogue(await fetchCatalogue());
      })
      .catch((e: unknown) => setError(errorWithStatus(e)));
  }, [router]);

  const restore = async () => {
    setNote("");
    try {
      if (await restoreAccess()) router.replace("/");
      else setNote("No payment found for your account.");
    } catch (e) {
      setNote(errorWithStatus(e));
    }
  };

  if (!catalogue && !error) return <LoadingScreen />;
  const price = priceText(catalogue?.price ?? null);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="w-full max-w-md space-y-6 text-center">
        <h1 className="bg-gradient-to-r from-[#00b0ef] to-[#0058cc] bg-clip-text text-4xl font-bold text-transparent">
          Unlock {config.appName() || "this app"}
        </h1>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : catalogue?.price ? (
          <div className="space-y-3 rounded-lg border border-border bg-background p-6">
            {price && <p className="text-3xl font-bold text-foreground">{price}</p>}
            <button
              onClick={() => setPaying(true)}
              className="inline-flex w-full items-center justify-center rounded-lg bg-gradient-to-r from-[#2563EB] to-[#93C5FD] px-4 py-2 text-sm font-medium text-white"
            >
              Continue to payment
            </button>
          </div>
        ) : (
          // For sale, yet no price recorded: only an admin can finish it.
          <p role="alert" className="text-sm text-destructive">
            This app’s price is not set up yet. An admin finishes it at /paywall/setup.
          </p>
        )}
        <div className="space-y-1">
          <button
            onClick={restore}
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            Already paid? Restore access
          </button>
          {note && <p className="text-xs text-muted-foreground">{note}</p>}
        </div>
      </div>
      <PayModal
        open={paying}
        onClose={() => setPaying(false)}
        onPaid={() => {
          resetPaidAccess();
          router.replace("/");
        }}
      />
    </main>
  );
}
```

## 9. `app/paywall/setup/page.tsx`

```tsx
"use client";

import { PaywallSetup } from "@/components/paywall-setup";

/**
 * The paywall's setup: how people get in. Outside the (app) group on purpose —
 * PaywallGate would bounce the very admin who came here — and admin-only: the
 * screen says so, and the platform refuses everyone else on every call.
 */
export default function PaywallSetupPage() {
  return <PaywallSetup step="access" />;
}
```

## 10. `app/paywall/setup/connect/page.tsx`

```tsx
"use client";

import { PaywallSetup } from "@/components/paywall-setup";

/**
 * Connect with Stripe, for a paid answer while the organization has no Stripe
 * source yet. Stripe's consent page returns here, where the retry button is.
 */
export default function PaywallConnectPage() {
  return <PaywallSetup step="connect" />;
}
```

## 11. `app/(app)/layout.tsx` — 3-line edit

Add the import, then wrap the layout's `{children}`:

```tsx
import { PaywallGate } from "@/components/paywall-gate";
…
<PaywallGate>{children}</PaywallGate>
```

## 12. `middleware.ts` (or `proxy.ts`) — 4-line CSP edit

The SDK's default policy allows `js.stripe.com`, `api.stripe.com` and `hooks.stripe.com`, not
Stripe's embedded checkout; without these lines the pay modal stays empty on a production
build (`pnpm dev` only reports the violation). Add them to the existing `applyCsp` call:

```ts
  return applyCsp(request, {
    requestHeaders,
    mode:
      process.env.NODE_ENV === 'development' ? 'report-only' : undefined,
    // Stripe's embedded checkout (the paywall's pay modal).
    scriptSrc: ['https://checkout.stripe.com'],
    connectSrc: ['https://checkout.stripe.com'],
    frameSrc: ['https://checkout.stripe.com'],
    imgSrc: ['https://*.stripe.com'],
  });
```

## 13. `app/(app)/account/page.tsx` — the quiet way back to the question

Add the import, then the link above the `Account` card, for admins only — nothing new in the
navbar:

```tsx
import Link from "next/link";
…
    <div className="mx-auto w-full flex-1 overflow-auto px-4 py-8 md:w-[75vw] md:px-0">
      {isAdmin && (
        <div className="mb-2 flex justify-end">
          <Link
            href="/paywall/setup"
            className="text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            Payments setup
          </Link>
        </div>
      )}
      <div className="rounded-lg border border-[var(--border-color)] bg-white overflow-hidden">
```

## 14. `.env.local` addition (the deploy skill copies every `NEXT_PUBLIC_*` into `.env.production`)

```bash
NEXT_PUBLIC_PAYWALL_APP_SLUG=my-app   # pinned once, never changed: payments are recorded under it
```
