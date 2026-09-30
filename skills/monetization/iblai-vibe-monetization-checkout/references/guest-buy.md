# Checkout — the public / guest buy page (Step 5 in full)

Moved out of `SKILL.md` to keep the skill scannable; this is the full text.

## Step 5: Public / guest buy page

For logged-out landing pages and shareable buy links, build a standalone
page that pulls public pricing and creates a guest checkout. Both calls
are `AllowAny` on the server — no Authorization header is sent.

### 5.1 Fetch public pricing

There are three public-pricing endpoints — all `AllowAny`. Prefer the
canonical (`item_unique_id`-keyed) forms for new client code; the
composite form remains valid:

| URL | Form | Hook | Used when |
|---|---|---|---|
| `GET {dm_url}/api/billing/items/{item_unique_id}/pricing/` | **Canonical (recommended)** | direct fetch (no slice hook) | You have the paywall config's `unique_id`. New buy pages should prefer this URL. |
| `GET {dm_url}/api/billing/items/{item_unique_id}/public-pricing/` | **Canonical (legacy alias)** | direct fetch (no slice hook) | Same response; kept for buy links of the form `${authURL}/buy/{paywallUniqueId}`. |
| `GET {dm_url}/api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/pricing/` | Composite (legacy) | `useGetPublicPricingQuery({ platform_key, item_type, item_id })` | You already resolved `(platform_key, item_type, item_id)`. The SDK hook still builds this URL. |

```tsx
'use client';

import { useGetPublicPricingQuery } from '@iblai/iblai-js/data-layer';

export function GuestBuyPage({ itemType, itemId }: { itemType: string; itemId: string }) {
  const platformKey = process.env.NEXT_PUBLIC_PLATFORM_KEY!;
  const { data, isLoading } = useGetPublicPricingQuery({
    platform_key: platformKey,
    item_type: itemType,
    item_id: itemId,
  });

  if (isLoading || !data) return <PageSkeleton />;
  if (!data.is_paywalled || data.prices.length === 0) return <FreeItem />;

  return <GuestPricingGrid pricing={data} platformKey={platformKey} itemType={itemType} itemId={itemId} />;
}
```

Response shape from `useGetPublicPricingQuery`:

```json
{
  "item_type": "mentor", "item_id": "my-mentor-slug",
  "item_name": "Pro Mentor", "is_paywalled": true,
  "allow_free_tier": false, "trial_period_days": 7,
  "prices": [
    { "unique_id": "<price-uuid>", "name": "Monthly", "amount": "15.00",
      "currency": "usd", "interval": "month", "is_active": true,
      "features": ["Unlimited chat"] }
  ]
}
```

### 5.2 Create the guest checkout session

The guest can pay via two backend entry points. The slice exposes only
`useCreateGuestCheckoutMutation` (URL-pinned to the by-item endpoint).
For the by-price URL (`POST {dm_url}/api/billing/prices/{price_unique_id}/checkout-guest/`),
call `fetch` directly — there is no hook (`useCreateGuestCheckoutByPriceMutation`
has never existed, this is not version drift).

| Server URL | Form | Hook (in slice) | Use when |
|---|---|---|---|
| `POST {dm_url}/api/billing/items/{item_unique_id}/checkout-guest/` | **Canonical (recommended)** | direct fetch | You have the paywall config's `unique_id` — preferred for new buy pages. |
| `POST {dm_url}/api/billing/prices/{price_unique_id}/checkout-guest/` | **Canonical (recommended)** | direct fetch | You only have the price uuid (e.g. a one-click Buy link). The backend derives Platform/item from the price. |
| `POST {dm_url}/api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/checkout-guest/` | Composite (legacy) | `useCreateGuestCheckoutMutation` | You already resolved `(platform_key, item_type, item_id)`. The SDK hook still builds this URL. |

```tsx
import { useCreateGuestCheckoutMutation } from '@iblai/iblai-js/data-layer';

const [createGuestCheckout, { isLoading }] = useCreateGuestCheckoutMutation();

async function handleGuestBuy(priceId: string, email: string) {
  const result = await createGuestCheckout({
    platform_key: platformKey,
    item_type: itemType,
    item_id: itemId,
    price_id: priceId,
    email,
    success_url: 'https://example.com/welcome',
    cancel_url: 'https://example.com/pricing',
  }).unwrap();
  window.location.href = result.checkout_url;
}
```

Wrap `handleGuestBuy` in a `<form>` with `<input type="email" required>`
so the browser handles validation before calling the mutation. The
server creates the Stripe customer behind the scenes; the buyer never
logs in. After a successful charge the webhook materializes the
`ItemSubscription` and email is the identity used to look up the row.

For the by-price entry point, when no hook exists, fetch directly.
Compose the **DM base** explicitly — the checkout endpoints live on DM,
not the AXD edge:

```ts
async function buyByPriceUuid(priceUuid: string, email: string) {
  // DM base — never hit ${NEXT_PUBLIC_API_BASE_URL}/api/... directly.
  const dmBase = `${process.env.NEXT_PUBLIC_API_BASE_URL}/dm`;
  const res = await fetch(
    `${dmBase}/api/billing/prices/${priceUuid}/checkout-guest/`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        success_url: 'https://example.com/welcome',
        cancel_url: 'https://example.com/pricing',
      }),
    },
  );
  const { checkout_url } = await res.json();
  window.location.href = checkout_url;
}
```

No auth header; the server resolves the Platform + item from the price
uuid and delegates internally to the standard guest checkout.
