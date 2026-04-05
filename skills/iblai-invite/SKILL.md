---
name: iblai-invite
description: Add user invitation dialogs to your Next.js app
globs:
alwaysApply: false
---

# /iblai-invite

Add user invitation features -- a dialog to invite new users to a tenant by
email/username and a dialog showing pending invitations with status tracking.

> **AI Assistant:**
> Do NOT add custom styles, colors, or CSS overrides to ibl.ai SDK components.
> They ship with their own styling. Keep the components as-is.
> Do NOT implement dark mode unless the user explicitly asks for it.
>
> When building custom UI around SDK components, use the ibl.ai brand:
> - **Primary**: `#0058cc`, **Gradient**: `linear-gradient(135deg, #00b0ef, #0058cc)`
> - **Button**: `bg-gradient-to-r from-[#2563EB] to-[#93C5FD] text-white`
> - **Font**: System sans-serif stack, **Style**: shadcn/ui new-york variant
> - Use shadcn components for custom UI -- they share the same Tailwind
>   theme and render in ibl.ai brand colors automatically.
>
> You MUST run `/iblai-test` before telling the user the work is ready.
>
> After all work is complete, start a dev server (`pnpm dev`) so the user
> can see the result at http://localhost:3000.
>
> `iblai.env` is NOT a `.env.local` replacement — it only holds the 3
> shorthand variables (`DOMAIN`, `PLATFORM`, `TOKEN`). Next.js still reads
> its runtime env vars from `.env.local`.
>
> Use `pnpm` as the default package manager. Fall back to `npm` if pnpm
> is not installed. The generated app should live in the current directory,
> not in a subdirectory.

## Prerequisites

- Auth must be set up first (`/iblai-auth`)
- MCP and skills must be set up: `iblai add mcp`
- User must have admin privileges on the tenant to send invitations

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

## Step 2: Add the Components

There is no dedicated CLI generator for invite dialogs. Import the components
directly from the SDK:

```typescript
import { InviteUserDialog, InvitedUsersDialog } from "@iblai/iblai-js/web-containers";
```

## Step 3: Use MCP Tools for Customization

```
get_component_info("InviteUserDialog")
get_component_info("InvitedUsersDialog")
```

## `<InviteUserDialog>` Props

Dialog to invite a user to the current tenant by email or username.

| Prop | Type | Description |
|------|------|-------------|
| `isOpen` | `boolean` | Whether the dialog is visible |
| `onClose` | `() => void` | Close callback |
| `org` | `string` | Tenant/org key |

## `<InvitedUsersDialog>` Props

Dialog showing pending invitations with their status (accepted, pending, expired).

| Prop | Type | Description |
|------|------|-------------|
| `isOpen` | `boolean` | Whether the dialog is visible |
| `onClose` | `() => void` | Close callback |
| `org` | `string` | Tenant/org key |

## Example Usage

Add invite buttons to an admin settings page or account page:

```tsx
"use client";
import { useState } from "react";
import { InviteUserDialog, InvitedUsersDialog } from "@iblai/iblai-js/web-containers";
import { Button } from "@/components/ui/button";
import { resolveAppTenant } from "@/lib/iblai/tenant";

export function InviteSection() {
  const [showInvite, setShowInvite] = useState(false);
  const [showPending, setShowPending] = useState(false);
  const tenant = resolveAppTenant();

  return (
    <div className="flex gap-2">
      <Button onClick={() => setShowInvite(true)}>Invite User</Button>
      <Button variant="outline" onClick={() => setShowPending(true)}>
        View Pending
      </Button>
      <InviteUserDialog
        isOpen={showInvite}
        onClose={() => setShowInvite(false)}
        org={tenant}
      />
      <InvitedUsersDialog
        isOpen={showPending}
        onClose={() => setShowPending(false)}
        org={tenant}
      />
    </div>
  );
}
```

## Step 4: Verify

Run `/iblai-test` before telling the user the work is ready:

1. `pnpm build` -- must pass with zero errors
2. Start dev server and verify dialogs open correctly:
   ```bash
   pnpm dev &
   npx playwright screenshot http://localhost:3000 /tmp/invite.png
   ```

## Important Notes

- **Import**: `@iblai/iblai-js/web-containers` -- framework-agnostic
- **Admin only**: Invitation features require admin privileges on the tenant
- **Redux store**: Must include `mentorReducer` and `mentorMiddleware`
- **`initializeDataLayer()`**: 5 args (v1.2+)
- **`@reduxjs/toolkit`**: Deduplicated via webpack aliases in `next.config.ts`
- **Brand guidelines**: [BRAND.md](https://github.com/iblai/vibe/blob/main/BRAND.md)
