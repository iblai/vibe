---
name: iblai-vibe-agent-safety
description: Add the agent Safety tab (moderation prompts and flagged content) to your Next.js app
globs:
alwaysApply: false
metadata:
  kind: ui
---

# /iblai-vibe-agent-safety

Add the agent **Safety tab** -- a two-column layout of editable safety
and moderation prompt cards with toggle switches, plus an optional
flagged prompts modal. This is one tab in the wider agent-settings
family. All tabs share the same `AgentSettingsProvider` wrapper.

![Safety Tab](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/iblai-vibe-agent-safety/iblai-vibe-agent-safety.png)

> **Common setup (brand, conventions, env files, verification):** see [docs/skill-setup.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/docs/skill-setup.md).

## Prerequisites

- Auth must be set up first (`/iblai-vibe-auth`)
- MCP server + skills configured (`@iblai/mcp` in `.mcp.json`)
- `AgentSettingsProvider` must wrap the route (see `/iblai-vibe-agent-setting`
  Step 2 if not already set up)
- Ask the user for a real `mentorId` (agent UUID). Do NOT invent one.

## Step 1: Check Environment

Before proceeding, check for an `iblai.env` in the project root. Look for
`PLATFORM`, `DOMAIN`, and `TOKEN` variables. If the file does not exist or
is missing these variables, tell the user:
"You need an `iblai.env` with your platform configuration. Download the
template and fill in your values:
`curl -o iblai.env https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/iblai.env`"

## Step 2: Mount `AgentSafetyTab`

```tsx
// app/(app)/agents/[mentorId]/safety/page.tsx
"use client";

import { AgentSafetyTab } from "@iblai/iblai-js/web-containers/next";

export default function AgentSafetyPage() {
  return (
    <div className="flex h-full flex-col bg-white">
      <AgentSafetyTab />
    </div>
  );
}
```

### With Markdown rendering and flagged prompts

```tsx
import ReactMarkdown from "react-markdown";

<AgentSafetyTab
  renderPromptContent={(content) => <ReactMarkdown>{content}</ReactMarkdown>}
  showFlaggedPrompts
  FlaggedPromptsModal={({ isOpen, onClose, mentorId, tenantKey, username }) => (
    <MyFlaggedPromptsModal
      open={isOpen}
      onClose={onClose}
      mentorId={mentorId}
      tenantKey={tenantKey}
      username={username}
    />
  )}
/>;
```

## Step 3: Customize Labels (Optional)

```tsx
import { AgentSafetyTab } from "@iblai/iblai-js/web-containers/next";

<AgentSafetyTab
  labels={{
    header: { title: "Mentor safety" },
  }}
/>;
```

## Step 4: Use MCP Tools for Customization

```
get_component_info("AgentSafetyTab")
get_component_info("AgentSettingsProvider")
```

## `<AgentSafetyTab>` Props

Import from `@iblai/iblai-js/web-containers/next`.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `labels` | `DeepPartial<SafetyTabLabels>` | No | Override user-visible strings |
| `renderPromptContent` | `(content: string) => ReactNode` | No | Render prompt text as rich content. Defaults to plain text |
| `FlaggedPromptsModal` | `ComponentType<{ isOpen, onClose, mentorId, tenantKey, username }>` | No | Custom modal for reviewing flagged prompts |
| `showFlaggedPrompts` | `boolean` | No | Show the "Flagged Prompts" button |

## Related Exports

From `@iblai/iblai-js/web-containers/next`:

- `AGENT_SAFETY_TAB_LABELS` -- the default agent-facing label bundle.
- `SafetyTabLabels` -- type for the full label bundle.
- `SafetySelectedPrompt` -- type for a selected prompt entry.
- `SafetyEditFormValues` -- type for the edit form state.

## Step 5: Verify

Run `/iblai-vibe-ops-test` before telling the user the work is ready:

1. `pnpm build` -- must pass with zero errors
2. `pnpm test` -- vitest must pass
3. Start dev server and touch test:
   ```bash
   pnpm dev &
   npx playwright screenshot http://localhost:3000/agents/<id>/safety /tmp/agent-safety.png
   ```

## Important Notes

- **Redux store**: Must include `mentorReducer` and `mentorMiddleware`
- **`initializeDataLayer()`**: 5 args (v1.2+)
- **`@reduxjs/toolkit`**: Deduplicated via webpack aliases in `next.config.ts`
- **Peer deps**: `sonner` and `@iblai/iblai-web-mentor` must be installed
  (`pnpm add sonner @iblai/iblai-web-mentor`)
- **Shared provider**: `AgentSettingsProvider` must wrap the route at a
  layout level. See `/iblai-vibe-agent-setting` Step 2 for the full snippet.
- **FlaggedPromptsModal**: Injected by the host app to avoid pulling in
  standalone-specific dependencies. Without it, the "Flagged Prompts"
  button is hidden unless `showFlaggedPrompts` is `true`.
- **Brand guidelines**: [BRAND.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/BRAND.md)
