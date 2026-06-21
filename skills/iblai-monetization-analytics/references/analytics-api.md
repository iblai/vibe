# Analytics API

Four Platform-admin endpoints power custom monetization dashboards — the configured paywalls list, two flavors of subscriber listing (Platform-wide and per-item), and a revenue snapshot. All four are gated by `IsPlatformAdmin`; anonymous callers get 401, non-admin authenticated users get 403. Pair with [/iblai-monetization-analytics](../SKILL.md) for the UI playbook and [/iblai-monetization → references/schema-validation.md](../../iblai-monetization/references/schema-validation.md) for the live-schema check routine.

## Endpoints

All four return JSON and are scoped by the URL `{platform_key}`. The Platform must have `enable_monetization === true` — the view's `_enforce_can_sell_items` guard blocks the call otherwise.

- `GET /api/billing/platforms/{platform_key}/paywalls/` — list configured paywalls
- `GET /api/billing/platforms/{platform_key}/subscribers/` — Platform-wide subscribers
- `GET /api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/subscribers/` — per-item subscribers
- `GET /api/billing/platforms/{platform_key}/revenue/` — total revenue snapshot

## Views

Verified against `billing/views.py`:

- `PlatformPaywallsView` at `billing/views.py:2115` — `IsPlatformAdmin`, `StandardPageNumberPagination`, serializes via `ItemPaywallConfigSerializer`.
- `PlatformSubscribersView` at `billing/views.py:2073` — `IsPlatformAdmin`, `StandardPageNumberPagination`, serializes via `ItemSubscriptionListSerializer`.
- `ItemSubscribersView` at `billing/views.py:2030` — `IsPlatformAdmin`, `StandardPageNumberPagination`, serializes via `ItemSubscriptionSerializer`.
- `PlatformRevenueView` at `billing/views.py:2156` — `IsPlatformAdmin`, no pagination, serializes via `PlatformRevenueSummarySerializer`.

## Pagination envelope

The three list endpoints use `core.utils.pagination.StandardPageNumberPagination`, which serializes to:

```json
{
  "count": 123,
  "next_page": 2,
  "previous_page": null,
  "results": [ ... ]
}
```

`next_page` / `previous_page` are page numbers (or `null`), not URLs. Query params `page` and `page_size` are accepted on all three list endpoints. The SDK types match: `ListPaywallsResponse` and `ListSubscribersResponse` declare `count`, `next_page`, `previous_page`, `results`.

## GET paywalls — list configured paywalls

Use for a custom configured-items dashboard sorted by active subscribers, revenue, or enablement status.

| Query param | Type | Notes |
|---|---|---|
| `item_type` | string | Filter by normalized item type (e.g. `mentor`, `course`). |
| `is_enabled` | bool / null | Filter by enablement flag; omit to include both. |
| `search` | string | Server-side search across `item_id` and `description`. |
| `page` | int | 1-based page number. |
| `page_size` | int | Bounded by `STANDARD_MAX_PAGE_SIZE`. |

Each result is a `PaywallConfigResponse` — `unique_id`, `item_type`, `item_id`, `item_name`, `is_enabled`, `allow_free_tier`, `trial_period_days`, `grandfathering_strategy`, `prices: PaywallPrice[]`. SDK hook: `useListPaywallsQuery`.

## GET subscribers — Platform-wide

Use for an admin "Subscribers" view spanning all items, exportable to CSV.

| Query param | Type | Notes |
|---|---|---|
| `status` | string | One of the `ItemSubscription.StatusChoices` values (`active`, `canceled`, `past_due`, `trialing`, etc.). |
| `item_type` | string | Filter by normalized item type. |
| `search` | string | Server-side search across `user.username`, `user.email`, `item_id`. |
| `page` | int | 1-based page number. |
| `page_size` | int | Bounded by `STANDARD_MAX_PAGE_SIZE`. |

The list serializer is `ItemSubscriptionListSerializer` — it flattens user fields (`user_id`, `username`, `email`) inline alongside the subscription columns (`unique_id`, `item_type`, `item_id`, `item_name`, `status`, `price`, `created_at`, `updated_at`). The SDK declares results as `(SubscriptionObject & { user: unknown })[]`, but the wire payload exposes `user_id` / `username` / `email` as top-level fields, not nested under `user`. Read the flat fields on the serializer output.

SDK hook: `useListSubscribersQuery`.

