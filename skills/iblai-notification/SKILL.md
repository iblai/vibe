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

Do NOT add custom styles to ibl.ai SDK components — they ship with their
own styling. Do NOT implement dark mode unless asked.

Follow the component hierarchy: use ibl.ai SDK components
(`@iblai/iblai-js`) first, then shadcn/ui (`npx shadcn@latest add <name>`).

> **Navbar:** If the user wants a navbar with the bell, send them to
> `/iblai-navbar` first.

## Prerequisites

- Auth set up (`/iblai-auth`)
- MCP and skills set up (`iblai add mcp`)
- `iblai.env` populated with `PLATFORM`, `DOMAIN`, `TOKEN`. If missing,
  tell the user to download the template:
  `curl -o iblai.env https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/iblai.env`

## Generate

```bash
iblai --version    # upgrade if outdated: pip install --upgrade iblai-app-cli OR npm i -g @iblai/cli@latest
iblai add notification
```

Generated: `components/iblai/notification-bell.tsx` — bell with unread
badge. Reads `userData` and `tenant` from localStorage; returns `null`
when unauthenticated.

## Components

Use MCP for full props/examples:

```
get_component_info("NotificationDropdown")
get_component_info("NotificationDisplay")
```

### `<NotificationDropdown>` — bell icon for the navbar

| Prop | Type | Description |
|------|------|-------------|
| `org` | `string` | Platform key |
| `userId` | `string` | Username |
| `onViewNotifications` | `(id?) => void?` | "View all" callback |
| `className` | `string?` | Additional CSS class |

### `<NotificationDisplay>` — full notification center page

| Prop | Type | Description |
|------|------|-------------|
| `org` | `string` | Platform key |
| `userId` | `string` | Username |
| `isAdmin` | `boolean?` | Shows Alerts tab + Send button |
| `selectedNotificationId` | `string?` | Pre-select a notification |
| `enableRbac` | `boolean?` | Enable RBAC permission checks |

Derive `isAdmin` from the `tenants` array in localStorage.

### Roles

| Feature | Everyone | Admin |
|---------|----------|-------|
| Inbox, mark as read | ✓ | ✓ |
| Send notification, Alerts tab | | ✓ |

## Verify

Run `/iblai-ops-test` before reporting done:

```bash
pnpm build && pnpm test
pnpm dev &
npx playwright screenshot http://localhost:3000/notifications /tmp/notifications.png
```

## Notes

- Import from `@iblai/iblai-js/web-containers` (framework-agnostic).
- Redux store must include `mentorReducer` and `mentorMiddleware`.
- `initializeDataLayer()` takes 5 args (data-layer v1.2+).
- `@reduxjs/toolkit` deduped via webpack aliases in `next.config.ts`.

---

# Notification REST API

> **Base URL:** `${dmUrl}/api/notification/v1/` — `dmUrl` is the first
> arg passed to `initializeDataLayer()` (sourced from
> `NEXT_PUBLIC_API_BASE_URL`).
> **Auth:** `Authorization: Token <token>`
> **Live OpenAPI:** <https://api.iblai.app/dm/api/docs/schema/swagger-ui/>

The SDK's RTK Query hooks (`useGetUserNotificationsQuery`,
`useGetNotificationCountQuery`, `useUpdateNotificationStatusMutation`,
`useMarkAllNotificationsReadMutation`, …) wrap most endpoints. Drop down
to raw HTTP only for admin endpoints not yet exposed as hooks (template
PATCH, builder send, SMTP test). Discover hooks via
`get_api_query_info(...)` in MCP. `{org}` and `{platform_key}` are the
same value (the platform slug).

