# iblai-monetization-configure

> Build the admin MonetizationTab inside the Account page — the Platform seller wizard that turns an agent/course/program/pathway/custom item into a paid product, with paywall settings (grandfathering, free tier, trial days) and per-item pricing tiers. Use when the user mentions monetization tab, paywall configuration, item pricing, pricing tiers, wizard, custom items, grandfathering, item search, or "configure a paywall". See /iblai-monetization for the family index, /iblai-monetization-onboard for the Stripe Connect prerequisite, /iblai-monetization-checkout for what buyers see, /iblai-monetization-subscriptions for the user purchases pane, /iblai-monetization-analytics for revenue, /iblai-account for the host page, /iblai-rbac for the can_sell_items gate, /iblai-auth for token wiring.

# /iblai-monetization-configure

Build the admin **MonetizationTab** — the Platform seller surface that
lives inside the **Account** page. A Platform admin uses it to pick an
existing item (an agent, a course, a program, a pathway) or create a
custom item, then walks a wizard that enables the paywall and adds
pricing tiers. The actual UI ships as a default-exported SDK component;
your job is to host it correctly and pass the right props.

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

![Admin Monetization tab inside the Account page](./admin-monetization-tab.png)

## Prerequisites

- Auth must be set up first (`/iblai-auth`) — reuse the same token wiring.
- MCP and skills must be set up: `iblai add mcp`.
- `iblai.env` populated with `PLATFORM`, `DOMAIN`, `TOKEN`. If missing:
  `curl -o iblai.env https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/iblai.env`
- The **Account** page is already wired up (`/iblai-account`). The
  `MonetizationTab` is mounted by the SDK's `Account` component once the
  flag below is on — do NOT build a parallel host.
- The caller's Platform record has `enable_monetization === true`. This
  is set by an ibl.ai operator on the `tenants` array surfaced via
  `localStorage`; there is no in-app toggle. Without it, the
  `Monetization` tab is hidden in the Account sidebar.
- The caller has the `can_sell_items` RBAC permission on the Platform
  (`/platforms/{platformKey}/#can_sell_items`). The Account component
  resolves this via `checkRbacPermission` — see `/iblai-rbac`.
- **Stripe Connect Express onboarding is complete** for the Platform.
  The Connect status response must report `is_ready_for_payments: true`.
  If it is not, the paywall pane shows a dashed "Connect Stripe first"
  card and every price-create call returns 400. Do
  `/iblai-monetization-onboard` first and come back.

![Monetization pane before Stripe Connect onboarding — dashed "Connect Stripe first" card](./admin-monetization-sample-no-onboarding.png)

## What you'll build

You are not building a UI from scratch — the SDK's `MonetizationTab`
already renders everything below. You are wiring it into the Account
page and exposing a URL the Connect onboard return can land on.

| Section | What renders | Screenshot |
|---|---|---|
| Stripe Connect status card | Status badge, business info, connect / dashboard button | (covered by `/iblai-monetization-onboard`) |
| Paywall config (disabled state) | Dashed-border card: "Connect Stripe first to configure paywalls" | [admin-monetization-sample-no-onboarding.png](./admin-monetization-sample-no-onboarding.png) |
| Item search dropdown | Debounced 300 ms search across agents, courses, programs + a `+` button for custom items | [admin-monetization-sample-pricing-list.png](./admin-monetization-sample-pricing-list.png) |
| Configured-items list | Paginated cards (8 per page), filter `All / Active / Disabled`, badge per item type | [admin-monetization-sample-pricing-list.png](./admin-monetization-sample-pricing-list.png) |
| Item detail wizard | 2-step (existing) or 3-step (custom) step indicator | [admin-monetization-sample-paywall-config.png](./admin-monetization-sample-paywall-config.png) |
| Paywall settings | `is_enabled`, `allow_free_tier`, `trial_period_days`, `grandfathering_strategy`, `on_successful_payment` | [admin-monetization-sample-paywall-config.png](./admin-monetization-sample-paywall-config.png) |
| Pricing tiers | CRUD list with create-form, edit-in-place, delete | [admin-monetization-sample-pricing-config.png](./admin-monetization-sample-pricing-config.png) |

## Step 0: Check for CLI Updates

Before running any `iblai` command, ensure the CLI is up to date.
Run `iblai --version`, then upgrade directly:
- pip: `pip install --upgrade iblai-app-cli`
- npm: `npm install -g @iblai/cli@latest`

## Step 1: Validate the API schema

Before writing a single fetcher, run the schema-fetch routine from the
overview skill and confirm the three endpoints this skill exercises.
The SDK's mutations wrap them, but you should know the shape:

