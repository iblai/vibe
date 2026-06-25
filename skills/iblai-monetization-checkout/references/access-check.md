# Access check API — scoped + unscoped + 402-as-success

The access-check endpoint is the gate every paywalled surface should call before showing content. It answers one question — "can this user see this item right now?" — and, when the answer is no, hands back the pricing payload the `PaywallModal` needs to render. Read this in conjunction with [/iblai-monetization-checkout](../SKILL.md) and [/iblai-monetization → references/schema-validation.md](../../iblai-monetization/references/schema-validation.md).

## Endpoints

> `{dm_url}` = your DM service host (e.g. `https://api.iblai.app/dm`). Auth
> header: `Authorization: Token <DM token>` — the **DM token**, not the
> AXD token; the two are different tokens and the AXD token returns
> `401` here.

Four URL forms reach the same backend decision logic, sharing identical
response shape. Prefer the **canonical (`unique_id`-keyed)** forms for new
client code; the composite forms remain valid for callers that already hold
the `(platform_key, item_type, item_id)` triple.

| Form | Scope | URL |
|---|---|---|
| **Canonical (recommended)** | Unscoped | `GET {dm_url}/api/billing/items/{item_unique_id}/access-check/` |
| **Canonical (recommended)** | Scoped | `GET {dm_url}/api/billing/items/{item_unique_id}/scoped-access-check/` |
| Composite (legacy) | Unscoped | `GET {dm_url}/api/billing/access-check/{item_type}/{item_id}/?platform_key={platform_key}` |
| Composite (legacy) | Scoped | `GET {dm_url}/api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/access-check/` |

