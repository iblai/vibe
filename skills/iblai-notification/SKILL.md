---
name: iblai-notification
description: Add notification bell and center page to your Next.js app
globs:
alwaysApply: false
---

# /iblai-notification

Add notification features -- a compact bell icon with unread badge for your
navbar and a full notification center page with Inbox and Alerts tabs.

![Notifications Page](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/iblai-notification/notifications-page.png)

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

## Step 0: Check for CLI Updates

> **AI Assistant:** Before running any `iblai` command, ensure the CLI is
> up to date. Run `iblai --version` to check the current version, then
> upgrade directly:
> - pip: `pip install --upgrade iblai-app-cli`
> - npm: `npm install -g @iblai/cli@latest`
>
> This is safe to run even if already at the latest version.

## Step 1: Run the Generator

```bash
iblai add notifications
```

## What Was Generated

| File | Purpose |
|------|---------|
| `components/iblai/notification-bell.tsx` | Bell icon with unread badge for navbar |

The bell reads `userData` and `tenant` from localStorage. Returns `null`
gracefully if no user is authenticated.

## Step 2: Use MCP Tools for Customization

```
get_component_info("NotificationDisplay")
get_component_info("NotificationDropdown")
```

## `<NotificationDropdown>` Props (Bell Icon)

| Prop | Type | Description |
|------|------|-------------|
| `org` | `string` | Tenant/org key |
| `userId` | `string` | Username |
| `onViewNotifications` | `(id?) => void?` | "View all" callback |
| `className` | `string?` | Additional CSS class |

## `<NotificationDisplay>` Props (Full Page)

| Prop | Type | Description |
|------|------|-------------|
| `org` | `string` | Tenant/org key |
| `userId` | `string` | Username |
| `isAdmin` | `boolean?` | Shows Alerts tab + Send button |
| `selectedNotificationId` | `string?` | Pre-select a notification |
| `enableRbac` | `boolean?` | Enable RBAC permission checks |

## Roles

| Feature | Everyone | Admin only |
|---------|----------|-----------|
| Inbox (unread/read) | Yes | Yes |
| Mark as read / all | Yes | Yes |
| Send notification | | Yes |
| Alerts tab | | Yes |

## Step 3: Verify

Run `/iblai-test` before telling the user the work is ready:

1. `npm run build` -- must pass with zero errors
2. `npm run test` -- vitest must pass
3. Start dev server and touch test:
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
- **Brand guidelines**: [BRAND.md](https://github.com/iblai/vibe/blob/main/BRAND.md)
