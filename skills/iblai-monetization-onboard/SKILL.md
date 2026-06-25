---
name: iblai-monetization-onboard
description: Build the Stripe Connect Express onboarding surface for Platform sellers — the status card with Configured / Incomplete / Not Configured badge, the Configure Stripe / Complete Setup / Stripe Dashboard action button, the onboard-refresh round-trip when an onboarding link expires, and the is_ready_for_payments gate every later paywall depends on. Use when the user mentions Stripe Connect, Connect Express, onboarding, status card, is_ready_for_payments, dashboard link, disconnect Stripe, or "the Platform can't accept payments yet". See /iblai-monetization for the family overview, /iblai-monetization-configure for what comes next once Connect is ready, /iblai-monetization-checkout for the buyer flow, /iblai-account for the page that hosts the MonetizationTab, /iblai-auth for token wiring, /iblai-rbac for IsPlatformAdmin.
globs:
alwaysApply: false
---

# /iblai-monetization-onboard

Build the Stripe Connect Express onboarding surface — the first thing a
Platform owner sees on the Monetization tab. Until this surface flips
`is_ready_for_payments` to true, every paywall, price tier, and
checkout you wire up later will refuse to charge.

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

- Auth must be set up first (`/iblai-auth`) — reuse the same token wiring
- MCP and skills must be set up: `iblai add mcp`
- `iblai.env` populated with `PLATFORM`, `DOMAIN`, `TOKEN`. If missing:
  `curl -o iblai.env https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/iblai.env`
- The Account page already exists (`/iblai-account`) — the
  Stripe Connect status card lives inside the `Monetization` profile
  tab on that page, not on a standalone route
- The caller holds the `IsPlatformAdmin` role on the Platform. Connect
  endpoints are owner-only — non-owners get `403` and the status query
  comes back with `is_owner: false`, which causes the SDK to hide the
  card entirely
- The Platform has `enable_monetization === true` on its
  `currentTenant` record. This flag is what surfaces the
  `Monetization` tab inside `Account` in the first place; if it is
  unset, the entire onboarding surface is invisible regardless of
  Connect state. See `/iblai-monetization` for the flag lifecycle.

## What you'll build

A single Stripe Connect status card (the SDK component
`StripeConnect` from `@iblai/iblai-js`) with three states:

| State | Badge | Description | Action button |
|---|---|---|---|
| Ready | `Configured` (blue) | "Stripe is connected and ready to accept payments." Optionally appends "Charges enabled." / "Payouts enabled." | `Stripe Dashboard` — opens the Stripe-hosted Express Dashboard in a new tab |
| Started but incomplete | `Incomplete` (yellow) | "Stripe account created but onboarding is incomplete. Complete setup to start accepting payments." | `Complete Setup` — re-issues the onboarding link and redirects |
| Not started | `Not Configured` (grey) | "Connect a Stripe account to enable monetization features." | `Configure Stripe` — kicks off onboarding |

The badge and button text come straight from the SDK — do not
re-skin them. The badge maps to the `is_ready_for_payments` /
`has_account` booleans on the status response, not to
`onboarding_complete` directly.

This card is **auto-rendered** inside `MonetizationTab` whenever the
status response carries `is_owner: true`. You do not mount it by
hand. The reason this skill exists is so that (a) you understand the
contract before you put the tab on a page, and (b) you can build a
custom Connect surface (for example, a setup wizard, an admin tool,
or a standalone `/billing/setup` route) that talks to the same five
endpoints when the default card does not fit.

## Step 0: Check for CLI Updates

Before running any `iblai` command, ensure the CLI is up to date.
Run `iblai --version`, then upgrade directly:
- pip: `pip install --upgrade iblai-app-cli`
- npm: `npm install -g @iblai/cli@latest`

## Step 1: Validate the API schema

Before you write a single Connect call, walk through
[`references/connect-api.md`](./references/connect-api.md) — it
documents the five endpoints, request bodies, response fields,
permission classes, and the SDK hook map.

Then cross-check each path against the live schema as the schema-first
directive prescribes. The five Connect paths today (`commerce` tag) —
all hosted under the **DM base** (`{dm_url}`, e.g.
`https://api.iblai.app/dm`):

