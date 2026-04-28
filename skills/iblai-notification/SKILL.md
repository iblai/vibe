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

Do NOT add custom styles, colors, or CSS overrides to ibl.ai SDK components.
They ship with their own styling. Keep the components as-is.
Do NOT implement dark mode unless the user explicitly asks for it.

When building custom UI around SDK components, use the ibl.ai brand:
- **Primary**: `#0058cc`, **Gradient**: `linear-gradient(135deg, #00b0ef, #0058cc)`
- **Button**: `bg-gradient-to-r from-[#2563EB] to-[#93C5FD] text-white`
- **Font**: System sans-serif stack, **Style**: shadcn/ui new-york variant
- Follow the component hierarchy: use ibl.ai SDK components
  (`@iblai/iblai-js`) first, then shadcn/ui for everything else
  (`npx shadcn@latest add <component>`). Do NOT write custom components
  when an ibl.ai or shadcn equivalent exists. Both share the same
  Tailwind theme and render in ibl.ai brand colors automatically.
- Follow [BRAND.md](https://github.com/iblai/vibe/blob/main/BRAND.md) for
  colors, typography, spacing, and component styles.

You MUST run `/iblai-ops-test` before telling the user the work is ready.

After all work is complete, start a dev server (`pnpm dev`) so the user
can see the result at http://localhost:3000.

`iblai.env` is NOT a `.env.local` replacement — it only holds the 3
shorthand variables (`DOMAIN`, `PLATFORM`, `TOKEN`). Next.js still reads
its runtime env vars from `.env.local`.

Use `pnpm` as the default package manager. Fall back to `npm` if pnpm
is not installed. The generated app should live in the current directory,
not in a subdirectory.

> **Navbar:** If the user wants a navbar with the notification bell, guide
> them to `/iblai-navbar` first. That skill creates the full navbar with
> logo, page links, notification bell, and profile dropdown.

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
iblai add notification
```

## What Was Generated

| File | Purpose |
|------|---------|
| `components/iblai/notification-bell.tsx` | Bell icon with unread badge for navbar |

The bell reads `userData` and `tenant` from localStorage. Returns `null`
gracefully if no user is authenticated.

## Step 3: Use MCP Tools for Customization

```
get_component_info("NotificationDisplay")
get_component_info("NotificationDropdown")
```

## `<NotificationDropdown>` Props (Bell Icon)

| Prop | Type | Description |
|------|------|-------------|
| `org` | `string` | Platform key |
| `userId` | `string` | Username |
| `onViewNotifications` | `(id?) => void?` | "View all" callback |
| `className` | `string?` | Additional CSS class |

## `<NotificationDisplay>` Props (Full Page)

| Prop | Type | Description |
|------|------|-------------|
| `org` | `string` | Platform key |
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

## Step 4: Verify

Run `/iblai-ops-test` before telling the user the work is ready:

1. `pnpm build` -- must pass with zero errors
2. `pnpm test` -- vitest must pass
3. Start dev server and touch test:
   ```bash
   pnpm dev &
   npx playwright screenshot http://localhost:3000/notifications /tmp/notifications.png
   ```

## Important Notes

- **Import**: `@iblai/iblai-js/web-containers` -- framework-agnostic
- **Redux store**: Must include `mentorReducer` and `mentorMiddleware`
- **`initializeDataLayer()`**: 5 args (v1.2+)
- **`@reduxjs/toolkit`**: Deduplicated via webpack aliases in `next.config.ts`
- **Admin detection**: Derive from `tenants` array in localStorage
- **Brand guidelines**: [BRAND.md](https://github.com/iblai/vibe/blob/main/BRAND.md)

---

# IBL Notification System — API Reference

> **Base URL:** `${dmUrl}/api/notification/v1/`
> **Authentication:** `Authorization: Token YOUR_ACCESS_TOKEN`
> **API Version:** v1
> **Source:** [iblai/docs · notifications.md](https://github.com/iblai/docs/blob/main/developer/applications/notifications.md)
> and live OpenAPI: <https://api.iblai.app/dm/api/docs/schema/swagger-ui/>

`dmUrl` is the Data Manager base URL — read it from
`NEXT_PUBLIC_API_BASE_URL` in `.env.local` (e.g.
`https://api.iblai.app/dm`). The SDK passes it into `initializeDataLayer()`
as the first argument and reuses it for every notification call.

The SDK's RTK Query hooks (`useGetUserNotificationsQuery`,
`useGetNotificationCountQuery`, etc.) wrap most of these endpoints. Drop
down to raw HTTP only for admin endpoints (template editing, builder
send, SMTP test) that aren't yet exposed as SDK hooks. Discover hook
names with `get_api_query_info(...)` via MCP.

`{org}` and `{platform_key}` are interchangeable — both are the platform
key (e.g. `main`, your tenant key).

## 1. Introduction

The IBL Notification System provides multi-channel notification delivery
for the IBL learning platform. It handles routing, templating, and
delivery to learners, administrators, and other platform participants
across email, push, and in-app channels.

### Supported Channels

- **Email** — delivered via configured SMTP
- **Push Notifications** — delivered to registered mobile or browser
  clients via FCM
- **In-App** — surfaced within the IBL platform UI and accessible via API

### Key Capabilities

- Multi-channel delivery with per-channel enable/disable controls
- 22+ built-in notification types triggered automatically by platform
  events (enrollments, completions, credential issuance, and more)
- Customizable notification templates per platform with inheritance from
  defaults — your edits apply to a copy, not the original
- Enable or disable specific notification types for your platform
- AI-powered proactive learner notifications for engagement and progress
  recommendations (optional, requires configuration)
- Human support ticket routing with configurable recipient lists

## 2. System Overview

The notification system operates on an event-driven model. Actions
within your platform — such as a learner completing a course, a manager
sending an invitation, or a policy being assigned — trigger
notifications. The system evaluates your configuration, selects the
appropriate template, and delivers the notification through the enabled
channels. Templates, preferences, and recipient rules are scoped to the
platform.

Notifications reach users through two paths:

**Automatic** — events on the platform trigger notifications without any
action from you. For each event, the system checks:
1. Whether the notification type is enabled for the platform
2. Which channels are configured for delivery
3. Which template applies (customized version or inherited default)
4. Who the recipients are

**Manual (Direct Send)** — admins compose and send notifications on
demand using the Direct Send API (the "notification builder"). Pick a
template or write custom content, choose channels, and define your
audience from multiple sources (email addresses, usernames, user groups,
departments, programs, or CSV uploads). Recipients are merged and
deduplicated across sources before sending.

### Lifecycle

Each notification begins as `UNREAD` when delivered. Users can mark them
`READ` or `CANCELLED`. `READ` can be reverted to `UNREAD`; `CANCELLED`
is terminal.

## 3. Authentication

All endpoints require token-based auth in the `Authorization` header:

```
Authorization: Token YOUR_ACCESS_TOKEN
```

