# iblai-vibe-invite

> Add user invitation dialogs to your Next.js app

# /iblai-vibe-invite

Add user invitation features -- a dialog to invite new users to a platform by
email/username and a dialog showing pending invitations with status tracking.

![Invite Page](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/iblai-vibe-invite/iblai-vibe-invite.png)

> **Common setup (brand, conventions, env files, verification):** see [docs/skill-setup.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/docs/skill-setup.md).

## Prerequisites

- Auth must be set up first (`/iblai-vibe-auth`)
- MCP server + skills configured (`@iblai/mcp` in `.mcp.json`)
- User must have admin privileges on the platform to send invitations

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

Dialog to invite a user to the current platform by email or username.

| Prop | Type | Description |
|------|------|-------------|
| `isOpen` | `boolean` | Whether the dialog is visible |
| `onClose` | `() => void` | Close callback |
| `org` | `string` | Platform key |

## `<InvitedUsersDialog>` Props

Dialog showing pending invitations with their status (accepted, pending, expired).

| Prop | Type | Description |
|------|------|-------------|
| `isOpen` | `boolean` | Whether the dialog is visible |
| `onClose` | `() => void` | Close callback |
| `org` | `string` | Platform key |

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
        tenant={tenant}
      />
      {showPending && (
        <InvitedUsersDialog
          onClose={() => setShowPending(false)}
          tenant={tenant}
        />
      )}
    </div>
  );
}
```

## Step 4: Verify

Run `/iblai-vibe-ops-test` before telling the user the work is ready:

1. `pnpm build` -- must pass with zero errors
2. Start dev server and verify dialogs open correctly:
   ```bash
   pnpm dev &
   npx playwright screenshot http://localhost:3000 /tmp/invite.png
   ```

## Important Notes

- **Import**: `@iblai/iblai-js/web-containers` -- framework-agnostic
- **Admin only**: Invitation features require admin privileges on the platform
- **Redux store**: Must include `mentorReducer` and `mentorMiddleware`
- **`initializeDataLayer()`**: 5 args (v1.2+)
- **`@reduxjs/toolkit`**: Deduplicated via webpack aliases in `next.config.ts`
- **Brand guidelines**: [BRAND.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/BRAND.md)