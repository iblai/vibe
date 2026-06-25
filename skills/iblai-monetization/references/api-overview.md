# Monetization REST API — overview

Reference card for the URL paths, auth, pagination, and error contract used by
the monetization skill family. The live OpenAPI schema at
[https://api.iblai.app/dm/api/docs/schema/](https://api.iblai.app/dm/api/docs/schema/)
is the source of truth; this page is for orientation. When the table here and
the schema disagree, trust the schema. See [./schema-validation.md](./schema-validation.md)
for the fetch routine.

## Base URLs

> **`{dm_url}` placeholder.** Throughout this file, `{dm_url}` resolves to your
> data-manager host, e.g. `https://api.iblai.app/dm`. In TypeScript code,
> compose it as `` `${apiBase}/dm` `` (or read it from `SERVICES.DM` if the
> SDK is loaded). Never write `https://api.iblai.app/api/...` — the bare
> `/api/` path is served by the AXD edge and will not route to monetization.

Two prefixes carry the monetization surface (both under `{dm_url}`):

- **Billing** — `{dm_url}/api/billing/...` (unscoped + by-ID variants) and
  `{dm_url}/api/billing/platforms/{platform_key}/...` (Platform-scoped).
- **Stripe Connect** — `{dm_url}/api/service/platforms/{platform_key}/stripe/connect/...`.
  Every Stripe Connect path is Platform-scoped.

There is no URL-level API version. Backward-compatibility lives in the schema;
check `info.version` (an `info.version` like `4.281.0-ai-plus` at the time of
writing — the value rolls forward each release) to know what is deployed.

## Authentication

- Header: `Authorization: Token <DM token>` (NOT `Bearer`).
- **This is the DM token — not the AXD token.** The two are different tokens
  issued by different services; using the AXD token against `{dm_url}` returns
  `401 Unauthorized`. If the SDK is loaded, the DM token is what
  `iblFetchBaseQuery` attaches via `SERVICES.DM`.
- `platform_key` is resolved from the DM token for non–service-account callers
  via `RbacPermissionMixin.resolve_platform()`. Paths that include
  `{platform_key}` are the *scoped* variants used by admin tooling and
  public/guest endpoints where the caller has no token.
- Guest endpoints (`/checkout-guest/`, `/public-pricing/`) use `security: [{}]`
  in the schema — no auth header required.
- Cross-Platform records return **`404 Not Found`**, never `403 Forbidden`.
  Returning `403` would leak the existence of another Platform's record. Treat
  a `404` on a known-good item ID as a Platform-scope miss, not a missing row.

## Pagination envelope

List endpoints use the project's `StandardPageNumberPagination` (numeric pages,
not URLs):

```json
{
  "count": 42,
  "next_page": 2,
  "previous_page": null,
  "results": [ /* ... */ ]
}
```

Query parameters: `?page=<int>` and `?page_size=<int>`. `next_page` /
`previous_page` are integers or `null`.

Caveat: the OpenAPI schema currently models these endpoints with DRF's default
`next`/`previous` URL fields. The wire format the server actually returns is
`next_page`/`previous_page`. If a generated client breaks on the missing
`next`/`previous`, that is the cause.

## 402-as-success on access check

`access-check` is the one endpoint that intentionally uses `402 Payment
Required` to deliver a normal response body, not an error envelope. Both
`200 OK` (access granted) and `402 Payment Required` (access denied) return
the same `ItemAccessCheckResponse` schema. The frontend SDK whitelists `402` in
its RTK Query `validateStatus` so the response is parsed as data, not raised as
an error.

Response shape (200 — access granted):

```json
{
  "has_access": true,
  "item_type": "mentor",
  "item_id": "my-mentor-slug",
  "reason": "active",
  "requires_payment": false,
  "pricing_available": false,
  "pricing": null
}
```

Response shape (402 — payment required):

```json
{
  "has_access": false,
  "item_type": "mentor",
  "item_id": "my-mentor-slug",
  "reason": "no_subscription",
  "requires_payment": true,
  "pricing_available": true,
  "pricing": { "item_name": "Pro Mentor", "prices": [ /* ... */ ] }
}
```

`reason` is machine-readable (e.g. `active`, `no_paywall`, `no_subscription`).
`subscription` is included when access is granted via an active subscription.

## Canonical (`unique_id`) vs composite endpoints

Every item-keyed monetization endpoint exposes **two equivalent URLs**:

- **Canonical (recommended)** — keyed by `ItemPaywallConfig.unique_id` or
  `ItemPrice.unique_id` (a single UUID). The dispatch resolves the
  `(platform_key, item_type, item_id)` triple from that UUID. URL-stable across
  item-type renames; no need to carry `platform_key` or `item_type` in calls.
- **Composite (legacy, still supported)** — keyed by the
  `(platform_key, item_type, item_id)` triple. Appropriate when the caller
  already has the triple in hand (e.g. a webhook payload, a freshly created
  paywall, or a migration script) and does not want to look up the UUID first.

The two share `permission_classes` and serializer shapes — they only differ in
how the URL identifies the row. **Prefer the canonical form for new client
code.** Composite is documented alongside so existing integrations keep working.

| Capability | Canonical (recommended) | Composite (legacy) |
|---|---|---|
| Access check (unscoped) | `{dm_url}/api/billing/items/{item_unique_id}/access-check/` | `{dm_url}/api/billing/access-check/{item_type}/{item_id}/?platform_key=…` |
| Access check (scoped) | `{dm_url}/api/billing/items/{item_unique_id}/scoped-access-check/` | `{dm_url}/api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/access-check/` |
| Paywall config | `{dm_url}/api/billing/items/{item_unique_id}/paywall/` | `{dm_url}/api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/paywall/` |
| Prices list | `{dm_url}/api/billing/items/{item_unique_id}/paywall/prices/` | `{dm_url}/api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/paywall/prices/` |
| Price detail | `{dm_url}/api/billing/items/prices/{price_unique_id}/` | `{dm_url}/api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/paywall/prices/{price_id}/` |
| Auth'd checkout | `{dm_url}/api/billing/items/{item_unique_id}/checkout/` **or** `{dm_url}/api/billing/items/prices/{price_unique_id}/checkout/` | `{dm_url}/api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/checkout/` |
| Guest checkout | `{dm_url}/api/billing/items/{item_unique_id}/checkout-guest/` **or** `{dm_url}/api/billing/prices/{price_unique_id}/checkout-guest/` | `{dm_url}/api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/checkout-guest/` |
| Subscription read | `{dm_url}/api/billing/items/{item_unique_id}/subscription/` | `{dm_url}/api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/subscription/` |
| Subscription cancel | `{dm_url}/api/billing/items/{item_unique_id}/subscription/cancel/` | `{dm_url}/api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/subscription/cancel/` |
| Public pricing | `{dm_url}/api/billing/items/{item_unique_id}/pricing/` (and `{dm_url}/api/billing/items/{item_unique_id}/public-pricing/`) | `{dm_url}/api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/pricing/` |
| Item subscribers | `{dm_url}/api/billing/items/{item_unique_id}/subscribers/` | `{dm_url}/api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/subscribers/` |
| Checkout callback | `{dm_url}/api/billing/items/{item_unique_id}/checkout-callback/[<session_id>/]` | `{dm_url}/api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/checkout-callback/[<session_id>/]` |

**Canonical resolver caveats:**

- Buyer-facing canonical routes (`checkout`, `checkout-guest`, by-price
  variants) **404 when the paywall is disabled** — they carry
  `require_enabled_paywall = True` and short-circuit before reaching Stripe.
  Composite routes do not — they delegate to the parent view and fail later.
- Canonical price detail (`items/prices/{price_unique_id}/`) only resolves
  **active, non-deleted prices on enabled paywalls**. Inactive / soft-deleted
  / disabled-paywall prices → `404 NotFound`.
- All resolver 404s render as JSON `{"detail": "<message>"}` with
  `Content-Type: application/json`. They do not render Django's HTML 404 page.

Platform-scoped endpoints (`/api/billing/platforms/{platform_key}/paywalls/`,
`subscribers/`, `revenue/`, `my-subscriptions/`) and Stripe Connect endpoints
do **not** have canonical alternatives — they are platform-scoped, not
item-scoped.

## URL catalog

Paths confirmed against `/tmp/iblai_schema.yaml`. Methods listed per path; an
auth-class column shows the permission gate the backend view applies. Where a
capability has both canonical and composite forms, **canonical is listed
first**.

### Stripe Connect (5 paths)