In a Next.js app set up by `/iblai-auth`, the SDK automatically attaches
the user's bearer token. For server-side code (Route Handlers, edge
functions) calling admin endpoints, use a platform API key
(`PlatformApiKeyAuthentication`).

### Permission Levels

| Action | Required Role |
|--------|---------------|
| Read own notifications | Authenticated user |
| Manage own notifications (read/unread/delete) | Authenticated user |
| List/customize templates | Platform Admin |
| Toggle notification types | Platform Admin |
| Test SMTP credentials | Platform Admin |
| Send direct notifications | Platform Admin or Department Admin |

### RBAC

If RBAC is enabled, permissions are validated against granular resource
actions in addition to role checks. Listing notifications requires
`Ibl.Notifications/Notification/list`; writing requires
`Ibl.Notifications/Notification/write`. A role check alone is not
sufficient when RBAC enforcement is active.

### Security

Store tokens server-side. Never expose them in client JS, third-party
storage, or version control.

## 4. Quickstart

### Prerequisites

- **API token** — passed in every request
- **Platform key** — the slug identifying the org (e.g. `acme-learning`),
  used as the `org` / `platform_key` URL segment

### Step 1 — List notifications for a user

```
GET /api/notification/v1/orgs/{org}/users/{user_id}/notifications/
```

**Query parameters (all optional)**

| Parameter | Description |
|---|---|
| `status` | Filter by `READ`, `UNREAD`, `CANCELLED` |
| `channel` | Filter by channel (e.g. `email`, `push_notification`) |
| `exclude_channel` | Exclude a specific channel |
| `start_date` | Notifications created on or after this date |
| `end_date` | Notifications created on or before this date |

```bash
curl -X GET \
  "${dmUrl}/api/notification/v1/orgs/acme-learning/users/jane.doe/notifications/" \
  -H "Authorization: Token YOUR_ACCESS_TOKEN"
```

**Response**

```json
{
  "count": 2,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "username": "jane.doe",
      "title": "New course available: Introduction to Data Science",
      "body": "<p>Hi Jane, you have been enrolled in Introduction to Data Science.</p>",
      "status": "UNREAD",
      "channel": "email",
      "context": { "course_name": "Introduction to Data Science", "username": "jane.doe" },
      "short_message": "You have been enrolled in Introduction to Data Science.",
      "created_at": "2026-04-11T08:30:00Z",
      "updated_at": "2026-04-11T08:30:00Z"
    }
  ]
}
```

### Step 2 — Check unread count

```
GET /api/notification/v1/orgs/{org}/users/{user_id}/notifications-count/?status=UNREAD
```

```json
{ "count": 5 }
```

### Step 3 — Mark a notification as read

```
PUT /api/notification/v1/orgs/{org}/users/{user_id}/notifications/
```

```json
{ "notification_id": "3fa85f64-...,7cb92a41-...", "status": "READ" }
```

`notification_id` is a comma-separated UUID list.

### Step 4 — Mark all as read

```
POST /api/notification/v1/orgs/{platform_key}/mark-all-as-read
```

Body (optional):
```json
{ "notification_ids": ["3fa85f64-...", "7cb92a41-..."] }
```

If `notification_ids` is omitted, all unread notifications for the
authenticated user are marked read.

```json
{ "message": "Successfully marked 5 notifications as read", "count": 5 }
```

## 5. Core Concepts

| Concept | Description |
|---------|-------------|
| **Platform** | Your isolated notification environment. Templates, preferences, and delivery settings are scoped to your platform. |
| **Notification Template** | Defines content, channels, and behavior for a notification type. You inherit defaults until you customize — your changes apply to your own copy only. |
| **Notification** | A sent notification record tied to a user, with delivery and read status tracking. |
| **Channel** | A delivery method: `email`, `push_notification`, `in_app`, or `sms`. |
| **Notification Type** | A category of notification (e.g., `USER_NOTIF_COURSE_ENROLLMENT`). Each type maps to one template per platform. |
| **Notification Preference** | A platform-level toggle that enables or disables a notification type for all users on the platform. |

### Template inheritance

Until you customize a template, your platform reads the default
(`is_inherited: true`). The first `PATCH` to a template clones the
default into a platform-specific copy and applies your edits. `Reset`
deletes the override; the platform reverts to the default. The toggle
state (enabled/disabled) is stored separately and is not affected by
reset.

## 6. Notification Types Reference

| Type | Category | Trigger | Description |
|------|----------|---------|-------------|
| `USER_NOTIF_USER_REGISTRATION` | User | User account created | Welcomes new users to the platform |
| `APP_REGISTRATION` | User | User registers via a linked application | Welcome message with app name and benefits |
| `USER_NOTIF_COURSE_ENROLLMENT` | Learning | Enrolled in a course | Confirms course enrollment to the learner |
| `USER_NOTIF_COURSE_COMPLETION` | Learning | Completed a course | Congratulates on course completion with certificate link |
| `USER_NOTIF_CREDENTIALS` | Learning | Credential issued | Notifies learner of new credential with credential URL |
| `USER_NOTIF_LEARNER_PROGRESS` | Learning | Periodic progress summary | Delivers progress digest with courses, time spent, credentials |
| `USER_NOTIF_USER_INACTIVITY` | Engagement | User inactive for configured period | Re-engagement notification with inactivity details |
| `PLATFORM_INVITATION` | Invitation | Admin sends platform invite | Invites user to join the platform with redirect link |
| `COURSE_INVITATION` | Invitation | Admin sends course invite | Invites user to a course with enrollment link |
| `PROGRAM_INVITATION` | Invitation | Admin sends program invite | Invites user to a program with enrollment link |
| `COURSE_LICENSE_ASSIGNMENT` | License | Course license assigned to user | Notifies user of course access via license |
| `COURSE_LICENSE_GROUP_ASSIGNMENT` | License | Course license assigned to user group | Notifies group members of course access |
| `PROGRAM_LICENSE_ASSIGNMENT` | License | Program license assigned to user | Notifies user of program access via license |
| `PROGRAM_LICENSE_GROUP_ASSIGNMENT` | License | Program license assigned to user group | Notifies group members of program access |
| `USER_LICENSE_ASSIGNMENT` | License | Platform user license assigned | Notifies user of platform license with benefits |
| `USER_LICENSE_GROUP_ASSIGNMENT` | License | Platform user license assigned to group | Notifies group members of platform license |
| `ROLE_CHANGE` | Admin | User's platform role changed | Notifies user of role promotion or demotion |
| `ADMIN_NOTIF_COURSE_ENROLLMENT` | Admin | User enrolls in a course | Alerts admins with student name, email, and course |
| `POLICY_ASSIGNMENT` | RBAC | RBAC policy assigned or removed | Notifies user of role assignment/removal with resources |
| `HUMAN_SUPPORT_NOTIFICATION` | Support | Human support ticket created | Alerts support staff with ticket details and chat link |
| `PROACTIVE_LEARNER_NOTIFICATION` | AI | Scheduled | AI-generated personalized learning recommendations |
| `REPORT_COMPLETED` | Admin | Async report finishes processing | Notifies user with report status and download URL |
| `CUSTOM_NOTIFICATION` | Custom | Code-driven | Platform-defined custom notification with custom targeting |

