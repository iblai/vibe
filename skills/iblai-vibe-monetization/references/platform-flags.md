# Platform flags — enable_monetization vs show_paywall

Two boolean flags on the Platform record gate monetization UI in the SDK. They look like synonyms. They are not. They control different products, and a Platform can have one, both, or neither.

## TL;DR

| Flag | Controls | Configured by |
|---|---|---|
| `enable_monetization` | Admin Monetization tab in `Account`; user Purchases tab in `Profile`; PaywallModal access flow | ibl.ai operator (no in-app toggle) |
| `show_paywall` | `CreditBalance` widget in navbar (the Platform-wide credits product — see [/iblai-vibe-credit](../../iblai-vibe-credit)) | ibl.ai operator (no in-app toggle) |

## Why both exist

The two flags gate fundamentally different products:

- **`enable_monetization`** — this Platform sells its own items (courses, agents, pathways, programs) to its users. Revenue flows through Stripe Connect Express to the Platform's connected account; ibl.ai takes a commission. See [/iblai-vibe-monetization-onboard](../../iblai-vibe-monetization-onboard) and [/iblai-vibe-monetization-configure](../../iblai-vibe-monetization-configure).
- **`show_paywall`** — this Platform buys ibl.ai credits to fund AI consumption (agent messages, embeddings, etc.). Charges flow directly to ibl.ai's Stripe account. See [/iblai-vibe-credit](../../iblai-vibe-credit).

One Platform is the seller; the other Platform is the buyer of ibl.ai's product. They are independent commercial relationships.

## Common mistake

Assuming the flags are synonyms or always set together. They are NOT. Real combinations:

| `enable_monetization` | `show_paywall` | Meaning |
|---|---|---|
| `true` | `true` | Platform sells items AND buys ibl.ai credits |
| `true` | `false` | Platform sells items; AI usage covered some other way (flat-rate, enterprise plan) |
| `false` | `true` | Platform buys ibl.ai credits; doesn't sell anything to its own users |
| `false` | `false` | Neither product enabled — purely free Platform with no monetization surfaces |

Code that gates UI on the wrong flag will silently break for any Platform in a mixed configuration. Always pick the flag that matches the specific product, not "monetization-ish stuff in general".

## Where flags live in the SDK

Both flags are fields on the SDK's `Tenant` type. The SDK still uses `Tenant` as the literal TypeScript type name — surface it verbatim in code, but call the concept a Platform everywhere else.

From `packages/web-utils/src/types/index.ts`:

```ts
export interface Tenant {
  key: string;
  is_admin: boolean;
  org: string;
  name?: string;
  platform_name: string;
  is_advertising?: boolean;
  is_enterprise?: boolean;
  show_paywall?: boolean;
  enable_monetization?: boolean;
}
```

The full `tenants` array is hydrated into `localStorage` by [/iblai-vibe-auth](../../iblai-vibe-auth) after login; every entry carries both flags so any component can read them synchronously without a network round-trip.

## Gating in components

### `Account` (admin, `packages/web-containers/src/components/profile/account.tsx`)

Monetization tab — gated on BOTH the flag AND an RBAC check:

```tsx
const canMonetize = currentTenant?.enable_monetization && hasMonetizationPermission;
...
...(canMonetize ? [{ id: 'monetization', label: 'Monetization', icon: Coins }] : []),
```

Billing tab — gated on `show_paywall`, distinct from the Monetization tab:

```tsx
{currentTenant?.show_paywall && (
  <button key={'billing'} ...>
```

### `Profile` (user, `packages/web-containers/src/components/profile/index.tsx`)

Purchases tab — gated on `enable_monetization`. Yes, the user-side Purchases tab uses `enable_monetization`, NOT `show_paywall`. The Platform is selling items via Connect; Purchases is where the user reviews and cancels those item subscriptions.

```tsx
const isPurchasesEnabled = currentTenant?.enable_monetization;
...
...(isPurchasesEnabled
  ? [{ id: 'purchases', label: 'Purchases', renderIcon: renderLucideIcon(ShoppingBag) }]
  : []),
```

### Navbar `CreditBalance` widget

Gated on `show_paywall`. Detailed integration lives in [/iblai-vibe-credit](../../iblai-vibe-credit).

```tsx
{showCreditBalance && currentTenant?.show_paywall && (
  <CreditBalance ... />
)}
```

## Decision tree for app authors

- **Want users to sell their own items?** Need `enable_monetization: true` AND Stripe Connect onboarding complete on the connected account (`charges_enabled` + `details_submitted`). See [/iblai-vibe-monetization-onboard](../../iblai-vibe-monetization-onboard).
- **Want this Platform to buy ibl.ai credits?** Need `show_paywall: true`. See [/iblai-vibe-credit](../../iblai-vibe-credit).
- **Both?** Both flags must be `true`. Each product is configured independently.
- **Neither?** Skip the monetization UI entirely — render the free-tier experience.

## How to get the flags toggled

There is no public API or in-app admin toggle for either flag. They are provisioned on the Platform record by the ibl.ai operator. App authors should contact their ibl.ai customer success / operations contact to request a change. Until then, treat the value returned in the `tenants` localStorage payload as authoritative.

## Reading the flag in code

```ts
const tenants = JSON.parse(localStorage.getItem('tenants') ?? '[]');
const currentTenant = tenants.find((t: any) => t.key === currentPlatformKey);

if (currentTenant?.enable_monetization) {
  // Render item-monetization UI (PaywallModal, MonetizationTab, PurchasesTab, etc.)
}

if (currentTenant?.show_paywall) {
  // Render ibl.ai credits UI (CreditBalance widget, top-up modal, etc.)
}
```

Use optional chaining on `currentTenant?.` — the user may not be a member of every Platform in the array, and an undefined record should fail closed (no monetization UI).

## Related skills

- [/iblai-vibe-monetization](../../iblai-vibe-monetization) — overview and family index
- [/iblai-vibe-monetization-onboard](../../iblai-vibe-monetization-onboard) — Stripe Connect Express onboarding (requires `enable_monetization`)
- [/iblai-vibe-monetization-configure](../../iblai-vibe-monetization-configure) — admin MonetizationTab + paywall wizard
- [/iblai-vibe-monetization-checkout](../../iblai-vibe-monetization-checkout) — PaywallModal + access-check + checkout
- [/iblai-vibe-monetization-subscription](../../iblai-vibe-monetization-subscription) — user PurchasesTab + cancel flow
- [/iblai-vibe-credit](../../iblai-vibe-credit) — Platform-wide ibl.ai credits product (gated by `show_paywall`)
- [/iblai-vibe-auth](../../iblai-vibe-auth) — how the `tenants` array is hydrated into localStorage
- [/iblai-vibe-account](../../iblai-vibe-account) — Account tab host
- [/iblai-vibe-profile](../../iblai-vibe-profile) — Profile tab host
- [/iblai-vibe-navbar](../../iblai-vibe-navbar) — where `CreditBalance` is mounted
