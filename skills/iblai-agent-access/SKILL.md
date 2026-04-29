---
name: iblai-agent-access
description: Add the agent Access tab (role-based access control for editor and chat roles) to your Next.js app
globs:
alwaysApply: false
---

# /iblai-agent-access

Add the agent **Access tab** -- role-based access management for agents.
Lets admins assign **editor** and **chat** roles, add/remove users and
groups per role, and view existing access policies in a table. This is one
tab in the wider agent-settings family (`access`, `api`, `datasets`,
`disclaimers`, `embed`, `history`, `llm`, `memory`, `prompts`, `safety`,
`settings`, `tools`). All tabs share the same `AgentSettingsProvider`
wrapper.

![Access Tab](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/iblai-agent-access/iblai-agent-access.png)

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
- Follow [BRAND.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/BRAND.md) for
  colors, typography, spacing, and component styles.

You MUST run `/iblai-ops-test` before telling the user the work is ready.

After all work is complete, start a dev server (`pnpm dev`) so the user
can see the result at http://localhost:3000.

`iblai.env` is NOT a `.env.local` replacement — it only holds the 3
shorthand variables (`DOMAIN`, `PLATFORM`, `TOKEN`). Next.js still reads
its runtime env vars from `.env.local`.

Use `pnpm` as the default package manager. Fall back to `npm` if pnpm
is not installed.

> **Common setup (brand, conventions, env files, verification):** see [docs/skill-setup.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/docs/skill-setup.md).

## Prerequisites

- Auth must be set up first (`/iblai-auth`)
- MCP and skills must be set up: `iblai add mcp`
- `AgentSettingsProvider` must wrap the route (see `/iblai-agent-setting`
  Step 2 if not already set up)
- Ask the user for a real `mentorId` (agent UUID). Do NOT invent one.

## Step 0: Check for CLI Updates

Before running any `iblai` command, ensure the CLI is up to date.
Run `iblai --version` to check the current version, then upgrade directly:
- pip: `pip install --upgrade iblai-app-cli`
- npm: `npm install -g @iblai/cli@latest`

This is safe to run even if already at the latest version.

## Step 1: Check Environment

Before proceeding, check for an `iblai.env` in the project root. Look for
`PLATFORM`, `DOMAIN`, and `TOKEN` variables. If the file does not exist or
is missing these variables, tell the user:
"You need an `iblai.env` with your platform configuration. Download the
template and fill in your values:
`curl -o iblai.env https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/iblai.env`"

## Step 2: Mount `AgentAccessTab`

The `AgentSettingsProvider` layout from `/iblai-agent-setting` Step 2 must
already wrap this route. The provider supplies `tenantKey`, `mentorId`,
`username`, and `enableRBAC` via context.

```tsx
// app/(app)/agents/[mentorId]/access/page.tsx
"use client";

import { AgentAccessTab } from "@iblai/iblai-js/web-containers/next";

export default function AgentAccessPage() {
  return (
    <div className="flex h-full flex-col bg-white">
      <AgentAccessTab />
    </div>
  );
}
```

## Step 3: Customize Labels (Optional)

`AgentAccessTab` renders with the default agent-facing copy
(`AGENT_ACCESS_TAB_LABELS`). Override any string via the `labels` prop:

```tsx
import {
  AgentAccessTab,
  AGENT_ACCESS_TAB_LABELS,
} from "@iblai/iblai-js/web-containers/next";

<AgentAccessTab
  labels={{
    header: { title: "Mentor access", description: "Manage who can edit or chat with this mentor." },
    table: { columns: { role: "Permission level" } },
  }}
/>;
```

## Step 4: Use MCP Tools for Customization

```
get_component_info("AgentAccessTab")
get_component_info("AgentSettingsProvider")
```

## `<AgentAccessTab>` Props

Import from `@iblai/iblai-js/web-containers/next`.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `labels` | `DeepPartial<AccessTabLabels>` | No | Override user-visible strings (header, table columns, empty states, dialogs) |
| `onPermissionsLoaded` | `(permissions: object) => void` | No | Fired when RBAC permissions for `/users/` and `/groups/` are fetched on mount |

