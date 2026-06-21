# Public pricing API

Two read-only endpoints serve the paywall config + active prices for an
item to anonymous callers (no token required). Use them on marketing
landing pages, shareable buy links, and pricing teasers that must render
before the user is signed in.

## Two endpoints

**Scoped by item (type + id + Platform):**

```
GET /api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/pricing/
```

Use when you already know the item's `(type, id, platform)` triple —
typical for app-internal pricing teasers, course catalog cards, and the
guest checkout surface in the SDK.

**By config UUID:**

```
GET /api/billing/items/{config_unique_id}/public-pricing/
```

Same response shape, but the item is resolved from
`ItemPaywallConfig.unique_id` instead of the item triple. Use this for
shareable buy links where only the paywall's UUID is known (the
Configure wizard's "Copy" button generates URLs of the form
`${authURL}/buy/{paywallUniqueId}`).

The auth app ships a working `/buy/[id]/page.tsx` route that already
calls this endpoint, so `${authURL}/buy/{paywallUniqueId}` resolves
out-of-the-box when `authURL` points at the standard auth app. Build
your own buy page only when you are NOT deploying behind the auth app
(e.g. a standalone marketing site or a custom-branded checkout
surface).

## View

`PublicItemPricingView` lives at
`billing/views.py:1958`. The by-config variant is
`PublicItemPricingByConfigView` at `billing/views.py:2001` and
subclasses the scoped view — it looks up the config by UUID, then
delegates to the same handler with the resolved
`(platform_key, item_type, item_id)`.

Both views set `authentication_classes = []` and
`permission_classes = [AllowAny]`. The `get_permissions()` override
explicitly returns `[AllowAny()]` to bypass the RBAC mixin so
unauthenticated requests succeed.

## Auth

`AllowAny` — no token required. The SDK marks the hook with
`skipAuth: true` so the request middleware does not attach an
`Authorization` header:

```ts
getPublicPricing: builder.query<PublicPricingResponse, PaywallItemParams>({
  query: ({ platform_key, item_type, item_id }) => ({
    url: MONETIZATION_ENDPOINTS.PUBLIC_PRICING.path(platform_key, item_type, item_id),
    method: 'GET',
    skipAuth: true,
  }),
  providesTags: ['publicPricing'],
}),
```

The SDK currently ships only the scoped-by-item hook
(`useGetPublicPricingQuery`). For the by-config-UUID variant, call the
endpoint directly with `fetch`.

## Response shape

`PublicItemPricing` (from `PublicItemPricingSerializer` at
`billing/serializers.py:616-623`):

| Field | Type | Notes |
| --- | --- | --- |
| `item_type` | `string` | e.g. `course`, `program`, `mentor`, `pathway`, or `custom:…` |
| `item_id` | `string` | The item identifier as a string |
| `item_name` | `string` | Display name resolved via the item-type strategy; falls back to `"{item_type}:{item_id}"` when the item cannot be resolved |
| `is_paywalled` | `boolean` | `true` only when an `ItemPaywallConfig` exists AND `is_enabled` is `true` |
| `allow_free_tier` | `boolean` | Mirrors `ItemPaywallConfig.allow_free_tier` |
| `trial_period_days` | `integer` | Mirrors `ItemPaywallConfig.trial_period_days`; `0` means no trial |
| `prices` | `PublicItemPrice[]` | Only ACTIVE, non-deleted prices — the view filters with `prices.filter(is_active=True, is_deleted=False)` |

Each entry in `prices` is the standard `ItemPrice` shape:

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `string` (uuid) | The price's `unique_id`. The SDK type calls this `unique_id` — match whichever your SDK version uses. |
| `name` | `string` | Display name (e.g. `"Basic"`, `"Pro"`) |
| `description` | `string \| null` | What's included in this tier |
| `amount` | `string` (wire) / `number` (SDK type) | Backend serializes Decimal as a string per the OpenAPI schema (e.g. `"9.99"`, `"0"` for free), but the SDK's `PublicPricingResponse` declares `amount: number`. Treat as string at runtime — `parseFloat()` it before arithmetic. The SDK type is currently incorrect. |
| `currency` | `string` | ISO code, lowercased (usually `"usd"`) |
| `interval` | `string` | One of `'month'`, `'year'`, `'one_time'` |
| `is_active` | `boolean` | Always `true` in this response — inactives are filtered out |
| `features` | `string[]` | Bullet-style feature list for the tier |

