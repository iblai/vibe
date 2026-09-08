---
name: iblai-vibe-memory-guide
description: What memory means for an ibl.ai app and which surface to mount for which audience — user global memories, per-agent memories by category, shared agent knowledge, the org/agent/user gates that decide whether memory is on, and the SDK hooks and REST endpoints for anything custom. Use when the user mentions memory, remember, personalize, "what the agent knows about the user", forget, or wants memory UI in their app. For the org-wide admin surface see /iblai-vibe-memory; for one agent's tab see /iblai-vibe-agent-memory; the member's own view is the Profile Memory tab in /iblai-vibe-profile.
globs:
alwaysApply: false
---

# /iblai-vibe-memory-guide

Memory is the platform's answer to "make the app remember me". It is one data
model with three stores, three gates, and three ready-made surfaces. This page
tells you which to use; the linked skills mount them.

![Member view — Profile › Memory](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/iblai-vibe-memory/iblai-vibe-memory-user-memories.png)
![Admin view — org Memory tab](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/iblai-vibe-memory/iblai-vibe-memory.png)
![Agent view — Agent › Memory tab](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/iblai-vibe-agent-memory/iblai-vibe-agent-memory.png)

> **Common setup (brand, conventions, env files, verification):** see [docs/skill-setup.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/docs/skill-setup.md).

## 1. Three stores

| Store | Scope | Written by | Read by | Typical content |
|---|---|---|---|---|
| **Global memories** | one user, **every** agent in the org | auto-capture from chats (`auto` badge) or the user by hand | every agent the user talks to, when recall is on | "Prefers concise answers", "Works in the finance team" |
| **Agent memories** | one user × **one agent**, filed under **categories** | auto-capture guided by each category's *extraction prompt*, or admins/the user by hand | that agent only | per the five default categories: `knowledge_gaps`, `learning_goals`, `preferences`, `progress_milestones`, `personal_context` |
| **Agent knowledge** | one agent, **no user** — shared by everyone | admins / the agent's owner, curated | injected into every chat with that agent as `## Agent Knowledge` | "Our refund window is 30 days", "Always cite the policy handbook" |

Memories are short facts (≥ 10 characters). Auto-captured ones carry a robot
icon and an `auto` badge; manual ones a person icon.

## 2. Three gates (all must be open for memory to work)

