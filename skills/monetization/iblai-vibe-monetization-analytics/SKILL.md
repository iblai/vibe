---
name: iblai-vibe-monetization-analytics
description: Add revenue analytics for ibl.ai's item monetization — the SDK's Monetization tab in AnalyticsLayout (AnalyticsMonetizationStats — revenue, sales, active paywalls, subscribers, status and item-type charts, subscribers and paywalls tables), or custom dashboards, subscriber lists, paywall overviews, and a self-service subscription cancel helper built from the same hooks. Use when the user mentions analytics, revenue, subscribers, sales volume, sales count, commission, dashboard, paywalls list, cancel subscription, or "monetization metrics". See /iblai-vibe-monetization for the family index, /iblai-vibe-monetization-onboard for Stripe Connect status + commission, /iblai-vibe-monetization-configure for paywall setup, /iblai-vibe-monetization-subscription for the user-side counterpart, /iblai-vibe-auth for token wiring, and /iblai-vibe-rbac for the IsPlatformAdmin gate.
globs:
alwaysApply: false
metadata:
  kind: ui
---

# /iblai-vibe-monetization-analytics

Show sellers what their paywalls earn. The fastest path is the SDK's
**Monetization** tab in `AnalyticsLayout`, rendered by
`AnalyticsMonetizationStats`: four KPI cards, two donut charts, and
paginated subscribers and paywalls tables. When you need something the
tab does not show, build it from the four analytics endpoints (revenue,
Platform-wide subscribers, per-item subscribers, paywalls list) and the
`CancelSubscription` helper, which cancels the **caller's own**
subscription on a given `(item_type, item_id)`.

![Monetization tab — Total Revenue, Total Sales, Active Paywalls, Total Subscribers, and the two donut charts](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/monetization/iblai-vibe-monetization-analytics/monetization-analytics-main-cards.png)

> **A true admin override (cancel-on-behalf-of-user) does not exist.**
> The cancel endpoint is hard-locked to `request.user`; there is no
> `user_id` parameter. To force-cancel another user's subscription, an
> operator must do so directly in the Stripe Dashboard.

> **Two different tabs.** `MonetizationTab` in the Account page
> (`/iblai-vibe-monetization-configure`) *configures* paywalls and shows no
> revenue. The analytics **Monetization** tab (`AnalyticsMonetizationStats`,
> below) *reports* on them.

> **Common setup (brand, conventions, env files, verification):** see [docs/skill-setup.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/docs/skill-setup.md).

> **Verify the API before you call it.** Fetch the live OpenAPI schema at `{dm_url}/api/docs/schema/` (`{dm_url}` = `https://api.$DOMAIN/dm`, `DOMAIN` from `iblai.env`, default `iblai.app`) and confirm the URL path, method, request body, and response shape for every endpoint you reach for. See [/iblai-vibe-monetization → references/schema-validation.md](../../monetization/iblai-vibe-monetization/references/schema-validation.md).

## Prerequisites

- Auth must be set up first (`/iblai-vibe-auth`) — reuse the same
  `Authorization: Token <token>` wiring the rest of the app uses.
- `.mcp.json` configured with `@iblai/mcp` (and skills installed via
  `npx skills add iblai/vibe --all`).
- `iblai.env` populated with `PLATFORM`, `DOMAIN`, `TOKEN`. If missing:
  `curl -o iblai.env https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/iblai.env`
- **Platform admin role required.** All four analytics endpoints
  (paywalls, Platform-wide subscribers, per-item subscribers, revenue)
  are gated by `IsPlatformAdmin`. Non-admin → `403`; anonymous → `401`.
  See `/iblai-vibe-rbac`.
- **`enable_monetization === true` required.** All four analytics views
  also run the `_enforce_can_sell_items` mixin check (returns `403` when
  the flag is off) — this applies equally to the per-item subscribers
  endpoint, not just the Platform-wide ones. The flag ships in the SDK's
  `tenants` array.
  See [/iblai-vibe-monetization → references/platform-flags.md](../../monetization/iblai-vibe-monetization/references/platform-flags.md).
- **Stripe Connect onboarded** with `is_ready_for_payments === true`.
  Without it, revenue is empty and subscribers contains only free /
  grandfathered rows. Wire `/iblai-vibe-monetization-onboard` first.