The canonical forms resolve `(platform_key, item_type, item_id)` from the
paywall config's UUID at dispatch time — no query parameter or path segment
required. On the composite unscoped form, when `platform_key` is omitted the
backend resolves it from the request context (the token's Platform); always
pass it explicitly for embed / cross-Platform surfaces — implicit resolution
is for the same-Platform case only.

## Views

- Canonical unscoped — `ItemAccessCheckByUniqueIdView` (`new_views.py`) —
  wraps `ItemAccessCheckView` via `ConfigUniqueIdMixin`.
- Canonical scoped — `ScopedItemAccessCheckByUniqueIdView` (`new_views.py`) —
  wraps `ScopedItemAccessCheckView`.
- Composite scoped — `ScopedItemAccessCheckView` at `billing/views.py:767` —
  subclasses the unscoped view and pulls `platform_key` from the URL path
  instead of the query string.
- Composite unscoped — `ItemAccessCheckView` at `billing/views.py:668-764` —
  the base implementation. Normalizes `item_type`, validates the
  `platform_key` query param via `ItemAccessCheckQPSerializer`, then
  delegates to `check_payment_access`.

## Permission

Both views set `permission_classes = [IsEdxAuthenticated]` — the caller must present a valid user token. The OpenAPI schema's `security` block additionally lists `PlatformApiKeyAuthentication`, so a Platform API key with an attached user context also satisfies authentication. Anonymous callers get 401; if you need a no-auth pricing peek, use the public-pricing endpoint instead (see [/iblai-monetization-checkout](../SKILL.md)).

## Why two variants

- **Scoped** — the canonical case. Your SPA already knows the current Platform (from `currentTenant` in the auth slice), so building the URL with `platform_key` baked in matches the rest of the billing API and pairs cleanly with the rest of the `monetizationApiSlice` endpoints.
- **Unscoped** — for surfaces that aren't yet "inside" a Platform: an embed widget rendered on a third-party domain, a landing page that wants to gate a CTA before the Platform context is loaded, or an admin tool that switches Platform mid-session. The path is shorter and the Platform comes off the query string.

Both flow through the same backend code; the only meaningful difference is where the `platform_key` lives on the wire.

## Response shape

The response body conforms to the `ItemAccessCheckResponse` schema component:

| Field | Type | Notes |
|---|---|---|
| `has_access` | `bool` | The primary signal — read this, not the HTTP status. |
| `item_type` | `str` | Echoes the normalized item type (e.g. `mentor`, `course`, `workshop`). |
| `item_id` | `str` | Echoes the item id passed in the URL. |
| `reason` | `str` | Machine-readable code explaining the decision (see enum below). |
| `requires_payment` | `bool` | True when the user must pay to unlock. |
| `pricing_available` | `bool` | True when active prices (or free-tier opt-in) exist for the item. |
| `pricing` | `{ item_name, prices } \| null` | Trimmed pricing block populated on denial so the modal can render without a second round-trip. |
| `subscription` | `ItemSubscription \| null` | Populated on success when access comes from a subscription row. |

`required: [has_access, item_id, item_type, pricing_available, reason, requires_payment]` per the schema; `pricing` and `subscription` are nullable.

The `pricing` object on a 402 response is a **trimmed block**: `{ item_name: string, prices: PaywallPrice[] }` — only two fields. It is shape-compatible with the `pricing` prop on `PaywallModal`, so on a denial you can pass `data.pricing` straight through. For the full `PublicItemPricing` shape (with `is_paywalled`, `allow_free_tier`, `trial_period_days`, `item_type`, `item_id`), call the public-pricing endpoint directly.

The `subscription` object — when present — is the **full `ItemSubscriptionSerializer`** (20 fields), not a trimmed shape. You get the same record exposed by the per-item subscribers list and the cancel response: `unique_id`, `user_id`, `username`, `email`, `item_type`, `item_id`, `item_name`, `status`, `price`, `current_period_start`, `current_period_end`, `trial_end`, `cancel_at_period_end`, `canceled_at`, `is_grandfathered`, `grandfathered_at`, `billing_portal_url`, `metadata`, `created_at`, `updated_at` (the `price` entry is the nested `ItemPriceSerializer`). This means a successful access check is sufficient input for a "Manage subscription" affordance — no second round-trip needed.

### `reason` values

Verified against `ItemPaywallService.check_access` in `billing/services/item_paywall.py` plus `ItemSubscription.StatusChoices`:

- **Bare reasons (no subscription row involved):** `no_paywall` (no config or strategy bypass), `paywall_disabled` (config exists but `is_enabled=False`), `no_subscription` (paywall configured but the user has no row), `item_not_found` (strategy registered but the item id resolves to nothing on this Platform).
- **Subscription-derived reasons** — two schemes, gated on whether the row is in `ItemSubscription.ACCESS_STATUSES`:
  - **Bare status name** when the status grants access — `active`, `free`, `grandfathered`, `trialing` (these four make up `ACCESS_STATUSES`). Pair this with `has_access: true`.
  - **`subscription_<status>` prefix** when the status denies access — `subscription_past_due`, `subscription_canceled`, `subscription_incomplete`. Pair this with `has_access: false`. The prefix is generated by `f"subscription_{subscription.status}"`, so any future denying status will follow the same pattern.

Treat `reason` as informational — gate on `has_access`, surface `reason` in telemetry / debug overlays only.

## HTTP 402 contract — read the body, not the status

When `has_access: false` and a paywall is configured, the endpoint returns **HTTP 402 Payment Required** with the full `ItemAccessCheckResponse` body as the payload. Both 200 and 402 carry the same schema, so the body is always parseable regardless of the status code.

The frontend SDK overrides RTK Query's default "4xx is an error" behavior on the access-check endpoint so the 402 body lands in `data`, not `error`:

```ts
// packages/data-layer/src/features/monetization/custom-api-slice.ts:197
validateStatus: (response) => response.ok || [402].includes(response.status),
```

This is intentional — a 402 with a pricing payload is the success path for the paywall flow. Always read `data.has_access` to decide whether to gate; never check `fetch`/`response.status` yourself, and never branch on the RTK Query `error` discriminant for 402 responses.

> The unscoped variant (`checkAccessUnscoped`) does **not** include the same `validateStatus` override in the current SDK. If you call it directly via `fetch` or another client, set your own validator or handle 402 explicitly.

## HTTP status codes

- `200 OK` — `has_access: true` (subscription active / free / grandfathered / trialing, or there is no paywall configured at all).
- `402 Payment Required` — `has_access: false` with a populated `pricing` payload; a paywall is configured and the user does not satisfy it.
- `400 Bad Request` — invalid `item_type` format (must match `^(?:custom:)?[a-z][a-z0-9_-]*$`).
- `401 Unauthorized` — no authenticated user.
- `404 Not Found` — the item doesn't exist on this Platform. Items belonging to a different Platform leak as 404, not 403 — the URL is treated as if the item simply isn't there.

## Caching

`check_payment_access` caches decisions per `(username, item_type, item_id, platform_key)`:

- Cache key: `payment_access:{item_type}:{item_id}:{platform_key}:{username}` (prefix `payment_access`, constants live in `billing/services/payment_access.py`).
- ALLOW results cached **5 minutes** (`PAYMENT_ACCESS_CACHE_TTL_GRANT = 300`).
- DENY results cached **1 minute** (`PAYMENT_ACCESS_CACHE_TTL_DENY = 60`) — short on purpose so a user who has just purchased recovers quickly.

When a subscription is created, updated, or canceled, the backend calls `invalidate_payment_access_cache(username, item_type, item_id, platform_key)` so the next access check sees the new state without waiting for TTL. The webhook handler and `ItemPaywallService.create_subscription_from_checkout` both invalidate on write.

App authors: don't assume instant propagation if you mutate subscription rows directly (admin tools, fixtures, scripts) — either call `invalidate_payment_access_cache` from your tool, or expect up to a minute of stale denial.

## Decision tree (backend)

`ItemPaywallService.check_access` in `billing/services/item_paywall.py:54` runs this sequence:

1. Look up `ItemPaywallConfig` for `(item_type, item_id, platform=platform_key)`.
2. **No Platform-scoped config:**
   - If an enabled global (Platform-less) config with active prices exists → DENY, `reason: 'no_subscription'`, `requires_payment: true`.
   - Else if a strategy is registered for the item type and the item resolves on this Platform (or any) → ALLOW, `reason: 'no_paywall'`.
   - Else if a strategy is registered but the item doesn't resolve → DENY, `reason: 'item_not_found'`.
   - Else (no strategy at all) → ALLOW, `reason: 'no_paywall'`.
3. **Config exists but `is_enabled=False`** → ALLOW, `reason: 'paywall_disabled'`.
4. **Config exists and is enabled:**
   - Find the user's `ItemSubscription` row (if any).
   - Subscription `status in {active, free, grandfathered, trialing}` → ALLOW, `reason: <status>`, return `subscription`.
   - Subscription `status in {past_due, canceled, incomplete}` → DENY, `reason: subscription_{status}`, `requires_payment: true`, `pricing_available: <bool>`, return `subscription`.
   - No subscription row → DENY, `reason: 'no_subscription'`, `requires_payment: true`, `pricing_available: <bool>`.

`ItemSubscription.has_access` (the property the strategy reads) treats the set `{active, free, grandfathered, trialing}` as access; everything else denies.

## PaywallModal direct compatibility

Because the 402 body's `pricing` object matches `PaywallModal`'s `pricing` prop one-for-one, gating a screen is a four-line affair:

```tsx
const { data } = useCheckAccessQuery({ platform_key, item_type, item_id });
if (!data?.has_access && data?.pricing) {
  return <PaywallModal pricing={data.pricing} platformKey={platform_key} itemType={item_type} itemId={item_id} open onClose={() => {}} />;
}
```

No extra `usePublicPricing` round-trip is needed — the 402 payload already carries everything the modal renders.

## Async variant for WebSockets / Channels

The backend exposes `acheck_payment_access(user, item_type, item_id, platform_key)` for ASGI consumers (`billing/services/payment_access.py:279`). It's a `sync_to_async` wrapper around the same code path and respects the same cache.

Frontend code does not call this — it's reachable only from ASGI consumers in the backend. Documented here so backend devs adding a paywalled WebSocket route know which symbol to import.

## Verification pointers

- Backend: `billing/views.py:668-764` (unscoped view), `billing/views.py:767` (scoped subclass), `billing/services/item_paywall.py:54` (decision tree), `billing/services/payment_access.py:202` (`check_payment_access` + caching), `billing/services/payment_access.py:279` (`acheck_payment_access`).
- Schema: `grep -n "billing_access_check_retrieve\|billing_platforms_items_access_check_retrieve" /tmp/iblai_schema.yaml`. Response component at `ItemAccessCheckResponse` in `components.schemas`.
- SDK: `gh api repos/iblai/ibl-web-frontend/contents/packages/data-layer/src/features/monetization/custom-api-slice.ts --jq '.content' | base64 -d` — the `validateStatus` override sits on the `checkAccess` query (line 197 in the version verified for this skill).

## Related skills

- [/iblai-monetization](../../iblai-monetization/SKILL.md) — index, auth, schema validation
- [/iblai-monetization-checkout](../SKILL.md) — modal + checkout session creation flow
- [/iblai-monetization-subscriptions](../../iblai-monetization-subscriptions/SKILL.md) — what populates the `subscription` field on success
- [/iblai-monetization-configure](../../iblai-monetization-configure/SKILL.md) — where the `ItemPaywallConfig` and `ItemPrice` rows come from
