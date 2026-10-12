---
name: iblai-vibe-agent-memory
description: Add the agent Memory tab — the Long-term Memory switch and two sub-tabs, Personal Memories (what the agent remembered about each person, by category, with user and date filters, a Categories manager and Add Memory) and Shared Memory (facts, rules and background every person who chats with this agent gets — add, edit, delete, paginated). Use when the user mentions agent memory, "remember across conversations", what the agent knows about a user, or wants an agent to always keep facts or house rules in mind. For the org-wide admin surface see /iblai-vibe-memory; for what memory means and which surface fits which audience see /iblai-vibe-memory-guide; for the REST endpoints see /iblai-api-agent-memory
globs:
alwaysApply: false
metadata:
  core: true
  kind: ui
---

# /iblai-vibe-agent-memory

Add the agent **Memory tab** -- a **Long-term Memory** switch ("Let this
agent remember useful details from past conversations — like a returning
colleague — so people don't have to repeat themselves") and, while it is
on, two sub-tabs:

- **Personal Memories** — what the agent remembered about each person:
  **Search for User**, **Pick a Date Range**, category tabs (All /
  Knowledge Gaps / Learning Goals / Personal Context / Preferences / …),
  a **Categories** manager, **Add Memory**, and a kebab per memory.
- **Shared Memory** — "Facts, rules, and background this agent should
  always keep in mind. Every person who chats with this agent gets these
  memories." **Add Shared Memory**, edit and delete, 20 per page.

Shared Memory is the UI for what the API calls **agent knowledge**
(`agent-memories`): one agent, no user, curated by hand, injected into
every chat with the agent as an `## Agent Knowledge` block. This is one
tab in the wider agent-settings family; all tabs share the same
`AgentSettingsProvider` wrapper (optional for this tab — identity can be
passed as props).

![Memory — Personal Memories](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-vibe-agent-memory/iblai-vibe-agent-memory.png)

![Memory — Shared Memory](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-vibe-agent-memory/iblai-vibe-agent-memory-shared.png)

![Shared Memory — Add Shared Memory dialog](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-vibe-agent-memory/iblai-vibe-agent-memory-shared-add.png)

![Shared Memory — per-entry Edit / Delete](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-vibe-agent-memory/iblai-vibe-agent-memory-shared-actions.png)

![Shared Memory — Edit Shared Memory dialog](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-vibe-agent-memory/iblai-vibe-agent-memory-shared-edit.png)

![Shared Memory — Delete confirmation](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-vibe-agent-memory/iblai-vibe-agent-memory-shared-delete.png)

> **Common setup (brand, conventions, env files, verification):** see [docs/skill-setup.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/docs/skill-setup.md).

## Related memory surfaces

- **`/iblai-vibe-memory-guide`** — what memory means (three stores, three
  gates) and which surface to mount for which audience.
- **`/iblai-vibe-memory`** — organization settings → Memory: any user's
  global memories and any agent's memories. Its **Agent** popup hosts the
  Personal Memories manager only; an agent's Shared Memory is managed
  here, on the agent's own tab.
- **`/iblai-vibe-profile`** — the member's own Memory tab (their global
  memories and the two capture/recall toggles).
- **`/iblai-api-agent-memory`** — the REST twin, including the
  agent-knowledge endpoints behind Shared Memory.

## Prerequisites

- Auth must be set up first (`/iblai-vibe-auth`)
- MCP server + skills configured (`@iblai/mcp` in `.mcp.json`)
- `AgentSettingsProvider` wrapping the route (see `/iblai-vibe-agent-setting`
  Step 2), **or** pass `tenantKey` / `mentorId` / `username` as props.
- Ask the user for a real `mentorId` (agent UUID). Do NOT invent one.
- Memory must be on for the organization (`enable_memsearch`). The
  switch on this tab is the **agent** gate; the person chatting must
  also have memory turned on. All three gates must be open before
  anything on this tab reaches a chat — see the guide.

