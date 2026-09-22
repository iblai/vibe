# App files — complete drop-in bodies

Copy these verbatim into the app. Only the `PRICES` constant in
`app/paywall/page.tsx` and the `.env.local` lines are per-app.

> **Prefer the ready-made copies**: the same files (plus their unit tests)
> ship as ops-init assets at
> `skills/start/iblai-vibe-ops-init/assets/stripe-components/`, where the render
> gate typechecks them and runs their tests against vibe-starter — SKILL.md
> Step 2 copies from there. This reference is the fallback for installs whose
> staged skills carry no `assets/`; keep it a byte mirror of the assets, never
> a second truth.

## 1. `lib/paywall.ts` (server-only)

```ts
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
```

## 2. `lib/paywall-connect.ts` (browser; the admin's own session token)

```ts
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
```

## 3. `app/api/paywall/access/route.ts`

```ts
import { NextRequest, NextResponse } from "next/server";
// Relative import (not @/): __tests__ invoke this handler under vitest, which
// resolves no path alias.
import { PAYWALL_APP_SLUG, dmPaywallFetch, userFromRequest } from "../../../../lib/paywall";

export async function GET(req: NextRequest) {
  const user = await userFromRequest(req);
  if (!user) return NextResponse.json({ error: "Not a platform member" }, { status: 401 });
  if (!PAYWALL_APP_SLUG)
    return NextResponse.json({ error: "PAYWALL_APP_SLUG not set" }, { status: 500 });

  const qs = new URLSearchParams({ app: PAYWALL_APP_SLUG });
  const sessionId = req.nextUrl.searchParams.get("session_id");
  if (sessionId) qs.set("session_id", sessionId);

  const res = await dmPaywallFetch(user.username, `/paywall/access/?${qs}`);
  return NextResponse.json(await res.json(), { status: res.status }); // DM JSON verbatim
}
```

## 4. `app/api/paywall/checkout/route.ts`

```ts
import { NextRequest, NextResponse } from "next/server";
// Relative import (not @/): __tests__ invoke this handler under vitest, which
// resolves no path alias.
import { PAYWALL_APP_SLUG, dmPaywallFetch, userFromRequest } from "../../../../lib/paywall";

const ALLOWED_PRICE_IDS = (process.env.PAYWALL_PRICE_IDS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// Embedded is the default: the buyer pays without leaving the app. Opt out with
// PAYWALL_EMBEDDED=0, which is only needed when the organization's Stripe source
// carries no publishable key — a connected account always has one, a pasted
// restricted key only if the credential stores it too. /paywall/setup says which.
const EMBEDDED = !["0", "false"].includes((process.env.PAYWALL_EMBEDDED ?? "").toLowerCase());

export async function POST(req: NextRequest) {
  const user = await userFromRequest(req);
  if (!user) return NextResponse.json({ error: "Not a platform member" }, { status: 401 });
  if (!PAYWALL_APP_SLUG)
    return NextResponse.json({ error: "PAYWALL_APP_SLUG not set" }, { status: 500 });

  const { price_id } = await req.json().catch(() => ({}) as any);
  if (!price_id || !ALLOWED_PRICE_IDS.includes(price_id))
    return NextResponse.json({ error: "Unknown price_id" }, { status: 400 });

  const origin = req.headers.get("origin") ?? new URL(req.url).origin;
  // Embedded takes no redirect URLs — Stripe never leaves the page, and the
  // app confirms through /paywall/return with the session id instead.
  const mode = EMBEDDED
    ? { ui_mode: "embedded" }
    : {
        success_url: `${origin}/paywall/return?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/paywall`,
      };
  const res = await dmPaywallFetch(user.username, "/paywall/checkout/", {
    method: "POST",
    body: JSON.stringify({ price_id, app: PAYWALL_APP_SLUG, ...mode }),
  });
  // DM 400s are actionable (missing credential, wrong app tag, bad URL host) — pass through.
  return NextResponse.json(await res.json(), { status: res.status });
}
```

