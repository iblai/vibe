# iblai-monetization-checkout

> Build the buyer-facing PaywallModal, access-check gate, Stripe checkout flow, and public/guest buy surface for ibl.ai's item-level monetization. Use when the user mentions paywall, checkout, gate content, access check, 402, hard paywall, locked content, PaywallModal, redirect to Stripe, success_url / cancel_url, guest checkout, anonymous buy, public pricing, or selling a single item to logged-out visitors. See /iblai-monetization for the family index, /iblai-monetization-configure for the prerequisite paywall + price setup, /iblai-monetization-onboard for the Connect-ready Platform requirement, /iblai-monetization-subscriptions for the post-purchase My Purchases tab, and /iblai-auth for token wiring.

# /iblai-monetization-checkout

Build the buyer surface: gate a page with `useCheckAccessQuery`, render
`PaywallModal` when locked, redirect to Stripe Checkout on tier select,
and ship a public/guest buy page for anonymous landing-page traffic.

Do NOT add custom styles, colors, or CSS overrides to ibl.ai SDK components.
They ship with their own styling. Keep the components as-is.
Do NOT implement dark mode unless the user explicitly asks for it.

When building custom UI around SDK components, use the ibl.ai brand
(primary `#0058cc`, button `bg-gradient-to-r from-[#2563EB] to-[#93C5FD] text-white`,
shadcn/ui new-york variant). Component hierarchy: ibl.ai SDK
(`@iblai/iblai-js`) first, then shadcn/ui (`npx shadcn@latest add <c>`);
do NOT write custom components when an SDK or shadcn equivalent exists.
Full brand reference: [BRAND.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/BRAND.md).

You MUST run `/iblai-ops-test` before telling the user the work is ready.

After all work is complete, start a dev server (`pnpm dev`) so the user
can see the result at http://localhost:3000.

`iblai.env` is NOT a `.env.local` replacement — it only holds the 3
shorthand variables (`DOMAIN`, `PLATFORM`, `TOKEN`). Next.js still reads
its runtime env vars from `.env.local`.

Use `pnpm` as the default package manager. Fall back to `npm` if pnpm
is not installed. The generated app should live in the current directory,
not in a subdirectory.

> **Common setup (brand, conventions, env files, verification):** see [docs/skill-setup.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/docs/skill-setup.md).

> **Verify the API before you call it.** Fetch the live OpenAPI schema at https://api.iblai.app/dm/api/docs/schema/ (also browsable at https://api.iblai.app/dm/api/docs/) and confirm the URL path, method, request body, and response shape for every endpoint you reach for. The schema is the source of truth; the URLs in this skill exist for orientation and may drift between releases. See [/iblai-monetization → references/schema-validation.md](../iblai-monetization/references/schema-validation.md) for the exact fetch routine.

> **`{dm_url}` + DM token.** Every checkout endpoint lives under the **DM
> base** — `{dm_url}` resolves to your data-manager host (e.g.
> `https://api.iblai.app/dm`); in TypeScript compose it as
> `` `${apiBase}/dm` ``. The auth header for the authenticated paywall
> flow is `Authorization: Token <DM token>` — the **DM token**, not the
> AXD token. The two are different tokens issued by different services;
> using the AXD token against `{dm_url}` returns `401`. The SDK attaches
> the DM token automatically via `SERVICES.DM`.

> **Canonical vs composite URLs.** Every item-keyed endpoint exposes both
> a canonical (`unique_id`-keyed) form and the legacy composite
> (`platform/type/id`-keyed) form. **Prefer canonical for new client code
> — buyer routes also short-circuit cleanly on disabled paywalls in the
> canonical form** (see "Canonical buyer 404" below). The shipped SDK
> hooks still build composite URLs; that is documented in each step. Full
> mapping in [`/iblai-monetization → references/api-overview.md`](../iblai-monetization/references/api-overview.md).

