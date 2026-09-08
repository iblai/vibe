---
name: iblai-vibe-agent-create
description: Create an ibl.ai agent from inside your app — there is no SDK component for creation, so this is the server route (org authority, admin-verified) that calls the platform's mentor-with-settings endpoint, the browser helper that calls it, and the pick-or-create setup screen vibe-starter uses to choose the app's default agent; then hand off to /iblai-vibe-agent-setting and the agent tabs. Use when the user says create an agent, new agent, let admins create agents, agent from a template, or the app has no agent yet. For editing an existing agent see /iblai-vibe-agent; for chatting see /iblai-vibe-agent-chat.
globs:
alwaysApply: false
metadata:
  kind: ui
---

# /iblai-vibe-agent-create

An agent is created with one platform call and returns a `unique_id` — the
UUID every other agent skill needs. The SDK has no creation component
(verified against `@iblai/web-containers` 1.16–1.19), so the pattern is a
**server route** plus a small form. vibe-starter's `/setup` is that form.

![/setup — pick or create the app's agent](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/iblai-vibe-agent-create/iblai-vibe-agent-create-1-dialog.png)

> **Common setup (brand, conventions, env files, verification):** see [docs/skill-setup.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/docs/skill-setup.md).

## Prerequisites

- Auth in place; `IBLAI_API_KEY` in `.env.local` (server-only) — creation
  needs the org's authority.
- `lib/iblai/platform.ts` from `/iblai-vibe-api` (`requireAdmin`,
  `platformFetch`).
- The caller must be an org admin (or hold `MENTOR_CREATORS` — see
  `/iblai-vibe-rbac`; the org toggle `rbac/student-agent-creation/status/`
  decides whether plain members may create).

## Step 1: Install

Render the assets (strip `.j2`; no variables):

| Asset | Destination | Does |
|---|---|---|
| `admin-agents-route.ts.j2` | `app/api/admin/agents/route.ts` | `GET` lists the org's agents; `POST` creates one |
| `admin-client.ts.j2` | `lib/iblai/admin-client.ts` | browser `adminFetch()` that forwards the session token |
| `setup-screen.tsx.j2` | `components/setup/setup-screen.tsx` | name the app → pick or create the agent → save to org metadata |
| `setup-page.tsx.j2` | `app/setup/page.tsx` | admin-only page, outside the navbar |

The setup screen saves through `useOrgSettings` (`/iblai-vibe-org-metadata`)
and uses the SDK's `OnboardingShell` / `StepHeader`. Needs shadcn `input`, `label`.

## Step 2: The call

```ts
// server, after requireAdmin(req)
const agent = await platformFetch<{ unique_id: string; name: string }>(
  `/dm/api/ai-mentor/orgs/${org}/users/${caller.username}/mentor-with-settings/`,
  {
    method: "POST",
    body: {
      template_name: "ai-mentor",     // the default template on most orgs
      new_mentor_name: name,
      display_name: name,
      description,
      system_prompt,                  // optional; refine later in the Prompts tab
      // llm_provider: "openai",      // optional; set later in the LLM tab
    },
  },
);
```

Listing existing agents (for a picker):
`GET /dm/api/search/orgs/{org}/users/{username}/mentors/`.

From the browser:

```ts
import { adminFetch } from "@/lib/iblai/admin-client";
const { unique_id } = await adminFetch<{ unique_id: string }>("/api/admin/agents", {
  method: "POST",
  json: { name: "Support Assistant", description: "Answers order questions." },
});
```

To copy an existing agent instead, use **fork** in `/iblai-vibe-agent-setting`.

## Step 3: After creation

1. Store the id where the app reads it: `NEXT_PUBLIC_DEFAULT_AGENT_ID` (env,
   wins) or the org setting `defaultAgentId` (what `/setup` writes).
2. Configure it: `/iblai-vibe-agent-setting` (identity, visibility), then
   Prompts, LLM, Datasets, Tools, Memory — all via `/iblai-vibe-agent`.
3. Chat with it: the home page in vibe-starter, or `/iblai-vibe-agent-chat`.

## Verify

1. `pnpm typecheck && pnpm build`.
2. As an admin, open `/setup`, create an agent, land on `/` chatting with it;
   the new agent appears on os.ibl.ai → Explore → Custom.
3. As a member, `POST /api/admin/agents` answers `403`.

## Platform data

| Call | Purpose |
|---|---|
| `POST …/orgs/{org}/users/{username}/mentor-with-settings/` | create from template → `unique_id` |
| `GET …/search/orgs/{org}/users/{username}/mentors/` | list agents |
| `GET …/orgs/{org}/users/{username}/mentor/categories/` | categories to assign afterwards |
| `POST …/users/{username}/mentors/{mentor}/fork/` | copy an agent |

REST references: [agent-create](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/iblai-api-agent-create/SKILL.md),
[agent-setting](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/iblai-api-agent-setting/SKILL.md).

## Related skills

- `/iblai-vibe-agent` — the tabs to configure it
- `/iblai-vibe-agent-setting` — identity, visibility, fork, delete
- `/iblai-vibe-agent-search` — the browser members pick from
- `/iblai-vibe-api` — the server-route pattern