Additional types from the live schema not covered above include
`ACTIVITY_COURSE_MILESTONE`, `ACTIVITY_NEW_CONTENT`,
`COURSES_PROGRESS_SUMMARY`, `DEFAULT_TEMPLATE`,
`PATHWAY_ENROLLMENT_CONFIRMATION`, `PROGRAM_ENROLLMENT_CONFIRMATION`,
and `SKILL_MASTERY_CHANGE`.

## 7. API Reference

### 7.1 Notifications

| Method | Endpoint | RBAC Permission |
|--------|----------|-----------------|
| `GET` | `/orgs/{org}/notifications/` | `Ibl.Notifications/Notification/list` |
| `PUT` | `/orgs/{org}/notifications/` | `Ibl.Notifications/Notification/write` |
| `PATCH` | `/orgs/{org}/notifications/bulk-update/` | `Ibl.Notifications/Notification/write` |
| `GET` | `/orgs/{org}/users/{user_id}/notifications/` | `Ibl.Notifications/Notification/list` |
| `PUT` | `/orgs/{org}/users/{user_id}/notifications/` | `Ibl.Notifications/Notification/write` |
| `PATCH` | `/orgs/{org}/users/{user_id}/notifications/bulk-update/` | `Ibl.Notifications/Notification/write` |
| `DELETE` | `/orgs/{org}/users/{user_id}/notifications/{id}/` | `Ibl.Notifications/Notification/delete` |
| `GET` | `/orgs/{org}/users/{user_id}/notifications-count/` | `Ibl.Notifications/Notification/list` |
| `POST` | `/orgs/{platform_key}/mark-all-as-read` | `Ibl.Notifications/Notification/write` |
| `GET` | `/campaigns/unsubscribe/{unsubscribe_hash}/` | None — public endpoint |

#### `GET /orgs/{org}/users/{user_id}/notifications/`

List notifications for a specific user. Results are ordered with unread
notifications first, then by creation date descending. Paginated.

**Path parameters**

| Name | Type | Description |
|------|------|-------------|
| `org` | string (slug) | Platform key |
| `user_id` | string | Username of the target user |

**Query parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `status` | string | No | Filter by status: `READ`, `UNREAD`, `CANCELLED` |
| `channel` | string | No | Filter by channel name (e.g. `email`, `push_notification`) |
| `start_date` | string | No | Notifications created on or after this date |
| `end_date` | string | No | Notifications created on or before this date |
| `exclude_channel` | string | No | Exclude a specific channel |
| `page` | integer | No | Page number for pagination |

**Response fields**

| Field | Type | Description |
|-------|------|-------------|
| `count` | integer | Total notifications matching the query |
| `next` | integer or null | Next page number |
| `previous` | integer or null | Previous page number |
| `results[].id` | UUID | Unique notification identifier |
| `results[].username` | string or null | Recipient's username |
| `results[].title` | string | Rendered notification title |
| `results[].body` | string | Rendered body (may contain HTML) |
| `results[].status` | string | `READ`, `UNREAD`, or `CANCELLED` |
| `results[].channel` | string or null | Delivery channel name |
| `results[].context` | object or null | Template context variables used for rendering |
| `results[].short_message` | string | Short message for SMS or preview |
| `results[].created_at` | ISO 8601 | Creation timestamp |
| `results[].updated_at` | ISO 8601 | Last update timestamp |

#### `PUT /orgs/{org}/users/{user_id}/notifications/`

Update the status of one or more notifications by UUID.

**Request body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `notification_id` | string | Yes | Comma-separated UUIDs |
| `status` | string | Yes | `READ`, `UNREAD`, or `CANCELLED` |

```json
{
  "notification_id": "3fa85f64-...,7cb93e21-...",
  "status": "READ"
}
```

**Response 200**
```json
{ "message": "Notification status updated successfully", "success": true }
```

#### `PATCH /orgs/{org}/users/{user_id}/notifications/bulk-update/`

Set a single status on **all** notifications for the specified user on
the platform.

**Request body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `status` | string | Yes | `READ`, `UNREAD`, or `CANCELLED` |

**Error 400** — returned when the user has no notifications:
```json
{ "error": "Notification does not exist" }
```

#### `DELETE /orgs/{org}/users/{user_id}/notifications/{id}/`

Permanently delete a single notification.

**Response 200**
```json
{ "message": "Notification deleted successfully" }
```

**Error 404**
```json
{ "message": "Notification does not exist" }
```

#### `GET /orgs/{org}/users/{user_id}/notifications-count/`

Return the count of notifications for a user.

**Query parameters**

| Name | Type | Description |
|------|------|-------------|
| `status` | string | `READ`, `UNREAD`, or `CANCELLED` |
| `channel` | string | Filter by channel name |

**Response 200**
```json
{ "count": 5 }
```

#### `POST /orgs/{platform_key}/mark-all-as-read`

Mark all unread notifications as read for the authenticated user. Pass
`notification_ids` to restrict the operation.

**Request body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `notification_ids` | array of UUIDs | No | Restrict the operation to specific IDs |

**Response 200**
```json
{ "message": "Successfully marked 3 notifications as read", "count": 3 }
```

#### Campaign unsubscribe (public)

```
GET /api/notification/v1/campaigns/unsubscribe/{unsubscribe_hash}/
```

No auth required — the `unsubscribe_hash` is the secret. Use this in
campaign email footers.

```json
{ "success": true, "message": "..." }
```

Two related admin-only endpoints:

```
POST /api/notification/v1/orgs/{platform_key}/campaigns/enable/
POST /api/notification/v1/orgs/{platform_key}/campaigns/exclude/
```

Body shape (both):
```json
{
  "campaign_id": 42,
  "campaign_title": "Weekly digest",
  "email": "alice@example.com"
}
```

`enable` re-enables a previously-unsubscribed campaign; `exclude` opts a
user out programmatically.

### 7.2 Notification Templates

