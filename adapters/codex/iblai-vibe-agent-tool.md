# iblai-vibe-agent-tool

> Add the agent Tools tab (switch the agent's tools on and off -- web search, code interpreter, image generation, MCP, and more) to your Next.js app. Use when the user mentions agent tools, enabling web search or code interpreter, tool switches, or turning on MCP for an agent. For MCP servers and connectors see /iblai-vibe-agent-mcp; for the REST contract see /iblai-api-agent-tool.

# /iblai-vibe-agent-tool

Add the agent **Tools tab** -- which tools the agent may call while it
answers. **Scope: per agent.** The enabled set is saved on the agent's
settings (`tool_slugs`), so it applies to every user who chats with the
agent. The tab lists every tool the platform offers for the agent, one card
per tool with an info tooltip and a switch. This is one tab in the
agent-settings family indexed by `/iblai-vibe-agent`; it shares the
`AgentSettingsProvider` wrapper with every other tab.

**Tools** -- one card per tool, in the order the API returns them. Hovering
the info icon shows the tool's description. Each switch saves on its own, at
once, and toasts "Agent updated successfully".

![Tools tab -- tool list with a description tooltip](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-vibe-agent-tool/iblai-vibe-agent-tool-1-tools.png)

**Enabled** -- an enabled tool's switch is blue (here **Screen Sharing**, near
the end of the list). The list scrolls inside the tab.

![Tools tab -- an enabled tool](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-vibe-agent-tool/iblai-vibe-agent-tool-2-enabled.png)

> **Common setup (brand, conventions, env files, verification):** see [docs/skill-setup.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/docs/skill-setup.md).

## Prerequisites

- Auth set up (`/iblai-vibe-auth`, or vibe-starter).
- `AgentSettingsProvider` wraps the route (`/iblai-vibe-agent` §1).
- `@iblai/iblai-js@^2.36.2` (resolves `@iblai/web-containers` 1.41.1). Check with
  `pnpm why @iblai/web-containers`.
- A real agent UUID. Ask the user; never invent one.

## Step 1: Check Environment

Look for `iblai.env` in the project root with `PLATFORM`, `DOMAIN`, and
`TOKEN`. If it is missing, tell the user:
"You need an `iblai.env` with your platform configuration. Download the
template and fill in your values:
`curl -o iblai.env https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/iblai.env`"

## Step 2: Mount `AgentToolsTab`

```tsx
// app/(app)/agents/[mentorId]/tools/page.tsx
"use client";

import { AgentToolsTab } from "@iblai/iblai-js/web-containers/next";

export default function AgentToolsPage() {
  return (
    <div className="flex h-full flex-col bg-white">
      <AgentToolsTab />
    </div>
  );
}
```

The tab reads `tenantKey`, `mentorId`, and `username` from
`AgentSettingsProvider` and does its own fetching and saving. No props are
required.

## Step 3: Customize Labels (Optional)

