# Paywall config API

Source of truth for the paywall-configuration endpoint that the
admin wizard drives. Verified against the live OpenAPI schema at
`https://api.iblai.app/dm/api/docs/schema/`, the backend view at
`web/ibl-dm-core-apps/ibl-dm-billing-app/billing/views.py:998`, the
`ItemPaywallConfig` model, and the TypeScript types in the frontend
SDK at `packages/data-layer/src/features/monetization/types.ts`.

## Endpoint

> `{dm_url}` = your DM service host (e.g. `https://api.iblai.app/dm`).
> Auth header: `Authorization: Token <DM token>` — the **DM token**, not
> the AXD token; the AXD token returns `401`.

```
# Canonical (recommended) — keyed by ItemPaywallConfig.unique_id
GET    {dm_url}/api/billing/items/{item_unique_id}/paywall/
PUT    {dm_url}/api/billing/items/{item_unique_id}/paywall/
DELETE {dm_url}/api/billing/items/{item_unique_id}/paywall/

# Composite (legacy) — also accepts POST for the initial create
GET    {dm_url}/api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/paywall/
POST   {dm_url}/api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/paywall/
PUT    {dm_url}/api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/paywall/
DELETE {dm_url}/api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/paywall/
```

**Initial create requires composite.** The canonical URL needs
`item_unique_id`, which only exists after the row has been created. Use
the composite `POST` for the first write; capture `unique_id` from the
response; switch to canonical for subsequent operations.

- **Views:** `ItemPaywallConfigView` (`billing/views.py:998`, composite) +
  `ItemPaywallConfigByUniqueIdView` (`new_views.py`, canonical via
  `ConfigUniqueIdMixin`).
- **Permission:** `IsPlatformAdmin` — Platform-scoped admin token only.
  Same class on both canonical and composite views.
- **Mixin:** `BaseItemPaywallMixin` — also enforces `enforce_can_sell_items`
  (Stripe Connect readiness) inside `_validate_admin_request`.
- **SDK hooks** (`monetizationApiSlice`):
  - `useGetPaywallConfigQuery(PaywallItemParams)` — GET
  - `useEnablePaywallMutation(EnablePaywallArgs)` — POST
  - `useUpdatePaywallMutation(EnablePaywallArgs)` — PUT
  - `useDisablePaywallMutation(PaywallItemParams)` — DELETE

## Path parameters

