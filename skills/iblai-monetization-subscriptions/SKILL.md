---
name: iblai-monetization-subscriptions
description: Build the user-facing PurchasesTab inside the Profile page — list, detail, and cancel for the current user's subscriptions on a Platform. Use when the user mentions purchases, my subscriptions, subscription list, cancel subscription, stripe portal, grandfathered, legacy subscription, subscription detail, or cancel-at-period-end. See /iblai-monetization for the family index + auth + RBAC, /iblai-monetization-checkout for how the user got here (paywall, checkout, callback), /iblai-monetization-analytics for the admin subscriber view, /iblai-profile for the Profile shell that hosts this tab, and /iblai-auth for the token wiring.
globs:
alwaysApply: false
---

# /iblai-monetization-subscriptions

Wire the post-purchase surface inside the Profile page: a paginated, searchable
list of the current user's subscriptions, a detail view per subscription, and
a cancel flow that branches between an immediate cancel and a Stripe Customer
Portal redirect. The SDK ships `PurchasesTab` — Profile renders it
automatically when the Platform has monetization enabled — so most of the work
is wiring, not UI.

Do NOT add custom styles, colors, or CSS overrides to ibl.ai SDK components.
They ship with their own styling. Keep the components as-is.
Do NOT implement dark mode unless the user explicitly asks for it.

When building custom UI around SDK components, use the ibl.ai brand:
- **Primary**: `#0058cc`, **Gradient**: `linear-gradient(135deg, #00b0ef, #0058cc)`
- **Button**: `bg-gradient-to-r from-[#2563EB] to-[#93C5FD] text-white`
- **Font**: System sans-serif stack, **Style**: shadcn/ui new-york variant
- Follow the component hierarchy: use ibl.ai SDK components
  (`@iblai/iblai-js`) first, then shadcn/ui for everything else
  (`npx shadcn@latest add <component>`). Do NOT write custom components
  when an ibl.ai or shadcn equivalent exists. Both share the same
  Tailwind theme and render in ibl.ai brand colors automatically.
- Follow [BRAND.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/BRAND.md) for
  colors, typography, spacing, and component styles.

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

## Prerequisites

- Auth must be set up first (`/iblai-auth`) — reuse the same token wiring.
- MCP and skills must be set up: `iblai add mcp`.
- `iblai.env` populated with `PLATFORM`, `DOMAIN`, `TOKEN`. If missing:
  `curl -o iblai.env https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/iblai.env`
- The Profile page is mounted (`/iblai-profile`). PurchasesTab is rendered by
  the Profile shell, not by your app code directly.
