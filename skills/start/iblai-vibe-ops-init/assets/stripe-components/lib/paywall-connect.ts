// lib/paywall-connect.ts — "Connect with Stripe" for the app paywall, from the
// browser on the signed-in admin's own dm_token. The app holds no platform key
// for this: authority is the caller's RBAC (Ibl.Mentor/StripeConnect/*), and
// the username in the path only has to name a member of the organization.
// Relative imports (not @/): __tests__ load this module under vitest, which
// resolves no path alias.
import config from "./iblai/config";
import { resolveAppTenant } from "./iblai/tenant";

/** `GET …/providers/stripe/connect/`. Fields past `stripe_account` appear only once linked. */
export type ConnectStatus = {
  connected: boolean;
  /** Whether a NEW connect can be started — false means the platform has nowhere to keep the OAuth state. */
  available: boolean;
  key_credential_set: boolean;
  /** What the payments proxy runs on. A pasted key wins over a linked account. */
  source: "key" | "connected" | null;
  /** What Stripe.js is initialised with; "" means embedded checkout cannot run. */
  publishable_key: string;
  stripe_account: string | null;
  account_id?: string;
  livemode?: boolean;
  charges_enabled?: boolean;
  details_submitted?: boolean;
  business_name?: string | null;
  email?: string | null;
  connected_at?: string;
  /** The snapshot could not be refreshed from Stripe. */
  stale?: boolean;
};

export class ConnectError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ConnectError";
  }
}

/** The signed-in user's platform username, as the SDK wrote it at sign-in. */
export function currentUsername(): string {
  if (typeof window === "undefined") return "";
  try {
    const parsed = JSON.parse(localStorage.getItem("userData") ?? "{}");
    return parsed.user_nicename ?? parsed.username ?? "";
  } catch {
    return "";
  }
}

/** `…/orgs/<org>/users/<me>/providers/stripe/connect/`, or "" when either is unknown. */
export function connectUrl(): string {
  const org = resolveAppTenant();
  const me = currentUsername();
  if (!org || !me) return "";
  return (
    `${config.dmUrl()}/api/ai-mentor/orgs/${encodeURIComponent(org)}` +
    `/users/${encodeURIComponent(me)}/providers/stripe/connect/`
  );
}

// status 0 = the request was never made, so the message says what is missing
// rather than inventing a platform error.
function connectFetch(init: RequestInit = {}, query = ""): Promise<Response> {
  const base = connectUrl();
  if (!base)
    throw new ConnectError(0, "Sign in again — this screen needs your username and organization.");
  const token = localStorage.getItem("dm_token") ?? "";
  if (!token) throw new ConnectError(0, "Sign in again — no session token.");
  return fetch(`${base}${query}`, {
    ...init,
    headers: {
      Authorization: `Token ${token}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
    cache: "no-store",
  });
}

/** The platform's own message — its 4xx bodies name what to fix. */
async function fail(res: Response): Promise<never> {
  const body = await res.json().catch(() => null);
  throw new ConnectError(
    res.status,
    body?.error ?? body?.detail ?? `Stripe Connect request failed (${res.status})`,
  );
}

/** `refresh` reads the account from Stripe now instead of the ≤60s snapshot. */
export async function getConnectStatus(refresh = false): Promise<ConnectStatus> {
  const res = await connectFetch({ method: "GET" }, refresh ? "?refresh=1" : "");
  if (!res.ok) return fail(res);
  return (await res.json()) as ConnectStatus;
}

/** Returns the Stripe URL to send the admin to; `returnUrl` must be an origin the platform trusts. */
export async function startConnect(returnUrl: string): Promise<string> {
  const res = await connectFetch({
    method: "POST",
    body: JSON.stringify({ return_url: returnUrl }),
  });
  if (!res.ok) return fail(res);
  const { authorize_url } = await res.json().catch(() => ({}));
  if (!authorize_url) throw new ConnectError(res.status, "The platform returned no authorize_url.");
  return authorize_url as string;
}

/**
 * Deauthorize at Stripe and forget the link. 404 is "nothing connected" — a
 * no-op, not a failure: the only way to reach this is from a status read that
 * already proved the path user is a member. A 502 means Stripe could not
 * confirm it and the account is STILL connected, so that one surfaces.
 */
export async function disconnect(): Promise<void> {
  const res = await connectFetch({ method: "DELETE" });
  if (res.ok || res.status === 404) return;
  return fail(res);
}

const REASONS: Record<string, string> = {
  access_denied: "You cancelled at Stripe — nothing was linked.",
  invalid_grant: "That connect link had expired. Try again.",
  already_connected: "This organization already has a Stripe account linked.",
  account_linked_elsewhere: "That Stripe account is linked to another organization.",
  not_configured: "This platform has no Stripe Connect credential — an operator has to add one.",
  stripe_unreachable: "Stripe could not be reached. Try again.",
};

/** One plain sentence for a `?stripe_connect=error&reason=` code; unknown codes print raw. */
export function reasonText(code: string): string {
  return REASONS[code] ?? `Stripe refused the connection (${code || "no reason given"}).`;
}
