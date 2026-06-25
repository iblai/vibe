# Stripe Connect API

The five Stripe Connect endpoints the Platform owner persona uses
before any paywall, pricing, or checkout becomes operational
(`status`, `onboard`, `onboard/refresh`, `dashboard`, `DELETE`). All
five sit under the `commerce` tag in the OpenAPI schema and are scoped
to the Platform on the token.

> **Backend source of truth:** view classes live in
> `dl_iblai_services_app/views/stripe_connect.py`
> (`StripeConnectStatusView`, `StripeConnectOnboardView`,
> `StripeConnectDashboardLinkView`, `StripeConnectDisconnectView`).
> Business logic lives in `services/stripe/connect.py`
> (`StripeConnectService`). View classes are NOT in a `services/stripe/`
> module — that path holds only the service layer.

> **Base URL:** `{dm_url}` — the DM service host, e.g.
> `https://api.iblai.app/dm`. In TypeScript compose it as
> `` `${apiBase}/dm` `` (or read `SERVICES.DM` from a loaded SDK).
> Never hit the bare AXD edge (`${NEXT_PUBLIC_API_BASE_URL}/api/...`) —
> Stripe Connect routes live on DM only.
> **Auth:** `Authorization: Token <DM token>` (PlatformApiKeyAuthentication).
> This is the **DM token**, not the AXD token — using the AXD token here
> returns `401`.
> **Permission:** `IsPlatformAdmin` on every endpoint — these are
> Platform-owner-only surfaces, not learner-facing.

## Endpoint catalog

| Method | Path | View class | Purpose |
|---|---|---|---|
| GET | `{dm_url}/api/service/platforms/{platform_key}/stripe/connect/status/` | `StripeConnectStatusView` | Current account status, commission, `is_owner`, `is_ready_for_payments` |
| POST | `{dm_url}/api/service/platforms/{platform_key}/stripe/connect/onboard/` | `StripeConnectOnboardView` | Create Connect Express account, return hosted onboarding URL |
| POST | `{dm_url}/api/service/platforms/{platform_key}/stripe/connect/onboard/refresh/` | `StripeConnectOnboardView` (refresh route) | Re-issue onboarding URL when the original expires or is abandoned |
| GET | `{dm_url}/api/service/platforms/{platform_key}/stripe/connect/dashboard/` | `StripeConnectDashboardLinkView` | Stripe-hosted Express Dashboard login link |
| DELETE | `{dm_url}/api/service/platforms/{platform_key}/stripe/connect/` | `StripeConnectDisconnectView` | Soft-disconnect the Platform's Connect account |

All paths include the `{platform_key}` segment. Pass the Platform key
from your token / `currentTenant` context — never hardcode.

## `GET .../status/` — read account state

**Response (`StripeConnectStatus`):**

| Field | Type | Notes |
|---|---|---|
| `has_account` | boolean | A `StripeConnectAccount` row exists (whether or not onboarding is done) |
| `account_id` | string | Stripe `acct_xxx` identifier — only set when `has_account` is true |
| `onboarding_complete` | boolean | Computed: `charges_enabled && details_submitted` |
| `charges_enabled` | boolean | Stripe can charge cards on this account |
| `payouts_enabled` | boolean | Stripe can pay out to the connected bank |
| `details_submitted` | boolean | Owner has submitted the KYC form |
| `is_ready_for_payments` | boolean | **The gate** — true only when `!is_disconnected && onboarding_complete && charges_enabled` |
| `is_owner` | boolean | The authenticated user equals the Platform owner — frontend uses this to decide whether to render the Stripe card at all |
| `commission_percent` | object | Per-item-type commission cuts sourced from per-Platform `Config` keys (`STRIPE_ITEM_COMMISSION_PERCENT_<TYPE>`). See divergence note below |

> **`commission_percent` 3-way divergence — treat as
> `Record<string, number>`:**
> - Backend wire (computed in
>   `dl_iblai_services_app/models/stripe_connect.py:120-127`) returns
>   **4 keys**: `mentor`, `course`, `program`, `pathway`
> - OpenAPI schema component `ItemTypeCommission` declares only **3
>   keys** (`mentor`, `course`, `program` — no `pathway`)
> - SDK TypeScript type declares only **2 keys** (`mentor`, `course`)
>
> Consumers should iterate with `Object.entries(commission_percent)`
> instead of destructuring fixed keys, and tolerate unknown item types.
> Do not assume a fixed shape.

