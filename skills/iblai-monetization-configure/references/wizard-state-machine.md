# Wizard state machine

How the Paywall Configuration wizard inside MonetizationTab moves between
its steps, when it POSTs vs PUTs, and how it constructs the optional buy
URL. All file paths below are inside `iblai/ibl-web-frontend` on `main`.

## Files involved

- **Wizard component:** `packages/web-containers/src/components/profile/monetization/paywall-detail.tsx`
- **Step indicator:** `packages/web-containers/src/components/profile/monetization/wizard-step-indicator.tsx`
- **Shared helpers + type:** `packages/web-containers/src/components/profile/monetization/paywall-utils.ts`

The wizard is launched from `paywall-config.tsx`, which renders
`PaywalledItemsList` until the admin selects an existing item from search
OR clicks the `+ Add Custom Item` affordance — then it swaps in
`PaywallDetail` with the resolved `{type, id, name, isCustom}` props.

## The `WizardStep` type

Exported from `paywall-utils.ts`:

```ts
export type WizardStep = 'custom-item' | 'paywall' | 'pricing';
```

`PaywallDetail` keeps the active step in local state:
`useState<WizardStep>(isCustom ? 'custom-item' : 'paywall')`.

## Two flows

The wizard builds its `wizardSteps` array conditionally:

```ts
const wizardSteps = [
  ...(isCustom ? [{ key: 'custom-item' as WizardStep, label: 'Item Details' }] : []),
  { key: 'paywall', label: 'Paywall' },
  { key: 'pricing', label: 'Pricing' },
];
```

- **Existing items** (mentor / course / program / pathway selected from
  search): 2-step `Paywall → Pricing`. The `custom-item` step is skipped
  because the item already exists in the Platform domain.
- **Custom items** (admin clicked `+ Add Custom Item`): 3-step
  `Item Details → Paywall → Pricing`. The admin names the item, picks a
  slug, and optionally sets a Product URL.

```
                       ┌──── (existing item) ────┐
                       │                          │
   user selects item ──┤                          ├──→ Paywall step
                       │                          │
                       └─ (custom item) → Item Details → Paywall step
                                                              │
                                                              ↓
                                                        Pricing step
```

## `itemCreated` local state — POST vs PUT

A boolean tracked in `paywall-detail.tsx` decides which RTK Query
mutation runs on save:

```ts
const [itemCreated, setItemCreated] = useState(!isCustom);
const mutate = itemCreated ? updatePaywall : enablePaywall;
```

- For an **existing item**, `isCustom` is false, so `itemCreated` starts
  `true` — every save on the Paywall step calls
  `useUpdatePaywallMutation` (PUT).
- For a **custom item**, `itemCreated` starts `false`. The first call —
  inside `handleCreateCustomItem` on the Item Details step — uses
  `useEnablePaywallMutation` (POST). On success, `setItemCreated(true)`
  flips it, and subsequent saves use `useUpdatePaywallMutation` (PUT).
- `itemCreated` lives in component state only, so it resets when the
  admin navigates away from the detail view.

Both mutations hit
`{dm_url}/api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/paywall/`
(verified in the schema); only the verb changes.

## Step indicator click behavior

`WizardStepIndicator` renders each step as a button and disables clicks
only when its `onStepClick` prop is undefined. `PaywallDetail` passes a
different handler depending on the flow:

- **Existing item** (`!isCustom`): `setCurrentStep` is passed directly,
  so the admin can jump freely to any step.
- **Custom item** (`isCustom`): a wrapper only allows backward jumps —
  `if (targetIndex < currentIndex) setCurrentStep(step)`. Forward
  navigation during creation requires the current step's primary action
  (Create & Continue, or Save Configuration).

Forward navigation in either flow is gated by the action button on the
current step: Item Details requires both `customItemType` and
`customItemName` non-empty; Paywall advances on a successful save;
Pricing requires at least one price tier (enforced in
`price-management.tsx`).

## Custom item creation contract

When the admin clicks **Create & Continue**, `handleCreateCustomItem`
runs:

```ts
const sluggedType = slugify(customItemType);
const sluggedId = slugify(customItemName);
const result = await enablePaywall({
  platform_key: platformKey,
  item_type: sluggedType,
  item_id: sluggedId,
  is_enabled: false,
  allow_free_tier: false,
  trial_period_days: 0,
  grandfathering_strategy: 'free_forever',
  item_name: customItemName,
  description: customDescription,
  on_successful_payment: buildOnSuccessfulPaymentUrl({
    authURL, itemType: sluggedType, itemId: sluggedId,
    platformKey, isCustom: true, customProductUrl,
  }),
}).unwrap();
```