All template endpoints require **Platform Admin** role.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/platforms/{platform_key}/templates/` | List all templates |
| `GET` | `/platforms/{platform_key}/templates/{type}/` | Get template detail |
| `PATCH` | `/platforms/{platform_key}/templates/{type}/` | Customize a template (creates platform copy on first edit) |
| `PATCH` | `/platforms/{platform_key}/templates/{type}/toggle/` | Enable or disable a notification type |
| `POST` | `/platforms/{platform_key}/templates/{type}/reset/` | Reset to default |
| `POST` | `/platforms/{platform_key}/templates/{type}/test/` | Send a test notification |

#### `GET /platforms/{platform_key}/templates/`

Returns every template visible to the platform, including inherited
defaults and your customized overrides. Custom notification types are
appended after system types.

**Response 200**
```json
[
  {
    "id": 14,
    "type": "USER_NOTIF_COURSE_ENROLLMENT",
    "name": "Course Enrollment",
    "description": "Sent when a learner enrolls in a course",
    "is_inherited": false,
    "source_platform": "acme-learning",
    "is_enabled": true,
    "can_customize": true,
    "is_custom": false,
    "message_title": "You have been enrolled in {{ course_name }}",
    "email_subject": "Welcome to {{ course_name }}",
    "spas": ["skills", "admin"],
    "allowed_channels": ["email", "push_notification"],
    "available_context": {
      "username": "Learner's username",
      "course_name": "Name of the course",
      "site_name": "Platform display name"
    }
  }
]
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID or string | Template ID. Custom types use a `custom_<id>` string format. |
| `type` | string | Notification type key |
| `name` | string | Human-readable name |
| `description` | string | When this notification is sent |
| `is_inherited` | boolean | `true` if using the unmodified default template |
| `source_platform` | string | Platform key that owns the active template |
| `is_enabled` | boolean | Whether this type is enabled for the platform |
| `can_customize` | boolean | Whether template content is editable |
| `is_custom` | boolean | `true` for custom notification types |
| `message_title` | string | Push/in-app title |
| `email_subject` | string | Email subject line |
| `spas` | array of strings | SPAs that surface this notification |
| `allowed_channels` | array of strings | Delivery channels |
| `available_context` | object | Variable keys and descriptions |

#### `GET /platforms/{platform_key}/templates/{type}/`

Returns full content and configuration of a single template. If a
customized template exists, that is returned; otherwise the default is
returned with `is_inherited: true`.

Detail-only fields:

| Field | Type | Description |
|-------|------|-------------|
| `message_body` | string | Full body text |
| `short_message_body` | string | Short version for SMS/preview |
| `email_from_address` | string | Sender email |
| `email_html_template` | string | HTML email body |
| `spas_detail` | array | SPA objects with `id`, `name`, `description` |
| `allowed_channels_detail` | array | Channel objects with `id`, `name` |
| `metadata` | object | Raw configuration blob |
| `periodic_config` | object or null | Schedule config (`PROACTIVE_LEARNER_NOTIFICATION` only) |
| `policy_config` | object or null | Role config (`POLICY_ASSIGNMENT` only) |
| `human_support_config` | object or null | Recipient config (`HUMAN_SUPPORT_NOTIFICATION` only) |

`periodic_config` (when present):

| Field | Type | Description |
|-------|------|-------------|
| `learner_scope` | string | `ACTIVE_LEARNERS` or `ALL_LEARNERS` |
| `report_period_days` | integer | Days of activity to include |
| `frequency` | string | `DAILY`, `WEEKLY`, `MONTHLY`, or `CUSTOM` |
| `custom_interval_days` | integer or null | Interval when frequency is `CUSTOM` |
| `execution_time` | string | `HH:MM` (24-hour) |
| `timezone` | string | Timezone name |
| `mentors` | array | `[{"unique_id", "prompt", "name"}]` |
| `last_execution_date` | string or null | ISO 8601 of last run |
| `next_execution_date` | string or null | ISO 8601 of next run |

`policy_config` (when present):

| Field | Type | Description |
|-------|------|-------------|
| `enabled_policies` | array | Per-role configs: `[{"role_name", "enabled", "subject"}]` |
| `notify_on_assignment` | boolean | Notify on policy assignment |
| `notify_on_removal` | boolean | Notify on policy removal |

`human_support_config` (when present):

| Field | Type | Description |
|-------|------|-------------|
| `recipient_mode` | string | `platform_admins_and_mentor_owner`, `platform_admins_only`, `mentor_owner_only`, or `custom` |
| `custom_recipients` | array | Recipient targets when mode is `custom` |

#### `PATCH /platforms/{platform_key}/templates/{type}/`

Customize a template. The first PATCH for a given type clones the
default into a platform-specific copy. Subsequent PATCHes update that
copy. Only fields present in the request body are changed.

**Writable fields**

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Template display name |
| `description` | string | Description |
| `message_title` | string | Push/in-app title |
| `message_body` | string | Body text |
| `short_message_body` | string | Short version |
| `email_subject` | string | Email subject |
| `email_from_address` | string | Sender email |
| `email_html_template` | string | HTML email body |
| `spa_ids` | array of integers | SPA IDs |
| `channel_ids` | array of integers | Channel IDs |

For system-managed types (`PROACTIVE_LEARNER_NOTIFICATION`,
`POLICY_ASSIGNMENT`, `HUMAN_SUPPORT_NOTIFICATION`), only configuration
fields are editable — `message_body`, `short_message_body`, and
`email_html_template` are read-only.

**Periodic config** (for `PROACTIVE_LEARNER_NOTIFICATION`)

| Field | Type | Description |
|-------|------|-------------|
| `periodic_learner_scope` | string | `ACTIVE_LEARNERS` or `ALL_LEARNERS` |
| `periodic_report_period_days` | integer (1–365) | Report window |
| `periodic_frequency` | string | `DAILY`, `WEEKLY`, `MONTHLY`, `CUSTOM` |
| `periodic_custom_interval_days` | integer (1–365) | Interval for `CUSTOM` |
| `periodic_execution_time` | string | `HH:MM` format |
| `periodic_timezone` | string | Timezone name |
| `periodic_mentors` | array | Mentor configs |

**Policy config** (for `POLICY_ASSIGNMENT`)

| Field | Type | Description |
|-------|------|-------------|
| `policy_enabled_policies` | array | Per-role config |
| `policy_notify_on_assignment` | boolean | Notify on assignment |
| `policy_notify_on_removal` | boolean | Notify on removal |

**Human support** (for `HUMAN_SUPPORT_NOTIFICATION`)

| Field | Type | Description |
|-------|------|-------------|
| `human_support_recipient_mode` | string | Recipient mode |
| `human_support_custom_recipients` | array | Custom recipients |

```bash
curl -X PATCH "${dmUrl}/api/notification/v1/platforms/acme-learning/templates/USER_NOTIF_COURSE_ENROLLMENT/" \
  -H "Authorization: Token YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email_subject": "Welcome to {{ course_name }} on Acme Learning",
    "message_title": "Enrollment confirmed: {{ course_name }}"
  }'
```

#### `PATCH /platforms/{platform_key}/templates/{type}/toggle/`

Enable or disable a notification type. Does not modify template content.

**Request body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `allow_notification` | boolean | Yes | `true` to enable; `false` to disable |

**Response 200**
```json
{
  "type": "USER_NOTIF_COURSE_ENROLLMENT",
  "is_enabled": false,
  "platform": "acme-learning",
  "message": "Notification disabled successfully"
}
```

