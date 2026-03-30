---
name: iblai-notifications
description: Add notification bell and center page to your Next.js app
globs:
alwaysApply: false
---

# /iblai-notifications

Add notification features -- a compact bell icon with unread badge for your
navbar and a full notification center page with Inbox and Alerts tabs.

![Notifications Page](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/iblai-notifications/notifications-page.png)

> **AI Assistant:** Build this component directly using the code and MCP tools
> below. Do NOT use the CLI for this -- you are building this feature yourself
> using the SDK components documented here.
>
> Do NOT add custom styles, colors, or CSS overrides to ibl.ai SDK components.
> They ship with their own styling. Keep the components as-is.
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
- The following packages are already installed by `iblai add auth`:
  `@iblai/iblai-js`, `@reduxjs/toolkit`, `react-redux`

## Step 1: Use MCP Tools

```
get_component_info("NotificationDisplay")
get_component_info("NotificationDropdown")
```

## Step 2: Create Notification Center Page

Create `app/notifications/page.tsx` (or `src/app/notifications/page.tsx` if using `src/` layout):

```tsx
"use client";

import { useEffect, useState } from "react";
import { NotificationDisplay } from "@iblai/iblai-js/web-containers";
import config from "@/lib/iblai/config";

function resolveTenantKey(raw: string | null): string {
  if (!raw || raw === "[object Object]") return "";
  try {
    const p = JSON.parse(raw);
    if (typeof p === "string") return p;
    if (p?.key) return p.key;
  } catch {}
  return raw;
}

export default function NotificationsPage() {
  const [tenantKey, setTenantKey] = useState("");
  const [username, setUsername] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("userData");
      if (raw) {
        const parsed = JSON.parse(raw);
        setUsername(parsed.user_nicename ?? parsed.username ?? "");
      }
    } catch {}

    const stored =
      localStorage.getItem("current_tenant") ??
      localStorage.getItem("tenant");
    const resolved = resolveTenantKey(stored) || config.mainTenantKey();
    setTenantKey(resolved);

    try {
      const tenantsRaw = localStorage.getItem("tenants");
      if (tenantsRaw) {
        const tenants = JSON.parse(tenantsRaw);
        const match = tenants.find((t: any) => t.key === resolved);
        if (match) setIsAdmin(!!match.is_admin);
      }
    } catch {}

    setReady(true);
  }, []);

  if (!ready || !tenantKey || !username) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <p className="text-sm text-gray-400">Loading notifications...</p>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-auto">
      <NotificationDisplay
        org={tenantKey}
        userId={username}
        isAdmin={isAdmin}
      />
    </div>
  );
}
```

## Step 3: Create Notification Bell (Navbar Component)

Create `components/iblai/notification-bell.tsx`:

1. Call `get_component_info("NotificationDropdown")` for the full props reference
2. Import from `@iblai/iblai-js/web-containers`
3. Read username and tenant from localStorage (same pattern as above)

Place in your navbar:

```tsx
import { IblaiNotificationBell } from "@/components/iblai/notification-bell";

<IblaiNotificationBell onViewAll={() => router.push("/notifications")} />
```

## `<NotificationDisplay>` Props (Full Page)

| Prop | Type | Description |
|------|------|-------------|
| `org` | `string` | Tenant/org key |
| `userId` | `string` | Username |
| `isAdmin` | `boolean?` | Shows Alerts tab + Send button |
| `selectedNotificationId` | `string?` | Pre-select a notification |
| `enableRbac` | `boolean?` | Enable RBAC permission checks |

## `<NotificationDropdown>` Props (Bell Icon)

| Prop | Type | Description |
|------|------|-------------|
| `org` | `string` | Tenant/org key |
| `userId` | `string` | Username |
| `onViewNotifications` | `(id?) => void?` | "View all" callback |

## Roles

| Feature | Everyone | Admin only |
|---------|----------|-----------|
| Inbox (unread/read) | Yes | Yes |
| Mark as read / all | Yes | Yes |
| Send notification | | Yes |
| Alerts tab | | Yes |

## Deep-Linking

Add `app/notifications/[notificationId]/page.tsx` with
`selectedNotificationId={notificationId}` prop to deep-link to a specific
notification.

## Step 4: Verify

Run `/iblai-test` before telling the user the work is ready:

1. `npm run build` -- must pass with zero errors
2. Start dev server and touch test:
   ```bash
   npm run dev &
   npx playwright screenshot http://localhost:3000/notifications /tmp/notifications.png
   ```

## Important Notes

- **Import**: `@iblai/iblai-js/web-containers` -- framework-agnostic
- **Redux store**: Must include `mentorReducer` and `mentorMiddleware`
- **`initializeDataLayer()`**: 5 args (v1.2+)
- **`@reduxjs/toolkit`**: Deduplicated via webpack aliases in `next.config.ts`
- **Admin detection**: Derive from `tenants` array in localStorage
- **Config import**: Use `@/lib/iblai/config` (generated by `iblai add auth`)
- **Brand guidelines**: [BRAND.md](https://github.com/iblai/vibe/blob/main/BRAND.md)
