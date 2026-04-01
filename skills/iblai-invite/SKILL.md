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

## Prerequisites

- Auth must be set up first (`/iblai-auth`)
- MCP and skills must be set up: `iblai add mcp`
- User must have admin privileges on the tenant to send invitations

## Step 0: Check for CLI Updates

> **AI Assistant:** Before running any `iblai` command, check for updates.
> Run `iblai --version` to get the current version, then check the latest:
> - **PyPI:** `curl -sf https://pypi.org/pypi/iblai-app-cli/json | python3 -c "import sys,json; print(json.load(sys.stdin)['info']['version'])"`
> - **npm:** `npm view @iblai/cli version 2>/dev/null`
> - **GitHub (binary installs):** `curl -sf https://api.github.com/repos/iblai/iblai-app-cli/releases/latest | python3 -c "import sys,json; print(json.load(sys.stdin)['tag_name'].lstrip('v'))"`
>
> If a newer version exists, update:
> - pip: `pip install --upgrade iblai-app-cli`
> - npm: `npm install -g @iblai/cli@latest`
> - Binary: download the latest release from `https://github.com/iblai/iblai-app-cli/releases/latest` for the current platform and replace the binary

## Step 1: Add the Components

There is no dedicated CLI generator for invite dialogs. Import the components
directly from the SDK:

```typescript
import { InviteUserDialog, InvitedUsersDialog } from "@iblai/iblai-js/web-containers";
```

## Step 2: Use MCP Tools for Customization

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

## Step 3: Verify

Run `/iblai-test` before telling the user the work is ready:

1. `npm run build` -- must pass with zero errors
2. Start dev server and verify dialogs open correctly:
   ```bash
   npm run dev &
   npx playwright screenshot http://localhost:3000 /tmp/invite.png
   ```

## Important Notes

- **Import**: `@iblai/iblai-js/web-containers` -- framework-agnostic
- **Admin only**: Invitation features require admin privileges on the tenant
- **Redux store**: Must include `mentorReducer` and `mentorMiddleware`
- **`initializeDataLayer()`**: 5 args (v1.2+)
- **`@reduxjs/toolkit`**: Deduplicated via webpack aliases in `next.config.ts`
- **Brand guidelines**: [BRAND.md](https://github.com/iblai/vibe/blob/main/BRAND.md)