Platform-scoped only — no canonical alternative.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `{dm_url}/api/service/platforms/{platform_key}/stripe/connect/status/` | Read Connect account state for the Platform. |
| `POST` | `{dm_url}/api/service/platforms/{platform_key}/stripe/connect/onboard/` | Start Express onboarding; returns hosted onboarding URL. |
| `POST` | `{dm_url}/api/service/platforms/{platform_key}/stripe/connect/onboard/refresh/` | Re-issue onboarding URL when the prior link expired. |
| `GET` | `{dm_url}/api/service/platforms/{platform_key}/stripe/connect/dashboard/` | Express Dashboard login link. |
| `DELETE` | `{dm_url}/api/service/platforms/{platform_key}/stripe/connect/` | Disconnect the Platform's Connect account. |

All five require Platform admin (`IsPlatformAdmin`).

### Paywall configuration (Platform admin)

| Method | Path | Form |
|---|---|---|
| `GET` / `PUT` / `DELETE` | `{dm_url}/api/billing/items/{item_unique_id}/paywall/` | **Canonical (recommended)** |
| `GET` / `POST` / `PUT` / `DELETE` | `{dm_url}/api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/paywall/` | Composite (legacy) |

`POST` and `PUT` are interchangeable (upsert). `DELETE` disables the paywall;
it does not destroy the configuration row.

**First-time create:** the canonical URL needs `item_unique_id`, which only
exists after the config has been created. Use the composite URL for the
initial `POST` / `PUT`, then switch to canonical for subsequent operations.

### Prices (Platform admin)

| Method | Path | Form |
|---|---|---|
| `GET` / `POST` | `{dm_url}/api/billing/items/{item_unique_id}/paywall/prices/` | **Canonical (recommended)** |
| `GET` / `PUT` / `DELETE` | `{dm_url}/api/billing/items/prices/{price_unique_id}/` | **Canonical (recommended)** |
| `GET` / `POST` | `{dm_url}/api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/paywall/prices/` | Composite (legacy) |
| `GET` / `PUT` / `DELETE` | `{dm_url}/api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/paywall/prices/{price_id}/` | Composite (legacy) |

The composite detail path parameter is named `price_id` (a UUID); the canonical
form names it `price_unique_id`. Both refer to the `ItemPrice.unique_id`
column. Canonical price-detail only resolves **active, non-deleted prices on
enabled paywalls** — inactive / soft-deleted / disabled-paywall prices → `404`.

### Public pricing (no auth)

| Method | Path | Form |
|---|---|---|
| `GET` | `{dm_url}/api/billing/items/{item_unique_id}/pricing/` | **Canonical (recommended)** |
| `GET` | `{dm_url}/api/billing/items/{item_unique_id}/public-pricing/` | **Canonical (legacy alias of `/pricing/`)** |
| `GET` | `{dm_url}/api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/pricing/` | Composite (legacy) |

Both canonical forms resolve the same paywall config — `/pricing/` is the
mixin-based route; `/public-pricing/` is the original `unique_id` route, kept
for anonymous landing pages that already hold a shareable link.

### Access check

| Method | Path | Form | Notes |
|---|---|---|---|
| `GET` | `{dm_url}/api/billing/items/{item_unique_id}/access-check/` | **Canonical (recommended)** | Unscoped via canonical UUID. |
| `GET` | `{dm_url}/api/billing/items/{item_unique_id}/scoped-access-check/` | **Canonical (recommended)** | Scoped via canonical UUID. |
| `GET` | `{dm_url}/api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/access-check/` | Composite (legacy) | Scoped; `platform_key` in path. |
| `GET` | `{dm_url}/api/billing/access-check/{item_type}/{item_id}/?platform_key=...` | Composite (legacy) | Unscoped; `platform_key` query param optional (token-resolved fallback). |

All four return `200` or `402` with the same `ItemAccessCheckResponse` body —
see above.

### Checkout

| Method | Path | Form | Auth |
|---|---|---|---|
| `POST` | `{dm_url}/api/billing/items/{item_unique_id}/checkout/` | **Canonical (recommended)** | Authenticated user. |
| `POST` | `{dm_url}/api/billing/items/prices/{price_unique_id}/checkout/` | **Canonical (recommended)** | Authenticated user; URL pins the price. |
| `POST` | `{dm_url}/api/billing/items/{item_unique_id}/checkout-guest/` | **Canonical (recommended)** | `AllowAny` (guest). |
| `POST` | `{dm_url}/api/billing/prices/{price_unique_id}/checkout-guest/` | **Canonical (recommended)** | `AllowAny` (guest, by price UUID). |
| `POST` | `{dm_url}/api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/checkout/` | Composite (legacy) | Authenticated user. |
| `POST` | `{dm_url}/api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/checkout-guest/` | Composite (legacy) | `AllowAny` (guest). |

