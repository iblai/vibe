---
name: iblai-account
description: Add account and organization settings page to your Next.js app
globs:
alwaysApply: false
---

# /iblai-account

Add an account/organization settings page with tabs for Organization info,
User Management, Integrations, Advanced settings, and Billing.

![Account Page](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/iblai-account/account-page.png)

Do NOT add custom styles, colors, or CSS overrides to ibl.ai SDK components.
They ship with their own styling. Keep the components as-is.
Do NOT implement dark mode unless the user explicitly asks for it.

When building custom UI around SDK components, use the ibl.ai brand:
- **Primary**: `#0058cc`, **Gradient**: `linear-gradient(135deg, #00b0ef, #0058cc)`
- **Button**: `bg-gradient-to-r from-[#2563EB] to-[#93C5FD] text-white`
- **Font**: System sans-serif stack, **Style**: shadcn/ui new-york variant
- Always use shadcn/ui components for all custom UI -- buttons, forms,
  modals, tables, dropdowns, etc. Do NOT write raw HTML or custom
  components when a shadcn equivalent exists. Install with
  `npx shadcn@latest add <component>`. shadcn shares the same Tailwind
  theme and renders in ibl.ai brand colors automatically.
- Follow [BRAND.md](https://github.com/iblai/vibe/blob/main/BRAND.md) for
  colors, typography, spacing, and component styles.

You MUST run `/iblai-test` before telling the user the work is ready.

After all work is complete, start a dev server (`pnpm dev`) so the user
can see the result at http://localhost:3000.

`iblai.env` is NOT a `.env.local` replacement — it only holds the 3
shorthand variables (`DOMAIN`, `PLATFORM`, `TOKEN`). Next.js still reads
its runtime env vars from `.env.local`.

Use `pnpm` as the default package manager. Fall back to `npm` if pnpm
is not installed. The generated app should live in the current directory,
not in a subdirectory.

## Prerequisites

- Auth must be set up first (`/iblai-auth`)
- MCP and skills must be set up: `iblai add mcp`

## Step 0: Check for CLI Updates

Before running any `iblai` command, ensure the CLI is
up to date. Run `iblai --version` to check the current version, then
upgrade directly:
- pip: `pip install --upgrade iblai-app-cli`
- npm: `npm install -g @iblai/cli@latest`

This is safe to run even if already at the latest version.

## Step 1: Check Environment

Before proceeding, check for a `iblai.env`
in the project root. Look for `PLATFORM`, `DOMAIN`, and `TOKEN` variables.
If the file does not exist or is missing these variables, tell the user:
"You need an `iblai.env` with your platform configuration. Download the
template and fill in your values:
`curl -o iblai.env https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/iblai.env`"

## Step 2: Run the Generator

```bash
iblai add account
```

## What Was Generated

| File | Purpose |
|------|---------|
| `app/(app)/account/page.tsx` | Account/organization settings page with tabs |

The page reads `userData`, `tenant`/`current_tenant`, and `tenants` from
localStorage. Admin status is derived from the `tenants` array.

> **Note:** The `Account` component uses `next/image` internally -- it is
> imported from `@iblai/iblai-js/web-containers/next`.

## Step 3: Use MCP Tools for Customization

```
get_component_info("Account")
```

## `<Account>` Props

### Required

| Prop | Type | Description |
|------|------|-------------|
| `tenant` | `string` | Tenant/org key |
| `tenants` | `Tenant[]` | Full list of user tenants from localStorage |
| `username` | `string` | Username |
| `onInviteClick` | `() => void` | Called when "Invite user" is clicked |
| `onClose` | `() => void` | Cancel/close callback |
| `authURL` | `string` | Auth service URL |
| `isAdmin` | `boolean` | Controls tab visibility -- most tabs require `true` |

### Optional

| Prop | Type | Description |
|------|------|-------------|
| `targetTab` | `string` | Initial tab: `organization`, `management`, `integrations`, `advanced`, `billing` |
| `currentPlatformBaseDomain` | `string` | Base domain for custom domain settings |
| `currentSPA` | `string` | Current app identifier (e.g., `"agent"`) |
| `billingURL` | `string` | Stripe billing portal URL -- shows Billing tab |
| `topUpURL` | `string` | Stripe top-up URL -- shows Billing tab |
| `enableRbac` | `boolean` | Enable RBAC permission checks for Management |
| `showPlatformName` | `boolean` | Show tenant name badge in sidebar |
| `useGravatarPicFallback` | `boolean` | Use Gravatar when no org logo |

## Tabs

| Tab | Requires |
|-----|---------|
| **Organization** | `isAdmin === true` |
| **Management** | RBAC permissions |
| **Integrations** | `isAdmin === true` |
| **Advanced** | `isAdmin === true` |
| **Billing** | `billingURL` or `topUpURL` prop set |

## Step 4: Verify

Run `/iblai-test` before telling the user the work is ready:

1. `pnpm build` -- must pass with zero errors
2. `pnpm test` -- vitest must pass
3. Start dev server and touch test:
   ```bash
   pnpm dev &
   npx playwright screenshot http://localhost:3000/account /tmp/account.png
   ```

## Important Notes

- **Next.js required**: Import from `@iblai/iblai-js/web-containers/next` (uses `next/image`)
- **Redux store**: Must include `mentorReducer` and `mentorMiddleware`
- **`initializeDataLayer()`**: 5 args (v1.2+)
- **`@reduxjs/toolkit`**: Deduplicated via webpack aliases in `next.config.ts`
- **`currentPlatformBaseDomain`**: Must be `{config.platformBaseDomain()}` — uses the config helper, not a raw env var. This is correct and intentional.
- **Brand guidelines**: [BRAND.md](https://github.com/iblai/vibe/blob/main/BRAND.md)
