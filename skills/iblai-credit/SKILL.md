---
name: iblai-credit
description: Add a credit balance widget (plan badge, credits, auto-recharge, upgrade) to your Next.js app
globs:
alwaysApply: false
---

# /iblai-credit

Add the SDK `CreditBalance` widget — a navbar dropdown that shows the
user's current plan (Free / Trial / Premium), remaining and consumed
credits, the next reset date, the auto-recharge configuration, and a
plan-aware action button (Upgrade Plan / Manage Usage + Add Credits /
Manage Billing).

The widget is shipped by `@iblai/iblai-js` (SDK 1.6.0+) from
`@iblai/iblai-js/web-containers`. It is rendered as an icon button with
an unread/low-credits status dot and a dropdown panel on click.

Do NOT add custom styles to the SDK component — it ships with its own
styling. Do NOT implement dark mode unless asked.

Follow the component hierarchy: use ibl.ai SDK components
(`@iblai/iblai-js`) first, then shadcn/ui (`npx shadcn@latest add <name>`).

> **Navbar:** The navbar created by `/iblai-navbar` already wires this
> widget in by default between the notification bell and the profile
> dropdown. Use this skill if you are adding the widget to a custom
> layout, or want to render it outside the navbar.

## Step 0: Start from vibe-starter? (new projects)

Before running this skill, ask the user:

