---
name: iblai-vibe-agent-history
description: Add the agent History tab (conversation history with filters and export) to your Next.js app
globs:
alwaysApply: false
metadata:
  kind: ui
---

# /iblai-vibe-agent-history

Add the agent **History tab** -- conversation history with rating,
summaries, topic tags, and filters (user, date range, sentiment, topics).
Includes conversation preview, pagination slot, and optional export. This
is one tab in the wider agent-settings family. All tabs share the same
`AgentSettingsProvider` wrapper.

![History Tab](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/iblai-vibe-agent-history/iblai-vibe-agent-history.png)

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

Run `/iblai-vibe-ops-test` before telling the user the work is ready:

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
  layout level. See `/iblai-vibe-agent-setting` Step 2 for the full snippet.
- **Brand guidelines**: [BRAND.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/BRAND.md)