All endpoints below live under the **DM base** (`{dm_url}`, e.g.
`https://api.iblai.app/dm`) and require `Authorization: Token <DM token>`
— the **DM token**, not the AXD token (the AXD token returns `401`).

| Capability | Canonical (recommended) | Composite (legacy) |
|---|---|---|
| Paywall config CRUD | `GET / PUT / DELETE {dm_url}/api/billing/items/{item_unique_id}/paywall/` | `GET / POST / PUT / DELETE {dm_url}/api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/paywall/` |
| Prices list / create | `GET / POST {dm_url}/api/billing/items/{item_unique_id}/paywall/prices/` | `GET / POST {dm_url}/api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/paywall/prices/` |
| Price detail | `GET / PUT / DELETE {dm_url}/api/billing/items/prices/{price_unique_id}/` | `GET / PUT / DELETE {dm_url}/api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/paywall/prices/{price_id}/` |

**Create-first lifecycle.** The canonical URL needs `item_unique_id`,
which only exists *after* the paywall config has been created. For the
**initial `POST` / `PUT`** that creates the paywall, use the composite
URL — once the response comes back with `unique_id`, switch to canonical
for all subsequent reads / updates / deletes. New price rows have the
same lifecycle: create via composite or canonical list endpoint, then
operate on the returned `unique_id` via `items/prices/{price_unique_id}/`.

**Canonical price-detail 404 conditions.** The canonical price-detail
route resolves only **active, non-deleted prices on enabled paywalls** —
inactive (`is_active=false`), soft-deleted (`is_deleted=true`), or
disabled-paywall prices return `404 NotFound`. The composite form has
no such gate and reaches the parent view. Use canonical for buyer
flows; use composite when you need to read or update a row that is
intentionally inactive.

All endpoints require `IsPlatformAdmin`. The schemas for the request body,
response, and the enum values for `grandfathering_strategy` and
`interval` are pinned in:

- [`references/paywall-config-api.md`](./references/paywall-config-api.md)
- [`references/prices-api.md`](./references/prices-api.md)
- [`references/wizard-state-machine.md`](./references/wizard-state-machine.md)

If those files are not present in this directory, the canonical schema
is the single source of truth — `grep "/paywall/" /tmp/iblai_schema.yaml`
will surface every path, method, and `$ref` body shape.

## Step 2: Confirm Account page integration

The Account page (`/iblai-account`) is the host. It owns the sidebar
that gates the `Monetization` tab on `currentTenant?.enable_monetization
&& checkRbacPermission(rbacPermissions, '/platforms/{platformKey}/#can_sell_items')`,
and it mounts `MonetizationTab` directly — passing `platformKey` and
`authURL`. `authURL` is load-bearing: the SDK uses it to build the
Stripe Connect onboarding return URL **and** to derive the domain
extension when generating the default `on_successful_payment` redirect
for an item. Do not pass an empty string and do not strip the trailing
domain.

A typical Next.js host that supplies all the required props:

```tsx
// app/account/page.tsx
'use client';

import { Account } from '@iblai/iblai-js';
import { useAuth } from '@/lib/iblai/auth';
import { config } from '@/lib/iblai/config';

export default function AccountPage() {
  const { user, tenants, rbacPermissions } = useAuth();
  if (!user) return null;

  return (
    <Account
      tenant={config.platform()}
      tenants={tenants}
      username={user.username}
      email={user.email}
      mainPlatformKey={config.mainPlatform()}
      authURL={config.authUrl()}
      enableRbac={true}
      rbacPermissions={rbacPermissions}
      isAdmin={user.is_admin}
      onInviteClick={() => {}}
      onClose={() => {}}
    />
  );
}
```

`config.authUrl()` resolves to the same auth host (e.g.
`https://auth.{ext}`) that `/iblai-auth` already configured. Do not
introduce a parallel value. If your Platform's `authURL` is
`https://auth.example.com`, the SDK's `getAuthURLExtension` strips
`auth` and yields `example.com`, which is then used to build defaults
like `https://mentorai.example.com/platform/{platformKey}/{itemId}` for the
post-payment redirect.

## Step 3: Reach the Monetization pane from a URL

The Account component reads a query-string hint to pre-select a tab.
The convention is `?profileTab=monetization` — the same query param
that the Stripe Connect onboarding flow uses as its **return URL** so
that after a Connect redirect the user lands back on this exact pane.

Two things follow from this:

1. **Your router must preserve the query string.** A blanket
   `router.replace(pathname)` in a layout or middleware will strip
   `profileTab` and the user will land on the default `organization`
   tab after Connect onboarding completes.
