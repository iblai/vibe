---
name: iblai-agent-search
description: Add the agent search/browse page (starred, featured, custom, and default agents) to your Next.js app
globs:
alwaysApply: false
---

# /iblai-agent-search

Add an **Agent Search** page -- a searchable, filterable agent browser
with four sections: starred agents, featured agents, custom agents, and
all agents. Includes search input, category/subject/LLM/type filters,
star/favorite toggle, and "Create Agent" action.

![Agent Search](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/iblai-agent-search/agent-search.png)

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

## Step 2: Mount `AgentSearch`

`AgentSearch` does NOT use `AgentSettingsProvider`. It takes `tenantKey`,
`username`, and `onAgentClick` as direct props.

```tsx
// app/(app)/agents/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AgentSearch } from "@iblai/iblai-js/web-containers/next";

export default function AgentsPage() {
  const router = useRouter();
  const [tenantKey, setTenantKey] = useState("");
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("userData");
      if (raw) {
        const parsed = JSON.parse(raw);
        setUsername(parsed.user_nicename ?? parsed.username ?? "");
      }
      const resolvedTenant =
        localStorage.getItem("app_tenant") ??
        (() => {
          try {
            return JSON.parse(localStorage.getItem("current_tenant") ?? "{}").key;
          } catch { return undefined; }
        })() ??
        localStorage.getItem("tenant") ??
        "";
      setTenantKey(resolvedTenant);
    } catch {}
  }, []);

  if (!tenantKey) return null;

  return (
    <div className="flex h-full flex-col bg-white p-4">
      <AgentSearch
        tenantKey={tenantKey}
        username={username}
        onAgentClick={(agent) => {
          router.push(`/agents/${agent.unique_id}/settings`);
        }}
        onCreateAgent={() => {
          router.push("/agents/new");
        }}
      />
    </div>
  );
}
```

### Limiting visible sections

By default all four sections render (starred, featured, custom, default).
Use the `include` prop to show only specific sections:

```tsx
<AgentSearch
  tenantKey={tenantKey}
  username={username}
  onAgentClick={handleClick}
  include={["featured", "default"]}
/>
```

## Step 3: Customize Labels (Optional)

```tsx
import { AgentSearch } from "@iblai/iblai-js/web-containers/next";

<AgentSearch
  tenantKey={tenantKey}
  username={username}
  onAgentClick={handleClick}
  labels={{
    sections: {
      starred: { title: "Your favorites" },
      featured: { title: "Recommended mentors" },
    },
  }}
/>;
```

## Step 4: Use MCP Tools for Customization

```
get_component_info("AgentSearch")
get_component_info("AgentCard")
get_hook_info("useAgentSearch")
```

## `<AgentSearch>` Props

Import from `@iblai/iblai-js/web-containers/next`.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `tenantKey` | `string` | Yes | Current platform key |
| `username` | `string \| null` | Yes | Current user (null = unauthenticated) |
| `onAgentClick` | `(agent: AgentSearchResult) => void` | Yes | Called when an agent card is clicked |
| `onCreateAgent` | `() => void` | No | Called when "Create Agent" is clicked. Hides button if omitted |
| `onUnauthenticatedAction` | `() => void` | No | Called when an unauthenticated user tries a protected action |
| `enableRBAC` | `boolean` | No | Toggle RBAC gating (default: `false`) |
| `rbacPermissions` | `object` | No | RBAC permissions object |
| `executeGatedAction` | `(fn: () => unknown) => unknown` | No | Gate callback when `enableRBAC` is true |
| `createAgentRbacResource` | `string` | No | RBAC resource for create (default: `/mentors/#create`) |
| `mainTenantKey` | `string` | No | Main tenant key (default: `"main"`) |
| `labels` | `DeepPartial<AgentSearchLabels>` | No | Override user-visible strings |
| `include` | `AgentSearchSection[]` | No | Sections to show (default: all) |
| `getLLMProviderName` | `(providerKey: string) => string` | No | Map provider key to display name in filters |

## Sub-Components

All importable from `@iblai/iblai-js/web-containers/next` for custom
layouts:

| Component | Description |
|-----------|-------------|
| `AgentCard` | Single agent card with avatar, name, description, date |
| `AgentSearchInput` | Search text field with icon |
| `AgentSearchFilters` | Category/subject/LLM/type filter dropdowns |
| `StarButton` | Favorite toggle star icon |
| `AgentEmptyState` | "No agents found" placeholder |

## Hooks

From `@iblai/iblai-js/web-containers/next`:

| Hook | Description |
|------|-------------|
| `useAgentSearch` | Core search hook wrapping the AI search API |
| `useAgentSearchWithPagination` | Search with load-more pagination |
| `useAgentStar` | Star/unstar mutation hooks |

## Related Exports

From `@iblai/iblai-js/web-containers/next`:

- `AGENT_SEARCH_LABELS` -- default label bundle for AgentSearch.
- `AGENT_PICKER_LABELS` -- default label bundle for a picker variant.
- `resolveAgentSearchLabels` -- deep-merge helper for labels.
- `formatDateString` -- default date formatter used by AgentCard.
- `AgentSearchResult` -- type for a single agent result.

## Step 5: Verify

Run `/iblai-test` before telling the user the work is ready:

1. `pnpm build` -- must pass with zero errors
2. `pnpm test` -- vitest must pass
3. Start dev server and touch test:
   ```bash
   pnpm dev &
   npx playwright screenshot http://localhost:3000/agents /tmp/agent-search.png
   ```

## Important Notes

- **Redux store**: Must include `mentorReducer` and `mentorMiddleware`
- **`initializeDataLayer()`**: 5 args (v1.2+)
- **`@reduxjs/toolkit`**: Deduplicated via webpack aliases in `next.config.ts`
- **Peer deps**: `sonner` and `@iblai/iblai-web-mentor` must be installed
  (`pnpm add sonner @iblai/iblai-web-mentor`)
- **No AgentSettingsProvider**: Unlike the tab components, `AgentSearch`
  takes identity props directly. Do NOT wrap it in `AgentSettingsProvider`.
- **Starred agents**: Require an authenticated user (`username !== null`).
  When `username` is null, the starred section is hidden.
- **Brand guidelines**: [BRAND.md](https://github.com/iblai/vibe/blob/main/BRAND.md)