> **Canonical buyer 404.** Canonical buyer routes (`checkout`,
> `checkout-guest`, `items/prices/{price_unique_id}/checkout/`,
> `prices/{price_unique_id}/checkout-guest/`) carry
> `require_enabled_paywall = True` and return
> `404 {"detail": "Paywall configuration not found."}` *before* reaching
> Stripe when the paywall is disabled. The composite forms do not — they
> delegate to the parent view and fail later with a different error.

## Prerequisites

- **Auth** — required for the authenticated paywall + checkout flow. Wire
  the **DM token** (not AXD) via `/iblai-auth`. The public/guest buy
  surface in Step 5 does NOT need auth — those calls pass
  `skipAuth: true`.
- **MCP + skills** — `iblai add mcp`.
- **`iblai.env`** populated with `PLATFORM`, `DOMAIN`, `TOKEN`. If missing:
  `curl -o iblai.env https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/iblai.env`
- **The item has a paywall configured.** A paywall config + at least one
  active price must exist for `(platform, item_type, item_id)`. If not,
  the buyer flow can't run — do `/iblai-monetization-configure` first.
- **The Platform finished Stripe Connect Express onboarding.** Checkout
  hard-requires `stripe_connect_account.is_ready_for_payments`. Without
  it, `POST {dm_url}/api/billing/.../checkout/` returns
  `400 {"detail": "Platform payment system not configured"}`. Do
  `/iblai-monetization-onboard` first.

## What you'll build

1. **Authenticated paywall gate** — page calls `useCheckAccessQuery` on
   mount, reads `data.has_access`, renders `<PaywallModal>` when locked,
   and lands the buyer back on the unlocked content after Stripe
   webhook reconciliation.
2. **Public / guest buy page** — standalone (no-auth) page uses
   `useGetPublicPricingQuery` + `useCreateGuestCheckoutMutation` so a
   logged-out visitor can buy a single item with just an email. Used
   for landing pages, marketing emails, and shareable buy links.

## Step 0: Check for CLI Updates

Before running any `iblai` command, ensure the CLI is up to date.
Run `iblai --version`, then upgrade directly:
- pip: `pip install --upgrade iblai-app-cli`
- npm: `npm install -g @iblai/cli@latest`

## Step 1: Validate the API schema

Confirm each URL, method, request body, and response shape against the
live schema before you wire it. Endpoint catalogs and field tables for
this skill live in:

- [`references/access-check.md`](./references/access-check.md) — scoped
  + unscoped access-check endpoints, 200 vs 402 response payloads.
- [`references/checkout-api.md`](./references/checkout-api.md) —
  authenticated checkout, guest checkout by item, guest checkout by
  price uuid, plus the callback URL the buyer returns to.
- [`references/public-pricing.md`](./references/public-pricing.md) —
  the two public-pricing endpoints (by `(type, id)` and by config uuid).

When this skill and the live schema disagree, the schema wins. See
[`/iblai-monetization → references/schema-validation.md`](../iblai-monetization/references/schema-validation.md).

## Step 2: Check access on page load

Call `useCheckAccessQuery` at the top of the gated page. The slice sets
`validateStatus: (r) => r.ok || [402].includes(r.status)` on this
endpoint, so a **402 Payment Required is delivered to `data`, not
`error`**. Treating 402 as a normal error breaks the entire paywall
flow — always branch on `data.has_access`.

```tsx
'use client';

import { useCheckAccessQuery } from '@iblai/iblai-js/data-layer';

export function GatedItemPage({ itemId, itemType }: { itemId: string; itemType: string }) {
  const platformKey = process.env.NEXT_PUBLIC_PLATFORM_KEY!;
  const { data, isLoading } = useCheckAccessQuery({
    platform_key: platformKey,
    item_type: itemType,
    item_id: itemId,
  });

  if (isLoading || !data) return <PageSkeleton />;

  if (!data.has_access && data.pricing) {
    return <PaywallScreen pricing={data.pricing} platformKey={platformKey} itemId={itemId} itemType={itemType} />;
  }

  return <UnlockedContent itemType={itemType} itemId={itemId} />;
}
```

