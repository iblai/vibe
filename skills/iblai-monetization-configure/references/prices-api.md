# Prices API

Per-item paywall price tier endpoints. See also
[paywall-config-api.md](./paywall-config-api.md) for the parent paywall
configuration and [/iblai-monetization-checkout](../../iblai-monetization-checkout)
for how `PaywallModal` consumes these tiers.

> **Verify before you call.** The live OpenAPI schema at
> `https://api.iblai.app/dm/api/docs/schema/` is the source of truth. Path
> fragments and field shapes shown below are confirmed against that schema
> and `billing/views.py` + `billing/serializers.py`, but may drift.

## Endpoints

| Method | Path | Permission |
|---|---|---|
| GET | `/api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/paywall/prices/` | `IsPlatformAdmin` |
| POST | `/api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/paywall/prices/` | `IsPlatformAdmin` |
| GET | `/api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/paywall/prices/{price_id}/` | `IsPlatformAdmin` |
| PUT | `/api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/paywall/prices/{price_id}/` | `IsPlatformAdmin` |
| DELETE | `/api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/paywall/prices/{price_id}/` | `IsPlatformAdmin` |

`{price_id}` in the URL is the price's UUID (the serializer renames the
backend field `unique_id` to `id` for the client). The URL kwarg name is
`price_id`, not `price_unique_id`.

## Views

- `ItemPriceListView` — `billing/views.py:1183`
- `ItemPriceDetailView` — `billing/views.py:1300`

Both inherit `BaseItemPaywallMixin`, which provides `_validate_admin_request`
(resolves Platform + item-type strategy + item record) and `get_active_price`
(404 if missing or soft-deleted). Both declare
`permission_classes = [IsPlatformAdmin]`.

## GET list — list prices

```
GET /api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/paywall/prices/
```

Returns an **unpaginated JSON array** of `ItemPrice` objects, not the standard
`{count, next, previous, results}` envelope. The view filters
`is_deleted=False AND is_active=True` and orders by `sort_order, amount` — so
inactive and soft-deleted prices are hidden from this response.

If the item has no `ItemPaywallConfig` yet, the response is an empty array
`[]` (200, not 404).

Use this in the admin UI's price-management list **and** the same shape feeds
`PaywallModal`'s rendering of active tiers.

## POST create

```
POST /api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/paywall/prices/
```

Body fields (`ItemPriceCreateSerializer`):

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string, max 255 | yes | Display name, e.g. `"Premium"` |
| `amount` | decimal string, max 10 digits / 2 dp, min 0 | yes | USD, e.g. `"9.99"`; `"0"` for free tier |
| `description` | string, nullable | no | Long-form tier description |
| `currency` | string, max 3 | no | Defaults to `"usd"`. SDK form locks this — see "Currency lock" below |
| `interval` | enum | no | `month` \| `year` \| `one_time`. Defaults to `month` |
| `features` | array of strings, nullable | no | Bulleted list shown under the tier in `PaywallModal` |
| `is_active` | bool | no | Defaults to `true` |
| `remark` | string, max 100 | no | Badge label, e.g. `"Most Popular"` |
| `sort_order` | integer | no | Defaults to `0`. Lower renders first |

Preconditions enforced before any Stripe call:

- The Platform's Stripe Connect account must be ready
  (`require_connect_account_ready` — 400 otherwise).
- The item's `ItemPaywallConfig` must exist AND `is_enabled=True`. Otherwise
  the response is `400 {"detail": "Paywall must be enabled before creating prices"}`.

Side effects, in order:

1. If the `ItemPaywallConfig` has no `stripe_product_id`, a Stripe Product is
   created on the connected account and persisted to the config.
2. A Stripe Price is created on the connected account using `amount`,
   `currency`, and `interval`. The returned `stripe_price_id` is stored on
   the new `ItemPrice`. Idempotency: if a price with the same
   `stripe_price_id` already exists for this config, the existing row is
   returned with `200` instead of duplicating.
3. Stripe errors (product or price creation) surface as
   `500 {"detail": "Failed to create Stripe product."}` or
   `500 {"detail": "Failed to create Stripe price."}` — the DB write is
   skipped, no orphan row is created.

Success response: `201 ItemPrice`.

## PUT update

```
PUT /api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/paywall/prices/{price_id}/
```

Accepts the same body shape as POST. The view applies `partial=True`, so any
subset of fields is allowed.

Stripe-side behavior:

- If `amount`, `currency`, OR `interval` changes AND the row already has a
  `stripe_price_id`, the view creates a **new** Stripe Price (Stripe Prices
  are immutable), writes the new id to `stripe_price_id`, then best-effort
  deactivates the old Stripe Price.
- If only `name`, `description`, `features`, `sort_order`, `remark`, or
  `is_active` change, no Stripe call is made.
- A Stripe failure during rotation returns
  `500 {"detail": "Failed to update Stripe price."}` and the DB write is
  rolled back.

Success response: `200 ItemPrice`.

## DELETE — soft delete

```
DELETE /api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/paywall/prices/{price_id}/
```

The view sets `is_deleted=True`, `is_active=False`, and `deleted_at=now()`,
then best-effort deactivates the Stripe Price on the connected account (it is
**archived**, not deleted, so existing subscriptions on this tier keep
billing).