## What you'll build

0. **The shipped Monetization tab** — one prop on the `AnalyticsLayout`
   you already have, plus a route. Start here; build 1–5 only for what it
   does not cover.
1. **Revenue card** — `useGetRevenueQuery` → `sales_volume`,
   `sales_count`, `currency`. Optionally pair with
   `useGetStripeConnectStatusQuery` for commission percentages.
2. **Subscribers list (Platform-wide)** — paginated table via
   `useListSubscribersQuery` with status + `item_type` filters and
   server-side search.
3. **Per-item subscribers drilldown** — `useListItemSubscribersQuery`,
   typically reached from a paywall detail page or leaderboard row.
4. **Paywalls overview** — `useListPaywallsQuery` with `item_type` +
   `is_enabled` filters; useful for leaderboards, audits, or custom
   surfaces beyond the bundled `MonetizationTab`.
5. **Self-service `CancelSubscription` helper** — cancels the **caller's
   own** subscription on a given `(item_type, item_id)`. NOT an admin
   override; the endpoint resolves the subscription via `request.user`.
   To cancel another user's subscription, use the Stripe Dashboard.

## Step 0: Turn on the Monetization analytics tab

`AnalyticsLayout` ships a `monetization` tab, hidden by default. It shows
only when **both** hold (no admin bypass):

- the host passes `enableMonetization` — wire it to the org's
  `enable_monetization` flag;
- the user holds `can_sell_items` on the org
  (`/platforms/{org}/#can_sell_items`), the same check the sidebar and the
  Account page's Monetization entry use. Read it yourself with
  `canViewMonetizationAnalytics(rbacPermissions, currentTenant)` from
  `@iblai/iblai-js/web-utils`.

Otherwise the trigger is not rendered, and a deep link to
`{basePath}/monetization` redirects to the first tab the user may open. A
pure watcher never sees it. In vibe-starter, add the prop to
`app/(app)/admin/analytics/layout.tsx`:

```tsx
const { currentTenant } = useCurrentTenant(); // @iblai/iblai-js/web-utils

<AnalyticsLayout
  currentPath={pathname}
  basePath={basePath}
  onTabChange={(tab: string) => router.push(tab ? `${basePath}/${tab}` : basePath)}
  enableMonetization={Boolean(currentTenant?.enable_monetization)}
>
```

and give the tab a route, `app/(app)/admin/analytics/monetization/page.tsx`:

```tsx
"use client";

import { AnalyticsMonetizationStats } from "@iblai/iblai-js/web-containers";
import { useCurrentTenant } from "@iblai/iblai-js/web-utils";

export default function Page() {
  const { currentTenant } = useCurrentTenant();
  if (!currentTenant?.key) return null;
  return <AnalyticsMonetizationStats tenantKey={currentTenant.key} mentorId="" />;
}
```

What it renders (`useMonetization` composes `useGetRevenueQuery`,
`useListPaywallsQuery`, `useListSubscribersQuery`):

| Section | Source |
|---|---|
| **Total Revenue** — `sales_volume`, two decimals, no locale grouping | revenue |
| **Total Sales**, **Active Paywalls**, **Total Subscribers** | `sales_count`, paywalls `count`, subscribers `count` |
| **Subscribers by Status**, **Paywalls by Type** donuts | current page of each list, shared chart palette |
| **Subscribers** table (12 per page, status filter): User, Item, Type, Plan, Amount, Subscribed, Status | subscribers |
| **Configured Paywalls** table (8 per page, All / Agent / Course filter): Item, Type, Prices (active count), Status | paywalls |

The **User** column shows the email (username as fallback) as a
`UserProfileLink` that opens the profile viewer; pass `currentSPA` to
forward your SPA to it. **Subscribed** is the day the subscription started
(`created_at`); **Amount** is blank for `grandfathered` rows. `mentorId`,
`selectedMentorId`, and `usergroupIds` are accepted but unused — the tab is
always org-wide, so the agent picker and date range do not filter it.

![Subscribers table — User, Item, Type, Plan, Amount, Subscribed, Status](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/monetization/iblai-vibe-monetization-analytics/monetization-analytics-subscribers-list.png)

