---
name: iblai-vibe-agent-skills
description: Add the agent Skills tab (AgentSkillsTab — reusable Agent Skills attached per agent, the organization's skill catalog, New/Edit skill dialogs with file resources, and the chat `/` skill picker) to your Next.js app. Use when the user mentions agent skills, playbooks, 'attach a skill to my agent', skill resources, or the `/` skill picker in chat. For the REST contract see /iblai-api-agent-skill; for sandboxes see /iblai-vibe-agent-sandbox.
globs:
alwaysApply: false
metadata:
  kind: ui
---

# /iblai-vibe-agent-skills

Add the agent **Skills tab** (`AgentSkillsTab`) -- reusable playbooks a Base
Agent can discover and follow. An Agent Skill is a written instruction bundle
(plus optional reference files) for one job, like summarizing a meeting or
searching the web. The agent reads a skill only when it is relevant, so it can
carry many without bloating every conversation. **Scope:** skills are defined
**per organization** (or private to one agent); the tab manages which of them
are attached to **this agent**. It has two sub-tabs, **Agent Skills** and
**Available Skills**, a **New Skill** button, and Edit dialogs with a
**Resources** file manager. Users invoke a skill from the chat composer with
`/` (Step 4). Skills need no sandbox.

**Agent Skills** -- the skills attached to this agent, each with its `/slug`,
an on/off switch (the assignment's `enabled`), and **Remove**.

![Skills -- Agent Skills](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-vibe-agent-skills/iblai-vibe-agent-skills-1-agent-skills.png)

**Available Skills** -- the organization's catalog, paged 10 at a time:
name, version, category and **Only This Agent** badges, description, and
**Add** (or a green **Added** chip once attached).

![Skills -- Available Skills](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-vibe-agent-skills/iblai-vibe-agent-skills-2-available.png)

**Row actions** -- each catalog row has a switch (the skill's own
`enabled`) and a menu with **Edit** and **Delete**, shown only for skills the
organization owns.

![Skills -- row actions](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-vibe-agent-skills/iblai-vibe-agent-skills-3-actions.png)

**New Skill** -- **Only This Agent**, Name, Slug, Version, Category,
Description, and Instruction (a rich-text playbook).

![Skills -- New Skill dialog](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-vibe-agent-skills/iblai-vibe-agent-skills-4-new-skill.png)

**Edit Skill -> Resources** -- files the agent can use with the skill:
`reference` and `script` (text) or `asset` (upload), each with a menu.

![Skills -- Edit Skill, Resources](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-vibe-agent-skills/iblai-vibe-agent-skills-5-edit-resources.png)

> **Common setup (brand, conventions, env files, verification):** see [docs/skill-setup.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/docs/skill-setup.md).

## Prerequisites

- Auth set up (`/iblai-vibe-auth`, or vibe-starter).
- `AgentSettingsProvider` wraps the route (`/iblai-vibe-agent` §1).
- `@iblai/iblai-js` ≥ 2.26 (resolves `@iblai/web-containers` 1.32).
- A real agent UUID. Ask the user; never invent one.
- The signed-in user is an organization admin (or holds the agent's
  skill-assignment roles). The tab renders nothing for `userIsStudent`.
- Agent Skills apply to **Base Agent** agents only (template slug
  `base-agent`, or the legacy `ai-mentor` / `ai-agent`). For another agent
  type the tab shows "Skills are only available to Base Agents."

## Step 1: Check Environment

Look for `iblai.env` in the project root with `PLATFORM`, `DOMAIN`, and
`TOKEN`. If it is missing, tell the user:
"You need an `iblai.env` with your platform configuration. Download the
template and fill in your values:
`curl -o iblai.env https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/iblai.env`"

## Step 2: Mount `AgentSkillsTab` and load its permissions

`AgentSkillsTab` resolves the agent from `AgentSettingsProvider`, then gates
every read and write on the agent's RBAC grants **in the Redux store**
(`state.rbac`, key `/mentors/{mentorDbId}/`): `view_skill_assignments`
(the list), `create_skill_assignment` (Available Skills, **Add**, New Skill),
`write_skill_assignment` (the switch), `delete_skill_assignment`
(**Remove**). Nothing fills that store for you -- without the grants the tab
shows only "No skills enabled for this agent yet." Load them once per agent:

```tsx
// app/(app)/agents/[mentorId]/skills/page.tsx
"use client";

import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { AgentSkillsTab, useAgentSettings } from "@iblai/iblai-js/web-containers/next";
import {
  useGetMentorSettingsQuery,
  useGetRbacPermissionsMutation,
} from "@iblai/iblai-js/data-layer";
import { updateRbacPermissions } from "@iblai/iblai-js/web-utils";

export default function AgentSkillsPage() {
  const { tenantKey, mentorId, username } = useAgentSettings();
  const dispatch = useDispatch();
  const [getRbacPermissions] = useGetRbacPermissionsMutation();
  const { data: settings } = useGetMentorSettingsQuery({
    mentor: mentorId,
    org: tenantKey,
    // @ts-expect-error userId is accepted at runtime
    userId: username,
  });
  const mentorDbId = (settings as { mentor_id?: number } | undefined)?.mentor_id;

  // AgentSkillsTab reads the agent's grants from state.rbac.
  useEffect(() => {
    if (!mentorDbId) return;
    getRbacPermissions({
      requestBody: { platform_key: tenantKey, resources: [`/mentors/${mentorDbId}/`] },
    })
      .unwrap()
      .then((permissions) => dispatch(updateRbacPermissions(permissions)))
      .catch(() => {});
  }, [mentorDbId, tenantKey, getRbacPermissions, dispatch]);

  return (
    <div className="flex h-full flex-col bg-white">
      <AgentSkillsTab />
    </div>
  );
}
```

The settings query is the same one the tab runs, so it is a cache read. The
store must include the `rbac` reducer (vibe-starter's `store/iblai-store.ts`
does).

### Lower level: `AgentSkills`

`AgentSkillsTab` wraps `AgentSkills` (still exported from
`@iblai/iblai-js/web-containers`) with the header, the Base Agent check, and
the student guard. Mount `AgentSkills` directly only for a custom shell. It
takes `platformKey`, `mentorUniqueId`, and optional `mentorDbId`; with
`mentorDbId` it applies the same RBAC gating, without it nothing is gated.

```tsx
import { AgentSkills } from "@iblai/iblai-js/web-containers";

<AgentSkills platformKey="acme-demo" mentorUniqueId="<agent-uuid>" />;
```

## Step 3: Customize Labels (Optional)

```tsx
import { AgentSkillsTab } from "@iblai/iblai-js/web-containers/next";

<AgentSkillsTab labels={{ header: { title: "Playbooks" } }} />;
```

Label groups (`SkillsTabLabels`): `header` (`title`, `description`),
`notBaseAgent`, and `loading`. The rows, dialogs, and toasts inside come from
the SDK's i18n and are not part of the bundle.

## Step 4: Enable the chat `/` skill picker

The chat composer ships a `/` skill combobox: typing `/` as the first word
opens a popup listing the agent's skills (name + `/slug`, arrow keys +
Enter/Tab to select, Esc to dismiss). Selecting inserts `/slug ` into the
composer. It is **off by default** -- opt in with one prop on `<Chat>` (from
`/iblai-vibe-agent-chat`):

```tsx
import { Chat } from "@iblai/iblai-js/web-containers/next";

<Chat
  // ...existing chat config...
  slashSkillsEnabled
/>;
```

With `slashSkillsEnabled`, the composer lazily fetches the agent's skills on
the first `/` keystroke (20 per page, loading more as the list scrolls;
errors degrade to an inactive picker). To supply the list yourself, pass
`slashSkills` (an `EffectiveAgentSkill[]`) and `slashSkillsLoading` while
resolving it. The same three props exist on `ChatInputForm`. For a fully
custom composer use `useSlashSkills`, `useSlashSkillPicker`,
`SlashSkillPicker`, and `isSlashCommandToken`.

![Chat composer -- `/` skill picker](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-vibe-agent-skills/iblai-vibe-agent-skills-slash-picker.png)

![Chat page -- `/` picker open above the composer](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-vibe-agent-skills/iblai-vibe-agent-skills-chat-picker.png)

## Step 5: Use MCP Tools for Customization

```
get_component_info("AgentSkillsTab")
get_component_info("AgentSkills")
get_component_info("Chat")
```

## Component Props

### `<AgentSkillsTab>` (from `@iblai/iblai-js/web-containers/next`)

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `labels` | `DeepPartial<SkillsTabLabels>` | No | Override the header, Base Agent note, and loading copy |
| `tenantKey` | `string` | No | Identity override. Falls back to `AgentSettingsProvider` |
| `mentorId` | `string` | No | Identity override (agent UUID). Falls back to `AgentSettingsProvider` |
| `username` | `string` | No | Identity override. Falls back to `AgentSettingsProvider` |
| `userIsStudent` | `boolean` | No | `true` renders nothing (skills are admin-only). Falls back to `AgentSettingsProvider` |

### `<AgentSkills>` (from `@iblai/iblai-js/web-containers`)

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `platformKey` | `string` | Yes | Org key |
| `mentorUniqueId` | `string` | Yes | Agent UUID |
| `mentorDbId` | `number \| string` | No | Agent DB id; turns on RBAC gating against `/mentors/{id}/` |

### `<Chat>` / `<ChatInputForm>` slash-picker props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `slashSkillsEnabled` | `boolean` | No | Turns the `/` picker on (default `false`) |
| `slashSkills` | `EffectiveAgentSkill[]` | No | Host-supplied list; skips the internal fetch |
| `slashSkillsLoading` | `boolean` | No | Shows a loading row while the host resolves `slashSkills` |

## What the tab does

- **Header note + New Skill** -- "Skills added or removed here apply to new
  chat sessions only. Edits to a skill's instructions apply immediately,
  including in conversations already in progress."
- **Agent Skills** lists the agent's skill **assignments**, paged 10 per
  page. The switch PATCHes the assignment's `enabled`; **Remove** deletes
  the assignment (the skill itself stays in the catalog).
- **Available Skills** lists the whole catalog, paged 10, including disabled
  skills so they can be re-enabled. **Add** creates an enabled assignment;
  rows already assigned show **Added**. The switch PATCHes the skill.
  **Edit** / **Delete** appear only for skills the organization owns;
  featured skills from the `main` platform are read-only.
- **New / Edit Skill** -- `Only This Agent` sets `mentor` to this agent's
  UUID (private; takes precedence over a same-slug platform skill). A private
  skill is attached to the agent right after it is created. Edit adds the
  **General** / **Resources** sub-tabs; a skill private to another agent
  keeps its owner (the toggle is locked).
- **Resources** -- `reference` and `script` are text (filename + content);
  `asset` is a multipart upload. Row menu: **Download** (assets), **Edit**
  (text), **Delete** (with confirmation). Paged 20 per page.

## Related Exports

From `@iblai/iblai-js/web-containers/next`:

- `AgentSkillsTab` — the tab (header, Base Agent check, student guard).
- `AGENT_SKILLS_TAB_LABELS`, `SkillsTabLabels`, `AgentSkillsTabProps`.

From `@iblai/iblai-js/web-containers`:

- `AgentSkills` — the manager inside the tab.
- `SlashSkillPicker`, `SlashSkillPickerProps` — the `/` popup listbox.
- `useSlashSkillPicker`, `isSlashCommandToken` — composer keyboard /
  open-state machine.
- `useSlashSkills` — lazy paged fetch of the agent's skills for the
  picker.

From `@iblai/iblai-js/data-layer`:

- `useGetAgentSkillsQuery`, `useGetAgentSkillQuery`,
  `useCreateAgentSkillMutation`, `useUpdateAgentSkillMutation`,
  `useDeleteAgentSkillMutation` — skill catalog CRUD.
- `useGetAgentSkillResourcesQuery`,
  `useCreateAgentSkillResourceMutation`,
  `useUpdateAgentSkillResourceMutation`,
  `useUploadAgentSkillResourceAssetMutation`,
  `useDeleteAgentSkillResourceMutation` — skill file resources.
- `useGetMentorSkillAssignmentsQuery`,
  `useGetMentorSkillAssignmentsInfiniteQuery` (one growing cache entry
  per agent — powers the `/` picker's lazy list),
  `useCreateMentorSkillAssignmentMutation`,
  `useUpdateMentorSkillAssignmentMutation`,
  `useDeleteMentorSkillAssignmentMutation` — per-agent assignments.
- `resolveEffectiveAgentSkills` — client-side join of catalog +
  assignments into the agent's effective set (private >
  organization > global/featured, deduped by slug).
- `filterSlashSkills` — enabled-only name/slug filter used by the
  picker.
- `isBaseAgentMentor`, `BASE_AGENT_TEMPLATE_SLUGS` — Base Agent gate.
- `useGetRbacPermissionsMutation` — loads the grants the tab gates on
  (dispatch the result with `updateRbacPermissions` from
  `@iblai/iblai-js/web-utils`).
- `MENTOR_SKILL_ASSIGNMENTS_PAGE_SIZE` — the picker's page size (20).
- `AgentSkill`, `AgentSkillResource`, `MentorSkillAssignment`,
  `EffectiveAgentSkill` — payload types.

## Platform data

| Hook | Purpose |
|---|---|
| `useGetMentorSkillAssignmentsQuery` + create/update/delete mutations | The agent's assignments (Agent Skills sub-tab) |
| `useGetAgentSkillsQuery` + create/update/delete mutations | The organization catalog (Available Skills, New/Edit) |
| `useGetAgentSkillResourcesQuery` + resource mutations | Skill files (Resources) |
| `useGetRbacPermissionsMutation` | The agent's skill-assignment grants |

REST twin: [`/iblai-api-agent-skill`](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-api-agent-skill/SKILL.md);
the endpoint summary is also at the end of this page.

## Step 6: Verify

Run `/iblai-vibe-ops-test` before telling the user the work is ready:

1. `pnpm build` -- must pass with zero errors.
2. `pnpm test` -- vitest must pass.
3. `pnpm dev`, sign in as an organization admin, open
   `/agents/<uuid>/skills`: **Agent Skills** and **Available Skills** both
   show and **New Skill** is visible. If only "No skills enabled for this
   agent yet" renders with no **Available Skills** sub-tab, the RBAC grants
   were not loaded (Step 2).
4. **Add** a skill from **Available Skills**; it appears under **Agent
   Skills** with its `/slug`.
5. `npx playwright screenshot http://localhost:3000/agents/<uuid>/skills /tmp/agent-skills.png`

## Important Notes

- **Redux store**: Must include `mentorReducer` and `mentorMiddleware`
- **`initializeDataLayer()`**: 5 args (v1.2+)
- **`@reduxjs/toolkit`**: Deduplicated via webpack aliases in `next.config.ts`
- **Peer deps**: `sonner` and `@iblai/iblai-web-mentor` must be installed
  (`pnpm add sonner @iblai/iblai-web-mentor`)
- **Base Agent only**: `AgentSkillsTab` shows a note for other agent types;
  hide the tab yourself with `isBaseAgentMentor({ mentorSlug,
  templateMentorSlug })` when you can.
- **Private skills and the live backend**: on 2026-10-02 the assignment
  endpoint rejected a skill private to the same agent ("Object with
  unique_id=… does not exist"), so **Only This Agent** + **Create** created
  the skill but reported "Failed to create skill" and left it unattached.
  Until that is fixed, create shared skills and **Add** them.
- **RBAC grants in the store**: see Step 2. A missing grant hides the
  matching control rather than showing an error.
- **Session behaviour**: adding/removing a skill applies to **new chat
  sessions only**; editing a skill's instructions applies immediately,
  including to conversations already in progress. The component
  surfaces this note in its header — keep it visible in custom UI.
- **Skill UUID, not pk**: `MentorSkillAssignment.skill` is the skill's
  `unique_id`, not the integer id. Custom UI joining skills to
  assignments must key on `skill.unique_id`. (Skill *resources* key on
  the integer `skill.id` instead.)
- **Private-skill precedence**: a skill created with **Only This
  Agent** shadows platform skills with the same slug for that agent
  (`resolveEffectiveAgentSkills` ranks private > organization > featured).
- **Featured skills are read-only**: featured skills come from the
  `main` platform; the API 404s organization writes against them, so the
  component hides their Edit/Delete actions. Mirror that in custom UI.
- **Enabled is an AND**: an effective skill is enabled only when the
  catalog skill AND its assignment are both enabled; the `/` picker
  offers enabled skills only.
- **Brand guidelines**: [BRAND.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/BRAND.md)

## Agent Skills REST API

For custom UI beyond the component. All endpoints are prefixed with
`${dmUrl}/api/ai-mentor/orgs/{org}/` where `dmUrl` is
`NEXT_PUBLIC_API_BASE_URL`. Auth: `Authorization: Token <token>`.

### Skill catalog (platform-level)

| Method | Path | Purpose |
|---|---|---|
| GET | `agent-skills/` | List skills — filters: `enabled`, `search` (name/slug), `limit`, `offset` |
| POST | `agent-skills/` | Create — `{ name, slug, version, category, description, instruction, mentor, enabled }` |
| GET | `agent-skills/{id}/` | Retrieve |
| PATCH | `agent-skills/{id}/` | Update |
| DELETE | `agent-skills/{id}/` | Delete |

`mentor` (agent UUID) makes the skill private to that agent; `null`
makes it platform-wide. Featured skills (`is_featured`) are served
read-only to organizations.

### Skill resources (files)

| Method | Path | Purpose |
|---|---|---|
| GET | `agent-skill-resources/` | List — filters: `skill` (integer pk), `file_type`, `limit`, `offset` |
| POST | `agent-skill-resources/` | Create — `{ skill, file_type, filename, content }` for text; multipart with `file` for `asset` |
| PATCH | `agent-skill-resources/{id}/` | Update filename/content |
| DELETE | `agent-skill-resources/{id}/` | Delete |

`file_type` is `reference`, `script` (text — send `content`), or
`asset` (binary — send multipart `file`; the response carries a
download URL in `file`).

### Per-agent assignments

| Method | Path | Purpose |
|---|---|---|
| GET | `agents/{mentor_unique_id}/skills/` | Skills bound to this agent |
| POST | `agents/{mentor_unique_id}/skills/` | Bind — `{ "skill": "<skill-uuid>", "enabled": true }` |
| PATCH | `agents/{mentor_unique_id}/skills/{id}/` | Toggle `enabled` |
| DELETE | `agents/{mentor_unique_id}/skills/{id}/` | Unbind |

Uses the canonical `agents/` spelling — the `mentors/` route is a
deprecated alias slated for removal. The `skill` field is the **UUID**
(`unique_id`), not the integer primary key — keying assignments by
`unique_id` keeps the binding stable across skill edits.
