---
name: iblai-agent-history
description: Add the agent History tab (conversation history with filters and export) to your Next.js app
globs:
alwaysApply: false
---

# /iblai-agent-history

Add the agent **History tab** -- conversation history with rating,
summaries, topic tags, and filters (user, date range, sentiment, topics).
Includes conversation preview, pagination slot, and optional export. This
is one tab in the wider agent-settings family. All tabs share the same
`AgentSettingsProvider` wrapper.

![History Tab](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/iblai-agent-history/iblai-agent-history.png)

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
- `AgentSettingsProvider` must wrap the route (see `/iblai-agent-settings`
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

## Step 2: Mount `AgentHistoryTab`

```tsx
// app/(app)/agents/[mentorId]/history/page.tsx
"use client";

import { AgentHistoryTab } from "@iblai/iblai-js/web-containers/next";

export default function AgentHistoryPage() {
  return (
    <div className="flex h-full flex-col bg-white">
      <AgentHistoryTab />
    </div>
  );
}
```

### With Markdown rendering and export

```tsx
import ReactMarkdown from "react-markdown";

<AgentHistoryTab
  renderMessageContent={(content) => <ReactMarkdown>{content}</ReactMarkdown>}
  onExport={(filters) => {
    console.log("export with filters", filters);
  }}
  isExporting={false}
/>;
```

### With pagination

```tsx
<AgentHistoryTab
  PaginationComponent={({ currentPage, totalPages, onPageChange, disabled }) => (
    <MyPagination
      page={currentPage}
      total={totalPages}
      onChange={onPageChange}
      disabled={disabled}
    />
  )}
/>;
```

## Step 3: Customize Labels (Optional)

```tsx
import { AgentHistoryTab } from "@iblai/iblai-js/web-containers/next";

<AgentHistoryTab
  labels={{
    header: { title: "Mentor conversations" },
  }}
/>;
```

## Step 4: Use MCP Tools for Customization

```
get_component_info("AgentHistoryTab")
get_component_info("AgentSettingsProvider")
```

## `<AgentHistoryTab>` Props

Import from `@iblai/iblai-js/web-containers/next`.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `labels` | `DeepPartial<HistoryTabLabels>` | No | Override user-visible strings |
| `renderMessageContent` | `(content: string) => ReactNode` | No | Render AI messages as rich text. Defaults to plain text |
| `PaginationComponent` | `ComponentType<{ currentPage, totalPages, onPageChange, disabled, disableNumberedButtons? }>` | No | Custom pagination. Without it no pagination UI renders |
| `onExport` | `(filters: ChatHistoryFilter) => void` | No | Called with current filters when Export is clicked |
| `isExporting` | `boolean` | No | Whether an export is in progress |

## Related Exports

From `@iblai/iblai-js/web-containers/next`:

- `HistoryTabLabels` -- type for the full label bundle.

## Step 5: Verify

Run `/iblai-test` before telling the user the work is ready:

1. `pnpm build` -- must pass with zero errors
2. `pnpm test` -- vitest must pass
3. Start dev server and touch test:
   ```bash
   pnpm dev &
   npx playwright screenshot http://localhost:3000/agents/<id>/history /tmp/agent-history.png
   ```

## Important Notes

- **Redux store**: Must include `mentorReducer` and `mentorMiddleware`
- **`initializeDataLayer()`**: 5 args (v1.2+)
- **`@reduxjs/toolkit`**: Deduplicated via webpack aliases in `next.config.ts`
- **Peer deps**: `sonner` and `@iblai/iblai-web-mentor` must be installed
  (`pnpm add sonner @iblai/iblai-web-mentor`)
- **Shared provider**: `AgentSettingsProvider` must wrap the route at a
  layout level. See `/iblai-agent-settings` Step 2 for the full snippet.
- **Brand guidelines**: [BRAND.md](https://github.com/iblai/vibe/blob/main/BRAND.md)
