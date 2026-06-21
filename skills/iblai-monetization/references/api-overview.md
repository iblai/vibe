# Monetization REST API — overview

Reference card for the URL paths, auth, pagination, and error contract used by
the monetization skill family. The live OpenAPI schema at
[https://api.iblai.app/dm/api/docs/schema/](https://api.iblai.app/dm/api/docs/schema/)
is the source of truth; this page is for orientation. When the table here and
the schema disagree, trust the schema. See [./schema-validation.md](./schema-validation.md)
for the fetch routine.

## Base URLs

Two prefixes carry the monetization surface:

- **Billing** — `/api/billing/...` (unscoped + by-ID variants) and
  `/api/billing/platforms/{platform_key}/...` (Platform-scoped).
- **Stripe Connect** — `/api/service/platforms/{platform_key}/stripe/connect/...`.
  Every Stripe Connect path is Platform-scoped.

There is no URL-level API version. Backward-compatibility lives in the schema;
check `info.version` (an `info.version` like `4.281.0-ai-plus` at the time of
writing — the value rolls forward each release) to know what is deployed.

## Authentication

- Header: `Authorization: Token <token>` (NOT `Bearer`).
- `platform_key` is resolved from the token for non–service-account callers via
  `RbacPermissionMixin.resolve_platform()`. Paths that include `{platform_key}`
  are the *scoped* variants used by admin tooling and public/guest endpoints
  where the caller has no token.
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

## URL catalog

Paths confirmed against `/tmp/iblai_schema.yaml`. Methods listed per path; an
auth-class column shows the permission gate the backend view applies.

### Stripe Connect (5 paths)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/service/platforms/{platform_key}/stripe/connect/status/` | Read Connect account state for the Platform. |
| `POST` | `/api/service/platforms/{platform_key}/stripe/connect/onboard/` | Start Express onboarding; returns hosted onboarding URL. |
| `POST` | `/api/service/platforms/{platform_key}/stripe/connect/onboard/refresh/` | Re-issue onboarding URL when the prior link expired. |
| `GET` | `/api/service/platforms/{platform_key}/stripe/connect/dashboard/` | Express Dashboard login link. |
| `DELETE` | `/api/service/platforms/{platform_key}/stripe/connect/` | Disconnect the Platform's Connect account. |

All five require Platform admin (`IsPlatformAdmin`).

### Paywall configuration (Platform admin)

| Method | Path |
|---|---|
| `GET` / `POST` / `PUT` / `DELETE` | `/api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/paywall/` |

`POST` and `PUT` are interchangeable (upsert). `DELETE` disables the paywall;
it does not destroy the configuration row.

### Prices (Platform admin)

| Method | Path |
|---|---|
| `GET` / `POST` | `/api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/paywall/prices/` |
| `GET` / `PUT` / `DELETE` | `/api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/paywall/prices/{price_id}/` |

The path parameter is named `price_id` (a UUID) in this route. In the by-price
guest checkout below the same UUID is named `price_unique_id` — both refer to
the `ItemPrice.unique_id` column.

### Public pricing (no auth)

| Method | Path |
|---|---|
| `GET` | `/api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/pricing/` |
| `GET` | `/api/billing/items/{config_unique_id}/public-pricing/` |

The first form is the Platform-scoped lookup. The second resolves a paywall
config by its `unique_id` (UUID) — useful for anonymous landing pages that
already hold a shareable link to a specific paywall.

### Access check (authenticated)

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/access-check/` | Scoped variant; `platform_key` in path. |
| `GET` | `/api/billing/access-check/{item_type}/{item_id}/?platform_key=...` | Unscoped; `platform_key` query param optional (token-resolved fallback). |

Both return `200` or `402` with the same `ItemAccessCheckResponse` body — see
above.

### Checkout

| Method | Path | Auth |
|---|---|---|
| `POST` | `/api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/checkout/` | Authenticated user. |
| `POST` | `/api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/checkout-guest/` | `AllowAny` (guest). |
| `POST` | `/api/billing/prices/{price_unique_id}/checkout-guest/` | `AllowAny` (guest, by price UUID). |

All three return a `CheckoutSessionResponse` containing the Stripe-hosted
checkout URL the client should redirect to.

### Checkout callback

| Method | Path |
|---|---|
| `GET` | `/api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/checkout-callback/` |
| `GET` | `/api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/checkout-callback/{checkout_session_id}/` |

Hit by Stripe's `success_url` redirect. The session-scoped variant lets the
client confirm a specific session; the bare variant accepts
`?stripe_checkout_id=...` as a query param.

### Subscriptions

| Method | Path |
|---|---|
| `GET` | `/api/billing/platforms/{platform_key}/my-subscriptions/` |
| `GET` | `/api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/subscription/` |
| `POST` | `/api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/subscription/cancel/` |

`my-subscriptions/` is paginated and filterable by `status` (`active`, `free`,
`grandfathered`, `trialing`, `past_due`, `canceled`, `incomplete`) and
`item_type`. The per-item endpoint returns the active subscription or `404` if
none exists.

### Analytics (Platform admin)

| Method | Path |
|---|---|
| `GET` | `/api/billing/platforms/{platform_key}/paywalls/` |
| `GET` | `/api/billing/platforms/{platform_key}/subscribers/` |
| `GET` | `/api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/subscribers/` |
| `GET` | `/api/billing/platforms/{platform_key}/revenue/` |

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