When no paywall config exists at all, the response still returns 200
with `is_paywalled: false`, `allow_free_tier: true`,
`trial_period_days: 0`, and `prices: []`.

## When to use each variant

| Situation | Endpoint |
| --- | --- |
| You know the item's `(type, id, platform_key)` triple | Scoped by item |
| You only have a paywall UUID from a shareable link | By config UUID |
| In-app pricing teaser on a course/program detail page | Scoped by item |
| Public `/buy/{paywallUniqueId}` route | By config UUID |
| Anonymous landing-page CTA | Scoped by item (Platform is known to the page) |

## What it does NOT return

- No subscription state — see `/iblai-monetization-subscriptions`.
- No access decision — use `useCheckAccessQuery` (200 or 402 with the
  pricing payload).
- No Stripe checkout URL — call `useCreateCheckoutMutation` (signed-in)
  or `useCreateGuestCheckoutMutation` (anonymous) to start a session.

This endpoint is pure read-only pricing display.

## Anonymous landing page pattern

```tsx
import {
  useGetPublicPricingQuery,
  useCreateGuestCheckoutMutation,
} from '@iblai/iblai-js/data-layer';

const { data: pricing, isLoading } = useGetPublicPricingQuery({
  platform_key,
  item_type,
  item_id,
});

const [createCheckout] = useCreateGuestCheckoutMutation();

const handleBuy = async (price_id: string, email: string) => {
  const result = await createCheckout({
    platform_key,
    item_type,
    item_id,
    price_id,
    email,
    success_url: '/thanks',
    cancel_url: window.location.href,
  }).unwrap();
  window.location.href = result.checkout_url;
};
```

Render `pricing.prices` as tier cards, collect an email in a small
form, and post to `createCheckout` on click. The browser then redirects
to Stripe's hosted checkout.

## Cross-Platform sharing

The by-config-UUID variant does not require a Platform context in the
URL — `ItemPaywallConfig.unique_id` is globally unique across
Platforms, and the view recovers the Platform from the config row
before delegating. This makes shareable `/buy/{paywallUniqueId}` URLs
portable across Platforms without leaking the Platform key into the
link.

## Caching

The SDK caches the scoped-by-item response under the `publicPricing`
RTK Query tag. Paywall and price mutations (`upsertPaywallConfig`,
`createPaywallPrice`, `updatePaywallPrice`, `deletePaywallPrice`)
invalidate this tag automatically, so teasers re-render with fresh
prices after an admin edit.

The by-config-UUID variant has no built-in hook — manual `fetch` calls
bypass RTK Query caching.

## Free items (`allow_free_tier: true`)

When the paywall config allows a free tier, the buyer may enroll
without payment (subject to backend logic in the item-type strategy).
The SDK's `PaywallModal` renders a "Start free" CTA alongside the paid
tiers when this is `true`. Mirror this in custom buy surfaces.

## Not paywalled (`is_paywalled: false`)

Happens when no `ItemPaywallConfig` row exists OR the config exists
but `is_enabled` is `false`. Do NOT render a buy button — either hide
the pricing section (item is freely available) or show "Not available
for purchase" (admin has disabled monetization). Checkout creation
will fail server-side.

## Related skills

- [/iblai-monetization-checkout](../SKILL.md) — full checkout flow
- [/iblai-monetization-configure](../../iblai-monetization-configure) —
  where Platform admins create the paywall config + prices this
  endpoint returns
- [/iblai-monetization](../../iblai-monetization) — family index and
  RTK Query slice overview