Payload from `GET {dm_url}/api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/access-check/` (same shape for 200 and 402):

```json
{
  "has_access": false,
  "item_type": "mentor",
  "item_id": "my-mentor-slug",
  "reason": "no_subscription",
  "requires_payment": true,
  "pricing_available": true,
  "pricing": {
    "item_name": "Pro Mentor",
    "prices": [
      { "id": "<price-uuid>", "name": "Monthly", "amount": "15.00",
        "currency": "usd", "interval": "month", "is_active": true,
        "features": ["Unlimited chat"], "stripe_price_id": "price_..." }
    ]
  },
  "subscription": null
}
```

`reason` is informational. Bare values: `"no_subscription"`,
`"no_paywall"`, `"item_not_found"`, `"paywall_disabled"`. For an active
sub whose status is in the access whitelist (`active`/`free`/`grandfathered`/`trialing`),
`reason` is the bare status. For other statuses it is prefixed:
`"subscription_canceled"`, `"subscription_past_due"`, `"subscription_incomplete"`.
Gate on `has_access`; use `pricing` to populate the modal.

## Step 3: Render the locked state with PaywallModal

`PaywallModal` is exported top-level from
`@iblai/iblai-js/web-containers` and ships its own grid, copy, and
Pay button. Pass it the `pricing` block straight off the access-check
response — do NOT restyle it, do NOT swap the grid, do NOT inject your
own price cards.

```tsx
'use client';

import { useState } from 'react';
import { PaywallModal } from '@iblai/iblai-js/web-containers';
import type { AccessCheckResponse } from '@iblai/iblai-js/data-layer';

interface Props {
  pricing: NonNullable<AccessCheckResponse['pricing']>;
  platformKey: string;
  itemId: string;
  itemType: string;
  hard?: boolean;
}

export function PaywallScreen({ pricing, platformKey, itemId, itemType, hard }: Props) {
  const [open, setOpen] = useState(true);

  return (
    <>
      <LockedPlaceholder onClick={() => setOpen(true)} />
      <PaywallModal
        pricing={pricing}
        platformKey={platformKey}
        itemId={itemId}
        itemType={itemType}
        open={open}
        onClose={() => setOpen(false)}
        closable={!hard}
      />
    </>
  );
}
```

**Props (verbatim from the SDK):**

| Prop | Type | Notes |
|---|---|---|
| `pricing` | `{ item_name; prices: PaywallPrice[] }` | Copy directly from `accessCheck.data.pricing`. |
| `platformKey` | `string` | Must match the token's Platform. |
| `itemId` | `string` | The item being gated. |
| `itemType` | `string` | Normalized type (`mentor`, `course`, `program`, ...). |
| `open` | `boolean` | Controlled by the parent. |
| `onClose` | `() => void` | Fires when the user dismisses (only when `closable`). |
| `closable?` | `boolean` (default `true`) | `false` = hard paywall: hides the close button and intercepts escape + outside-click. |
| `buttonClassName?` | `string` | Pass-through Tailwind classes for the Pay button only. Do not restyle anything else. |

**What the modal does internally** — it calls
`useCreateCheckoutMutation({ platform_key, item_type, item_id, price_id, success_url, cancel_url })`
when the buyer clicks Pay, then runs
`window.location.href = result.checkout_url` to send them to Stripe.
The mutation hits `POST {dm_url}/api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/checkout/`
and returns `{ checkout_url, session_id, platform_key }` (the backend
`CheckoutSessionResponseSerializer` returns all three; the SDK's TS
`CheckoutResponse` type is missing `platform_key` — SDK drift, the
runtime field is present). Stripe drops the buyer back
at `{dm_url}/api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/checkout-callback/`
on success, where the server reconciles the session before redirecting
to the buyer-facing URL.