## GET subscribers — per-item

Drilldown from a paywall detail page or a leaderboard row. Scoped to one `(item_type, item_id)` pair.

Returns the richer `ItemSubscriptionSerializer` shape (21 fields per row) — adds `current_period_start`, `current_period_end`, `trial_end`, `cancel_at_period_end`, `canceled_at`, `is_grandfathered`, `grandfathered_at`, `billing_portal_url`, and `metadata` on top of the 12 fields returned by the Platform-wide list. The Platform-wide list uses the flatter `ItemSubscriptionListSerializer`.

| Query param | Type | Notes |
|---|---|---|
| `status` | string | Same status choices as Platform-wide. |
| `search` | string | Same search behavior as Platform-wide. |
| `page` | int | 1-based page number. |
| `page_size` | int | Bounded by `STANDARD_MAX_PAGE_SIZE`. |

Note there is no `item_type` query param — the item type is in the URL. SDK hook: `useListItemSubscribersQuery` (typed via `ListItemSubscribersParams`).

## GET revenue — sales summary

Top-line numbers for the Platform. No query params today; the schema may add a date range in a future release — re-check at fetch time.

Response (`PlatformRevenueSummary`):

```json
{
  "sales_volume": "1234.56",
  "sales_count": 42,
  "currency": "usd"
}
```

- `sales_volume` — sum of `ItemPaymentRecord.connected_account_amount` for `SUCCEEDED` payments on the Platform. Schema declares it as `string` with `format: decimal` (DRF serializes `DecimalField` as a string on the wire). The SDK's `RevenueResponse.sales_volume` is typed `number` — coerce defensively (`Number(value)`) before arithmetic.
- `sales_count` — `Count("id")` over the same `SUCCEEDED` queryset.
- `currency` — pulled from the first `SUCCEEDED` `ItemPaymentRecord.currency`, falling back to `"usd"` when no payments exist yet.

SDK hook: `useGetRevenueQuery`.

### Underlying data source — `ItemPaymentRecord`

Revenue is computed from `ItemPaymentRecord` rows whose `status` is `SUCCEEDED`. Rows are created when `handle_item_checkout_completed` (`dl_iblai_services_app/services/stripe/item_paywall_handlers.py:505`) reconciles a session into a payment record. The same function is invoked from two sites with the same downstream effect: the Stripe `checkout.session.completed` webhook dispatch (`dl_iblai_services_app/services/stripe/webhook.py:100`) and the post-redirect `ItemCheckoutCallbackView` callback (`billing/views.py:2333`). This is NOT a live Stripe API call — sales appear in `/revenue/` only after the handler runs. Latency is typically under 30s but can stretch when Stripe queues or your webhook handler is delayed.

If the Stripe Connect account is not fully onboarded, `connected_account_amount` will not populate, and `sales_volume` will under-report. Confirm `is_ready_for_payments` via [/iblai-monetization-onboard](../../iblai-monetization-onboard/SKILL.md) before relying on revenue numbers.

## Commission interpretation

`commission_percent` is exposed on the Stripe Connect status payload (`GET /api/service/platforms/{platform_key}/stripe/connect/status/`). It is the percentage **ibl.ai** takes from each sale, NOT the seller's take.

Shape (per `StripeConnectStatusResponse`):

```ts
commission_percent: {
  mentor: number;
  course: number;
  program: number;
  pathway: number;
}
```

Heads-up — this field has a **3-way source disagreement**. All three are technically wrong in different ways; trust the wire and code defensively:

| Source | Keys returned | Missing |
|---|---|---|
| Backend wire (`dl_iblai_services_app/models/stripe_connect.py:7-12`) | `mentor`, `course`, `program`, `pathway` | — (truth) |
| OpenAPI schema component `ItemTypeCommission` | `mentor`, `course`, `program` | `pathway` |
| SDK TypeScript type | `mentor`, `course` | `program`, `pathway` |

Treat unknown item-type keys as optional in your renderer so the SDK type doesn't make you discard real values.

A value of `25.0` means ibl.ai takes 25% and the seller keeps 75%. Computed in `StripeConnectAccount.commission_percent` (`dl_iblai_services_app/models/stripe_connect.py:120-127`) by reading per-Platform dynamic `Config` for each item type via the module-level `COMMISSION_CONFIG_KEYS` map (`stripe_connect.py:7`):