## User notifications

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/orgs/{org}/users/{user_id}/notifications/` | List user notifications. Query: `status`, `channel`, `exclude_channel`, `start_date`, `end_date`, `page` |
| `PUT` | `/orgs/{org}/users/{user_id}/notifications/` | Update status. Body: `{notification_id: "uuid,uuid", status: "READ\|UNREAD\|CANCELLED"}` |
| `PATCH` | `/orgs/{org}/users/{user_id}/notifications/bulk-update/` | Set status on **all** user notifications. Body: `{status}` |
| `DELETE` | `/orgs/{org}/users/{user_id}/notifications/{id}/` | Delete one notification |
| `GET` | `/orgs/{org}/users/{user_id}/notifications-count/` | Count. Query: `status`, `channel`. Returns `{count}` |
| `POST` | `/orgs/{platform_key}/mark-all-as-read` | Mark all (or `notification_ids[]`) read |
| `GET` | `/orgs/{org}/notifications/` / `PUT` / `PATCH .../bulk-update/` | Org-wide variants (admin) |

Status values: `READ`, `UNREAD`, `CANCELLED`. Notification record:
`{id, username, title, body, status, channel, context, short_message, created_at, updated_at}`.

## Templates (admin)

Templates inherit defaults; the first `PATCH` clones the default into a
platform-specific copy. `reset` deletes the override (toggle state is
preserved).

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/platforms/{platform_key}/templates/` | List templates (system + custom) |
| `GET` | `/platforms/{platform_key}/templates/{type}/` | Template detail |
| `PATCH` | `/platforms/{platform_key}/templates/{type}/` | Customize template |
| `PATCH` | `/platforms/{platform_key}/templates/{type}/toggle/` | Body: `{allow_notification: bool}` |
| `POST` | `/platforms/{platform_key}/templates/{type}/reset/` | Revert to default |
| `POST` | `/platforms/{platform_key}/templates/{type}/test/` | Send test email. Body: `{context?}` |

Writable on `PATCH`: `name`, `description`, `message_title`,
`message_body`, `short_message_body`, `email_subject`,
`email_from_address`, `email_html_template`, `spa_ids[]`, `channel_ids[]`.

For `PROACTIVE_LEARNER_NOTIFICATION`, `POLICY_ASSIGNMENT`, and
`HUMAN_SUPPORT_NOTIFICATION` only their config fields are writable
(content is read-only). See "Special types" below.

Templates use Django syntax (`{{ var }}`, `{% if %}`, `{% for %}`).
`email_html_template` is sanitized by `bleach` — `<script>`, `<iframe>`,
`<form>`, event-handler attributes, and `javascript:` URLs are stripped.

### Notification types

System types include: `USER_NOTIF_USER_REGISTRATION`,
`APP_REGISTRATION`, `USER_NOTIF_COURSE_ENROLLMENT`,
`USER_NOTIF_COURSE_COMPLETION`, `USER_NOTIF_CREDENTIALS`,
`USER_NOTIF_LEARNER_PROGRESS`, `USER_NOTIF_USER_INACTIVITY`,
`PLATFORM_INVITATION`, `COURSE_INVITATION`, `PROGRAM_INVITATION`,
`COURSE_LICENSE_ASSIGNMENT`, `COURSE_LICENSE_GROUP_ASSIGNMENT`,
`PROGRAM_LICENSE_ASSIGNMENT`, `PROGRAM_LICENSE_GROUP_ASSIGNMENT`,
`USER_LICENSE_ASSIGNMENT`, `USER_LICENSE_GROUP_ASSIGNMENT`,
`ROLE_CHANGE`, `ADMIN_NOTIF_COURSE_ENROLLMENT`, `POLICY_ASSIGNMENT`,
`HUMAN_SUPPORT_NOTIFICATION`, `PROACTIVE_LEARNER_NOTIFICATION`,
`REPORT_COMPLETED`, `CUSTOM_NOTIFICATION`,
`ACTIVITY_COURSE_MILESTONE`, `ACTIVITY_NEW_CONTENT`,
`COURSES_PROGRESS_SUMMARY`, `PATHWAY_ENROLLMENT_CONFIRMATION`,
`PROGRAM_ENROLLMENT_CONFIRMATION`, `SKILL_MASTERY_CHANGE`. Per-type
template variables are returned in `available_context` from the GET
detail endpoint.

## Direct send (notification builder)