**Hard paywall vs soft paywall.** A soft paywall (`closable={true}`,
the default) lets the buyer dismiss the modal and stay on the page —
fine when the surrounding page still has useful free content. A hard
paywall (`closable={false}`) hides the close button, intercepts escape,
and ignores outside-click; pair it with a full-page lock screen so the
buyer can't navigate back. Pick one per item.

## Step 4: Customize success / cancel URLs

The modal hardcodes `success_url = cancel_url = window.location.href`.
That works for in-page gates (your access-check re-runs after the
webhook lands and the page flips to unlocked) but it is **wrong for
standalone buy pages** — buyers who refresh after a successful payment
will land back on the same buy page and re-enter the paywall flow until
the access-check cache invalidates.

For a custom buy page, do NOT use `PaywallModal`. Wire
`useCreateCheckoutMutation` (or its guest sibling in Step 5) directly so
you can pass deliberate URLs:

```tsx
import { useCreateCheckoutMutation } from '@iblai/iblai-js/data-layer';

const [createCheckout, { isLoading }] = useCreateCheckoutMutation();

async function handleBuy(priceId: string) {
  const result = await createCheckout({
    platform_key: platformKey,
    item_type: itemType,
    item_id: itemId,
    price_id: priceId,
    success_url: 'https://example.com/welcome?item=' + itemId,
    cancel_url: 'https://example.com/pricing',
  }).unwrap();
  window.location.href = result.checkout_url;
}
```

Land the buyer on the unlocked destination (`/learn/{itemId}`) or a
thank-you page that itself links back to the unlocked content. Never
point `success_url` at the buy page.

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

## Step 6: Unscoped access check (for cross-Platform embeds)

When your SPA has no Platform context — e.g. an embeddable widget that
floats over arbitrary host pages — call the unscoped variant:

```ts
import { useCheckAccessUnscopedQuery } from '@iblai/iblai-js/data-layer';

const { data } = useCheckAccessUnscopedQuery({
  item_type: itemType,
  item_id: itemId,
  platform_key: platformKey, // passed as a query string, not a path segment
});
```

The hook hits `GET {dm_url}/api/billing/access-check/{item_type}/{item_id}/?platform_key=<key>`.
The response shape and 200-vs-402 contract are identical on the wire,
but **unlike `useCheckAccessQuery`, `useCheckAccessUnscopedQuery` does
NOT carry a `validateStatus` override** — a 402 lands in `error`, not
`data`. Either wrap it with your own `validateStatus` or use the scoped
variant whenever the Platform is known. Prefer the scoped variant
anyway — it keeps the URL self-describing for logging / caching.

## Verify

Run `/iblai-ops-test` before telling the user the work is ready:

1. `pnpm build` — must pass with zero errors.
2. `pnpm dev` and exercise both surfaces:
   ```bash
   pnpm dev &
   npx playwright screenshot http://localhost:3000/learn/<locked-item> /tmp/paywall.png
   npx playwright screenshot http://localhost:3000/buy/<item-id> /tmp/guest.png
   ```
3. **Authenticated paywall**: locked item renders `<PaywallModal>`
   (`Choose your plan` header visible); picking a tier redirects to
   `https://checkout.stripe.com/...`; `closable={false}` makes escape
   and outside-click no-ops.
4. **Custom success URL**: refreshing the success page does NOT bounce
   back into the paywall.
5. **Guest buy page**: loads with no token (private window);
   `useGetPublicPricingQuery` returns 200 with `is_paywalled: true`;
   submitting email + tier redirects to Stripe.

## Common mistakes

- **Treating `useCheckAccessQuery` errors as fatal.** 402 arrives in
  `data`, not `error`. `if (error) return <Crash />` kills the paywall.
- **Pointing `success_url` at the same buy page.** Refresh re-enters
  the paywall flow until the cache invalidates. Land on the unlocked
  destination or a thank-you page.
- **Using a `currency` other than `'usd'`.** Stripe Connect locks to
  USD; other values reject server-side.