2. **You should plumb the hint into `targetTab`** so direct loads of
   `/account?profileTab=monetization` open the pane immediately:

```tsx
import { useSearchParams } from 'next/navigation';

const params = useSearchParams();
const targetTab = params.get('profileTab') ?? 'basic';

return <Account targetTab={targetTab} /* ...other props */ />;
```

The Account component also fires `onTabChange('monetization')` when the
user clicks the tab — you can mirror that to the URL with
`router.replace` so refreshes stay sticky.

## Step 4: Configure a paywall for an existing item

![Configured-items list with the item search dropdown and filter tabs](./admin-monetization-sample-pricing-list.png)

For an agent, course, or program that already exists in the catalog,
the wizard has **two steps**: `Paywall → Pricing`. The flow is:

1. The admin types into the **item search dropdown**. The SDK debounces
   for 300 ms, then fans out to two queries in parallel:
   - `useGetAiSearchMentorsQuery` — agents.
   - `useGetPersonnalizedSearchQuery` — courses and programs.
2. The admin picks a result. The SDK resolves it to
   `{ item_type, item_id, item_name }` (e.g. `mentor` + the agent's
   `unique_id`).
3. The wizard calls `useGetPaywallConfigQuery` — if no row exists, the
   backend returns the default `is_enabled: false` skeleton.
4. The admin sets `is_enabled`, `allow_free_tier`, `trial_period_days`,
   `grandfathering_strategy`, and `on_successful_payment`, then submits.
5. The SDK calls `useEnablePaywallMutation` on first save (creates the
   `ItemPaywallConfig`, provisions a Stripe product on the connected
   account, stamps `paywall_enabled_at`), or
   `useUpdatePaywallMutation` on every subsequent save.

![Paywall configuration step](./admin-monetization-sample-paywall-config.png)

### Grandfathering — pick the right strategy

`grandfathering_strategy` decides what happens to users who already
have access to the item the moment the paywall flips on:

| Value | Effect on existing users |
|---|---|
| `free_forever` | Existing users keep unlimited free access. Only new users hit the paywall. |
| `require_subscription` | Everyone must subscribe (no grandfathering). |

The backend stamps `paywall_enabled_at` on the first enable — that is
the cutoff used to decide who counts as "existing." Switching strategies
later does NOT re-stamp the cutoff. Surface this to the admin: once you
ship a paywall as `free_forever`, the population of grandfathered users
is frozen at that instant.

## Step 5: Configure a paywall for a custom item

A custom item is anything that is not a managed agent / course /
program / pathway — for example, an external SaaS subscription you
want to sell through Stripe. The wizard has **three steps**:
`Item Details → Paywall → Pricing`.

The admin clicks the `+` button next to the search dropdown to enter
custom mode. They fill:

- **Item type** (free text, e.g. "Workshop", "API key")
- **Item name** (e.g. "Advanced Prompt Engineering 2026")
- **Description** (optional, becomes the Stripe checkout description)
- **Product URL** (optional, used to build `on_successful_payment`)

On `Create`, the SDK slugifies both fields with `slugify()` from
`paywall-utils.ts` (lowercased, alphanumerics + `-`, no leading or
trailing dashes) and posts to the paywall create endpoint with:

```ts
{
  item_type: slugify(customItemType),  // e.g. "workshop"
  item_id:   slugify(customItemName),  // e.g. "advanced-prompt-engineering-2026"
  is_enabled: false,
  allow_free_tier: false,
  trial_period_days: 0,
  grandfathering_strategy: 'free_forever',
  item_name: customItemName,
  description: customDescription,
  on_successful_payment: buildOnSuccessfulPaymentUrl({ /* ... */ }),
}
```

The deliberate `is_enabled: false` is so the item exists but stays
dormant until the admin completes the Paywall step. After the create
returns, the wizard advances to `paywall`, then `pricing`. The same
`useEnablePaywallMutation` is reused for the dormant create and the
final enable — the backend uses `is_enabled` change tracking to decide
whether to provision the Stripe product.

`buildOnSuccessfulPaymentUrl` from `paywall-utils.ts` defaults the
post-payment redirect by extracting the domain extension from `authURL`
(e.g. `https://auth.iblai.app` → `iblai.app`) and building a per-type
URL:

| `item_type` | Default `on_successful_payment` |
|---|---|
| `mentor` / `agent` | `https://mentorai.{ext}/platform/{platformKey}/{itemId}` |
| `course` | `https://skillsai.{ext}/courses/{itemId}` |
| `program` | `https://skillsai.{ext}/programs/{itemId}` |
| `pathway` | `undefined` — no default branch in `buildOnSuccessfulPaymentUrl`. Admins must set `on_successful_payment` manually on the paywall config or new pathway purchases will land with no redirect. |
| custom (anything else) | The admin-supplied `customProductUrl`, or `undefined` |