## Related Exports

From `@iblai/iblai-js/web-containers/next`:

- `AGENT_ACCESS_TAB_LABELS` -- the default agent-facing label bundle.
- `AccessTabLabels` -- type for the full label bundle (header, table,
  empty states, edit dialog, create dialog, role descriptions).

## Step 5: Verify

Run `/iblai-ops-test` before telling the user the work is ready:

1. `pnpm build` -- must pass with zero errors
2. `pnpm test` -- vitest must pass
3. Start dev server and touch test:
   ```bash
   pnpm dev &
   npx playwright screenshot http://localhost:3000/agents/<id>/access /tmp/agent-access.png
   ```

## Important Notes

- **Redux store**: Must include `mentorReducer` and `mentorMiddleware`
- **`initializeDataLayer()`**: 5 args (v1.2+)
- **`@reduxjs/toolkit`**: Deduplicated via webpack aliases in `next.config.ts`
- **Peer deps**: `sonner` and `@iblai/iblai-web-mentor` must be installed
  (`pnpm add sonner @iblai/iblai-web-mentor`)
- **Shared provider**: `AgentSettingsProvider` must wrap the route at a
  layout level. See `/iblai-agent-setting` Step 2 for the full snippet.
- **RBAC**: The tab checks `enableRBAC` from the provider and
  `rbacPermissions` to gate add/edit actions. If `enableRBAC` is `false`
  (the default), all actions are permitted.
- **Default roles**: `editor` and `chat`. These come from
  `DEFAULT_MENTOR_ROLES` in the package and are not configurable via props.
- **Brand guidelines**: [BRAND.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/BRAND.md)

## RBAC REST API

For custom UI beyond `<AgentAccessTab>`. All endpoints are prefixed with
`${dmUrl}/api/core/` where `dmUrl` is `NEXT_PUBLIC_API_BASE_URL`. RBAC state
is scoped per platform — pass `platform_key={key}` on every request.

### Concepts

- **Resource paths** are hierarchical, rooted at a platform: a policy on
  `/platforms/1/mentors/5/` also applies to `/platforms/1/mentors/5/documents/`.
- **Actions** look like `Ibl.Mentor/Mentors/read`, `Ibl.Mentor/Chat/action`,
  `Ibl.*` (wildcard).
- **Data actions** gate field-level access:
  `Ibl.Mentor/Settings/display_name/read`. Unreadable fields return empty
  values; unwritable fields return 403.
- **Policies** bind a Role to Resources for Users and/or Groups. Permissions
  are additive across all matching policies. Owner well-known roles
  (`mentor-owner`, `document-owner`, etc.) are applied automatically when
  the requesting user owns the resource.

### Roles CRUD — `Ibl.Core/Roles/...`

| Method | Path | Action |
|---|---|---|
| GET | `rbac/roles/?platform_key={key}` | `list` |
| POST | `rbac/roles/` | `action` |
| GET | `rbac/roles/{id}/?platform_key={key}` | `read` |
| PUT/PATCH | `rbac/roles/{id}/` | `write` |
| DELETE | `rbac/roles/{id}/?platform_key={key}` | `delete` |

List params: `platform_key` (required), `include_global_roles` (default `true`),
`name`. Body: `{ name, platform_key, actions[], data_actions[] }`.

### Policies CRUD — `Ibl.Core/Policies/...`

| Method | Path | Action |
|---|---|---|
| GET | `rbac/policies/?platform_key={key}` | `list` |
| POST | `rbac/policies/` | `action` |
| GET | `rbac/policies/{id}/?platform_key={key}` | `read` |
| PUT/PATCH | `rbac/policies/{id}/` | `write` |
| DELETE | `rbac/policies/{id}/?platform_key={key}` | `delete` |

List params: `platform_key`, `role_id`, `name`, `username`, `email`, `group`,
`include_users`, `include_groups`. Body: `{ platform_key, name, role_id,
resources[], user_ids[], group_ids[] }`. Resources must start with
`/platforms/` and end with `/`.

### Groups CRUD — `Ibl.Core/Groups/...`