All six return a `CheckoutSessionResponse` containing the Stripe-hosted
checkout URL the client should redirect to. The by-price canonical checkout
(`items/prices/{price_unique_id}/checkout/`) requires no body `price_id` — the
URL itself fixes the price.

Canonical buyer routes carry `require_enabled_paywall = True`: a disabled
paywall returns `404 NotFound` (`{"detail": "Paywall configuration not found."}`)
before reaching Stripe. The composite routes do not — they fail later.

### Checkout callback

| Method | Path | Form |
|---|---|---|
| `GET` | `{dm_url}/api/billing/items/{item_unique_id}/checkout-callback/` | **Canonical (recommended)** |
| `GET` | `{dm_url}/api/billing/items/{item_unique_id}/checkout-callback/{checkout_session_id}/` | **Canonical (recommended)** |
| `GET` | `{dm_url}/api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/checkout-callback/` | Composite (legacy) |
| `GET` | `{dm_url}/api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/checkout-callback/{checkout_session_id}/` | Composite (legacy) |

Hit by Stripe's `success_url` redirect. The session-scoped variant lets the
client confirm a specific session; the bare variant accepts
`?stripe_checkout_id=...` as a query param.

### Subscriptions

| Method | Path | Form |
|---|---|---|
| `GET` | `{dm_url}/api/billing/items/{item_unique_id}/subscription/` | **Canonical (recommended)** |
| `POST` | `{dm_url}/api/billing/items/{item_unique_id}/subscription/cancel/` | **Canonical (recommended)** |
| `GET` | `{dm_url}/api/billing/platforms/{platform_key}/my-subscriptions/` | (platform-scoped, no canonical) |
| `GET` | `{dm_url}/api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/subscription/` | Composite (legacy) |
| `POST` | `{dm_url}/api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/subscription/cancel/` | Composite (legacy) |

`my-subscriptions/` is paginated and filterable by `status` (`active`, `free`,
`grandfathered`, `trialing`, `past_due`, `canceled`, `incomplete`) and
`item_type`. The per-item endpoint returns the active subscription or `404` if
none exists. `ItemSubscriptionCancelView` is hard-locked to `request.user` —
no admin override.

### Analytics (Platform admin)

| Method | Path | Form |
|---|---|---|
| `GET` | `{dm_url}/api/billing/items/{item_unique_id}/subscribers/` | **Canonical (recommended, item-scoped)** |
| `GET` | `{dm_url}/api/billing/platforms/{platform_key}/paywalls/` | (platform-scoped, no canonical) |
| `GET` | `{dm_url}/api/billing/platforms/{platform_key}/subscribers/` | (platform-scoped, no canonical) |
| `GET` | `{dm_url}/api/billing/platforms/{platform_key}/revenue/` | (platform-scoped, no canonical) |
| `GET` | `{dm_url}/api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/subscribers/` | Composite (legacy, item-scoped) |

`paywalls/`, `subscribers/`, and item-scoped `subscribers/` are paginated with
the envelope above. `revenue/` returns a `PlatformRevenueSummary` object
(aggregate totals, not a list — no pagination).

## Schema as authority

The schema is the contract. This catalog exists so a reader can orient quickly,
but every request body, response field, and status code should be confirmed
against the live `schema.yaml` before code lands. See
[./schema-validation.md](./schema-validation.md) for the fetch routine.

## Versioning note

The monetization API has not been versioned in the URL path. Backward
compatibility is managed through the OpenAPI document — fields are added rather
than removed, and the `info.version` field bumps on every release. Pin against
a schema snapshot rather than assuming the live schema is unchanged.

## Related skills

- [/iblai-monetization](../SKILL.md) — index and family map.
- [/iblai-monetization-onboard](../../iblai-monetization-onboard) — Stripe Connect onboarding.
- [/iblai-monetization-configure](../../iblai-monetization-configure) — paywall + price CRUD.
- [/iblai-monetization-checkout](../../iblai-monetization-checkout) — access-check (the 402-as-success consumer) and checkout.
- [/iblai-monetization-subscriptions](../../iblai-monetization-subscriptions) — my-subscriptions, cancel flow.
- [/iblai-monetization-analytics](../../iblai-monetization-analytics) — paywalls, subscribers, revenue.