#### `POST /platforms/{platform_key}/templates/{type}/reset/`

Deletes the platform's customized template; the platform falls back to
the default. The toggle state (enabled/disabled) is not affected.

**Response 200**
```json
{
  "message": "Template reset to default. Platform will now use main template.",
  "deleted": true
}
```

If no override existed:
```json
{
  "message": "Template was already using default from main platform.",
  "deleted": false
}
```

#### `POST /platforms/{platform_key}/templates/{type}/test/`

Send a test email using the template. Sent to the requesting admin's
email address.

**Request body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `context` | object | No | Key-value pairs injected into the template; overrides defaults |

Default context (auto-injected): `username`, `site_name`, `course_name`,
`platform_key`.

**Response 200**
```json
{
  "success": true,
  "message": "Test notification sent successfully to admin@acme-learning.com",
  "recipient": "admin@acme-learning.com"
}
```

**Response 500** — delivery failure:
```json
{
  "success": false,
  "message": "Failed to send test notification. Check email configuration."
}
```

### 7.3 Push Notifications (FCM)

Real-time alerts via Firebase Cloud Messaging. Available when push is
enabled on the platform.

#### Register FCM device token

```
POST /api/notification/v1/orgs/{org}/users/{user_id}/register-fcm-token/
```

**Request body**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | string | Yes | — | Device or app name |
| `registration_id` | string | Yes | — | FCM device registration token |
| `active` | boolean | No | `true` | Whether this registration is active |
| `cloud_message_type` | string | No | `"FCM"` | `FCM` (recommended) or `GCM` (deprecated) |
| `application_id` | string | No | `"ibl_fcm_app"` | Application identifier |

```bash
curl -X POST \
  "${dmUrl}/api/notification/v1/orgs/acme-learning/users/john.doe/register-fcm-token/" \
  -H "Authorization: Token YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John iPhone 15",
    "registration_id": "eX3ampleFCMToken:APA91bHPRgkF..."
  }'
```

**Response 200**
```json
{ "success": true, "message": "Token created successfully" }
```

#### Remove FCM device token

```
DELETE /api/notification/v1/orgs/{org}/users/{user_id}/register-fcm-token/
```

**Request body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `registration_id` | string | Yes | Device registration token to remove |

### 7.4 SMTP Configuration

#### Test SMTP credentials

Opens a live SMTP connection and sends a test email to verify
credentials.

```
POST /api/notification/v1/platforms/{platform_key}/config/test-smtp/
```

**Auth:** Token, Platform Admin (`Ibl.Notifications/SMTP/action`)

**Request body**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `smtp_host` | string | Yes | — | SMTP server hostname |
| `smtp_port` | integer (1–65535) | Yes | — | SMTP server port |
| `smtp_username` | string | Yes | — | SMTP username |
| `smtp_password` | string | Yes | — | SMTP password (write-only) |
| `use_tls` | boolean | No | `true` | STARTTLS encryption |
| `use_ssl` | boolean | No | `false` | SSL/TLS on connect |
| `test_email` | email | Yes | — | Recipient for the test email |
| `from_email` | email | No | — | Sender (defaults to `smtp_username`) |

> `use_tls` and `use_ssl` are mutually exclusive. Use `use_tls: true`
> with port 587, or `use_ssl: true` with port 465. Never set both to
> `true`.

**Response 200**
```json
{
  "success": true,
  "status": "success",
  "message": "Test email sent successfully to verify@example.com. Please check your inbox to confirm delivery."
}
```

**Response 500 — auth failure**
```json
{
  "success": false,
  "status": "error",
  "message": "SMTP test failed: Authentication failed. Please check your username and password."
}
```

**Response 500 — connection failure**
```json
{
  "success": false,
  "status": "error",
  "message": "SMTP test failed: Connection failed. Please check your host and port settings."
}
```

### 7.5 Sending Direct Notifications (Builder)

Send notifications on demand to any combination of recipients. Pick a
template or write custom content, choose channels, define your audience,
preview, and send.

**Auth:** Token, Platform Admin or Department Admin