This is why passing the correct `authURL` to `Account` matters — pass a
bogus value and every default redirect ends up on the wrong subdomain.

## Step 6: Manage pricing tiers

Once the paywall is enabled, the wizard advances to the **Pricing** step.
The SDK's `PriceManagement` component owns the tier list and form.

![Pricing configuration step](./admin-monetization-sample-pricing-config.png)

Hooks the SDK uses (all under `IsPlatformAdmin`):

- `useListPricesQuery` → `GET /paywall/prices/`
- `useCreatePriceMutation` → `POST /paywall/prices/`
- `useUpdatePriceMutation` → `PUT /paywall/prices/{price_id}/`
- `useDeletePriceMutation` → `DELETE /paywall/prices/{price_id}/` (soft delete)

The price form collects:

| Field | Type | Notes |
|---|---|---|
| `name` | string (max 255) | Display label — e.g. "Basic", "Premium". |
| `amount` | decimal string | USD, pattern `^-?\d{0,8}(?:\.\d{0,2})?$`. `0` means free. |
| `currency` | enum | Locked to `usd` in the SDK's `EMPTY_FORM`. Do NOT change this. |
| `interval` | enum | `month` / `year` / `one_time`. |
| `description` | nullable string | Tier description. |
| `features` | array of strings | Chip input — `Enter` adds, `X` removes. JSON-serialized in storage. |
| `remark` | string (max 100) | Optional badge like "Most Popular". |
| `is_active` | bool | Inactive prices stay listed but cannot be purchased. |
| `sort_order` | int | Display order; defaults to `0`. |

Two behaviors worth surfacing:

1. **Pricing-field edits create a new Stripe price.** The backend's
   `PUT /paywall/prices/{price_id}/` description states: "If pricing
   fields change and a Stripe price exists, a new Stripe price is
   created and the old one deactivated." Existing subscriptions keep
   their original Stripe price — only new checkouts hit the new one.
2. **Delete is a soft delete.** The DELETE handler sets `is_deleted=true`
   and deactivates the matching Stripe price; historical analytics
   keep the row. Do not show the price as "gone" — show it as "archived".

A `POST /paywall/prices/` is rejected (400) if the parent paywall is
disabled or the Connect account is not ready. Surface that as a toast
that says "Enable the paywall first" rather than a raw error.

## Step 7: Copy the public buy URL

Click the copy icon next to the item title to copy
`${authURL}/buy/{paywallUniqueId}` to the clipboard — the SDK toasts
"URL copied to clipboard" after writing it. This URL resolves
**out-of-the-box** because the auth app ships a `/buy/[id]` route at
`apps/auth/app/(auth)/buy/[id]/page.tsx` in the `iblai/ibl-web-frontend`
monorepo. Since `authURL` already points at the auth app, the URL
renders the public buy page with zero additional wiring on your end.

If you are NOT deploying the auth app (e.g. you're hosting only the
admin shell on a standalone domain), you'll need to build your own buy
page using `useGetPublicPricingQuery({ config_unique_id })` and
`useCreateGuestCheckoutMutation` — see the public/guest buy section in
`/iblai-monetization-checkout` for the complete recipe.

## Verify

Run `/iblai-ops-test` before telling the user the work is ready:

1. `pnpm build` — must pass with zero errors.
2. `pnpm dev` and drive the tab:
   ```bash
   pnpm dev &
   npx playwright screenshot \
     "http://localhost:3000/account?profileTab=monetization" \
     /tmp/monetization.png
   ```
3. Confirm with the screenshot:
   - The `Monetization` tab is present in the sidebar (gating works).
   - Without Connect onboarding, the paywall pane shows the dashed
     "Connect Stripe first" card (Stripe Connect status guards correctly).
   - With Connect onboarding done, the item search dropdown is enabled
     and typing fires the debounced 300 ms search.
4. Configure a real item end-to-end: enable paywall, save, add a `$9.99`
   monthly tier, click `Save`. Then refresh the page and confirm the
   tier persists.
5. Click the `+` button, fill `customItemType="workshop"`,
   `customItemName="Test Workshop"`, click `Create` — the wizard should
   advance to step 2 with the slugified id `test-workshop`.

## Common mistakes

- **Not passing `authURL`.** The SDK uses it to derive the post-payment
  redirect default; passing `""` or a non-domain string produces broken
  defaults like `https://mentorai./platform/{platformKey}/{itemId}` and the
  copy-URL feature silently breaks.