| Name | Type | Notes |
|---|---|---|
| `platform_key` | string | Platform key (must match the token's Platform). |
| `item_type` | string | `mentor`, `course`, `program`, `pathway`, or `custom:<slug>`. Normalized by `normalize_item_type()` — unknown types are auto-prefixed `custom:`. |
| `item_id` | string | UUID for mentors; slug/course-key for others; free-form for custom types. |

## GET — fetch paywall config

Returns the current configuration for an item. Always returns 200 — if
no `ItemPaywallConfig` row exists yet, a synthetic "disabled" stub is
returned instead of a 404 so the wizard's "first-time" form renders the
same way as the "edit" form.

**Response 200** — `PaywallConfigResponse` (full row exists):

```json
{
  "unique_id": "8f9c3e8e-2d6d-4a3d-9c2e-1b8f7d6e5a4c",
  "item_type": "mentor",
  "item_id": "a1b2c3d4-...",
  "item_name": "Career Coach",
  "item_metadata": null,
  "platform": { "key": "main", "name": "Main" },
  "is_enabled": true,
  "description": "1-on-1 career coaching",
  "allow_free_tier": false,
  "stripe_product_id": "prod_QabcXYZ",
  "trial_period_days": 7,
  "grandfathering_strategy": "free_forever",
  "on_successful_payment": "https://app.example.com/thanks",
  "paywall_enabled_at": "2026-06-12T18:00:00Z",
  "prices": [ /* ItemPrice[] — see references/prices-api.md */ ],
  "created_at": "2026-06-10T10:00:00Z",
  "updated_at": "2026-06-12T18:00:00Z"
}
```

**Response 200** — stub (no row yet) — only these fields are returned:

```json
{
  "item_type": "mentor",
  "item_id": "a1b2c3d4-...",
  "is_enabled": false,
  "allow_free_tier": false,
  "trial_period_days": 0,
  "prices": []
}
```

The wizard treats the stub shape as "first save will POST". After the
first save the full envelope is returned and `unique_id` is available
for the prices endpoint.

## POST — create or enable

Used by the SDK's `useEnablePaywallMutation` on first save.

**Body** — `EnablePaywallArgs` / `ItemPaywallConfigCreate`:

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `is_enabled` | boolean | no | unchanged | First-time enable flips this to `true`. |
| `allow_free_tier` | boolean | no | `false` | Lets buyers skip Stripe checkout. |
| `trial_period_days` | integer (≥ 0) | no | `0` | Free-trial days passed to Stripe. |
| `grandfathering_strategy` | enum | no | `require_subscription` | `free_forever` \| `require_subscription`. |
| `item_name` | string (≤ 255) | conditional | — | **Required** when `item_type` starts with `custom:`. Used as the Stripe Product name. |
| `description` | string | no | `""` | Marketing copy shown at checkout. |
| `on_successful_payment` | URI (≤ 500) | no | `""` | Stripe redirect after successful checkout. The SDK derives a sensible default via `buildOnSuccessfulPaymentUrl` (`paywall-utils.ts`) from the current auth URL + item type — pass an explicit URL only if you need to override. |
| `item_metadata` | JSON | no | `null` | Arbitrary blob for custom types only. |

**Response 200** — `PaywallConfigResponse` (same shape as GET).

**Side effects on first enable** (`will_enable && !was_enabled`):

1. `enforce_can_sell_items` re-checks Stripe Connect is ready —
   returns 400 if not.
2. `get_or_create_stripe_product` creates a Stripe Product on the
   Platform's connected account. Failure returns 500 with
   `{"detail": "Failed to create Stripe product."}`.
3. Inside an `atomic()` block with `select_for_update`, the config is
   updated and `paywall_enabled_at` is set to `timezone.now()` if it
   was null.
4. `strategy.post_enable_paywall(config, platform)` runs in the same
   transaction. This is where grandfathering happens (see below).
   If it raises, the whole block rolls back.
5. Post-commit, `sync_stripe_product` pushes the name/description back
   to Stripe (best-effort, non-blocking).

## PUT — update existing config

Internally `put()` calls `post()`, so the behavior is identical. The
SDK calls `useUpdatePaywallMutation` after the first save so its cache
key reflects an "update" intent. Grandfathering re-runs only when the
transition is `is_enabled: false → true`; flipping other fields on an
already-enabled config does **not** re-grandfather existing users.

## DELETE — disable (does not erase)

```
HTTP 204 No Content
```

Sets `is_enabled = false` inside a transaction; the row, prices, and
existing `ItemSubscription` records are preserved. Stripe subscriptions
are **not** auto-canceled — the paywall flag flips off, but historical
subscription rows remain readable through
`{dm_url}/api/billing/platforms/{platform_key}/items/.../subscribers/`
(or the canonical `{dm_url}/api/billing/items/{item_unique_id}/subscribers/`).

If no config row exists, the response is still 204 (idempotent).

## `ItemPaywallConfig` model

File: `web/ibl-dm-core-apps/ibl-dm-billing-app/billing/models.py` (line 74).

| Field | Type | Notes |
|---|---|---|
| `unique_id` | `UUIDField`, unique, `default=uuid.uuid4` | Embedded in `/paywall/prices/` URL paths and in public pricing keys. |
| `item_type` | `CharField(max_length=50)`, db_index | Normalized via `normalize_item_type` on save. |
| `item_id` | `CharField(max_length=255)`, db_index | Stringified — UUIDs are stored as strings. |
| `platform` | `FK("core.Platform", on_delete=CASCADE)` | `related_name="item_paywall_configs"`. |
| `is_enabled` | `BooleanField`, default=False | The on/off flag the wizard toggles. |
| `description` | `TextField`, blank=True | Marketing copy. |
| `item_name` | `CharField(max_length=255)`, blank=True | Built-in types resolve names from their domain models; custom types must set this. |
| `item_metadata` | `JSONField`, nullable | Custom types only. |
| `allow_free_tier` | `BooleanField`, default=False | Lets users bypass checkout. |
| `stripe_product_id` | `CharField(max_length=255)`, nullable | Stripe Product on the connected account. Read-only via the serializer. |
| `trial_period_days` | `IntegerField`, default=0 | `0` = no trial. |
| `grandfathering_strategy` | `CharField(max_length=50)`, choices | `FREE_FOREVER` \| `REQUIRE_SUBSCRIPTION`, default `REQUIRE_SUBSCRIPTION`. |
| `on_successful_payment` | `URLField(max_length=500)`, blank=True | Stripe redirect URL. |
| `paywall_enabled_at` | `DateTimeField`, nullable | Set on first enable. Used by strategies as the grandfathering cutoff. |
| `created_at` / `updated_at` | `DateTimeField` | Auto. |

**Unique constraint:** `(item_type, item_id, platform)` — one config
per item per Platform.

**`save()` override:** normalizes `item_type` and sets
`paywall_enabled_at = now()` if `is_enabled` is true and the timestamp
is still null. This is the same guarantee the view enforces — both
paths converge.

## Grandfathering strategies

The enum lives in `ItemPaywallConfig.GrandfatheringStrategy`. The
schema name is `GrandfatheringStrategyEnum`. The view dispatches via
`strategy.post_enable_paywall(config, platform)`; each item-type
strategy reads `config.grandfathering_strategy` and acts accordingly.

| Value | Behavior |
|---|---|
| `free_forever` | Users who had access **before** `paywall_enabled_at` are issued grandfathered subscription rows with `is_grandfathered=true`. They keep free access forever. New users (signing up after that timestamp) must pay. |
| `require_subscription` | No grandfathering. Every user — including existing ones — sees the paywall on the next access check and must subscribe. This is the **default**. |

`paywall_enabled_at` is the cutoff timestamp the strategy reads. It's
only ever set once — subsequent enable/disable toggles do not move it.

## Wizard mechanics

The SDK's `MonetizationTab` distinguishes "this item is brand-new" from
"this item has been configured before" via local component state
(`itemCreated`). It calls `useEnablePaywallMutation` on the first save
and `useUpdatePaywallMutation` on subsequent saves.

For **custom items** the flow is two POSTs:

1. The wizard's "Item Details" step POSTs with `is_enabled: false` and
   a required `item_name`. This creates a dormant `ItemPaywallConfig`
   so `unique_id` exists and the prices endpoint becomes reachable.
2. The "Paywall config" step then PUTs the same URL with
   `is_enabled: true` plus the grandfathering / free-tier / trial
   settings. The Stripe Product is created at that point because the
   `false → true` transition runs the full enable side effects.

For **built-in items** (`mentor`, `course`, `program`, `pathway`) the
item already exists, so step 1 is skipped; the first save POSTs with
`is_enabled: true` and side effects run immediately.

## TypeScript types

From `packages/data-layer/src/features/monetization/types.ts`:

```ts
export interface PaywallItemParams {
  platform_key: string;
  item_type: string;
  item_id: string;
}

export interface EnablePaywallArgs extends PaywallItemParams {
  is_enabled: boolean;
  allow_free_tier: boolean;
  trial_period_days: number;
  grandfathering_strategy: 'free_forever' | 'require_subscription';
  item_name?: string;
  description?: string;
  on_successful_payment?: string;
}

export interface PaywallConfigResponse {
  unique_id: string;
  item_type: string;
  item_id: string;
  item_name: string;
  is_enabled: boolean;
  allow_free_tier: boolean;
  trial_period_days: number;
  grandfathering_strategy: string;
  stripe_product_id: string | null;
  paywall_enabled_at: string | null;
  prices: PaywallPrice[];
}
```

The same `EnablePaywallArgs` interface backs both
`useEnablePaywallMutation` (POST) and `useUpdatePaywallMutation`
(PUT) — the only difference is the cache invalidation strategy.

## Common errors

| Status | When |
|---|---|
| 400 | `enforce_can_sell_items` fails — Stripe Connect not ready. Run `/iblai-monetization-onboard` first. |
| 400 | `item_name` missing for a `custom:*` type (raised by `ItemPaywallConfigCreateSerializer.validate`). |
| 403 | Token is not a Platform admin. |
| 404 | Platform key unknown, or built-in item type fails `strategy.resolve_item`. Generic/custom types can bootstrap (return None resolution is allowed) and won't 404 here. |
| 500 | Stripe Product create or sync raised — body is `{"detail": "Failed to create Stripe product."}`. |

## Related

- [/iblai-monetization-configure → references/prices-api.md](./prices-api.md)
- [/iblai-monetization-configure → references/wizard-state-machine.md](./wizard-state-machine.md)
- [/iblai-monetization](../../iblai-monetization) — item-type normalization and platform flags.
- [/iblai-monetization-onboard](../../iblai-monetization-onboard) — the Stripe Connect prerequisite.
- [/iblai-monetization-checkout](../../iblai-monetization-checkout) — what `allow_free_tier`, `trial_period_days`, and the prices array drive on the buyer side.
