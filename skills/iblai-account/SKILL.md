---
name: iblai-account
description: Add account and organization settings page to your Next.js app
globs:
alwaysApply: false
---

# /iblai-account

Add an account/organization settings page with tabs for Organization info,
User Management, Integrations, Advanced settings, and Billing.

## Prerequisites

- Auth must be set up first (`/iblai-auth`)
- `iblai` CLI available (`iblai --version`). See `/iblai-auth` prerequisites for installation.

## Add Account Settings

```bash
iblai add account
# or: npx @iblai/cli add account
```

```bash
pnpm install
```

## What Was Generated

| File | Purpose |
|------|---------|
| `app/(app)/account/page.tsx` | Account settings page using SDK `Account` component |

## Usage

Accessible at `/account`. Requires admin privileges for most tabs.

The `isAdmin` flag is derived from the `tenants` array in localStorage:

```typescript
const tenants = JSON.parse(localStorage.getItem("tenants"));
const isAdmin = tenants.find(t => t.key === currentTenantKey)?.is_admin;
```

## Quick Embed

To embed the Account component in an existing page:

```tsx
import { Account } from "@iblai/iblai-js/web-containers/next";

<Account tenant={tenantKey} isAdmin={isAdmin} />
```

## Verify

```bash
pnpm dev
```

Log in as an admin user, then navigate to `/account`.

## Detailed Guide

For the complete implementation reference:
https://github.com/iblai/iblai-app-cli/blob/main/skills/components/iblai-add-account.md