## 5. `components/paywall-gate.tsx`

```tsx
"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

const OK_KEY = "paywall_ok_at";
const OK_TTL_MS = 60_000;

/** GET /api/paywall/access with the user's dm_token; stamps the grant cache. */
export async function checkPaywallAccess(sessionId?: string): Promise<boolean> {
  const token = localStorage.getItem("dm_token") ?? "";
  const qs = sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : "";
  const res = await fetch(`/api/paywall/access${qs}`, {
    headers: { Authorization: `Token ${token}` },
  });
  const data = await res.json().catch(() => null);
  if (data?.has_access) sessionStorage.setItem(OK_KEY, String(Date.now()));
  return !!data?.has_access;
}

export function PaywallGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  // ponytail: sessionStorage grant cache (~60s) only de-flashes hard
  // navigations; the DM stays the entitlement authority.
  const [ok, setOk] = useState(() => {
    if (typeof window === "undefined") return false;
    return Date.now() - Number(sessionStorage.getItem(OK_KEY) ?? 0) < OK_TTL_MS;
  });

  // Mount-only check. ponytail: enforcement is client-side — this starter's
  // server HTML carries no user data, so a bypass only shows the empty shell;
  // real data still requires the user's own tokens.
  useEffect(() => {
    if (ok) return;
    checkPaywallAccess()
      .then((granted) => (granted ? setOk(true) : router.replace("/paywall")))
      .catch(() => router.replace("/paywall"));
  }, [ok, router]);

  if (!ok)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-gray-400">Loading...</p>
      </div>
    );
  return <>{children}</>;
}
```

## 6. `components/paywall-connect.tsx`

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ConnectError,
  type ConnectStatus,
  disconnect,
  getConnectStatus,
  reasonText,
  startConnect,
} from "@/lib/paywall-connect";

const message = (e: unknown, fallback: string) =>
  e instanceof ConnectError ? e.message : fallback;

/** `Yes` / `No`, so a half-finished Stripe account reads at a glance. */
const yesNo = (v: boolean | undefined) => (v ? "Yes" : "No");

function summary(status: ConnectStatus): string {
  if (status.source === "key")
    return "Running on the restricted key in this organization's credentials, which wins over any linked account.";
  if (status.source === "connected") return "Connected to a Stripe account.";
  return "No Stripe account linked yet — the app cannot charge.";
}

/**
 * Link, inspect or unlink the organization's own Stripe account. Every call
 * goes out on the admin's own session token; the platform enforces
 * Ibl.Mentor/StripeConnect/* and answers 403 to anyone else.
 */
