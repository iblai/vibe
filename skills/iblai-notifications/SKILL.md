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