- The Platform has `enable_monetization === true`. The Profile shell reads
  this flag from `currentTenant` (SDK identifier; that's the Platform record)
  and only renders the Purchases tab when the flag is on. The `show_paywall`
  flag governs paywall enforcement on items — it is NOT what gates the
  Purchases tab. Use `enable_monetization`.
- The caller is authenticated. There is no role restriction: any logged-in
  user can see their own subscriptions. The list view, detail view, and
  cancel view all use `IsEdxAuthenticated` and filter by `request.user`.

## What you'll build

Most of this is already implemented inside the SDK `PurchasesTab`. The
spec below documents what the user will see so you can recognize when
something is mis-wired, and so any custom subscription UI you write
mirrors the same shape.

| Surface | Content |
|---|---|
| Search bar | Debounced 300ms input; passes `search` to the list query (backend filters by `item_id__icontains`). |
| Filters | Status select (All / Active / Trialing / Canceled / Past Due) + item-type select (All / Mentor / Course / Program / Pathway) + total count chip. |
| Subscription card | Item name, type badge, plan name + amount/interval, "Renews"/"Expires" date, "Since" date, cancel-at-period-end warning row, status badge, "Legacy" badge when grandfathered. |
| Detail view | Status, plan, type, renewal/expiry date, since date, grandfathered badge, "Type `cancel` to confirm" input + destructive cancel button. |
| Cancel result | Either a "Subscription Canceled" success card OR an "Open Stripe Portal" card — depends on the response branch. |
| Pagination | 8 items per page; Previous / Page N / Next controls; disabled when there's no next/previous page. |

## Step 0: Check for CLI Updates

Before running any `iblai` command, ensure the CLI is up to date.
Run `iblai --version`, then upgrade directly:
- pip: `pip install --upgrade iblai-app-cli`
- npm: `npm install -g @iblai/cli@latest`

## Step 1: Validate the API schema

Three endpoints back this surface. Confirm each one in the live OpenAPI schema
before writing any client code — the current schema has the shapes below at
fetch time, but a future release may shift fields. See
[references/cancel-flow.md](references/cancel-flow.md) for the full payloads
and the response-branching contract.

```bash
curl -sS https://api.iblai.app/dm/api/docs/schema/ -o /tmp/iblai_schema.yaml
grep -E "my-subscriptions/|subscription/cancel/|subscription/$" /tmp/iblai_schema.yaml
```

You should see all three. Endpoints live under the **DM base**
(`{dm_url}`, e.g. `https://api.iblai.app/dm`) and require `Authorization:
Token <DM token>` — the **DM token**, not the AXD token (using the AXD
token returns `401`). Item-keyed endpoints expose both a canonical
(`unique_id`-keyed) form and the legacy composite form; the SDK still
builds composite URLs.

| Capability | Canonical (recommended) | Composite (legacy) |
|---|---|---|
| Subscription read | `GET {dm_url}/api/billing/items/{item_unique_id}/subscription/` | `GET {dm_url}/api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/subscription/` |
| Subscription cancel | `POST {dm_url}/api/billing/items/{item_unique_id}/subscription/cancel/` | `POST {dm_url}/api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/subscription/cancel/` |
| User's full subscription list | — (platform-scoped, no canonical) | `GET {dm_url}/api/billing/platforms/{platform_key}/my-subscriptions/` |

All three require an authenticated user; the backend scopes by `request.user`
+ `platform_key`, so there is no way to read or cancel another user's
subscription. `ItemSubscriptionCancelView` is hard-locked to `request.user`
— operators cannot cancel on behalf of another user through this API.

## Step 2: Wire the Profile integration

The Profile page shell owns this tab. Confirm `/iblai-profile` has been set
up — if it has not, do that skill first and come back.

When the Profile shell mounts it reads the current Platform record. The SDK
exposes that record under the literal identifier `currentTenant` (legacy name
— treat the field as "the active Platform"). If
`currentTenant?.enable_monetization` is truthy, the shell appends a
`Purchases` tab to the tab strip and renders `PurchasesTab` when it is
active:

```ts
// inside the SDK Profile component
const isPurchasesEnabled = currentTenant?.enable_monetization;
const tabs = [
  // …other tabs
  ...(isPurchasesEnabled
    ? [{ id: 'purchases', label: 'Purchases', renderIcon: renderLucideIcon(ShoppingBag) }]
    : []),
];

{activeTab === 'purchases' && <PurchasesTab org={tenant} username={username} />}
```

You do not need to mount `PurchasesTab` yourself. If the tab is missing,
debug in this order:

1. Is the user authenticated and on `/iblai-profile`?
2. Is `enable_monetization` actually `true` on the current Platform? Check
   the platform list endpoint or `localStorage` cache. Do NOT confuse it
   with `show_paywall` — that flag gates paywall enforcement on items and
   has no effect on this tab.
3. `PurchasesTab` is a private component owned by the `Profile` shell —
   it's NOT re-exported by `@iblai/iblai-js/web-containers`. Integrate via
   `<Profile>` (which renders `PurchasesTab` when
   `currentTenant.enable_monetization === true`); standalone use requires
   copying the component from
   `packages/web-containers/src/components/profile/purchases/purchases-tab.tsx`.

## Step 3: Customize the list query

This step is only relevant if you are building a **custom** subscriptions
surface (a billing-only page, a widget on the dashboard, an admin overlay).
If you are using the SDK `PurchasesTab`, skip ahead to Step 6 to verify
cache invalidation.

```ts
import { useGetMySubscriptionsQuery, type SubscriptionObject } from '@iblai/data-layer';

const { data, isLoading, isFetching } = useGetMySubscriptionsQuery(
  {
    platform_key,
    page,
    page_size: 8,
    ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
    ...(typeFilter !== 'all' ? { item_type: typeFilter } : {}),
    ...(debouncedSearch.trim() ? { search: debouncedSearch.trim() } : {}),
  },
  { refetchOnMountOrArgChange: true },
);
```

Note: the SDK's `MySubscriptionsParams` type lists `item_name?` but the
backend only honors `search` (filters by `item_id__icontains`). Use
`search` for text matching — `item_name` is dropped silently by the
`SubscriptionListQPSerializer`.

The response envelope is the standard Platform pagination shape:

```ts
type MySubscriptionsResponse = {
  count: number;
  next_page: number | null;
  previous_page: number | null;
  results: SubscriptionObject[];
};
```

Note: the runtime paginator (`StandardPageNumberPagination` at
`core/utils/pagination.py`) returns `next_page`/`previous_page` as
integers (or `null`). The OpenAPI schema documents `next`/`previous` as
URI strings (DRF default) — that's schema drift. Trust the runtime
shape shown above.

`SubscriptionObject.price.amount` is a **string** (DRF decimal). Use the
SDK pattern `parseFloat(sub.price.amount)` or pass the string straight into
`Intl.NumberFormat(...).format()` — do not multiply / add the raw string.

Debounce the search input 300ms before forwarding it to the query, and
reset `page` to `1` whenever any filter or the debounced search changes.
Otherwise the user lands on an empty page-3 when the result set shrinks.

## Step 4: Detail view + cancel flow

Each card opens a detail view. Refetch the canonical record (the list payload
is summary-only on some Platforms) and wire the cancel mutation:

```ts
import {
  useGetItemSubscriptionQuery,
  useCancelSubscriptionMutation,
} from '@iblai/data-layer';

const { data: fetched, isLoading } = useGetItemSubscriptionQuery(
  { platform_key, item_type: sub.item_type, item_id: sub.item_id },
  { refetchOnMountOrArgChange: true },
);

const [cancelSubscription, { isLoading: isCanceling }] = useCancelSubscriptionMutation();
```

`useCancelSubscriptionMutation` returns ONE of two payload shapes — branch on
which key is present:

```ts
const result = await cancelSubscription({
  platform_key,
  item_type: sub.item_type,
  item_id: sub.item_id,
  ...(isRecurring ? { return_url: window.location.href } : {}),
}).unwrap();

if (result.portal_url) {
  // Recurring sub with a Stripe customer — open the Stripe Customer Portal.
  window.open(result.portal_url, '_blank');
} else if (result.status === 'canceled') {
  // One-time, grandfathered, or no-Stripe-customer — already canceled.
  // `result` is the FULL ItemSubscriptionSerializer record (21 fields)
  // with the new `status='canceled'` and `canceled_at` set.
  toast.success('Subscription canceled');
}
```

The three response branches the backend may return:

- **Immediate cancel** (one-time, grandfathered, or no
  `stripe_subscription_id`): full `ItemSubscriptionSerializer` response —
  21 fields — with `status='canceled'` and `canceled_at` populated.
- **Portal handoff** (recurring with a `stripe_customer_id`): single-field
  `{ portal_url }` via `PortalUrlResponseSerializer`. The actual Stripe
  cancellation happens inside the Stripe Customer Portal.
- **400** if recurring but `stripe_customer_id` is missing on the user.
- **404** if no subscription exists for the caller on this item.
- **500** if Stripe Customer Portal creation throws.

The destructive button must remain disabled until the user types the literal
string `cancel` into a confirmation input. This is what `PurchasesTab` does —
match it in any custom UI. Treat the cancel button as you would any other
irreversible action.

See [references/cancel-flow.md](references/cancel-flow.md) for the full
response shapes, the server-side branching logic, and the optional
`return_url` body field.

## Step 5: Grandfathered subscriptions

Some users are granted legacy access — historical purchases, comped seats,
admin-issued lifetime passes. The backend flags these with
`is_grandfathered: true` on `SubscriptionObject`. PurchasesTab renders a
small amber "Legacy" / "Grandfathered" badge on both the card and the
detail view.

Grandfathered subscriptions have NO Stripe customer. When the user cancels,
the backend takes the immediate-cancel branch and returns the FULL
`ItemSubscriptionSerializer` record (21 fields) with the new
`status='canceled'` and `canceled_at` populated — there is no portal URL
because there is nothing for Stripe to manage. Render the
"Subscription Canceled" success card and refresh the list.

In any custom UI, treat `is_grandfathered` as decorative — do not change
the cancel button copy. The cancel mutation handles the routing for you.

## Step 6: Cache invalidation

`useCancelSubscriptionMutation` invalidates four RTK Query tags:

- `mySubscriptions` — the Purchases list refetches and the cancelled row
  flips to the `canceled` status filter (or drops off the current page).
- `itemSubscription` — the detail view picks up the new `status` and
  `canceled_at` timestamp.
- `accessCheck` — any gated content (`useCheckAccessQuery` on a paywalled
  page, the `PaywallModal` trigger on a locked mentor) flips back to
  locked. Forget this and the rest of the app shows a stale "you have
  access" UI.
- `subscribers` — the admin subscriber list (rendered by
  `/iblai-monetization-analytics`) reflects the churn immediately.

If you are building a custom cancel surface that calls a thin wrapper
around the endpoint instead of the SDK mutation, replicate this exact tag
set. Dropping `accessCheck` is the most common bug.

## Verify

After wiring:

1. Open the Profile page on a Platform with `enable_monetization === true`
   and confirm the Purchases tab is in the tab strip.
2. Log in as a user with at least one subscription and verify the list
   renders 8 cards per page with the correct status / type / Legacy badges.
3. Type into the search box; confirm the debounce kicks in after 300ms
   and the list filters by the `search` param (matches against `item_id`).
4. Open a recurring subscription detail, type `cancel` into the
   confirmation input, click the destructive button, and confirm a
   Stripe Customer Portal card renders with an "Open Stripe Portal" CTA.
5. Open a one-time or grandfathered subscription, repeat the cancel flow,
   and confirm the "Subscription Canceled" card renders instead.
6. After a cancel, navigate to a paywalled item the user previously had
   access to and confirm it is now locked (the `accessCheck` invalidation
   worked).
7. Use the pagination Previous / Next controls and confirm `page` resets
   to 1 when any filter or the debounced search changes.

## Common mistakes

- **Assuming the cancel mutation always returns `portal_url`.** It does
  not. One-time purchases, grandfathered subscriptions, and any
  subscription without a Stripe customer return `{ status: 'canceled' }`
  immediately. Branch on which key is present, not on subscription type.
- **Forgetting to invalidate `accessCheck` in a custom cancel wrapper.**
  The cancel succeeds, the Purchases list refreshes, but every gated page
  in the app keeps showing "you have access" until a hard reload. Always
  invalidate `accessCheck` (and `subscribers`) alongside the two
  subscription tags.
- **Gating the Purchases tab on `show_paywall`.** Wrong flag.
  `show_paywall` controls paywall enforcement on items. The Purchases tab
  is gated on `enable_monetization`. They are independent.
- **Building a custom `PurchasesTab` from scratch.** The Profile shell owns
  the tab; the SDK exports the component; both ship a tested UI for
  search, filters, detail, cancel, and pagination. Add a custom widget
  elsewhere if you must, but do not replace the one Profile renders.
- **Doing arithmetic on `price.amount` directly.** It is a string.
  `parseFloat` first, or pass it untouched to `Intl.NumberFormat`. Don't
  add `"19.00"` to `"5.00"` and ship `"19.005.00"` in production.
- **Hardcoding URL paths.** The SDK constants live in
  `MONETIZATION_ENDPOINTS` (`packages/data-layer/src/features/monetization/`).
  When refactoring, import from there — do not retype the path.

## MCP tools for further detail

Once `iblai add mcp` is set up, query the MCP tools for richer help:

- `get_hook_info("useGetMySubscriptionsQuery")`
- `get_hook_info("useGetItemSubscriptionQuery")`
- `get_hook_info("useCancelSubscriptionMutation")`
- `get_component_info("Profile")`

## Files in this skill's scope

Frontend (`iblai/ibl-web-frontend`):

- `packages/web-containers/src/components/profile/purchases/purchases-tab.tsx`
  — the SDK `PurchasesTab` component (search, filters, list, detail,
  cancel branching, pagination).
- `packages/web-containers/src/components/profile/index.tsx` — the Profile
  shell that gates `Purchases` on `currentTenant?.enable_monetization`
  and renders `<PurchasesTab org={tenant} username={username} />`.
- `packages/data-layer/src/features/monetization/custom-api-slice.ts`
  — `getMySubscriptions`, `getItemSubscription`, `cancelSubscription`
  endpoints and their `providesTags` / `invalidatesTags` wiring.
- `packages/data-layer/src/features/monetization/types.ts` —
  `SubscriptionObject`, `SubscriptionPrice`, `MySubscriptionsParams`,
  `MySubscriptionsResponse`, `CancelSubscriptionArgs`,
  `CancelSubscriptionResponse`.

Backend (`iblai/ibl-dm-pro`):

- `web/ibl-dm-core-apps/ibl-dm-billing-app/billing/views.py`
  - `ItemSubscriptionView` at line 1853 — GET detail.
  - `ItemSubscriptionCancelView` at line 1885 — POST cancel, server-side
    branching between immediate cancel and Stripe Customer Portal.
  - `UserAllSubscriptionsView` at line 2196 — GET paginated list.
- `web/ibl-dm-core-apps/ibl-dm-billing-app/billing/serializers.py`
  - `ItemSubscriptionListSerializer`, `ItemSubscriptionSerializer`,
    `SubscriptionCancelSerializer`, `PortalUrlResponseSerializer`.

## Related skills

- [/iblai-monetization](../iblai-monetization/SKILL.md) — family index, auth,
  schema validation, Platform flags, RBAC, the full monetization API slice.
- [/iblai-monetization-checkout](../iblai-monetization-checkout/SKILL.md) —
  how the user got here: PaywallModal, `useCheckAccessQuery` (402-as-success),
  checkout session creation, guest checkout, public pricing.
- [/iblai-monetization-analytics](../iblai-monetization-analytics/SKILL.md) —
  the Platform admin's view of the same data: revenue, subscribers list,
  paywalls list, admin cancel tool.
- [/iblai-monetization-configure](../iblai-monetization-configure/SKILL.md) —
  the Platform admin's MonetizationTab inside Account: paywall config,
  pricing CRUD, Item Details → Paywall → Pricing wizard.
- [/iblai-monetization-onboard](../iblai-monetization-onboard/SKILL.md) —
  Stripe Connect Express onboarding for the Platform seller.
- [/iblai-profile](../iblai-profile/SKILL.md) — the Profile shell that
  hosts this tab.
- [/iblai-auth](../iblai-auth/SKILL.md) — token wiring this tab depends on.
- [BRAND.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/BRAND.md)
  — colors, typography, spacing, component styles for any custom subscription
  surface you build alongside the SDK tab.