> **`is_owner` schema drift:** the backend wire response and the SDK
> TypeScript type both include `is_owner`, but the OpenAPI schema
> component `StripeConnectStatus` does NOT declare it. Trust the wire
> contract, not the schema, on this field.

`is_ready_for_payments` is the single source of truth for "can this
Platform accept payments today?" Do not infer payment-readiness from
`has_account: true` alone — that bit flips before KYC is done and
before Stripe enables charges.

When the Platform has no account at all, the response collapses to:

```json
{
  "has_account": false,
  "onboarding_complete": false,
  "charges_enabled": false,
  "payouts_enabled": false,
  "is_owner": <bool>
}
```

(no `is_ready_for_payments`, no `commission_percent`, no `account_id`).
Treat any missing field as `false` / `undefined`.

## `POST .../onboard/` — start onboarding

**Request body (`StripeConnectOnboard`):**

```json
{
  "return_url": "https://your-app.example.com/account?profileTab=monetization",
  "refresh_url": "https://your-app.example.com/account?profileTab=monetization",
  "business_type": "individual"
}
```

| Field | Required | Notes |
|---|---|---|
| `return_url` | yes | Stripe redirects here after the owner finishes onboarding |
| `refresh_url` | yes | Stripe redirects here if the onboarding link expires mid-flow; your frontend should re-call `/onboard/refresh/` from there |
| `business_type` | no | `individual` (schema default) or `company`. The SDK component hardcodes `company`; pass `individual` only if you build your own onboarding-start screen |

**Response (`StripeConnectOnboardResponse`):**

```json
{
  "account_id": "acct_xxx",
  "onboarding_url": "https://connect.stripe.com/setup/e/acct_xxx/..."
}
```

Redirect the owner's browser to `onboarding_url`. Do not embed it in an
iframe — Stripe Connect onboarding blocks framing.

**Errors:**

- `400` — Platform already has a connected Stripe account, or Stripe
  rejected the create call. Body: `{"detail": "..."}`
- `404` — Platform not found
- `403` — Caller is not the Platform owner

## `POST .../onboard/refresh/` — re-issue onboarding link

Same request body and response shape as `/onboard/`. Use when the
original `onboarding_url` has expired (Stripe links are short-lived) or
when the owner abandoned the flow and hit your `refresh_url`. Calling
this for a Platform that already has a fully onboarded account returns
`400`.

## `GET .../dashboard/` — Stripe Express Dashboard link

**Response (`StripeConnectDashboardLink`):**

```json
{ "dashboard_url": "https://connect.stripe.com/express/..." }
```

Open in a new tab. The URL is one-shot and tied to the requesting
session — do not cache it; call the endpoint each time the owner
clicks the dashboard button.

**Errors:**

- `404` — Platform has no Connect account yet

## `DELETE {dm_url}/api/service/platforms/{platform_key}/stripe/connect/` — disconnect

Soft-deletes the `StripeConnectAccount` row (sets `is_disconnected =
true`, stamps `disconnected_at`). All existing paywalls keep their
configuration but cannot process new charges until the Platform
re-onboards.

**Response branches:**

- `200 {"detail": "Stripe Connect account disconnected"}` — the account
  existed and is now soft-disconnected
- `404 {"detail": "..."}` — no `StripeConnectAccount` row exists for
  this Platform; nothing to disconnect. Treat as a no-op success in
  UI flows that re-issue a disconnect after a prior disconnect, or
  surface "no Stripe Connect account" copy.

**Other errors:** `403` if caller is not the Platform owner.

The frontend SDK does not currently expose a hook for this — call the
endpoint directly from a custom admin tool if you need to surface a
disconnect button.

## RTK Query hook map

| Endpoint | Hook |
|---|---|
| `GET /status/` | `useGetStripeConnectStatusQuery({ platform_key })` |
| `POST /onboard/` | `useStartStripeConnectOnboardingMutation()` |
| `POST /onboard/refresh/` | (no dedicated hook; call same mutation against refresh path or POST directly) |
| `GET /dashboard/` | `useGetStripeConnectDashboardQuery({ platform_key })` or `useLazyGetStripeConnectDashboardQuery()` |
| `DELETE /` | (no SDK hook — fetch directly) |

The status query carries the `stripeConnectStatus` cache tag; the
onboarding mutation invalidates it, so the status card auto-refetches
when the owner returns from Stripe.