Admin-only. Flow: **context → validate → preview → send.**

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/orgs/{platform_key}/notification-builder/context/` | Returns `{templates[], channels[], sources[]}` |
| `POST` | `/orgs/{platform_key}/notification-builder/validate_source/` | Body: `{type, data}`. Returns valid/invalid counts + sample |
| `POST` | `/orgs/{platform_key}/notification-builder/preview/` | Returns `{build_id, count, warning, recipients[]}` |
| `GET` | `/orgs/{platform_key}/notification-builder/{build_id}/recipients/` | Paginated. Query: `search`, `page`, `page_size` |
| `POST` | `/orgs/{platform_key}/notification-builder/send/` | Body: `{build_id}` |

Preview body:

```json
{
  "template_id": "uuid",            // OR template_data — not both
  "template_data": { "message_title": "...", "message_body": "..." },
  "channels": [1, 2],
  "sources": [{ "type": "email", "data": "a@x.com,b@x.com" }],
  "context": { "course_name": "Python 101" },
  "process_on": "2026-05-01T09:00:00Z"   // optional, for scheduled send
}
```

Source types: `email`, `username`, `platform`, `csv` (multipart with
`file_0`), `department`, `pathway`, `program`, `usergroup`. Recipients
are merged + deduped across sources. Duplicate suppression: SHA-256 hash
of recipients+template+channels — if matched within 24h, send returns
`"Similar notifications found"`.

## Push (FCM)

| Method | Path | Body |
|--------|------|------|
| `POST` | `/orgs/{org}/users/{user_id}/register-fcm-token/` | `{name, registration_id, active?, cloud_message_type?, application_id?}` |
| `DELETE` | `/orgs/{org}/users/{user_id}/register-fcm-token/` | `{registration_id}` |

## SMTP

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/platforms/{platform_key}/config/test-smtp/` | Verify SMTP. Body: `{smtp_host, smtp_port, smtp_username, smtp_password, use_tls?, use_ssl?, test_email, from_email?}` |

`use_tls` (port 587) and `use_ssl` (port 465) are mutually exclusive.

## Campaigns

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/campaigns/unsubscribe/{unsubscribe_hash}/` | Public — unsubscribe link target |
| `POST` | `/orgs/{platform_key}/campaigns/enable/` | Re-enable. Body: `{campaign_id, campaign_title, email}` |
| `POST` | `/orgs/{platform_key}/campaigns/exclude/` | Opt-out. Body: same |

## Special types (config-only `PATCH`)

### `HUMAN_SUPPORT_NOTIFICATION`

```json
{
  "human_support_recipient_mode": "platform_admins_and_mentor_owner",
  "human_support_custom_recipients": [
    { "type": "user", "id": 42 },
    { "type": "user_group", "id": 7 },
    { "type": "rbac_policy", "policy_name": "Support Staff" }
  ]
}
```

`recipient_mode`: `platform_admins_and_mentor_owner` (default),
`platform_admins_only`, `mentor_owner_only`, `custom`.

### `POLICY_ASSIGNMENT`

```json
{
  "policy_notify_on_assignment": true,
  "policy_notify_on_removal": true,
  "policy_enabled_policies": [
    { "role_name": "Analytics Viewer", "enabled": true, "subject": "..." }
  ]
}
```

Empty `policy_enabled_policies` = global flags apply to all roles.
Non-empty = only listed roles trigger notifications.

### `PROACTIVE_LEARNER_NOTIFICATION`

```json
{
  "periodic_frequency": "WEEKLY",
  "periodic_report_period_days": 7,
  "periodic_execution_time": "09:00",
  "periodic_timezone": "UTC",
  "periodic_learner_scope": "ACTIVE_LEARNERS",
  "periodic_custom_interval_days": 7,
  "periodic_mentors": [
    { "unique_id": "uuid", "prompt": "Summarize {{student_name}}'s progress.", "name": "Coach" }
  ]
}
```

`frequency`: `DAILY`, `WEEKLY`, `MONTHLY`, `CUSTOM`. `learner_scope`:
`ACTIVE_LEARNERS` or `ALL_LEARNERS`. Empty `mentors` = use all platform
mentors.

## RBAC permissions

`Ibl.Notifications/Notification/{list,write,delete}`,
`Ibl.Notifications/NotificationTemplate/{list,read,write}`,
`Ibl.Notifications/SMTP/action`, `Ibl.Notifications/Campaigns/action`.

## Example

```bash
curl "${dmUrl}/api/notification/v1/orgs/acme-learning/users/jane.doe/notifications/?status=UNREAD" \
  -H "Authorization: Token ${TOKEN}"

curl -X PATCH "${dmUrl}/api/notification/v1/platforms/acme-learning/templates/USER_NOTIF_COURSE_ENROLLMENT/" \
  -H "Authorization: Token ${TOKEN}" -H "Content-Type: application/json" \
  -d '{"email_subject": "Welcome to {{ course_name }}"}'
```