- `GET    {dm_url}/api/service/platforms/{platform_key}/stripe/connect/status/`
- `POST   {dm_url}/api/service/platforms/{platform_key}/stripe/connect/onboard/`
- `POST   {dm_url}/api/service/platforms/{platform_key}/stripe/connect/onboard/refresh/`
- `GET    {dm_url}/api/service/platforms/{platform_key}/stripe/connect/dashboard/`
- `DELETE {dm_url}/api/service/platforms/{platform_key}/stripe/connect/`

All five require `IsPlatformAdmin` and run platform-owner validation
in the service layer on top of that. All require `Authorization: Token
<DM token>` — the **DM token**, not the AXD token; the two are different
tokens issued by different services. Using the AXD token returns `401`.

## Step 2: Mount the status query and gate on `is_ready_for_payments`

Mount the status query and read `is_ready_for_payments`:

```tsx
'use client';

import { useGetStripeConnectStatusQuery } from '@iblai/iblai-js/data-layer';

export function ConnectGate({ platformKey }: { platformKey: string }) {
  const { data, isLoading, isError } = useGetStripeConnectStatusQuery(
    { platform_key: platformKey },
    { refetchOnMountOrArgChange: true },
  );

  if (isLoading) return <p>Checking Stripe…</p>;
  if (isError) return <p>Stripe status unavailable.</p>;
  if (!data?.is_owner) return null;          // hide card for non-owners
  if (!data.is_ready_for_payments) {
    return <p>Finish Stripe onboarding before publishing paywalls.</p>;
  }
  return <p>Ready to accept payments.</p>;
}
```

`is_ready_for_payments` is the only field you should branch on for the
"can this Platform accept payments today?" decision. It composes
`!is_disconnected && onboarding_complete && charges_enabled` on the
backend — `has_account: true` flips long before payments work and
will mislead you if you check it directly.

`{ refetchOnMountOrArgChange: true }` matters here: after the Stripe
redirect lands the user back on your page, the cached status from
before onboarding is stale. The default SDK card sets this option for
the same reason.

## Step 3: Trigger onboarding

Use the onboarding mutation. The hook lives at the same export path:

```tsx
'use client';

import { useStartStripeConnectOnboardingMutation } from '@iblai/iblai-js/data-layer';

function ConfigureButton({ platformKey }: { platformKey: string }) {
  const [startOnboarding, { isLoading }] =
    useStartStripeConnectOnboardingMutation();

  const handleClick = async () => {
    const returnUrl = new URL(window.location.href);
    returnUrl.searchParams.set('profileTab', 'monetization');
    const url = returnUrl.toString();

    const result = await startOnboarding({
      platform_key: platformKey,
      return_url: url,
      refresh_url: url,
      business_type: 'company',   // SDK default
    }).unwrap();

    window.location.href = result.onboarding_url;
  };

  return (
    <button onClick={handleClick} disabled={isLoading}>
      Configure Stripe
    </button>
  );
}
```

A few things to know:

- The SDK's bundled `StripeConnect` component **hardcodes
  `business_type: 'company'`** today. If you need the `individual`
  variant (sole traders, freelancers selling their own mentor), do
  **not** try to override the SDK card — build a custom onboarding-start
  screen against the same mutation and pass `business_type:
  'individual'`. The schema enum accepts both values and defaults to
  `individual` server-side when the field is omitted.
- `return_url` and `refresh_url` are both **required** by the request
  serializer. Using the same URL for both (as the SDK does) is fine.
- Redirect with `window.location.href`. Do not open the onboarding
  URL in an iframe — Stripe Connect blocks framing.
- The mutation invalidates the `stripeConnectStatus` cache tag, so any
  status query already mounted in your tree will refetch automatically
  once the user returns.

## Step 4: Handle return + refresh

After the owner completes (or abandons) onboarding, Stripe redirects
the browser back to the URL you supplied:

- **`return_url`** — fires on completion. Your page should re-mount,
  the status query should refetch, `is_ready_for_payments` should now
  be true.