- **Hand-rolling a custom `MonetizationTab`.** It is now a top-level
  named export from `@iblai/iblai-js` (`packages/web-containers` ships
  `MonetizationTab`), but you should still NOT mount it standalone —
  the Account page owns the sidebar, the tab gating, and the
  `onTabChange` plumbing.
- **Trusting older docs that said "MonetizationTab is not exported".**
  It is exported. Use the version surfaced via `Account`.
- **Confusing `enable_monetization` with `show_paywall`.**
  `enable_monetization` is the Account/Monetization-pane gate.
  `show_paywall` is the credit-system gate covered by `/iblai-credit`.
  They are not synonyms — see `/iblai-monetization` for the matrix.
- **Locking currency to anything other than `usd`.** The SDK's
  `EMPTY_FORM` hard-codes `currency: 'usd'`, and the connected Stripe
  account is provisioned for USD. Editing the form to pass `eur` will
  be accepted by the schema but rejected at checkout.
- **Skipping the `is_ready_for_payments` gate.** Calling
  `useCreatePriceMutation` before Connect onboarding completes returns
  400 with "Stripe Connect account not ready" — surface that as a
  blocking toast, do not retry.
- **Stripping `?profileTab=monetization` in a middleware/layout.** The
  Stripe Connect onboard return URL relies on this param to land the
  admin back on the Monetization pane.

## MCP tools for further detail

When you need exact prop signatures or hook shapes, query the MCP
instead of guessing:

- `get_component_info("Account")` — host props, sidebar gating logic.
- `get_component_info("MonetizationTab")` — `platformKey`, `authURL`.
- `get_hook_info("useGetPaywallConfigQuery")` — request/response shape.
- `get_hook_info("useEnablePaywallMutation")` — body shape, error model.
- `get_hook_info("useUpdatePaywallMutation")` — body shape, idempotency.
- `get_hook_info("useListPricesQuery")` — response array shape.
- `get_hook_info("useCreatePriceMutation")` — `ItemPriceCreate` body.
- `get_hook_info("useUpdatePriceMutation")` — Stripe re-issue behavior.
- `get_hook_info("useDeletePriceMutation")` — soft-delete semantics.
- `get_hook_info("useListPaywallsQuery")` — pagination envelope.
- `get_hook_info("useGetAiSearchMentorsQuery")` — agent search shape.
- `get_hook_info("useGetPersonnalizedSearchQuery")` — course/program shape.

## Files in this skill's scope

Frontend (SDK, read-only — do not fork these into your host):

- `packages/web-containers/src/components/profile/monetization/index.tsx`
- `packages/web-containers/src/components/profile/monetization/paywall-config.tsx`
- `packages/web-containers/src/components/profile/monetization/paywalled-items-list.tsx`
- `packages/web-containers/src/components/profile/monetization/item-search-dropdown.tsx`
- `packages/web-containers/src/components/profile/monetization/paywall-detail.tsx`
- `packages/web-containers/src/components/profile/monetization/price-management.tsx`
- `packages/web-containers/src/components/profile/monetization/wizard-step-indicator.tsx`
- `packages/web-containers/src/components/profile/monetization/paywall-utils.ts`

Backend (for reference — RBAC, validation, Stripe-product sync):

- `ItemPaywallConfigView` at `web/ibl-dm-core-apps/ibl-dm-billing-app/billing/views.py:998`
- `ItemPriceListView` at `web/ibl-dm-core-apps/ibl-dm-billing-app/billing/views.py:1183`
- `ItemPriceDetailView` at `web/ibl-dm-core-apps/ibl-dm-billing-app/billing/views.py:1300`

## Related skills

- `/iblai-monetization` — Family index, schema validation, RTK Query overview, RBAC matrix.
- `/iblai-monetization-onboard` — **Prerequisite.** Stripe Connect Express onboarding, `is_ready_for_payments` gate, return URL using `?profileTab=monetization`.
- `/iblai-monetization-checkout` — What buyers see: `PaywallModal`, `useCheckAccessQuery`, checkout, guest checkout, public pricing (`useGetPublicItemPricingQuery`).
- `/iblai-monetization-subscriptions` — End-user `PurchasesTab` + cancel flow.
- `/iblai-monetization-analytics` — Revenue, subscribers, paywalls list, admin cancel tool.
- `/iblai-account` — Hosts the `MonetizationTab`; owns the sidebar and gating.
- `/iblai-auth` — Token wiring; every paywall and price call uses `Authorization: Token <token>`.
- `/iblai-rbac` — `can_sell_items` permission on `/platforms/{platformKey}/`.
- **Brand guidelines**: [BRAND.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/BRAND.md)