A soft-deleted price disappears from the GET list response. There is no
`?include_deleted=true` query parameter on this endpoint — once deleted, the
row is reachable only through the admin/database.

Success response: `204 No Content`.

## `ItemPrice` model

Defined at `billing/models.py:188`.

| Field | Type | Default | Notes |
|---|---|---|---|
| `unique_id` | UUIDField | `uuid.uuid4` | Exposed as `id` in the serializer; appears in URL paths |
| `paywall_config` | FK → `ItemPaywallConfig` | — | `on_delete=CASCADE`, `related_name="prices"` |
| `name` | CharField(255) | — | Required |
| `description` | TextField | `""` | `blank=True, null=True` |
| `amount` | DecimalField(10, 2) | — | USD; `min_value=0` enforced by the create serializer |
| `currency` | CharField(3) | `"usd"` | |
| `interval` | CharField(20) choices | `month` | `IntervalChoices.MONTH` / `YEAR` / `ONE_TIME` |
| `stripe_price_id` | CharField(255) | `null` | Read-only on the serializer; written by the create/update view |
| `is_active` | BooleanField | `True` | Inactive rows are hidden from GET list |
| `features` | JSONField | `null` | List of strings |
| `remark` | CharField(100) | `""` | e.g. `"Most Popular"` |
| `sort_order` | IntegerField | `0` | Ascending |
| `is_deleted` | BooleanField | `False` | `db_index=True`; soft-delete flag |
| `deleted_at` | DateTimeField | `null` | Stamped on DELETE |
| `created_at` | DateTimeField | `auto_now_add` | Read-only |
| `updated_at` | DateTimeField | `auto_now` | Read-only |

`Meta.ordering = ["sort_order", "amount"]`.

The `is_free` property returns `True` when `amount == 0` — used by checkout
to skip Stripe entirely for free tiers.

## `interval` semantics

| Value | Stripe behavior |
|---|---|
| `month` | Recurring price with `interval=month`. Subscription renews monthly |
| `year` | Recurring price with `interval=year`. Subscription renews annually |
| `one_time` | One-time price. No subscription is created; a single charge. `PaywallModal` hides the renewal suffix for this interval |

## Currency lock

The SDK's `price-management.tsx` form locks the `currency` field:

```tsx
<Input value={form.currency} disabled
       className="mt-1 bg-gray-50 text-gray-500 cursor-not-allowed" />
```

The form's `EMPTY_FORM` initializes `currency: 'usd'` and the field is
non-editable. The backend technically accepts any 3-character currency code,
but multi-currency is **not** exercised by the SDK and the Stripe Connect
billing flow assumes USD. If a custom form sends a different currency
code, expect downstream surprises in revenue analytics and Stripe Connect
payouts.

## `features` — chip list

Stored as a JSON array of strings on the model. The SDK's `PriceForm` uses a
chip-style input: typing into the `Add a feature...` text box and pressing
Enter (or clicking the `+` button) appends the trimmed value to
`form.features`; clicking a chip's `X` removes it.

`PaywallModal` renders each feature as a `<li>` with a checkmark icon under
the price tier:

```tsx
{price.features.length > 0 && (
  <div>
    <p className="text-sm font-medium mb-3">This includes:</p>
    <ul className="space-y-3">
      {price.features.map((feature, idx) => (
        <li key={idx}>...<span>{feature}</span></li>
      ))}
    </ul>
  </div>
)}
```

## `is_active`

Inactive prices are excluded from the GET list response (the view filters
`is_active=True`), so they never appear in `PaywallModal`. However, the SDK's
admin price-management list reads the same endpoint, which means **inactive
prices are not visible in the admin UI either** via the public API alone — the
"Inactive" badge in `price-management.tsx` is reachable only if the list
filter is relaxed in a future revision or rows are flipped from a separate
admin tool. Treat `is_active=false` as "retired tier, existing subscriptions
keep billing, new buyers cannot pick this tier".

## `sort_order`

Integer, ascending. Both the model's `Meta.ordering` and the list view's
`order_by("sort_order", "amount")` sort by `sort_order` first, then `amount`
as a tie-breaker. Use it to pin tiers in a deliberate order (typically lowest
monthly to highest); `PaywallModal` renders prices in the order they arrive
from the API.

## RTK Query cache tags

From `packages/data-layer/src/features/monetization/custom-api-slice.ts`:

- `listPrices` — `providesTags: ['paywallPrices']`
- `createPrice`, `updatePrice`, `deletePrice` —
  `invalidatesTags: ['paywallPrices', 'paywallConfig']`

Invalidating `paywallConfig` is intentional: the configured-items list under
`/iblai-monetization-analytics` shows an active-price count per item, so it
needs to refresh whenever a price is added, edited, or removed.

## Related skills

- [/iblai-monetization](../../iblai-monetization) — family index, schema-validation routine
- [/iblai-monetization-checkout](../../iblai-monetization-checkout) — `PaywallModal` consumer
- [/iblai-monetization-onboard](../../iblai-monetization-onboard) — Stripe Connect prerequisite
- [/iblai-monetization-analytics](../../iblai-monetization-analytics) — paywalls list with active-price counts
