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