export function PaywallConnect() {
  const params = useSearchParams();
  const outcome = params.get("stripe_connect") ?? "";
  const reason = params.get("reason") ?? "";
  const [status, setStatus] = useState<ConnectStatus | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (refresh = false) => {
    setError("");
    try {
      setStatus(await getConnectStatus(refresh));
    } catch (e) {
      setError(message(e, "Could not read the Stripe status."));
    }
  }, []);

  // Returning from Stripe with `connected` means the link was just written —
  // read past the snapshot cached for up to a minute so the card is not stale.
  useEffect(() => {
    void load(outcome === "connected");
  }, [load, outcome]);

  const connect = async () => {
    setBusy(true);
    setError("");
    try {
      window.location.href = await startConnect(`${window.location.origin}/paywall/setup`);
    } catch (e) {
      setError(message(e, "Could not start the connection."));
      setBusy(false);
    }
  };

  const unlink = async () => {
    if (
      !window.confirm(
        "Disconnect this Stripe account? The app cannot charge until one is linked again.",
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      await disconnect();
      await load(true);
    } catch (e) {
      setError(message(e, "Could not disconnect."));
    } finally {
      setBusy(false);
    }
  };

  const rows: [string, string][] = [];
  if (status?.connected) {
    if (status.business_name) rows.push(["Account", status.business_name]);
    if (status.account_id) rows.push(["Account id", status.account_id]);
    rows.push(["Can charge cards", yesNo(status.charges_enabled)]);
    rows.push(["Details submitted", yesNo(status.details_submitted)]);
    if (status.livemode === false) rows.push(["Mode", "Test"]);
    if (status.stale)
      rows.push(["Snapshot", "Stripe could not be reached — this may be out of date"]);
  }

  return (
    <div className="space-y-4 rounded-lg border border-border bg-background p-6 text-left">
      {outcome === "connected" && (
        <p className="text-xs text-muted-foreground">Stripe account linked.</p>
      )}
      {outcome === "error" && (
        <p role="alert" className="text-xs text-destructive">
          {reasonText(reason)}
        </p>
      )}

      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">Stripe</p>
        <p className="text-xs text-muted-foreground">
          {/* A failed read must stop claiming to be in progress — the reason is below. */}
          {status ? summary(status) : error ? "Stripe status unavailable." : "Checking Stripe…"}
        </p>
      </div>

      {rows.length > 0 && (
        <dl className="space-y-1">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4 text-xs">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="text-right text-foreground">{value}</dd>
            </div>
          ))}
        </dl>
      )}

      {/* Checkout renders in the app by default, and that needs a publishable
          key — so a source without one is a warning, not a footnote. */}
      {status &&
        (status.publishable_key ? (
          <p className="text-xs text-muted-foreground">
            This source has a publishable key, so checkout renders inside the app.
          </p>
        ) : (
          <p role="alert" className="text-xs text-destructive">
            This source has no publishable key, which the in-app checkout needs — buying will fail.
            Store the publishable key (<code>pk_…</code>, it is public) beside the restricted key in
            the platform&apos;s <code>stripe</code> credential, or set{" "}
            <code>PAYWALL_EMBEDDED=0</code> to redirect to Stripe instead.
          </p>
        ))}

      {status && !status.connected && !status.available && (
        <p role="alert" className="text-xs text-destructive">
          This platform has nowhere to keep the connect state, so a new connection cannot be
          started. An operator has to apply the pending migration or give it a working cache. A
          pasted restricted key still works meanwhile.
        </p>
      )}

      <div className="space-y-2">
        {status && status.source === null && status.available && (
          <button
            onClick={connect}
            disabled={busy}
            className="inline-flex w-full items-center justify-center rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
          >
            {busy ? "Opening Stripe…" : "Connect with Stripe"}
          </button>
        )}
        {status?.connected && (
          <button
            onClick={unlink}
            disabled={busy}
            className="text-xs text-muted-foreground underline-offset-4 hover:underline disabled:opacity-50"
          >
            Disconnect this Stripe account
          </button>
        )}
        {status && !status.connected && !status.key_credential_set && (
          <p className="text-xs text-muted-foreground">
            An admin can instead add a restricted key named <code>stripe</code> in the
            platform&apos;s credentials screen — never paste one here.
          </p>
        )}
      </div>

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
```

## 7. `components/paywall-embedded.tsx`

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { loadStripe, type StripeEmbeddedCheckout } from "@stripe/stripe-js";

/** What the platform answers for `ui_mode: "embedded"`. */
export type EmbeddedSession = {
  client_secret: string;
  session_id: string;
  publishable_key: string;
  stripe_account: string | null;
};

/**
 * Stripe's own payment form, rendered in the page instead of a redirect.
 *
 * The platform minted the session; the browser only renders it — with the
 * platform's publishable key acting for the organization's connected account
 * when there is one (`stripeAccount`). Stripe never redirects here
 * (`redirect_on_completion: never`), so completion routes through the existing
 * return page, which confirms with the session id.
 */
export function PaywallEmbedded({ session }: { session: EmbeddedSession }) {
  const router = useRouter();
  const mountRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    let checkout: StripeEmbeddedCheckout | null = null;

    (async () => {
      const stripe = await loadStripe(
        session.publishable_key,
        session.stripe_account ? { stripeAccount: session.stripe_account } : undefined,
      );
      if (!stripe) throw new Error("Stripe.js could not be loaded.");
      checkout = await stripe.createEmbeddedCheckoutPage({
        fetchClientSecret: async () => session.client_secret,
        onComplete: () =>
          router.replace(`/paywall/return?session_id=${encodeURIComponent(session.session_id)}`),
      });
      if (cancelled || !mountRef.current) {
        checkout.destroy();
        return;
      }
      checkout.mount(mountRef.current);
    })().catch((e) => {
      if (!cancelled) setError(e instanceof Error ? e.message : "Could not open the payment form.");
    });

    return () => {
      cancelled = true;
      checkout?.destroy();
    };
  }, [session, router]);

  return (
    <div className="space-y-2">
      <div ref={mountRef} />
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
```