![Configured Paywalls table with the type filter and pagination](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/monetization/iblai-vibe-monetization-analytics/monetization-analytics-configured-paywalls.png)

## Step 1: Validate the API schema

Confirm the four analytics endpoints + the cancel endpoint are present
before writing any code:

```bash
DOMAIN=$(grep -m1 '^DOMAIN=' iblai.env 2>/dev/null | cut -d= -f2-)
curl -sS "https://api.${DOMAIN:-iblai.app}/dm/api/docs/schema/" -o /tmp/iblai_schema.yaml
grep -E "/api/billing/platforms/\{platform_key\}/(revenue|subscribers|paywalls)/|/api/billing/platforms/\{platform_key\}/items/\{item_type\}/\{item_id\}/(subscribers|subscription/cancel)/" /tmp/iblai_schema.yaml
```

You should see five paths. The full per-endpoint catalog (method, query
params, response shape, source view, permission class) lives in
[`references/analytics-api.md`](./references/analytics-api.md).

All analytics endpoints live under the **DM base** (`{dm_url}`, e.g.
`https://api.iblai.app/dm`) and require `Authorization: Token <DM token>`
— the **DM token**, not the AXD token. The platform-scoped endpoints
have **no canonical alternative** (they aggregate across items). Only
the item-scoped subscribers endpoint has a canonical (`unique_id`-keyed)
counterpart.

| Endpoint | Form | Hook |
|---|---|---|
| `{dm_url}/api/billing/platforms/{platform_key}/revenue/` | (platform-scoped, no canonical) | `useGetRevenueQuery` |
| `{dm_url}/api/billing/platforms/{platform_key}/subscribers/` | (platform-scoped, no canonical) | `useListSubscribersQuery` |
| `{dm_url}/api/billing/platforms/{platform_key}/paywalls/` | (platform-scoped, no canonical) | `useListPaywallsQuery` |
| `{dm_url}/api/billing/items/{item_unique_id}/subscribers/` | **Canonical (recommended)** | direct fetch (SDK hook is composite) |
| `{dm_url}/api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/subscribers/` | Composite (legacy) | `useListItemSubscribersQuery` |

Cancel reuses the subscription cancel endpoint —
canonical `{dm_url}/api/billing/items/{item_unique_id}/subscription/cancel/`
or composite `{dm_url}/api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/subscription/cancel/`
— via `useCancelSubscriptionMutation` (which still builds the composite
URL). It is the same endpoint the user-side `PurchasesTab` calls and is
hard-locked to `request.user` — operators cannot cancel on behalf of
another user through this API. See `/iblai-vibe-monetization-subscription`
for the `portal_url` vs immediate `status: "canceled"` branch.

## Step 2: Revenue

`useGetRevenueQuery({ platform_key })` returns three fields:

```ts
interface RevenueResponse {
  sales_volume: string;   // DRF DecimalField serializes as string, e.g. "1499.50" — coerce with Number()
  sales_count: number;    // number of completed sales (e.g. 12)
  currency: string;       // ISO 4217 lower-cased (typically "usd")
}
```

> **`sales_volume` ships as a string** (DRF `DecimalField` serializes as
> `"1499.50"`). Coerce with `Number(data.sales_volume)` before passing
> to `Intl.NumberFormat` — formatting a string yields `NaN`.

```tsx
import { useGetRevenueQuery } from '@iblai/iblai-js/data-layer';

function RevenueCard({ platformKey }: { platformKey: string }) {
  const { data } = useGetRevenueQuery({ platform_key: platformKey });
  if (!data) return <Skeleton className="h-32 w-full" />;
  const formatted = new Intl.NumberFormat(undefined, {
    style: 'currency', currency: data.currency.toUpperCase(),
  }).format(Number(data.sales_volume));
  return (
    <Card><CardContent className="p-5">
      <p className="text-xs text-gray-500">Total revenue</p>
      <p className="text-2xl font-semibold">{formatted}</p>
      <p className="text-xs text-gray-500 mt-1">
        {data.sales_count} completed sale{data.sales_count === 1 ? '' : 's'}
      </p>
    </CardContent></Card>
  );
}
```

