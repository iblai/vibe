---
name: iblai-notifications
description: Add notification bell and center page to your Next.js app
globs:
alwaysApply: false
---

# /iblai-notifications

Add notification features -- a compact bell icon with unread badge for your
navbar and a full notification center page with Inbox and Alerts tabs.

## Prerequisites

- Auth must be set up first (`/iblai-auth`)
- `iblai` CLI available (`iblai --version`). If not, run `/iblai-install`

## Add Notifications

```bash
iblai add notifications
# or: npx @iblai/cli add notifications
```

```bash
pnpm install
```

## What Was Generated

| File | Purpose |
|------|---------|
| `app/(app)/notifications/page.tsx` | Full notification center using SDK `NotificationDisplay` |
| `components/iblai/notification-bell.tsx` | Bell icon with unread count badge |

## Usage

### Notification Bell (navbar)

```tsx
import { IblaiNotificationBell } from "@/components/iblai/notification-bell";

<IblaiNotificationBell onViewAll={() => router.push("/notifications")} />
```

### Notification Center Page

Accessible at `/notifications`. Features:
- **Inbox** -- list of notifications with read/unread state
- **Alerts** (admin only) -- manage notification templates, send notifications

## Roles

| Feature | Everyone | Admin only |
|---------|----------|-----------|
| Inbox (unread/read) | Yes | Yes |
| Mark as read / all | Yes | Yes |
| Send notification | | Yes |
| Alerts tab | | Yes |

## Verify

```bash
pnpm dev
```

Log in, check the notification bell in the navbar, then navigate to `/notifications`.

## Detailed Guide

For the complete implementation reference:
https://github.com/iblai/iblai-app-cli/blob/main/skills/components/iblai-add-notifications.md
