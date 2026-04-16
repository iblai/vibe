---
name: iblai-tools-tab
description: Add the agent Tools tab (enable/disable agent tools) to your Next.js app
globs:
alwaysApply: false
---

# /iblai-tools-tab

Add the agent **Tools tab** -- a toggleable list of agent tools with
display names, descriptions in tooltips, and switches for enabling or
disabling each tool. This is one tab in the wider agent-settings family.
All tabs share the same `AgentSettingsProvider` wrapper.

![Tools Tab](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/iblai-tools-tab/tools-tab.png)

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

You MUST run `/iblai-test` before telling the user the work is ready.

After all work is complete, start a dev server (`pnpm dev`) so the user
can see the result at http://localhost:3000.

`iblai.env` is NOT a `.env.local` replacement — it only holds the 3
shorthand variables (`DOMAIN`, `PLATFORM`, `TOKEN`). Next.js still reads
its runtime env vars from `.env.local`.

Use `pnpm` as the default package manager. Fall back to `npm` if pnpm
is not installed.

## Prerequisites

- Auth must be set up first (`/iblai-auth`)
- MCP and skills must be set up: `iblai add mcp`
- `AgentSettingsProvider` must wrap the route (see `/iblai-settings-tab`
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

## Step 3: Customize Labels (Optional)

```tsx
import { AgentToolsTab } from "@iblai/iblai-js/web-containers/next";

<AgentToolsTab
  labels={{
    header: { title: "Mentor tools" },
  }}
/>;
```

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

- `AGENT_TOOLS_TAB_LABELS` -- the default agent-facing label bundle.
- `ToolsTabLabels` -- type for the full label bundle.

## Step 5: Verify

Run `/iblai-test` before telling the user the work is ready:

1. `pnpm build` -- must pass with zero errors
2. `pnpm test` -- vitest must pass
3. Start dev server and touch test:
   ```bash
   pnpm dev &
   npx playwright screenshot http://localhost:3000/agents/<id>/tools /tmp/tools-tab.png
   ```

## Important Notes

- **Redux store**: Must include `mentorReducer` and `mentorMiddleware`
- **`initializeDataLayer()`**: 5 args (v1.2+)
- **`@reduxjs/toolkit`**: Deduplicated via webpack aliases in `next.config.ts`
- **Peer deps**: `sonner` and `@iblai/iblai-web-mentor` must be installed
  (`pnpm add sonner @iblai/iblai-web-mentor`)
- **Shared provider**: `AgentSettingsProvider` must wrap the route at a
  layout level. See `/iblai-settings-tab` Step 2 for the full snippet.
- **Brand guidelines**: [BRAND.md](https://github.com/iblai/vibe/blob/main/BRAND.md)