- **Restyling the modal grid.** `PaywallModal` ships its own grid. Use
  `buttonClassName` for the Pay button only.
- **Skipping `is_ready_for_payments`.** Unfinished Connect onboarding
  400s the checkout with `"Platform payment system not configured"`
  (see `/iblai-monetization-onboard`).
- **Going straight to Stripe.js.** Bypasses Connect account signing,
  ibl.ai commission, and buyer-subscription binding — breaks reconciliation.

## MCP tools for further detail

```
get_component_info("PaywallModal")
get_hook_info("useCheckAccessQuery")
get_hook_info("useCheckAccessUnscopedQuery")
get_hook_info("useGetPublicPricingQuery")
get_hook_info("useCreateCheckoutMutation")
get_hook_info("useCreateGuestCheckoutMutation")
```

## Files in this skill's scope

**Frontend SDK** (`iblai/ibl-web-frontend`):

- `packages/web-containers/src/components/modals/paywall-modal.tsx` —
  the exported `PaywallModal` (props, hard-paywall escape/outside-click
  guards, internal `useCreateCheckoutMutation` + redirect).
- `packages/data-layer/src/features/monetization/custom-api-slice.ts` —
  specifically the `getPublicPricing`, `checkAccess`,
  `checkAccessUnscoped`, `createCheckout`, `createGuestCheckout`
  endpoints, plus the `validateStatus` override that lets 402 land in
  `data` on `checkAccess`.
- `packages/data-layer/src/features/monetization/paywall-utils.ts` —
  `displayItemType`, `slugify`, `useDebounce`, `getAuthURLExtension`,
  `buildOnSuccessfulPaymentUrl`.

**Backend** (`web/ibl-dm-core-apps/ibl-dm-billing-app/billing/views.py`):

- `ItemAccessCheckView` at `billing/views.py:668-764` (unscoped,
  `IsEdxAuthenticated`, returns 402 with pricing when locked).
- `ScopedItemAccessCheckView` at `billing/views.py:767`.
- `ItemCheckoutView` at `billing/views.py:1556` (authenticated,
  `IsEdxAuthenticated`).
- `ItemGuestCheckoutView` at `billing/views.py:1751` (`AllowAny`,
  email required).
- `ItemGuestCheckoutByPriceView` at `billing/views.py:1804`
  (`AllowAny`, takes price uuid).
- `PublicItemPricingView` at `billing/views.py:1958` (`AllowAny`).
- `ItemCheckoutCallbackView` at `billing/views.py:2257` (Stripe
  return URL — the server reconciles the session before redirecting
  the buyer).
- `billing/services/item_paywall.py:54` (`ItemPaywallService.check_access`) —
  the decision tree behind the 402: subscription lookup, status
  whitelist, `reason` selection, pricing block assembly.
- `billing/services/payment_access.py:202` (`check_payment_access`) —
  the cache layer in front of access checks; TTL constants
  `PAYMENT_ACCESS_CACHE_TTL_GRANT = 300` (5 min) and
  `PAYMENT_ACCESS_CACHE_TTL_DENY = 60` (1 min).

## Related skills

- `/iblai-monetization` — family index, auth, schema validation, item-type normalization, RBAC matrix.
- `/iblai-monetization-configure` — prerequisite: enable a paywall and create at least one active price.
- `/iblai-monetization-onboard` — prerequisite: Connect Express onboarding so `is_ready_for_payments` is true.
- `/iblai-monetization-subscriptions` — post-purchase `PurchasesTab` list + cancel flow.
- `/iblai-monetization-analytics` — admin analytics (revenue, subscribers, conversion).
- `/iblai-rbac` — RBAC role assignment for admin-side analytics, subscription mgmt, and Connect onboarding.
- `/iblai-auth` — token wiring; reuse the same token store. Do not introduce a parallel auth layer.
- **Brand guidelines**: [BRAND.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/BRAND.md)