# App files — complete drop-in bodies

Copy these verbatim into the app. Only the `PRICES` constant in
`app/paywall/page.tsx` and the two `.env.local` lines are per-app.

## 1. `lib/paywall.ts` (server-only)

```ts
// lib/paywall.ts — server-only paywall helpers. Uses IBLAI_API_KEY via
// config.apiKey(); never import from a client component.
import config from "@/lib/iblai/config";

export const PAYWALL_APP_SLUG = process.env.PAYWALL_APP_SLUG ?? "";

export type PaywallUser = { username: string; email: string };

// ponytail: per-lambda Map cache, ~60s TTL — cold starts just re-fetch.
const identityCache = new Map<string, { user: PaywallUser | null; at: number }>();
const IDENTITY_TTL_MS = 60_000;

/** End-user identity from their DM token — the ONLY trusted identity source. */
export async function resolveUser(dmToken: string): Promise<PaywallUser | null> {
  const hit = identityCache.get(dmToken);
  if (hit && Date.now() - hit.at < IDENTITY_TTL_MS) return hit.user;

  const res = await fetch(`${config.dmUrl()}/api/core/users/platforms/`, {
    headers: { Authorization: `Token ${dmToken}` },
    cache: "no-store",
  });
  if (!res.ok) return null; // don't cache failures — token may be mid-refresh

  const body = await res.json().catch(() => null);
  // Tolerate both bare-array and {results: []} shapes.
  const memberships: any[] = Array.isArray(body) ? body : (body?.results ?? []);
  const m = memberships.find((x) => x?.key === config.mainTenantKey());
  const user = m ? { username: m.username, email: m.email } : null;
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

## 2. `app/api/paywall/access/route.ts`

```ts
import { NextRequest, NextResponse } from "next/server";
import { PAYWALL_APP_SLUG, dmPaywallFetch, userFromRequest } from "@/lib/paywall";

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

## 3. `app/api/paywall/checkout/route.ts`

```ts
import { NextRequest, NextResponse } from "next/server";
import { PAYWALL_APP_SLUG, dmPaywallFetch, userFromRequest } from "@/lib/paywall";

const ALLOWED_PRICE_IDS = (process.env.PAYWALL_PRICE_IDS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export async function POST(req: NextRequest) {
  const user = await userFromRequest(req);
  if (!user) return NextResponse.json({ error: "Not a platform member" }, { status: 401 });
  if (!PAYWALL_APP_SLUG)
    return NextResponse.json({ error: "PAYWALL_APP_SLUG not set" }, { status: 500 });

  const { price_id } = await req.json().catch(() => ({}) as any);
  if (!price_id || !ALLOWED_PRICE_IDS.includes(price_id))
    return NextResponse.json({ error: "Unknown price_id" }, { status: 400 });

  const origin = req.headers.get("origin") ?? new URL(req.url).origin;
  const res = await dmPaywallFetch(user.username, "/paywall/checkout/", {
    method: "POST",
    body: JSON.stringify({
      price_id,
      app: PAYWALL_APP_SLUG,
      success_url: `${origin}/paywall/return?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/paywall`,
    }),
  });
  // DM 400s are actionable (missing credential, wrong app tag, bad URL host) — pass through.
  return NextResponse.json(await res.json(), { status: res.status });
}
```

## 4. `components/paywall-gate.tsx`

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

## 5. `app/paywall/page.tsx`

```tsx
import { BuyButton, PaywallAutoVerify, RestoreAccessButton } from "./paywall-actions";

// Written by /iblai-vibe-monetization-app-paywall Step 1 — re-run it to refresh.
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

## 6. `app/paywall/paywall-actions.tsx`

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { checkPaywallAccess } from "@/components/paywall-gate";

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
    if (data?.checkout_url) {
      window.location.href = data.checkout_url;
      return;
    }
    setError(data?.error ?? data?.detail ?? "Could not start checkout");
    setBusy(false);
  };

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

## 7. `app/paywall/return/page.tsx`

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
          <p className="text-sm text-foreground">We couldn't confirm your payment yet.</p>
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

## 8. `app/(app)/layout.tsx` — 3-line edit

Add the import, then wrap the layout's `{children}`:

```tsx
import { PaywallGate } from "@/components/paywall-gate";
…
<PaywallGate>{children}</PaywallGate>
```

## 9. `.env.local` additions (server-only; the deploy skill copies them into `.env.production`)

```bash
PAYWALL_PRICE_IDS=price_xxx,price_yyy   # server-only allowlist, comma-separated
PAYWALL_APP_SLUG=my-app                 # must equal the product's metadata.app
```