**Where the numbers come from.** The backend aggregates `ItemPaymentRecord`
rows written by Stripe webhook handlers — NOT a live read against Stripe.
Expect a short lag between checkout and the number ticking up. **Currency
is a single Platform field**, not a per-item breakdown; for multi-currency,
aggregate by `price.currency` from the subscribers list yourself.

## Step 3: Commission interpretation

The commission ibl.ai takes per item type is on the Stripe Connect status
endpoint (`useGetStripeConnectStatusQuery` → `commission_percent`), not on
the revenue response. Treat it as `Record<string, number>` and iterate
`Object.entries` — backend, OpenAPI, and SDK types disagree on which keys
exist (up to `mentor`, `course`, `program`, `pathway`). Render `mentor` as
**"Agent"**. Display it informationally; never subtract it from
`sales_volume`. Component and the key-divergence table:
[`references/commission.md`](./references/commission.md).

## Step 4: Subscribers — Platform-wide

`useListSubscribersQuery` returns a paginated list of every subscription
across every item on the Platform:

```ts
interface ListSubscribersParams {
  platform_key: string;
  status?: 'active' | 'free' | 'grandfathered' | 'trialing'
         | 'past_due' | 'canceled' | 'incomplete';
  item_type?: string;       // 'mentor' | 'course' | 'program' | 'pathway' | 'custom:foo'
  page?: number;
  page_size?: number;
}

// 12 flat fields per row — flat (NOT nested under `user`)
interface SubscriberRow {
  unique_id: string; user_id: number; username: string; email: string;
  item_type: string;  // 'mentor' | 'course' | 'program' | 'pathway' | 'custom:foo'
  item_id: string; item_name: string;
  status: 'active' | 'free' | 'grandfathered' | 'trialing'
        | 'past_due' | 'canceled' | 'incomplete';
  price: unknown;     // PaywallPrice — interval, amount, currency, is_active
  created_at: string; updated_at: string;  // ISO 8601
}

interface ListSubscribersResponse {
  count: number;
  next_page: number | null;
  previous_page: number | null;
  results: SubscriberRow[];
}
```

`user_id`, `username`, and `email` sit at the TOP level (NOT nested
under a `user` object) — admin tables render who is subscribed with no
second roundtrip per row. This is the slimmer
`ItemSubscriptionListSerializer`; the per-item endpoint returns the
richer `ItemSubscriptionSerializer` shape — see Step 5.

```tsx
function SubscribersTable({ platformKey }: { platformKey: string }) {
  const [status, setStatus] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const { data } = useListSubscribersQuery({
    platform_key: platformKey, status, page, page_size: 25,
  });
  // render data.results; paginate via data.next_page / data.previous_page
  // wrap controls in a status <Select>: active | trialing | past_due |
  // canceled | grandfathered | free | incomplete (omit → all statuses)
}
```

Pagination uses page numbers, not cursors — increment `page` when
`next_page` is non-null. Backend honors `page_size` as a query param.

## Step 5: Subscribers — per-item

When the admin drills into a specific paywall, render that item's
subscribers with `useListItemSubscribersQuery`. It accepts
`(item_type, item_id)` instead of bare query params:

```tsx
const { data } = useListItemSubscribersQuery({
  platform_key: platformKey,
  item_type: itemType,
  item_id: itemId,
  status: 'active',
});
// data.results[i] carries username, email, price, status, current_period_end
```

Response envelope is identical to the Platform-wide subscribers list
(`count`, `next_page`, `previous_page`, `results`), but **each row is
richer** — the per-item endpoint serializes through
`ItemSubscriptionSerializer` (~21 flat fields) instead of the slimmer
`ItemSubscriptionListSerializer` (12 flat fields). Extra fields you can
read here that are NOT on the Platform-wide list:
`current_period_start`, `current_period_end`, `trial_end`,
`cancel_at_period_end`, `canceled_at`, `is_grandfathered`,
`grandfathered_at`, `billing_portal_url`, `metadata`. The only filter
supported on this endpoint is `status`; if you also need filtering by
date or username, fall back to `useListSubscribersQuery` and filter
client-side.

## Step 6: Paywalls list