> Are you starting a new project from scratch? vibe-starter
> (https://github.com/iblai/vibe-starter/tree/spa) already ships the
> credit balance widget wired into the navbar, alongside auth, profile,
> account, and notifications. Want to use that instead?

If yes, clone into a temp directory and copy into the current directory before
installing (running pnpm install inside the cloned subdirectory causes hardlink
issues), then skip this skill:

    git clone -b spa https://github.com/iblai/vibe-starter.git vibe-starter-init
    cp -a vibe-starter-init/. . && rm -rf vibe-starter-init
    pnpm install

If they prefer to add the widget to an existing app, continue below.

## Prerequisites

- Auth set up (`/iblai-auth`)
- `@iblai/iblai-js` >= 1.6.0
- `iblai.env` populated with `PLATFORM`, `DOMAIN`, `TOKEN`. If missing,
  tell the user to download the template:
  `curl -o iblai.env https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/iblai.env`

## Tenant gate

The widget is intended to be visible only when the active tenant has
`show_paywall = true`. Read `current_tenant` from localStorage and pass
`enabled={Boolean(current_tenant.show_paywall)}` so the widget renders
nothing on tenants where billing is disabled. The widget also returns
`null` when `tenant` is empty.

## Component

Use MCP for full props and behaviour:

```
get_component_info("CreditBalance")
```

### `<CreditBalance>` — navbar credit balance dropdown

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `tenant` | `string` | yes | Active tenant/platform key |
| `username` | `string` | yes | Current username |
| `mainPlatformKey` | `string` | yes | Main IBL platform key (`NEXT_PUBLIC_MAIN_TENANT_KEY`) — used by the upgrade flow |
| `currentUserEmail` | `string` | yes | Current user's email — prefilled in Stripe checkout |
| `redirectUrl` | `string` | yes | `success_url` returned to after Stripe checkout — typically `window.location.href` |
| `enabled` | `boolean` | no | Default `true`. Pass `current_tenant.show_paywall` to gate visibility |
| `className` | `string` | no | Extra classes applied to the trigger button |

Action button rules (driven by `useGetAccountBillingInfoQuery`):

- **Free** (or `free_trial`): single **Upgrade Plan** button — calls
  `useStripeUpgrade.handleUpgrade('premium')`
- **Premium with payment method**: **Manage Usage** + **Add Credits**
  buttons (open `AutoRechargeModal` and `AddCreditsModal`)
- **Premium without payment method**: single **Manage Billing** button —
  opens the Stripe customer portal in `payment_method_update` flow

The Auto Recharge section only renders when there is a payment method
on file AND plan is not Free. Status dot on the trigger turns amber at
`balance <= 10` ("low") and red at `balance <= 1` ("critical"); hidden
when "healthy".

## Reference implementation

Drop this client component anywhere in your layout (e.g. inside the
navbar between the notification bell and the profile dropdown):

```tsx
// components/navbar/credit-balance-widget.tsx
'use client';

import { useEffect, useState } from 'react';
import { CreditBalance } from '@iblai/iblai-js/web-containers';
import config from '@/lib/iblai/config';
import { resolveAppTenant } from '@/lib/iblai/tenant';

export function CreditBalanceWidget() {
  const [tenant, setTenant] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [redirectUrl, setRedirectUrl] = useState('');

  useEffect(() => {
    setTenant(resolveAppTenant());

    try {
      const raw = localStorage.getItem('userData');
      if (raw) {
        const parsed = JSON.parse(raw);
        setUsername(parsed.user_nicename ?? parsed.username ?? '');
        setEmail(parsed.email ?? parsed.user_email ?? '');
      }
    } catch {}

    try {
      const raw = localStorage.getItem('current_tenant');
      if (raw) {
        const parsed = JSON.parse(raw);
        setEnabled(Boolean(parsed?.show_paywall));
      }
    } catch {}

    setRedirectUrl(window.location.href);
  }, []);

  if (!tenant || !username) return null;

  return (
    <CreditBalance
      tenant={tenant}
      username={username}
      mainPlatformKey={config.mainTenantKey()}
      currentUserEmail={email}
      redirectUrl={redirectUrl}
      enabled={enabled}
    />
  );
}
```

Render it next to the rest of the navbar actions:

```tsx
import { CreditBalanceWidget } from '@/components/navbar/credit-balance-widget';

<div className="flex items-center space-x-4">
  <CreditBalanceWidget />
  {/* notification bell, profile dropdown, etc. */}
</div>
```

## Test IDs

Stable selectors for Playwright (also exposed via the helpers in
`@iblai/iblai-js/playwright`):

| Test ID | Purpose |
|---|---|
| `credit-balance-trigger` | The icon button in the nav |
| `credit-balance-panel` | The dropdown content |
| `credit-balance-plan-badge` | Plan pill ("Free" / "Trial" / "Premium") |

Action buttons inside the panel are located by accessible name
(`getByRole('button', { name: /upgrade plan/i })`, etc.).

## Playwright helpers

The SDK exports a complete set of paywall helpers — guard tests on the
tenant flag, open the dropdown idempotently, and assert plan-specific
states:

```ts
import {
  expectCreditBalanceVisibilityForTenant,
  openCreditBalanceDropdown,
  expectCreditBalancePanelForFreePlan,
  expectCreditBalancePanelForTrialPlan,
  expectCreditBalancePanelForPremiumPlan,
  expectCreditBalanceForCurrentPlan,
  getCreditBalancePlanLabel,
  getCreditBalanceRemaining,
} from '@iblai/iblai-js/playwright';

test('credit balance reflects the active plan', async ({ page }) => {
  const { shouldBeVisible } = await expectCreditBalanceVisibilityForTenant(page);
  test.skip(!shouldBeVisible, 'show_paywall=false on this tenant');
  await expectCreditBalanceForCurrentPlan(page, { hasPaymentMethod: true });
});
```

See `PAYWALL_HELPERS.md` in the SDK for the full helper surface
(BillingTab assertions, plan-specific dispatchers, click helpers).

## Important Notes

- **Import path**: `@iblai/iblai-js/web-containers` — the framework-agnostic
  bundle, NOT `/next`.
- **SDK version**: requires `@iblai/iblai-js` >= 1.6.0.
- **Tenant gate**: always pass `enabled={Boolean(current_tenant.show_paywall)}`.
  The widget should not appear on tenants where billing is disabled.
- **Data dependencies**: `useGetAccountBillingInfoQuery`,
  `useCreateStripeCustomerPortalMutation`, `useStripeUpgrade`. These all
  require the data layer + auth providers from `iblai add auth`.
- **Do NOT override styles**: the trigger uses its own status-dot logic
  and the panel ships with the brand colors.