The tab renders with the default agent-facing copy (`AGENT_TOOLS_TAB_LABELS`,
localized through the SDK's i18n). Pass a partial `labels` object to change
any string:

```tsx
import { AgentToolsTab } from "@iblai/iblai-js/web-containers/next";

<AgentToolsTab
  labels={{
    header: { title: "Agent tools" },
    toasts: { toggleSuccess: "Tool updated" },
  }}
/>;
```

Label groups (`ToolsTabLabels`): `header` (`title`, `description`), `infoBox`,
`moreInfoAbout(name)` (the tooltip trigger's accessible name),
`switchAriaLabel(name, isEnabled)`, and `toasts` (`toggleSuccess`,
`toggleError`). Tool names and descriptions come from the API.

## Step 4: Use MCP Tools for Customization

```
get_component_info("AgentToolsTab")
get_component_info("AgentSettingsProvider")
```

## `<AgentToolsTab>` Props

Import from `@iblai/iblai-js/web-containers/next`.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `labels` | `DeepPartial<ToolsTabLabels>` | No | Override user-visible strings |

## Related Exports

From `@iblai/iblai-js/web-containers/next`:

- `AGENT_TOOLS_TAB_LABELS` -- the default label bundle.
- `useToggleTools({ tools, activeMentorId, tenantKey, username })` -- an
  agent-level setter: `toggleTools(slug)` adds or removes one slug from the
  `tools` you pass and saves the result as the agent's whole `tool_slugs`
  (it never reads the current set; the chat's tool chips change only the
  session instead).
- `AgentToolsTabProps`, `ToolsTabLabels` -- types.

## How it saves

| Action | Request |
|---|---|
| Load | `GET mentors/{uuid}/available-tools/` (`display_name`, `slug`, `description`) and the agent's settings (`mentor_tools[].slug`) |
| Flip a switch | `PUT mentors/{uuid}/settings/` with the whole new `tool_slugs` list and `can_use_tools` (`true` while any tool is on) |

Every switch is disabled while a save is in flight. Slugs seen on the live
platform: `web-search`, `code-interpreter`, `deep-research`,
`image-generation`, `video-generation`, `mcp`, `screen-share`, `study-mode`,
`human-support`, `google-calendar`, `google-docs`, `google-slides`,
`grading`, `course-creation`, `lesson-completion`,
`advanced-document-search` (read the list; it varies by organization).

## Platform data

| Hook | Purpose |
|---|---|
| `useGetToolsQuery` | Tools the agent can use |
| `useGetMentorSettingsQuery` | The agent's enabled tools |
| `useEditMentorMutation` | Save the new set |

REST twin: [`/iblai-api-agent-tool`](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-api-agent-tool/SKILL.md).

## Step 5: Verify

Run `/iblai-vibe-ops-test` before telling the user the work is ready:

1. `pnpm build` -- must pass with zero errors.
2. `pnpm test` -- vitest must pass.
3. Touch test `/agents/<uuid>/tools` in the browser as `/iblai-vibe-ops-test` says: one card
   per tool; flip a switch, reload -- it stays flipped; flip it back; read the console;
   check the phone width.

## Important Notes

- **Per agent, not per user**: every user who chats with the agent gets the
  same tools.
- **MCP needs two things**: the **MCP** switch here (`mcp` in
  `tool_slugs`) and at least one server assigned to the agent
  (`/iblai-vibe-agent-mcp`).
- **Some tools need setup elsewhere**: Google Calendar / Docs / Slides need a
  connected account, Human Support needs the support inbox
  (`/iblai-vibe-agent-support`), Screen Sharing works inside voice calls
  (`/iblai-vibe-agent-voice`).
- **Shared provider**: mount `AgentSettingsProvider` once at the layout
  level (`/iblai-vibe-agent` §1); do not wrap each tab.
- **Peer deps**: `sonner` and `@iblai/iblai-web-mentor`
  (`pnpm add sonner @iblai/iblai-web-mentor`).
- **Brand guidelines**: [BRAND.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/BRAND.md)

## MCP servers (the `MCP` tool)

Turning on the **MCP** tool (slug `mcp`) lets the agent call the MCP
servers attached to it. Everything about those servers lives in two skills:

- **`/iblai-vibe-agent-mcp`** — the MCP tab (`<McpTab>`) and a map of the
  REST calls behind a custom connector screen.
- **`/iblai-api-agent-mcp`** — the exact endpoints: the ranked catalog (your
  org's, featured and MCP Registry directory servers), `oauth-find`, the org's
  OAuth app or API key (`credentials/`), `verify/`, credential scopes,
  connections, user on/off choices, and the in-chat events.

Essentials when wiring MCP from this tab:

- `PUT mentors/{mentor_id}/settings/` with `mcp` in `tool_slugs` **and** the
  server ids in `mcp_servers`. Both lists **replace** the current ones — read
  `mentor_tools` / `mcp_servers` first and merge; omit a field to leave it
  unchanged (`null` is a 400); `[]` clears it. `can_use_tools` must be `true`
  when sending `tool_slugs`.
- Server transports are `streamable_http` (default) and `sse`; `auth_scope`
  defaults to `user` (each user signs in or brings a key).
- In chat, a server the user hasn't connected emits `oauth_required` (the turn
  pauses up to 5 min); a server that fails is skipped alone with a `warning`
  naming it; `oauth_authentication_timeout` ends the turn. Frame details:
  `/iblai-api-agent-mcp` `references/in-chat-events.md`.