## 8. `app/paywall/page.tsx`

```tsx
import { BuyButton, PaywallAutoVerify, RestoreAccessButton } from "./paywall-actions";

// Placeholder pricing — /iblai-vibe-monetization-app-paywall Step 1 fills this
// (and re-running it refreshes the display data). The page is unlinked and the
// paywall inert until that skill wires the env and the (app) layout gate.
// ponytail: display data duplicated from Stripe; charging uses only priceId.
const PRICES: { priceId: string; name: string; amount: string; interval: string | null }[] = [
  { priceId: "price_REPLACE_ME", name: "Full access", amount: "$29", interval: "month" },
];

export default function PaywallPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <PaywallAutoVerify />
      <div className="w-full max-w-md space-y-6 text-center">
        <h1 className="bg-gradient-to-r from-[#00b0ef] to-[#0058cc] bg-clip-text text-4xl font-bold text-transparent">
          Unlock this app
        </h1>
        <p className="text-sm text-muted-foreground">
          Pay once (or subscribe) to get full access with your account.
        </p>
        <div className="flex flex-col gap-4">
          {PRICES.map((p) => (
            <div
              key={p.priceId}
              className="space-y-3 rounded-lg border border-border bg-background p-6"
            >
              <p className="text-sm font-medium text-foreground">{p.name}</p>
              <p className="text-3xl font-bold text-foreground">
                {p.amount}
                {p.interval && (
                  <span className="text-sm font-normal text-muted-foreground">/{p.interval}</span>
                )}
              </p>
              <BuyButton priceId={p.priceId} />
            </div>
          ))}
        </div>
        <RestoreAccessButton />
      </div>
    </main>
  );
}
```

## 9. `app/paywall/paywall-actions.tsx`

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { checkPaywallAccess } from "@/components/paywall-gate";
import { PaywallEmbedded, type EmbeddedSession } from "@/components/paywall-embedded";

/** Entitled users landing here go straight back into the app. */
export function PaywallAutoVerify() {
  const router = useRouter();
  useEffect(() => {
    checkPaywallAccess().then((granted) => granted && router.replace("/"));
  }, [router]);
  return null;
}