Key points:

- The wizard does NOT prefix `custom:` onto `item_type` on the wire — it
  POSTs the raw slugged type. `displayItemType()` is the place that
  strips a `custom:` prefix for display.
- The paywall is created **dormant**: `is_enabled: false`,
  `allow_free_tier: false`, `trial_period_days: 0`,
  `grandfathering_strategy: 'free_forever'`. The admin flips the toggle
  on the Paywall step.
- `on_successful_payment` is where buyers land after Stripe success. For
  a custom item it's literally `customProductUrl?.trim() || undefined`
  (per `buildOnSuccessfulPaymentUrl`).
- The response's `unique_id` is captured into `paywallUniqueId`. The
  wizard sets `resolvedItemType`/`resolvedItemId` to the slugged values,
  flips `itemCreated` true, and advances to the Paywall step.
- Item Type, Item Name, and Product URL inputs become `disabled` once
  `itemCreated` is true; the description textarea stays editable.

## `slugify()` rules

From `paywall-utils.ts` — exact implementation:

```ts
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}
```

In order: lowercase, trim, strip every character that is NOT a word char
/ whitespace / dash, collapse runs of whitespace or underscores into a
single dash, collapse runs of dashes into a single dash, strip leading
and trailing dashes. The Item Details form previews the result live
(`Slug: {slugify(customItemType)}`, `ID: {slugify(customItemName)}`).

## Copy-URL button

Once `paywallUniqueId` is populated (either from the GET in the
existing-item flow, or from the POST response in the custom flow), a
Copy button appears next to the item title:

```ts
const basePath = authURL.endsWith('/') ? authURL : `${authURL}/`;
const url = `${basePath}buy/${paywallUniqueId}`;
await navigator.clipboard.writeText(url);
```

A green check appears for 2.5s after a successful copy, then reverts; a
toast (`'URL copied to clipboard'`) confirms.

The "Copy" button builds `${authURL}/buy/${paywallUniqueId}`. Because
`authURL` points at the auth app and the auth app ships a `/buy/[id]`
route (`apps/auth/app/(auth)/buy/[id]/page.tsx`), this URL resolves
out-of-the-box. If you're not deploying the auth app, build your own
buy page using `useGetPublicPricingQuery` +
`useCreateGuestCheckoutMutation` — see
[/iblai-monetization-checkout](../iblai-monetization-checkout).

## `authURL` dependency

`PaywallDetail` requires `authURL: string` as a prop and uses it for two
things:

1. **`buildOnSuccessfulPaymentUrl`** — for non-custom items this helper
   synthesizes a return URL of the form
   `https://mentorai.<ext>/platform/<key>/<id>`,
   `https://skillsai.<ext>/courses/<id>`, or
   `https://skillsai.<ext>/programs/<id>` from
   `getAuthURLExtension(authURL)`. If `authURL` is missing or
   unparseable, `getAuthURLExtension` returns `''` and
   `buildOnSuccessfulPaymentUrl` returns `undefined` — so the paywall
   ships with no `on_successful_payment` and Stripe Checkout has no
   `success_url`.
2. **Copy-URL button** — the buy URL is built off `authURL`.

The host app passes `authURL` down through the Account component:
`<MonetizationTab platformKey={tenant} authURL={authURL} />` (verified
in `packages/web-containers/src/components/profile/account.tsx`).

## Return URL from Stripe Connect onboarding

The Stripe Connect onboarding card (`stripe-connect.tsx`) appends
`?profileTab=monetization` to the current `window.location.href` and
sends that to the backend as both `return_url` and `refresh_url`:

```ts
const buildMonetizationUrl = () => {
  const url = new URL(window.location.href);
  url.searchParams.set('profileTab', 'monetization');
  return url.toString();
};
// ... return_url: redirectUrl, refresh_url: redirectUrl
```

After the admin completes onboarding (or aborts and is refreshed back),
they land at `/account?profileTab=monetization`. The host page must
read `profileTab` from the URL and select the Monetization tab — routers
must NOT strip query params, or the admin will land on the default tab.

## Related

- [/iblai-monetization-configure](../iblai-monetization-configure) — host skill (wizard launch + tab gating)
- [/iblai-monetization-onboard](../iblai-monetization-onboard) — Stripe Connect prerequisite
- [/iblai-monetization-checkout](../iblai-monetization-checkout) — what buyers see after the buy URL resolves
- [/iblai-monetization](../iblai-monetization) — family index