## Step 1: Check Environment

Before proceeding, check for an `iblai.env` in the project root. Look for
`PLATFORM`, `DOMAIN`, and `TOKEN` variables. If the file does not exist or
is missing these variables, tell the user:
"You need an `iblai.env` with your platform configuration. Download the
template and fill in your values:
`curl -o iblai.env https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/iblai.env`"

## Step 2: Mount `AgentMemoryTab`

```tsx
// app/(app)/agents/[mentorId]/memory/page.tsx
"use client";

import { AgentMemoryTab } from "@iblai/iblai-js/web-containers/next";

export default function AgentMemoryPage() {
  return (
    <div className="flex h-full flex-col bg-white">
      <AgentMemoryTab />
    </div>
  );
}
```

The tab reads `tenantKey`, `mentorId`, `username`, `enableRBAC` and
`rbacPermissions` from the nearest `<AgentSettingsProvider>`, loads the
agent settings for the switch, and renders both sub-tabs under it.

### With identity overrides

When the tab is not rendered inside an `<AgentSettingsProvider>`, pass
identity explicitly:

```tsx
<AgentMemoryTab
  tenantKey="my-tenant"
  mentorId="00000000-0000-0000-0000-000000000000"
  username="learner@example.com"
/>;
```

## Step 3: Customize Labels (Optional)

```tsx
import { AgentMemoryTab } from "@iblai/iblai-js/web-containers/next";

<AgentMemoryTab
  labels={{
    header: { title: "Mentor memory" },
    subTabs: { personal: "About each person", shared: "Always in mind" },
    sharedMemory: {
      addButton: "Add a standing fact",
      empty: { title: "Nothing shared yet" },
    },
  }}
/>;
```

## Step 4: Use MCP Tools for Customization

```
get_component_info("AgentMemoryTab")
get_component_info("AgentSettingsProvider")
get_hook_info("useGetSharedMemoriesQuery")
```

## `<AgentMemoryTab>` Props

Import from `@iblai/iblai-js/web-containers/next`.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `labels` | `DeepPartial<MemoryTabLabels>` | No | Override user-visible strings — header, the switch (`toggle`), `subTabs`, the whole `sharedMemory` bundle (list, empty/denied states, both dialogs, errors, toasts), and the switch toasts |
| `tenantKey` | `string` | No | Identity override. Defaults to the nearest `<AgentSettingsProvider>` |
| `mentorId` | `string` | No | Agent UUID override. Defaults to the provider |
| `username` | `string` | No | Username override. Defaults to the provider |
| `enableRBAC` | `boolean` | No | Honor the RBAC permission tree for the switch and the Shared Memory writes. Defaults to the provider value or `false` |
| `rbacPermissions` | `object` | No | The permission tree from your RBAC slice. Defaults to the provider value |

## What the tab renders

### Long-term Memory switch

The in-tab switch flips `enable_memory_component` on the agent
(optimistically, rolled back with a toast if the save fails). While it is
**off** both sub-tabs stay visible but inert, with the hint *"Turn it on
to let this agent remember details across conversations."* — the backend
injects neither personal nor shared memories into chats while the flag
is off.

### Personal Memories

The same manager the organization's Memory admin opens per agent:
**Search for User** (server-side), **Pick a Date Range**, category tabs
(All plus the agent's categories — Knowledge Gaps, Learning Goals,
Personal Context, Preferences, … by default), a **Categories** manager
(create / rename / delete categories and their extraction prompts),
**Add Memory**, and per-memory cards showing the time-ago, the owning
user's email and an Edit / Delete kebab.

### Shared Memory

- Header: *"Shared Memory — Facts, rules, and background this agent
  should always keep in mind. Every person who chats with this agent
  gets these memories."* and the **Add Shared Memory** button.