export function BuyButton({ priceId }: { priceId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [session, setSession] = useState<EmbeddedSession | null>(null);

  const buy = async () => {
    setBusy(true);
    setError("");
    const token = localStorage.getItem("dm_token") ?? "";
    const res = await fetch("/api/paywall/checkout", {
      method: "POST",
      headers: { Authorization: `Token ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ price_id: priceId }),
    });
    const data = await res.json().catch(() => null);
    // The server route decides which the platform minted: by default a
    // client_secret to render in place, or — under PAYWALL_EMBEDDED=0 — a
    // checkout_url to redirect to.
    if (data?.checkout_url) {
      window.location.href = data.checkout_url;
      return;
    }
    if (data?.client_secret) {
      setSession(data as EmbeddedSession);
      return;
    }
    setError(data?.error ?? data?.detail ?? "Could not start checkout");
    setBusy(false);
  };

  if (session) return <PaywallEmbedded session={session} />;

  return (
    <div className="space-y-2">
      <button
        onClick={buy}
        disabled={busy}
        className="inline-flex w-full items-center justify-center rounded-lg bg-gradient-to-r from-[#2563EB] to-[#93C5FD] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {busy ? "Redirecting…" : "Continue to payment"}
      </button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function RestoreAccessButton() {
  const router = useRouter();
  const [message, setMessage] = useState("");

  const restore = async () => {
    setMessage("");
    const granted = await checkPaywallAccess();
    if (granted) router.replace("/");
    else setMessage("No payment found for your account.");
  };

  return (
    <div className="space-y-1">
      <button
        onClick={restore}
        className="text-sm text-primary underline-offset-4 hover:underline"
      >
        Already paid? Restore access
      </button>
      {message && <p className="text-xs text-muted-foreground">{message}</p>}
    </div>
  );
}
```

## 10. `app/paywall/return/page.tsx`

```tsx
"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { checkPaywallAccess } from "@/components/paywall-gate";

function ReturnInner() {
  const router = useRouter();
  const sessionId = useSearchParams().get("session_id") ?? undefined;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    checkPaywallAccess(sessionId).then((granted) =>
      granted ? router.replace("/") : setFailed(true),
    );
  }, [sessionId, router]);

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      {failed ? (
        <div className="space-y-3 text-center">
          <p className="text-sm text-foreground">We couldn&apos;t confirm your payment yet.</p>
          <Link href="/paywall" className="text-sm text-primary underline-offset-4 hover:underline">
            Back to pricing
          </Link>
        </div>
      ) : (
        <p className="text-sm text-gray-400">Confirming your payment...</p>
      )}
    </main>
  );
}

export default function PaywallReturnPage() {
  return (
    <Suspense fallback={null}>
      <ReturnInner />
    </Suspense>
  );
}
```

## 11. `app/paywall/setup/page.tsx`

```tsx
"use client";

import { Suspense, useState } from "react";
import { isTenantAdmin } from "@/lib/iblai/tenant";
import { PaywallConnect } from "@/components/paywall-connect";

/**
 * Link the organization's Stripe account to this app.
 *
 * Outside the (app) group on purpose: PaywallGate would bounce the very admin
 * who came here to make payments work. The admin check below is a UI hint
 * only — the platform enforces Ibl.Mentor/StripeConnect/* on every call this
 * screen makes, and answers 403 to anyone else.
 */
export default function PaywallSetupPage() {
  // Read once on the client: the providers hold this tree until mounted.
  const [isAdmin] = useState(() => typeof window !== "undefined" && isTenantAdmin());

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="w-full max-w-md space-y-6">
        <h1 className="text-xl font-semibold text-foreground">Payments setup</h1>
        {isAdmin ? (
          <Suspense fallback={null}>
            <PaywallConnect />
          </Suspense>
        ) : (
          <p role="alert" className="text-sm text-destructive">
            Only organization admins can set up payments.
          </p>
        )}
      </div>
    </main>
  );
}
```

## 12. `app/(app)/layout.tsx` — 3-line edit

Add the import, then wrap the layout's `{children}`:

```tsx
import { PaywallGate } from "@/components/paywall-gate";
…
<PaywallGate>{children}</PaywallGate>
```

## 13. `.env.local` additions (server-only; the deploy skill copies them into `.env.production`)

```bash
PAYWALL_PRICE_IDS=price_xxx,price_yyy   # server-only allowlist, comma-separated
PAYWALL_APP_SLUG=my-app                 # must equal the product's metadata.app
PAYWALL_EMBEDDED=0                      # optional opt-out; only when the source has no publishable_key
```