The flow is **always**: get context → validate sources → preview → send.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/orgs/{platform_key}/notification-builder/context/` | Get available templates, channels, source types |
| `POST` | `/orgs/{platform_key}/notification-builder/validate_source/` | Validate a recipient source |
| `POST` | `/orgs/{platform_key}/notification-builder/preview/` | Combine sources, deduplicate, create a build |
| `GET` | `/orgs/{platform_key}/notification-builder/{build_id}/recipients/` | Browse paginated recipients |
| `POST` | `/orgs/{platform_key}/notification-builder/send/` | Send to all recipients in a build |

#### 1. Get builder context

```
GET /api/notification/v1/orgs/{platform_key}/notification-builder/context/
```

**Response 200**
```json
{
  "status": "success",
  "data": {
    "templates": [
      { "id": "3fa85f64-...", "name": "Course Enrollment", "type": "USER_NOTIF_COURSE_ENROLLMENT" }
    ],
    "channels": [
      { "id": 1, "name": "email" },
      { "id": 2, "name": "push_notification" },
      { "id": 3, "name": "in_app" }
    ],
    "sources": ["email", "username", "platform", "csv", "department", "pathway", "program", "usergroup"]
  }
}
```

#### Recipient source types

When you provide multiple sources in a preview, recipients are merged
and deduplicated.

| Source | `data` value | Description |
|--------|--------------|-------------|
| `email` | Comma-separated email addresses | Direct email list. Validated against Django email rules. |
| `username` | Comma-separated usernames | Platform usernames. Validated against your user records. |
| `platform` | Platform key (string) | All users on a platform. |
| `csv` | Uploaded file (multipart) | CSV file with an `email` column header. |
| `department` | Department ID (integer) | All active members of a department. |
| `pathway` | Pathway ID (string) | All suggested members of a pathway. |
| `program` | Program ID (string) | All suggested members of a program. |
| `usergroup` | User Group ID (integer) | All active members of a user group. |

#### 2. Validate a source

```
POST /api/notification/v1/orgs/{platform_key}/notification-builder/validate_source/
```

**Request body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | One of the source types above |
| `data` | string | Yes (except CSV) | The source value (emails, usernames, IDs, etc.) |

For CSV sources, send as multipart form data with the file in a `file_0`
field.

**Response 200**
```json
{
  "status": "success",
  "valid_count": 2,
  "invalid_entries": ["invalid-address"],
  "sample_recipients": [
    { "username": "jane.doe", "email": "jane@example.com" },
    { "username": "john.smith", "email": "john@example.com" }
  ]
}
```

#### 3. Preview

```
POST /api/notification/v1/orgs/{platform_key}/notification-builder/preview/
```

Combines sources, deduplicates, and creates a build record. Returns a
`build_id` you use to browse recipients and to send.

**Request body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `template_id` | UUID | No | ID of an existing template. Mutually exclusive with `template_data`. |
| `template_data` | object | No | Custom content: `{"message_title": "...", "message_body": "..."}`. Mutually exclusive with `template_id`. |
| `channels` | array of integers | Yes | Channel IDs from the context endpoint |
| `sources` | array of objects | Yes | Each object: `{"type": "...", "data": "..."}` |
| `context` | object | No | Custom template variables (e.g. `{"course_name": "Python 101"}`) |
| `process_on` | ISO 8601 datetime | No | Schedule send for a future time. If omitted, sends immediately on `/send`. |

You must provide either `template_id` or `template_data`, not both.
`template_data.message_body` supports template syntax (`{{ variable }}`).

**Response 200**
```json
{
  "status": "success",
  "build_id": "9c1a2b3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d",
  "count": 48,
  "warning": null,
  "recipients": [
    { "username": "jane.doe", "email": "jane@example.com", "status": "pending" }
  ]
}
```

| Field | Description |
|-------|-------------|
| `build_id` | Use this in `/recipients` and `/send` |
| `count` | Total deduplicated recipients |
| `warning` | If a similar notification was sent in the last 24 hours, this describes it |
| `recipients` | First 10 recipients as a preview |

#### 4. Browse recipients (paginated)

```
GET /api/notification/v1/orgs/{platform_key}/notification-builder/{build_id}/recipients/
```

**Query parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `search` | string | No | Filter by username or email (case-insensitive) |
| `page` | integer | No | Page number (default: 1) |
| `page_size` | integer | No | Results per page (default: 10) |

#### 5. Send

```
POST /api/notification/v1/orgs/{platform_key}/notification-builder/send/
```

If `process_on` was set during preview and is in the future, the
notification is queued for scheduled delivery.

**Request body**
```json
{ "build_id": "9c1a2b3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d" }
```

**Response 200**
```json
{
  "status": "success",
  "notifications_sent": 48,
  "build_id": "9c1a2b3d-...",
  "message": "Notifications sent"
}
```

| Message | Meaning |
|---------|---------|
| `"Notifications sent"` | Delivered immediately |
| `"Notifications queued"` | Scheduled for future delivery (`process_on` is in the future) |
| `"Similar notifications found"` | A matching notification was already sent in the last 24 hours |

#### Duplicate detection

The system generates a SHA-256 hash from the combination of recipients,
template, and channels. If an identical notification was sent in the
last 24 hours, the preview response includes a `warning` and the send
response returns `"Similar notifications found"` instead of sending
again.

#### Build status lifecycle

`draft → previewed → sending|queued → completed|failed`

## 8. Template System

### 8.1 How templates work

Every notification type ships with a default template. A platform does
not have its own template record for a type until it customizes one.
Until that point, reads return the default with `"is_inherited": true`.

The system creates the platform copy the first time the template is
edited via `PATCH`. The default's content and channel settings are
copied into a new record for the platform, then your edits are applied.
Subsequent `PATCH` requests update the copy directly.

**Toggle state** (enabled/disabled) is a separate record from the
template content. Enabling/disabling does not affect the template, and
resetting does not affect the toggle.

**Reset** deletes the customized template. The platform reverts to
inheriting the default (`"is_inherited": true`).

### 8.2 Template variables

Templates use Django template syntax. The rendering pipeline auto-loads
the `notification_template_tags` library, so its tags are available
without explicit `{% load %}`.

#### Global variables (every template)

| Variable | Description |
|---|---|
| `site_name` | Platform name |
| `site_url` | Platform URL |
| `site_logo_url` | Platform logo URL |
| `platform_name` | Platform name (capitalized) |
| `support_email` | Platform support email |
| `privacy_url` | Privacy policy URL |
| `terms_url` | Terms of use URL |
| `logo_url` | Platform logo URL |
| `current_year` | Current year |
| `base_domain` | Base domain of the platform |
| `skills_url` | Skills platform URL |
| `unsubscribe_url` | Campaign unsubscribe URL |

#### Common user variables

| Variable | Description |
|---|---|
| `username` | Recipient's username |
| `login_url` | Login or redirect URL |
| `login_path` | Path portion of the login URL |

#### By notification type

**Registration**

| Type | Variable | Description |
|---|---|---|
| `APP_REGISTRATION` | `app_name` | Application name |
| `APP_REGISTRATION` | `welcome_message` | Welcome message text |
| `APP_REGISTRATION` | `benefits` | List of benefit strings |
| `APP_REGISTRATION` | `closing_message` | Closing message text |
| `USER_NOTIF_USER_REGISTRATION` | `welcome_message` | Welcome message |
| `USER_NOTIF_USER_REGISTRATION` | `next_steps` | Next-step instructions |

**Course**

| Type | Variable | Description |
|---|---|---|
| `USER_NOTIF_COURSE_ENROLLMENT` | `course_name` | Course name |
| `ADMIN_NOTIF_COURSE_ENROLLMENT` | `course_name` | Course name |
| `ADMIN_NOTIF_COURSE_ENROLLMENT` | `student_name` | Enrolled student's name |
| `ADMIN_NOTIF_COURSE_ENROLLMENT` | `student_email` | Enrolled student's email |
| `USER_NOTIF_COURSE_COMPLETION` | `course_name` | Course name |
| `USER_NOTIF_COURSE_COMPLETION` | `completion_date` | Date of completion |
| `USER_NOTIF_COURSE_COMPLETION` | `certificate_url` | Certificate URL |
| `USER_NOTIF_USER_INACTIVITY` | `days_inactive` | Days inactive |
| `USER_NOTIF_USER_INACTIVITY` | `last_activity_date` | Last activity date |

**Learner progress**

| Type | Variable | Description |
|---|---|---|
| `USER_NOTIF_LEARNER_PROGRESS` | `courses_taken` | List of courses |
| `USER_NOTIF_LEARNER_PROGRESS` | `videos_watched_count` | Videos watched |
| `USER_NOTIF_LEARNER_PROGRESS` | `total_time_spent` | Total time spent (hours) |
| `USER_NOTIF_LEARNER_PROGRESS` | `credentials` | Credentials earned |

**Credentials**

| Type | Variable | Description |
|---|---|---|
| `USER_NOTIF_CREDENTIALS` | `item_name` | Course or program name |
| `USER_NOTIF_CREDENTIALS` | `credential_url` | Full credential URL |
| `USER_NOTIF_CREDENTIALS` | `credential_path` | Credential path |

**Invitations**

| Type | Variable | Description |
|---|---|---|
| `PLATFORM_INVITATION` | `redirect_to` | Redirect destination after signup |
| `COURSE_INVITATION` | `course_name` | Course name |
| `PROGRAM_INVITATION` | `program_name` | Program name |

**Licenses**

| Type | Variable | Description |
|---|---|---|
| `COURSE_LICENSE_ASSIGNMENT` | `course_name` | Course name |
| `PROGRAM_LICENSE_ASSIGNMENT` | `program_name` | Program name |
| `USER_LICENSE_ASSIGNMENT` | `welcome_message` | Welcome text |
| `USER_LICENSE_ASSIGNMENT` | `benefits` | Benefit list |
| `USER_LICENSE_ASSIGNMENT` | `closing_message` | Closing text |

**Role and policy**

| Type | Variable | Description |
|---|---|---|
| `ROLE_CHANGE` | `role` | New role name |
| `ROLE_CHANGE` | `demoted` | `True` if user was demoted |
| `POLICY_ASSIGNMENT` | `role_name` | Role being assigned/removed |
| `POLICY_ASSIGNMENT` | `assigned` | `True` if assigned, `False` if removed |
| `POLICY_ASSIGNMENT` | `resources` | List of affected resources |

**Human support**

| Type | Variable | Description |
|---|---|---|
| `HUMAN_SUPPORT_NOTIFICATION` | `ticket_subject` | Ticket subject |
| `HUMAN_SUPPORT_NOTIFICATION` | `ticket_description` | Ticket description |
| `HUMAN_SUPPORT_NOTIFICATION` | `ticket_status` | Ticket status |
| `HUMAN_SUPPORT_NOTIFICATION` | `user_name` | User who created the ticket |
| `HUMAN_SUPPORT_NOTIFICATION` | `user_email` | User's email |
| `HUMAN_SUPPORT_NOTIFICATION` | `mentor_name` | Mentor name |
| `HUMAN_SUPPORT_NOTIFICATION` | `platform_key` | Platform identifier |
| `HUMAN_SUPPORT_NOTIFICATION` | `session_id` | Chat session UUID |
| `HUMAN_SUPPORT_NOTIFICATION` | `chat_link` | URL to chat transcript |
| `HUMAN_SUPPORT_NOTIFICATION` | `mentor_unique_id` | Unique identifier of the mentor |
| `HUMAN_SUPPORT_NOTIFICATION` | `template_content` | Optional custom content (rendered if provided) |

**AI / proactive learner**

| Type | Variable | Description |
|---|---|---|
| `PROACTIVE_LEARNER_NOTIFICATION` | `student_name` | Learner's display name |
| `PROACTIVE_LEARNER_NOTIFICATION` | `student_email` | Learner's email |
| `PROACTIVE_LEARNER_NOTIFICATION` | `mentor_name` | Mentor name |
| `PROACTIVE_LEARNER_NOTIFICATION` | `ai_recommendation` | AI-generated recommendation text |
| `PROACTIVE_LEARNER_NOTIFICATION` | `username` | Learner's username |
| `PROACTIVE_LEARNER_NOTIFICATION` | `platform_key` | Platform identifier |
| `PROACTIVE_LEARNER_NOTIFICATION` | `mentor_unique_id` | Unique identifier of the mentor |

**Report**

| Type | Variable | Description |
|---|---|---|
| `REPORT_COMPLETED` | `report_name` | Report display name |
| `REPORT_COMPLETED` | `report_status` | `completed`, `error`, or `cancelled` |
| `REPORT_COMPLETED` | `download_url` | Download URL (completed reports only) |

#### Template syntax

```django
{# Variable interpolation #}
Hello {{ username }}, you have been enrolled in {{ course_name }}.

{# Conditionals #}
{% if demoted %}
Your role has been removed.
{% else %}
You have been granted the {{ role }} role.
{% endif %}

{# Iterating lists #}
{% for benefit in benefits %}
- {{ benefit }}
{% endfor %}
```

### 8.3 Customizing templates

Customize any editable template via `PATCH`. The first PATCH creates
the platform's own copy of the default; subsequent requests update that
copy.

For system-managed types (`PROACTIVE_LEARNER_NOTIFICATION`,
`POLICY_ASSIGNMENT`, `HUMAN_SUPPORT_NOTIFICATION`), only configuration
fields are editable — `message_body`, `short_message_body`, and
`email_html_template` are read-only.

#### HTML sanitization

`email_html_template` is sanitized with `bleach` before rendering.

**Allowed tags:** `a`, `abbr`, `b`, `blockquote`, `br`, `code`, `div`,
`em`, `h1`–`h6`, `hr`, `i`, `img`, `li`, `ol`, `p`, `pre`, `span`,
`strong`, `sub`, `sup`, `table`, `tbody`, `td`, `th`, `thead`, `tr`,
`u`, `ul`, `main`, `footer`

**Allowed attributes:**
- All elements: `style`, `class`, `id`
- `<a>`: `href`, `title`, `target`
- `<img>`: `src`, `alt`, `width`, `height`
- `<td>`, `<th>`: `colspan`, `rowspan`, `align`, `valign`

**Allowed URL protocols:** `http`, `https`, `mailto`

`<script>`, `<iframe>`, `<form>`, `<object>`, event handler attributes
(`onclick`, `onload`), and `javascript:` URLs are stripped.

#### Common validation errors

| Error | Cause |
|---|---|
| `"Template syntax error: ..."` | Invalid Django template syntax (e.g. unclosed `{% if %}`) |
| `"Unauthorized template tag library(ies) loaded: 'X'..."` | `{% load X %}` references a disallowed library |
| `"Permission denied: ..."` | Missing `Ibl.Notifications/NotificationTemplate/write` permission |

### 8.4 Testing templates

Send a test email to verify rendering and delivery. The email goes to
the requesting admin's address.

```
POST /api/notification/v1/platforms/{platform_key}/templates/{type}/test/
```

`context` is optional. If omitted, defaults are injected: `username`,
`site_name`, `course_name`, `platform_key`. Any keys you supply override
these defaults.

### 8.5 Resetting to default

```
POST /api/notification/v1/platforms/{platform_key}/templates/{type}/reset/
```

Removes the platform's customized template. Reverts immediately to the
default. The toggle state is preserved.

## 9. Special Notification Types

Three notification types have specialized behavior and configuration
that differs from standard event-driven notifications. Each is
controlled through the `metadata` field of the relevant
`NotificationTemplate`.

### 9.1 Human Support Notifications

Alerts designated recipients when a learner opens a human support
ticket from an AI mentor session. The notification delivers ticket
details and a direct link to the chat transcript.

**Requires:** AI features enabled. If not available, the callback exits
without sending.

**Trigger:** Automatic when a human support ticket is created with
`status == "open"`.

#### Configuration (via template `PATCH`)

```json
{
  "human_support_recipient_mode": "platform_admins_and_mentor_owner",
  "human_support_custom_recipients": []
}
```

| `recipient_mode` | Recipients |
|---|---|
| `platform_admins_and_mentor_owner` (default) | Active platform admins + mentor's creator |
| `platform_admins_only` | Active platform admins only |
| `mentor_owner_only` | The mentor's creator only |
| `custom` | Resolved from `custom_recipients` |

`custom_recipients` (required when mode is `custom`):

| `type` | Required fields | Resolution |
|---|---|---|
| `"user"` | `"id"` (integer) | User included if they have an active link for the platform |
| `"user_group"` | `"id"` (integer) | All active members of the user group |
| `"rbac_policy"` | `"policy_name"` (string) | All users assigned to the policy (direct + via groups) |

```json
[
  { "type": "user", "id": 42 },
  { "type": "user_group", "id": 7 },
  { "type": "rbac_policy", "policy_name": "Support Staff" }
]
```

Invalid entries are silently dropped during resolution.

### 9.2 Policy Assignment Notifications

Notifies a user when an RBAC role (policy) is assigned to or removed
from their account. Sent to the affected user.

**Requires:** RBAC enabled. If the template is disabled or absent, the
callback exits without sending.

**Trigger:** Automatic on policy assignment or removal.

#### Configuration

```json
{
  "policy_notify_on_assignment": true,
  "policy_notify_on_removal": true,
  "policy_enabled_policies": []
}
```

`enabled_policies` (per-role config):

| Field | Type | Description |
|---|---|---|
| `role_name` | string | Must match the policy role name exactly |
| `enabled` | boolean | `false` suppresses all notifications for this role |
| `notify_on_assignment` | boolean | Per-role override |
| `notify_on_removal` | boolean | Per-role override |
| `subject` | string | Custom email subject (template variables allowed) |

When `enabled_policies` is empty, the global flags apply to all roles.
When non-empty, only listed roles can trigger notifications.

```json
{
  "policy_enabled_policies": [
    {
      "role_name": "Analytics Viewer",
      "enabled": true,
      "notify_on_assignment": true,
      "notify_on_removal": false,
      "subject": "You have been granted Analytics Viewer access"
    },
    { "role_name": "Mentor Chat", "enabled": true }
  ]
}
```

### 9.3 Proactive Learner Notifications (AI-Powered)

Delivers AI-generated, personalized learning recommendations to learners
on a recurring schedule. For each configured mentor, the system
retrieves a recommendation specific to the learner and sends it by
email.

**Requires:** AI features enabled. If not available, the system records
a failed execution and exits.

**Trigger:** Scheduled. Evaluated at the configured `execution_time` and
`frequency`.

#### Configuration

| Field | Type | Default | Valid values |
|---|---|---|---|
| `frequency` | string | `"WEEKLY"` | `"DAILY"`, `"WEEKLY"`, `"MONTHLY"`, `"CUSTOM"` |
| `report_period_days` | integer | `7` | 1–365 |
| `execution_time` | string | `"09:00"` | `HH:MM` (24-hour) |
| `timezone` | string | `"UTC"` | Standard timezone names |
| `learner_scope` | string | `"ACTIVE_LEARNERS"` | `"ACTIVE_LEARNERS"`, `"ALL_LEARNERS"` |
| `mentors` | array | `[]` | Mentor config objects |
| `custom_interval_days` | integer | `7` | 1–365 (used when frequency is `CUSTOM`) |
| `is_active` | boolean | `false` | — |

| Frequency | Interval |
|---|---|
| `DAILY` | 1 day |
| `WEEKLY` | 7 days |
| `MONTHLY` | 30 days |
| `CUSTOM` | `custom_interval_days` |

**Learner scope:**
- `ACTIVE_LEARNERS` — learners with activity within `report_period_days`
- `ALL_LEARNERS` — all users linked to the platform

#### Mentor configuration

```json
{
  "mentors": [
    {
      "unique_id": "550e8400-e29b-41d4-a716-446655440000",
      "prompt": "Summarize {{student_name}}'s recent learning and suggest next steps.",
      "name": "Study Coach"
    }
  ]
}
```

| Field | Required | Description |
|---|---|---|
| `unique_id` | Yes | UUID of the mentor |
| `prompt` | No | Custom prompt template (`student_name`, `student_email`, `username`, `platform_key`) |
| `name` | No | Display name (enriched from mentor record if omitted) |

If `mentors` is empty, all mentors for the platform are used.

#### Duplicate prevention

Before sending, the system hashes the full context dictionary
(including `ai_recommendation`). If a notification already exists for
the student and template with an identical hash, it is skipped.
Different recommendations for the same learner are both delivered; only
exact duplicates are suppressed.

#### Execution history

After each run, `periodic_config` is updated with:
- `last_execution_date` — timestamp of the completed run
- `next_execution_date` — `last_execution_date + interval`
- `execution_history` — rolling log of the last 10 runs with
  `timestamp`, `success`, `students_processed`, `platform_key`

## 10. Notification Preferences

Each notification type can be independently enabled or disabled per
platform. When disabled, no notifications of that type are sent to any
user on the platform.

```
PATCH /api/notification/v1/platforms/{platform_key}/templates/{type}/toggle/
```

```json
{ "allow_notification": true }
```

The platform toggle is the first gate: if it is off, the notification
is never sent regardless of templates or channels.

## 11. Platform SMTP Configuration

SMTP credentials control how email notifications are delivered.

Required values:
- SMTP host (mail server hostname)
- SMTP port (commonly 587 for TLS, 465 for SSL)
- SMTP username
- SMTP password
- TLS/SSL mode (mutually exclusive; TLS recommended)
- From email address

Verify credentials via `POST /platforms/{platform_key}/config/test-smtp/`
(see §7.4) before activating them.

## 12. Notification Lifecycle

Notifications have two independent state machines: delivery status and
user interaction status.

### Delivery status

| Status | Meaning |
|---|---|
| `INITIATED` | Mail delivery process started |
| `NONE` | No email delivery attempted (push-only or in-app) |
| `FAILED` | Email delivery encountered an error |

### Notification status (user-facing)

| Status | Meaning |
|---|---|
| `UNREAD` | Delivered but not yet read (default) |
| `READ` | Viewed or explicitly marked as read |
| `CANCELLED` | Dismissed or revoked |

## 13. Error Reference

| HTTP Status | Error | Cause | Resolution |
|---|---|---|---|
| 401 | Unauthorized | Missing or invalid token | Provide a valid `Authorization: Token <token>` |
| 403 | Permission Denied | Insufficient permissions | Verify the token belongs to a user with the required role or RBAC permission |
| 404 | Not Found | Resource does not exist | Check `org`, `user_id`, `notification_id`, or template `type` in the URL |
| 400 | Bad Request | Malformed request body | Verify required fields and data types |

## 14. Rate Limits and Best Practices

- Use the bulk update endpoint instead of updating notifications one at
  a time.
- Check the unread count endpoint before fetching the full list. If
  count is zero, skip the list request.
- Always paginate notification list requests. Use `page` and iterate.
- Test template changes using the test endpoint before enabling for all
  users.
- Disable notification types your platform does not use.
- Store API tokens in environment variables, not in source code or
  version control.
- When configuring SMTP, use `use_tls: true` with port 587. Only use
  `use_ssl: true` with port 465 if required. Never set both to `true`.
- Test SMTP credentials against a dedicated inbox before updating
  production configuration.