| `ItemType` | Config key | Default |
|---|---|---|
| `MENTOR` | `STRIPE_ITEM_COMMISSION_PERCENT_MENTOR` | 25.00 |
| `COURSE` | `STRIPE_ITEM_COMMISSION_PERCENT_COURSE` | 25.00 |
| `PROGRAM` | `STRIPE_ITEM_COMMISSION_PERCENT_PROGRAM` | 25.00 |
| `PATHWAY` | `STRIPE_ITEM_COMMISSION_PERCENT_PATHWAY` | 25.00 |

Stripe Connect charges flow as destination charges with `application_fee_amount` derived from the per-item-type percentage, so commission auto-routes to ibl.ai's platform Stripe account. There is nothing for your app to do on each transaction; just display the percentage if you want sellers to see their take-rate. SDK hook: `useGetStripeConnectStatusQuery`.

## Building a revenue dashboard

Recommended composition for a custom analytics page:

1. **Top-line tiles** — `useGetRevenueQuery({ platform_key })` for `sales_volume` (coerce with `Number()`), `sales_count`, and `currency`. Format `sales_volume` with the locale-aware `Intl.NumberFormat('en-US', { style: 'currency', currency })`.
2. **Active-subscriber count** — `useListSubscribersQuery({ platform_key, status: 'active', page_size: 1 })` and read `count`. Repeat with `status: 'trialing'` if trials matter.
3. **Take-rate display** — `useGetStripeConnectStatusQuery({ platform_key })` to render the `commission_percent` block per item type.
4. **MoM deltas** — paginate `useListSubscribersQuery` and aggregate `created_at` client-side into month buckets. There is no server-side aggregation endpoint today, so cap your page sweep (Stripe-style cursor pagination is not available — this is offset/page-number).
5. **Per-item leaderboard** — fan out `useListItemSubscribersQuery` calls keyed off the `useListPaywallsQuery` results to count active subscribers per paywalled item. RTK Query dedupes the requests by key.

## `CancelSubscription` component

The SDK ships a self-service cancel UI at `packages/web-containers/src/components/profile/monetization/cancel-subscription.tsx`. The `CancelSubscription` tool calls `useCancelSubscriptionMutation`, which cancels the **caller's own** subscription on the given `(item_type, item_id)` — the underlying endpoint is hard-locked to `request.user`. Admin cancel-on-behalf-of-user is NOT supported by this API; for that, the operator must use Stripe directly.

**Import caveat:** `CancelSubscription` is not currently re-exported from `@iblai/iblai-js/web-containers`. Copy the component from `packages/web-containers/src/components/profile/monetization/cancel-subscription.tsx` or wait for an export.

```tsx
// Once re-exported:
// import { CancelSubscription } from '@iblai/iblai-js/web-containers';

<CancelSubscription platformKey={currentTenant.key} />
```

Internally:

- Lookup the caller's own subscription by `(item_type, item_id)` → `useLazyGetItemSubscriptionQuery`.
- Cancel it → `useCancelSubscriptionMutation`.
- Result branches on the cancel response shape:
  - `result.portal_url` present → recurring subscription; the SDK redirects to the Stripe billing portal so the customer can cancel there. Stripe requires the customer to cancel a recurring sub themselves.
  - Otherwise the response is the full `ItemSubscriptionSerializer` payload for the immediately-canceled subscription (one-time / grandfathered / already-mid-cycle path); branch on `result.status === 'canceled'`.

Cancelling invalidates the caller's `accessCheck` cache, so they lose access at next page-load. For the user-side surface that wraps this in a list of all purchases, see [/iblai-monetization-subscriptions](../../iblai-monetization-subscriptions/SKILL.md).

## Related skills

- [/iblai-monetization](../../iblai-monetization/SKILL.md) — family index, RBAC matrix, item-type normalization.
- [/iblai-monetization-onboard](../../iblai-monetization-onboard/SKILL.md) — Stripe Connect status, commission display, payouts readiness.
- [/iblai-monetization-configure](../../iblai-monetization-configure/SKILL.md) — paywall + price CRUD covered by `useListPaywallsQuery`.
- [/iblai-monetization-subscriptions](../../iblai-monetization-subscriptions/SKILL.md) — user-side counterpart with portal_url vs immediate branch logic.
- [/iblai-rbac](../../iblai-rbac/SKILL.md) — the `IsPlatformAdmin` gate.