- **`refresh_url`** — fires when the onboarding link expires (Stripe
  Connect links are short-lived) or when the owner exits the flow.
  Your page should detect this and re-issue an onboarding URL by
  calling the refresh endpoint:

```ts
// All Connect endpoints are mounted on the DM service, not the AXD edge.
// Compose the base from your env or from SERVICES.DM if the SDK is loaded.
const dmBase = `${apiBase}/dm`; // e.g. https://api.iblai.app/dm

const res = await fetch(
  `${dmBase}/api/service/platforms/${platformKey}/stripe/connect/onboard/refresh/`,
  {
    method: 'POST',
    headers: {
      // DM token — not the AXD token. The SDK injects this automatically
      // when you go through RTK Query; the direct fetch needs it spelled.
      Authorization: `Token ${dmToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      return_url: window.location.href,
      refresh_url: window.location.href,
      business_type: 'company',
    }),
  },
);
const { onboarding_url } = await res.json();
window.location.href = onboarding_url;
```

In Next.js, your App Router page **must not strip the query params
Stripe appends** (`?profileTab=monetization` is what tells your tab
which subview to show). If you read `searchParams` server-side, pass
them through; never use `router.replace('/account')` without
preserving the query string on the return landing.

## Step 5: Show the dashboard link

Once `is_ready_for_payments` is true, surface a button that drops the
owner into the Stripe-hosted Express Dashboard:

```tsx
import { useLazyGetStripeConnectDashboardQuery } from '@iblai/iblai-js/data-layer';

function DashboardButton({ platformKey }: { platformKey: string }) {
  const [getDashboard, { isFetching }] = useLazyGetStripeConnectDashboardQuery();

  const open = async () => {
    const { data } = await getDashboard({ platform_key: platformKey });
    if (data?.dashboard_url) window.open(data.dashboard_url, '_blank');
  };

  return <button onClick={open} disabled={isFetching}>Stripe Dashboard</button>;
}
```

Use the lazy variant — the dashboard URL is one-shot and tied to the
requesting session, so you fetch on click rather than on mount.
`useGetStripeConnectDashboardQuery` works too if you want
auto-fetching, but it will issue a request every time the component
mounts whether the user clicks or not.

## Step 6: Disconnect (optional, admin-only)

`DELETE {dm_url}/api/service/platforms/{platform_key}/stripe/connect/` is
defined in the schema and implemented at `StripeConnectDisconnectView`
(line 155 of `views/stripe_connect.py`), but the SDK does not currently
expose a hook for it. If you need to surface a disconnect option in a
custom admin tool, call it directly:

```ts
// Compose the DM base — Stripe Connect lives on DM, not the AXD edge.
const dmBase = `${apiBase}/dm`;