| Level | Flag | Who sets it | Where |
|---|---|---|---|
| **Org** | `enable_memsearch` | org admin (or ibl.ai operator) | `GET/POST …/users/{user_id}/memsearch-config/`; read-only status `…/memsearch-status/` |
| **Agent** | `enable_memory_component` | agent editor | Agent Settings → Memory tab toggle (`PUT …/mentors/{mentor}/settings/`) |
| **User** | `auto_capture_enabled` ("Allow AI to learn from our conversations"), `use_memory_in_responses` ("Use my saved information in responses") | the user (admins may set another user's) | Profile → Memory; `GET/PUT …/users/{username}/memsearch-settings/` (defaults `false`) |

**Visibility rule for your UI:** hide memory management unless the org status
is enabled **and** the agent's flag is on — but **always** show the user's two
toggles so people can opt in or out. `useGetMemsearchStatusQuery` answers the
org gate from the browser.

## 3. Which surface for which audience

| Audience | Wants | Mount | Skill |
|---|---|---|---|
| **Member** | see/curate what is remembered about *me*; the two toggles | `Profile` → `targetTab="memory"` (the Profile Memory tab) | `/iblai-vibe-profile` |
| **Agent owner / editor** | what *this agent* remembers about its users, by category; manage categories and extraction prompts; enable/disable | `AgentMemoryTab` inside `AgentSettingsProvider` | `/iblai-vibe-agent-memory` |
| **Org admin / DPO / support** | any user's global memories and toggles; any agent's memories; corrections and deletions on someone's behalf | `Account` → `targetTab="memory"` (Global + Agent tabs) | `/iblai-vibe-memory` |
| **Your own page** ("what the app knows about you" card on the home page) | list + add + delete global memories | the hooks in §4 | this page |

## 4. Building something custom

SDK hooks (`@iblai/iblai-js/data-layer`, verified 2.9.x):

| Hook | Does |
|---|---|
| `useGetUserMemorySettingsQuery`, `useUpdateUserMemorySettingsMutation` | the user's two toggles |
| `useGetGlobalMemoriesQuery`, `useCreateGlobalMemoryMutation`, `useUpdateGlobalMemoryMutation`, `useDeleteGlobalMemoryMutation` | global memories |
| `useGetMentorMemoriesListQuery`, `useCreateMentorMemoryMutation` | agent memories (see `get_api_query_info` for the full set) |
| `useGetMemsearchStatusQuery`, `useGetMemsearchConfigQuery`, `useUpdateMemsearchConfigMutation` | the org gate |

Minimal "what the app remembers" card (member-facing):

```tsx
"use client";

import {
  useGetGlobalMemoriesQuery,
  useDeleteGlobalMemoryMutation,
} from "@iblai/iblai-js/data-layer";

export function MemoryCard({ username }: { username: string }) {
  const { data, isLoading } = useGetGlobalMemoriesQuery({ username, page: 1, page_size: 10 } as any);
  const [remove] = useDeleteGlobalMemoryMutation();
  if (isLoading) return null;
  const items: any[] = (data as any)?.results ?? [];
  return (
    <ul className="space-y-2">
      {items.map((m) => (
        <li key={m.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
          <span>{m.content}</span>
          <button className="text-xs text-red-600" onClick={() => remove({ username, memory_id: m.id } as any)}>
            Forget
          </button>
        </li>
      ))}
    </ul>
  );
}
```

Confirm the argument shapes with `get_api_query_info("useGetGlobalMemoriesQuery")`
before shipping — the `.d.ts` lags the runtime in places.

REST (server-side `Api-Token`, or the SDK's session token in the browser).
Prefix `https://api.$DOMAIN/dm/api/ai-mentor/orgs/{org}/`:

| Store | Read | Write |
|---|---|---|
| Agent memories | `GET users/{username}/mentors/{mentor}/mentor-memories-list/?page=&page_size=&category=&user_id=&start_date=&end_date=` (flat) · `…/mentor-memories/` (grouped by category) · `users/{username}/mentor-memories/?mentor=` (across agents) | `POST users/{username}/mentors/{mentor}/mentor-memories/` `{category_slug, content}` · `PATCH …/{memoryId}/` · `DELETE …/{memoryId}/` |
| Categories | `GET mentors/{mentor}/memory-categories/` | `POST` (409 if slug exists) · `PATCH …/{categoryId}/` (name, description, extraction prompt) · `DELETE` (soft) |
| Agent knowledge | `GET mentors/{mentor}/agent-memories/?page=&page_size=` (no `users/` segment) | `POST mentors/{mentor}/agent-memories/` · `PATCH …/{memoryId}/` · `DELETE …/{memoryId}/` (204) |
| Global memories | `GET users/{username}/global-memories/?user_id=&email=&session_id=&content=&start_date=&end_date=` | `POST` `{content}` (≥ 10 chars, 409 duplicate) · `DELETE …/{memoryId}/` |
| Settings | `GET users/{username}/memsearch-settings/` · `GET …/memsearch-status/` | `PUT users/{username}/memsearch-settings/` (admins may target another username) |

Errors: `400` content too short · `403` another user's memories without admin · `404` · `409` duplicate.
Full reference: [iblai-api-agent-memory](https://raw.githubusercontent.com/iblai/api/refs/heads/main/skills/iblai-api-agent-memory/SKILL.md).

## 5. Privacy notes to tell the user

- Memory is personal data. Give members the two toggles and a way to delete (the Profile tab does both).
- Admin cross-user access exists for support and data-protection duties — gate your admin memory page on `isTenantAdmin()` (see `/iblai-vibe-admin`).
- Agent knowledge is shared with everyone who talks to the agent; never put a person's data there.

## Related skills

- `/iblai-vibe-profile` — member's own Memory tab
- `/iblai-vibe-agent-memory` — one agent's Memory tab
- `/iblai-vibe-memory` — org-wide Memory admin
- `/iblai-vibe-agent-privacy` — PII redaction/masking in chats (a different feature)
- `/iblai-vibe-api` — calling endpoints that have no hook