- An info box: *"Shared memories reach chats only while Long-term Memory
  is on for this agent and the person chatting has memory turned on."*
- One card per entry: the text, then *"Added by {name} · {time ago}"*
  (the curator's full name, else username, else *Unknown*), and a kebab
  with **Edit** and **Delete**.
- **Add / Edit Shared Memory** dialog: one **Memory** textarea
  (*"Write what this agent should always keep in mind..."*), a counter
  that reads *"0/10 characters minimum"* until ten characters are typed
  and *"123 characters"* after; **Save** stays disabled below ten.
- **Delete Shared Memory** confirm: *"Are you sure you want to delete
  this shared memory? Everyone who chats with this agent will stop
  seeing it. This action cannot be undone."*
- Pagination appears past 20 entries; deleting the last entry on a page
  steps back a page first.
- Empty: *"No Shared Memories Yet — Add anything this agent should
  always keep in mind — how to behave, key facts, or house rules."*
- No list permission (403): *"No Access to Shared Memory"* in place of
  the list.

### Errors the section handles

| Backend | Shown |
|---|---|
| `409` on save | *"This shared memory already exists."* under the field — entries dedupe on a content hash |
| `400` on save | *"A shared memory must be at least 10 characters."*, or the backend's own message for any other rule |
| `403` on any write | A toast, and the add button and kebabs disappear for the rest of the session |
| anything else | *"Couldn't save shared memory"* / *"Couldn't delete shared memory"* toasts |

### Who may write

The permission check endpoint has no shared-memory actions, so the
agent's own `write` action stands in: with `enableRBAC` and a permission
tree that carries the agent (`/mentors/{id}/`), **Limited Editor** can
write and **Limited Viewer** cannot. When the tree has no entry for the
agent everything stays writable and the server's `403` is the source of
truth. The switch follows the same rule. Writes are withheld (not
briefly granted) while the agent settings are still loading.

## Related Exports

From `@iblai/iblai-js/web-containers/next`:

- `AgentMemoryTab`, `AgentMemoryTabProps` — this tab.
- `AGENT_MEMORY_TAB_LABELS`, `MemoryTabLabels` — the default label
  bundle and its type (now with `subTabs` and `sharedMemory`).
- `MEMORY_SUB_TABS` — `{ personal: 'personal', shared: 'shared' }`, the
  sub-tab values.

From `@iblai/iblai-js/data-layer`:

- Shared Memory: `useGetSharedMemoriesQuery`,
  `useLazyGetSharedMemoriesQuery`, `useCreateSharedMemoryMutation`,
  `useUpdateSharedMemoryMutation`, `useDeleteSharedMemoryMutation`, with
  `SharedMemoryEntry` (`id`, `mentor_id`, `mentor_name`, `content`,
  `created_by`, `created_by_email`, `created_by_full_name`,
  `created_at`, `updated_at`), `SharedMemoryListResponse` and the
  `GetSharedMemoriesArgs` / `CreateSharedMemoryArgs` /
  `UpdateSharedMemoryArgs` / `DeleteSharedMemoryArgs` shapes
  (`{ org, mentorId, … }`; the list takes `params.page` /
  `page_size` ≤ 100 / `start_date` / `end_date`).
- Personal Memories: `useGetMentorMemoriesListQuery`,
  `useGetAllMentorMemoriesQuery`, `useCreateMentorMemoryMutation`,
  `useUpdateMentorMemoryMutation`, `useDeleteMentorMemoryMutation`;
  categories `useGetMemoryCategoriesAdminQuery`,
  `useCreateMemoryCategoryMutation`, `useUpdateMemoryCategoryMutation`,
  `useDeleteMemoryCategoryMutation`.
- The switch: `useGetMentorSettingsQuery`, `useEditMentorMutation`
  (`enable_memory_component`); the organization gate:
  `useGetMemsearchStatusQuery`.

Component map (internal to the tab, under
`packages/web-containers/src/components/modals/edit-mentor-modal/tabs/memory-tab/`):

| Component | File | Role |
|---|---|---|
| `AgentMemoryTab` | `index.tsx` | Header, the `CapabilityGate` switch, the two sub-tabs |
| `ManageMemories` | `manage-memories.tsx` | Personal Memories (also hosted by the org Memory admin's Agent popup) |
| `SharedMemorySection` | `shared-memory-section.tsx` | Shared Memory list, pagination, state handling |
| `SharedMemoryModal` | `shared-memory-modal.tsx` | Add / Edit dialog, 10-character minimum |
| `SharedMemoryDeleteModal` | `shared-memory-delete-modal.tsx` | Delete confirmation |
| `classifySharedMemoryError` | `shared-memory-errors.ts` | Maps 409 / 400 / 403 to the messages above |
| `useMemoryCapability` | `use-memory-capability.ts` | The switch's optimistic save and the write-permission proxy |

## Step 5: Verify

Run `/iblai-vibe-ops-test` before telling the user the work is ready:

1. `pnpm build` -- must pass with zero errors
2. `pnpm test` -- vitest must pass
3. Start dev server and touch test:
   ```bash
   pnpm dev &
   npx playwright screenshot http://localhost:3000/agents/<id>/memory /tmp/agent-memory.png
   ```

Stable selectors: `memory-capability-toggle`, `memory-sub-tabs`,
`memory-sub-tab-personal`, `memory-sub-tab-shared`,
`shared-memory-section`, `shared-memory-add-button`,
`shared-memory-entry`, `shared-memory-modal`, `shared-memory-content`,
`shared-memory-save`, `shared-memory-delete-modal`,
`shared-memory-delete-confirm`, `shared-memory-empty`,
`shared-memory-denied`, `shared-memory-pagination`.

## Important Notes

- **Redux store**: Must include `mentorReducer` and `mentorMiddleware`
- **`initializeDataLayer()`**: 5 args (v1.2+)
- **`@reduxjs/toolkit`**: Deduplicated via webpack aliases in `next.config.ts`
- **Peer deps**: `sonner` and `@iblai/iblai-web-mentor` must be installed
  (`pnpm add sonner @iblai/iblai-web-mentor`)
- **Provider optional**: the tab uses `useAgentSettingsOptional`, so it
  works inside `AgentSettingsProvider` or with explicit identity props.
- **Three gates**: organization `enable_memsearch`, this tab's switch
  (`enable_memory_component`), and the person's own `use_memory_in_responses`.
  Shared memories reach a chat only when all three are on — the info
  box on the sub-tab says exactly that.
- **Shared Memory is not personal data.** Everyone who chats with the
  agent gets it; put behaviour, facts and house rules there, never
  something about one person — that belongs in Personal Memories.
- **Shared Memory lives here only.** The organization's Memory admin
  (`/iblai-vibe-memory`) manages personal memories per agent; it does
  not show Shared Memory.
- **Entries dedupe**: an identical shared memory is refused with `409`,
  surfaced under the field; a save needs at least 10 characters.
- **Agent switch remounts the section**, so the page and the
  write-denied flag start over for the next agent.
- **Brand guidelines**: [BRAND.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/BRAND.md)

## Memory REST API

Full REST reference: [`/iblai-api-agent-memory`](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-api-agent-memory/SKILL.md)
(headless twin, installed with the rest of this repo's skills).
The tables below are the frontend-relevant summary.

For custom UI beyond `<AgentMemoryTab>`. All endpoints are prefixed with
`${dmUrl}/api/ai-mentor/orgs/{org}/` where `dmUrl` is `NEXT_PUBLIC_API_BASE_URL`
and `{org}` is the org key (`platform_key`).

The system has three control levels: **Platform** (admin enables for organization),
**Agent** (admin/owner enables per agent), **User** (user opts in/out of
capture and use).

### User memory settings (per user opt-in)

| Method | Path | Purpose |
|---|---|---|
| GET | `users/{user_id}/memsearch-settings/` | Read `auto_capture_enabled`, `use_memory_in_responses` |
| PUT | `users/{user_id}/memsearch-settings/` | Update one or both flags |

Defaults are `false` if no settings row exists.

### Platform config (organization admin)

| Method | Path | Purpose |
|---|---|---|
| GET | `users/{user_id}/memsearch-config/` | Read `enable_memsearch` |
| POST | `users/{user_id}/memsearch-config/` | Set `enable_memsearch` |
| GET | `users/{user_id}/memsearch-status/` | Read-only enabled status for the organization |

### Agent toggle

| Method | Path | Purpose |
|---|---|---|
| PUT | `users/{user_id}/mentors/{mentor}/settings/` | Body includes `enable_memory_component: bool` |

Every memory row identifies its owner with `username`, `email` and
`user_full_name`, so a list renders the person without a second request; a
shared-memory row names its curator with `created_by`, `created_by_email` and
`created_by_full_name` instead.

### Shared Memory (agent knowledge — no user segment)

| Method | Path | Purpose |
|---|---|---|
| GET | `mentors/{mentor_id}/agent-memories/` | Paged list. Params: `page`, `page_size` (≤100, default 20), `start_date`, `end_date` |
| POST | `mentors/{mentor_id}/agent-memories/` | Create. Body `{ content }` (≥10 chars). `201`; `409` if an identical entry exists |
| PATCH | `mentors/{mentor_id}/agent-memories/{memory_id}/` | Update `content` |
| DELETE | `mentors/{mentor_id}/agent-memories/{memory_id}/` | Delete → `204` |

### Global memories (apply across all agents)

| Method | Path | Purpose |
|---|---|---|
| GET | `users/{user_id}/global-memories/` | List. Params: `page`, `page_size` (≤25), `user_id`, `start_date`, `end_date`, `search` |
| POST | `users/{user_id}/global-memories/` | Create. Body `{ content }` (≥10 chars). 409 if duplicate |
| DELETE | `users/{user_id}/global-memories/{memory_id}/` | Delete |

### Agent-specific memories (grouped by category)

| Method | Path | Purpose |
|---|---|---|
| GET | `users/{user_id}/mentors/{mentor_id}/mentor-memories/` | List grouped by category. Params: `user_id`, `start_date`, `end_date`, `my_memory` |
| POST | `users/{user_id}/mentors/{mentor_id}/mentor-memories/` | Create. Body `{ category_slug, content }` (≥10 chars) |
| PATCH | `users/{user_id}/mentors/{mentor_id}/mentor-memories/{memory_id}/` | Partial update of `content` and/or `category_slug` |
| DELETE | `users/{user_id}/mentors/{mentor_id}/mentor-memories/{memory_id}/` | Delete |

### Memory categories (admin/owner)

| Method | Path | Purpose |
|---|---|---|
| GET | `mentors/{mentor_id}/memory-categories/` | List active categories |
| POST | `mentors/{mentor_id}/memory-categories/` | Create. 409 if slug exists |
| PATCH | `mentors/{mentor_id}/memory-categories/{category_id}/` | Update name/description/extraction prompt |
| DELETE | `mentors/{mentor_id}/memory-categories/{category_id}/` | Soft-delete (sets `is_active=false`) |

Default categories auto-created per agent: `knowledge_gaps`, `learning_goals`,
`preferences`, `progress_milestones`, `personal_context`.

### Common errors

`400` validation (`content` <10 chars), `403` viewing another user's memories
or writing shared memory without the agent's `write` action, `404` not found,
`409` duplicate.

### Visibility rule

Hide memory UI unless platform `memsearch-status` is enabled AND the agent's
`enable_memory_component` is true. Always show the user-level toggles so users
can opt in/out.