await fetch(
  `${dmBase}/api/service/platforms/${platformKey}/stripe/connect/`,
  { method: 'DELETE', headers: { Authorization: `Token ${dmToken}` } },
);
```

Response shape:
- **200** — disconnect succeeded; the `StripeConnectAccount` row was
  soft-deleted.
- **404** — the Platform has no Stripe Connect account row to delete
  (nothing was ever onboarded, or it was already disconnected).

The endpoint soft-deletes the `StripeConnectAccount` row — paywalls
keep their configuration but cannot charge until the Platform
re-onboards. Confirm twice in the UI before calling it; this is
production-grade revenue infrastructure.

## Verify

- [ ] `Monetization` tab appears inside the `Account` page only when
      `currentTenant?.enable_monetization === true`
- [ ] Status card renders **only** when the status response has
      `is_owner: true`
- [ ] Before onboarding: badge reads `Not Configured`, button reads
      `Configure Stripe`
- [ ] Clicking `Configure Stripe` redirects to a URL on
      `connect.stripe.com` (not a same-origin error page)
- [ ] After returning from Stripe, the status query refetches and
      `is_ready_for_payments` is `true`
- [ ] Badge then reads `Configured`, button reads `Stripe Dashboard`
- [ ] Clicking `Stripe Dashboard` opens a Stripe-hosted URL in a new tab
- [ ] If you exited mid-flow, hitting the `refresh_url` re-issues an
      onboarding link without prompting for any data twice
- [ ] Non-owner Platform admins (`is_owner: false`) see the tab but
      not the Connect card

## Common mistakes

- **Gating off `has_account: true` instead of `is_ready_for_payments`.**
  `has_account` flips the moment the Connect account row is created,
  which is before KYC, before charges are enabled, and before Stripe
  will accept a payment intent. Reading it as "Stripe works now" is
  the most common reason paywalls publish but checkout fails with a
  Stripe error.
- **Skipping the `is_ready_for_payments` check entirely** and assuming
  any user on the Monetization tab can configure paywalls. The
  Monetization tab's wizard is gated against this flag — surfacing
  pricing UI on top of an unready Connect account just produces a
  broken checkout downstream.
- **Stripping query params on the return URL.** Next.js router methods
  like `router.replace('/account')` drop `?profileTab=monetization`,
  which leaves the owner on the wrong sub-tab when they return. Either
  read `searchParams` and preserve them, or use
  `window.location.href` for the redirect so Stripe round-trips you to
  the exact URL you supplied.
- **Forgetting to pass `authURL` to the `<Account>` page.** The
  MonetizationTab needs the auth-redirect URL to chain the user
  through if they hit a re-auth wall during onboarding. See
  `/iblai-account` for the prop contract.
- **Trying to override `business_type: 'company'` by patching the SDK
  card.** The string is hardcoded inside the component; reach for a
  custom screen against `useStartStripeConnectOnboardingMutation`
  instead, and pass `business_type: 'individual'` there.
- **Treating the dashboard URL as cacheable.** It is one-shot. Re-call
  the endpoint each time the owner clicks the button.

## MCP tools for further detail

- `get_hook_info("useGetStripeConnectStatusQuery")`
- `get_hook_info("useStartStripeConnectOnboardingMutation")`
- `get_hook_info("useGetStripeConnectDashboardQuery")`
- `get_hook_info("useLazyGetStripeConnectDashboardQuery")`
- `get_component_info("MonetizationTab")`
- `get_component_info("StripeConnect")` (the auto-mounted child card)

## Files in this skill's scope

Frontend SDK (`iblai/ibl-web-frontend` on `main`):

- `packages/web-containers/src/components/profile/monetization/stripe-connect.tsx` — the auto-rendered status card
- `packages/web-containers/src/components/profile/monetization/index.tsx` — `MonetizationTab` that mounts the card behind `is_owner`
- `packages/data-layer/src/features/monetization/custom-api-slice.ts` — the four Connect hooks live in `// Flow 1: Stripe Connect`
- `packages/data-layer/src/features/monetization/types.ts` — `StripeConnectStatusResponse`, `StripeConnectOnboardArgs`, `StripeConnectOnboardResponse`, `StripeConnectDashboardResponse`

Backend (`ibl-dm-pro` repo, `dl_iblai_services_app`):

- `views/stripe_connect.py` — `StripeConnectOnboardView` (line 35), `StripeConnectStatusView` (line 92), `StripeConnectDashboardLinkView` (line 119), `StripeConnectDisconnectView` (line 155)
- `models/stripe_connect.py` — `StripeConnectAccount` model, the `is_ready_for_payments` and `commission_percent` properties
- `services/stripe/connect.py` — `StripeConnectService.get_account_status()`, the source of `is_owner` on the response

## Related skills

- `/iblai-monetization` — family overview + the schema-validation routine
- `/iblai-monetization-configure` — what to build right after this: the `MonetizationTab` wizard for paywall + price CRUD (depends on `is_ready_for_payments === true`)
- `/iblai-monetization-checkout` — the buyer-side `PaywallModal` and Stripe checkout that this onboarding enables
- `/iblai-account` — hosts the `MonetizationTab` and supplies the `authURL` prop
- `/iblai-auth` — the token wiring every Connect call inherits
- `/iblai-rbac` — `IsPlatformAdmin` and Platform-owner gating
- [BRAND.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/BRAND.md) — visual conventions for any custom Connect surface you build