`useListPaywallsQuery` returns every paywall configuration on the
Platform — the same rows the bundled `MonetizationTab` renders, but
you can pull them into any custom surface (leaderboards, audit screens,
billing-ops dashboards):

```ts
interface ListPaywallsParams {
  platform_key: string;
  item_type?: string;
  is_enabled?: boolean;     // narrow to live paywalls
  page?: number;
  page_size?: number;
}

interface ListPaywallsResponse {
  count: number;
  next_page: number | null;
  previous_page: number | null;
  results: PaywallConfigResponse[];
}
```

Common patterns:

- **Active-paywalls leaderboard.** Fetch with `is_enabled: true`, sort
  by `prices[0].amount` or by a count from a follow-up
  `useListItemSubscribersQuery` per row.
- **Paywall health audit.** Fetch all paywalls and flag rows where
  `prices.length === 0` or every price has `is_active === false` — these
  are configured but un-sellable. See `/iblai-vibe-monetization-configure`.
- **Item-type breakdown.** Group `results` by `item_type` to get a
  "paywalls per category" widget. Use `displayItemType` so `mentor`
  renders as **"Agent"**.

Each `PaywallConfigResponse` carries `prices: PaywallPrice[]` inline —
no second roundtrip per row to draw the entry-level price.

## Step 7: Self-service CancelSubscription helper