| Method | Path | Action |
|---|---|---|
| GET | `rbac/groups/?platform_key={key}` | `list` |
| POST | `rbac/groups/` | `action` |
| GET | `rbac/groups/{id}/?platform_key={key}` | `read` |
| PUT/PATCH | `rbac/groups/{id}/` | `write` |
| DELETE | `rbac/groups/{id}/?platform_key={key}` | `delete` |

List params: `platform_key`, `owner`, `name`, `username`, `email`,
`include_users`. Body: `{ platform_key, name, unique_id, description, user_ids[] }`.

### Permission check (any authenticated user)

```
POST rbac/permissions/check/
{ "platform_key": "...", "resources": ["/mentors/", "/mentors/42/", "/usergroups/"] }
```

Returns a map of resource → `{ list/create/read/write/delete/chat/... }`.
Accounts for owner roles automatically. Use this to gate UI actions.

### Mentor access — `Ibl.Mentor/ShareMentor/...`

| Method | Path | Action |
|---|---|---|
| POST | `rbac/mentor-access/` | `action` |
| GET | `rbac/mentor-access/?platform_key={key}&mentor_id={id}` | `read` |

Body: `{ platform_key, mentor_id, role, users_to_add[], users_to_remove[],
groups_to_add[], groups_to_remove[] }`. Roles: `chat | viewer | editor`.
Substitute `usernames_to_add` / `emails_to_add` if you don't have user IDs.

### Team (UserGroup) sharing — `Ibl.Core/ShareUserGroups/...`

| Method | Path | Action |
|---|---|---|
| POST | `rbac/teams/access/` | `action` |
| GET | `rbac/teams/access/?platform_key={key}&usergroup_id={id}` | `read` |

Body: `{ platform_key, usergroup_id, role, users_to_add[], ... }`. Roles:
`read | edit | view analytics | send notifications`.

### User policy bulk update — `Ibl.Core/UserPolicies/write`

```
PUT platform/users/policies/
[{ "user_id": 101, "platform_key": "...",
   "policies_to_add": [...], "policies_to_remove": [...], "policies_to_set": [...] }]
```

Only platform-assignable policies are allowed. `policies_to_set` replaces;
removals run before additions.

### Platform admin toggles (no extra RBAC action)

| Path | Body |
|---|---|
| `POST rbac/student-mentor-creation/set/` | `{ platform_key, allow_students_to_create_mentors }` |
| `GET rbac/student-mentor-creation/status/?platform_key={key}` | – |
| `POST rbac/student-llm-access/set/` | `{ platform_key, llm_resources: ["llms/openai/models/gpt-4o", ...] }` |
| `GET rbac/student-llm-access/status/?platform_key={key}` | – |

### Response permission metadata

Resource responses include a `permissions` object the UI can use to gate
controls:

```json
"permissions": {
  "field": { "display_name": { "read": true, "write": true } },
  "object": { "delete": false, "write": true }
}
```

Unreadable fields are masked (`""`, `[]`, or `{}`) and `read: false`.

### Resource operations

| Resource | Collection ops | Instance ops |
|---|---|---|
| `mentors` | list, create, chat, web_search, attach_document, voice_record, voice_call, export_chat_history, view_chat_history, view_analytics, view_prompts, share, sell_mentor | read, write, delete + above + show_settings, share_mentor, read_shared_mentor, can_use_embed, view_moderation_logs, view_safety_logs, view_disclaimers |
| `prompts`, `documents`, `tools`, `settings`, `llms`, `mcpservers` | list, create | read, write, delete |
| `usergroups` | list, create | read, write, delete, share_usergroup, read_shared_usergroup |
| `users` | list, write | – |
| `groups`, `policies`, `roles` | list, create | read, write, delete |
| `platforms` | – | can_send_notifications, can_view_analytics, can_manage_users, can_invite |

### Built-in roles

Tenant Admin · Students · Mentor Viewer · Mentor Editor · Mentor Chat ·
Student Mentor Creators · Analytics Viewer · Notification Manager ·
Enrollment Manager · LLM Users · LLM Model Access · List Users · List Teams ·
Create Teams · Read Team · Edit Team · Billing Manager.