The SDK's `CancelSubscription` component (not re-exported from
`@iblai/iblai-js/web-containers`; copy it locally) looks up and cancels the
**caller's own** subscription on an `(item_type, item_id)` — never another
user's; use the Stripe Dashboard for that. Recurring prices return
`{portal_url}` (finish in Stripe's portal); one-time prices return the
record with `status: 'canceled'`. Branch on both. Walkthrough:
[`references/cancel-subscription.md`](./references/cancel-subscription.md).

## Verify

Run `/iblai-vibe-ops-test` before telling the user the work is ready:

1. `pnpm build` — must pass with zero errors.
2. Drive the dashboard:
   ```bash
   pnpm dev &
   npx playwright screenshot http://localhost:3000/admin/analytics/monetization /tmp/dash.png
   ```
   As a user with `can_sell_items` the Monetization tab is in the strip;
   without it (or with `enable_monetization` off) the tab is absent and
   the URL redirects to another tab.
3. Revenue card shows `sales_count >= 1` on a Platform with at least one
   completed paid checkout, formatted in the Platform's currency.
4. Subscribers list paginates: incrementing `page` updates `next_page` to
   the next index (or `null` on the last page).
5. Status filter narrows the list — switching to `canceled` drops
   `active` rows.
6. Paywalls list mirrors `MonetizationTab` content; switching
   `is_enabled` to `false` surfaces any disabled paywalls.
7. Commission table renders one row per key returned in
   `commission_percent`. Iterate `Object.entries` defensively — do NOT
   assert exactly four rows. Backend returns up to four, but the OpenAPI
   schema declares three (no `pathway`) and the SDK type declares two
   (`mentor`, `course`).
8. CancelSubscription lookup on one of the **caller's own**
   subscriptions returns the subscription card; confirm-cancel either
   opens a Stripe portal (recurring) or returns the full subscription
   record with `status: 'canceled'` (one-time). Lookup of an item the
   caller does not own returns `404`.

## Common mistakes

- **Revenue dashboard before webhooks land.** `useGetRevenueQuery`
  aggregates `ItemPaymentRecord` rows written by webhook handlers — a
  just-completed checkout will not appear until the
  `checkout.session.completed` webhook processes. Show a "last updated"
  timestamp or refresh-on-click.
- **Forgetting to coerce `sales_volume`.** It ships as a string
  (`"1499.50"`); pass it through `Number()` before `Intl.NumberFormat`.
- **Assuming multi-currency revenue.** `RevenueResponse.currency` is one
  string. Aggregate by `price.currency` from subscribers if you need a
  per-currency breakdown.
- **Subtracting commission from `sales_volume`.** Destination charges
  already route commission to ibl.ai; presenting `sales_volume` minus
  commission as "net" double-counts.
- **Cancel ignoring the `portal_url` branch.** Recurring subscriptions
  cannot be canceled server-side — Stripe requires the portal flow.
  Mirror the `portal_url` vs `status === 'canceled'` switch from the
  shipped component.
- **Expecting `CancelSubscription` to be an admin-override tool.** The
  cancel endpoint resolves the subscription via `request.user` and has
  no `user_id` parameter; the component takes only
  `platform_key, item_type, item_id, return_url?`. To force-cancel
  another user's subscription, an operator must use the Stripe Dashboard.
- **Calling these endpoints with a non-admin token.** Every endpoint is
  gated by `IsPlatformAdmin` + `_enforce_can_sell_items`; non-admin →
  `403`, wrong-Platform record → `404`. Catch them separately.
- **Hardcoding `tenant_key` from `localStorage`.** Read it from the SDK
  auth context; the `tenants` array gets rewritten on Platform switches.

## MCP tools for further detail

Query the data-layer MCP for hook param shapes, filters, and cache tags:
`get_hook_info(...)` for `useGetRevenueQuery`, `useListSubscribersQuery`,
`useListItemSubscribersQuery`, `useListPaywallsQuery`, and
`useGetStripeConnectStatusQuery` (the last one carries the
`commission_percent` dict and `is_ready_for_payments` gate).

## Files in this skill's scope

Frontend (read via `gh api repos/iblai/ibl-web-frontend/contents/<path>`):

- `packages/web-containers/src/components/analytics/{analytics-monetization-stats.tsx,use-monetization.ts,analytics-layout.tsx}` —
  the shipped tab, its data hook, and the `enableMonetization` gate.
- `packages/web-utils/src/utils/analytics-access.ts` —
  `canViewMonetizationAnalytics`, `getMonetizationRbacResource`.

- `packages/data-layer/src/features/monetization/{custom-api-slice,types,constants}.ts` —
  query defs, response/param types, and endpoint paths.
- `packages/web-containers/src/components/profile/monetization/cancel-subscription.tsx` —
  the shipped `CancelSubscription` component (not currently re-exported
  from `@iblai/iblai-js/web-containers`; copy locally to use).

Backend (in `ibl-dm-pro/web/ibl-dm-core-apps/ibl-dm-billing-app/billing/`):

- `views.py:2156` — `PlatformRevenueView` (`IsPlatformAdmin`).
- `views.py:2073` — `PlatformSubscribersView` (`IsPlatformAdmin`,
  paginated, `status` + `item_type` filters).
- `views.py:2030` — `ItemSubscribersView` (`IsPlatformAdmin`,
  paginated, `status` filter).
- `views.py:2115` — `PlatformPaywallsView` (`IsPlatformAdmin`,
  paginated, `item_type` + `is_enabled` filters).
- `views.py:1885` — `ItemSubscriptionCancelView` (`IsEdxAuthenticated`,
  hard-locked to `request.user`; no admin override, no `user_id` param).
- `dl_iblai_services_app/services/stripe/item_paywall_handlers.py` —
  `handle_item_checkout_completed`, the Stripe webhook handler that
  writes the `ItemPaymentRecord` rows the revenue endpoint aggregates.
  (`views.py:2333` is the post-redirect `ItemCheckoutCallbackView`, not
  the webhook entrypoint; both call `handle_item_checkout_completed`.)
- `dl_iblai_services_app/models/stripe_connect.py:120` —
  `commission_percent` property reading the four
  `STRIPE_ITEM_COMMISSION_PERCENT_{MENTOR,COURSE,PROGRAM,PATHWAY}` keys.

Full per-endpoint catalog (params, response shape, error modes):
[`references/analytics-api.md`](./references/analytics-api.md).

## Related skills

- `/iblai-vibe-monetization` — Family index, schema-validation, Platform flags.
- `/iblai-vibe-monetization-onboard` — Stripe Connect; `commission_percent` +
  `is_ready_for_payments` live on Connect status.
- `/iblai-vibe-monetization-configure` — Paywall create/edit; the rows
  `useListPaywallsQuery` returns are the rows `MonetizationTab` edits.
- `/iblai-vibe-monetization-subscription` — User-side counterpart; details
  the `portal_url` branch of `CancelSubscription`.
- `/iblai-vibe-auth` — Token wiring. `/iblai-vibe-rbac` — `IsPlatformAdmin` gate.
- **Brand**: [BRAND.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/BRAND.md)
