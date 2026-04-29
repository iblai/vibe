---
name: iblai-agent-embed
description: Add the agent Embed tab (embed code, custom styling, shareable links) to your Next.js app
globs:
alwaysApply: false
---

# /iblai-agent-embed

Add the agent **Embed tab** -- a comprehensive embed configuration
interface with CSS/JS editors, custom floating bubble styling, visibility
controls, shareable links, and an embedded agent preview iframe. This is
one tab in the wider agent-settings family. All tabs share the same
`AgentSettingsProvider` wrapper.

![Embed Tab](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/iblai-agent-embed/iblai-agent-embed.png)

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
- Follow [BRAND.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/BRAND.md) for
  colors, typography, spacing, and component styles.

You MUST run `/iblai-ops-test` before telling the user the work is ready.

After all work is complete, start a dev server (`pnpm dev`) so the user
can see the result at http://localhost:3000.

`iblai.env` is NOT a `.env.local` replacement — it only holds the 3
shorthand variables (`DOMAIN`, `PLATFORM`, `TOKEN`). Next.js still reads
its runtime env vars from `.env.local`.

Use `pnpm` as the default package manager. Fall back to `npm` if pnpm
is not installed.

> **Common setup (brand, conventions, env files, verification):** see [docs/skill-setup.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/docs/skill-setup.md).

## Prerequisites

- Auth must be set up first (`/iblai-auth`)
- MCP and skills must be set up: `iblai add mcp`
- `AgentSettingsProvider` must wrap the route (see `/iblai-agent-setting`
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

## Step 2: Mount `AgentEmbedTab`

`AgentEmbedTab` has three required props: `urls`, `CopyCodeBlock`, and
`visibilityOptions`. These are host-provided because they depend on
the deployment environment and the host app's UI library.

```tsx
// app/(app)/agents/[mentorId]/embed/page.tsx
"use client";

import {
  AgentEmbedTab,
  type EmbedUrlConfig,
  type VisibilityOption,
} from "@iblai/iblai-js/web-containers/next";

const urls: EmbedUrlConfig = {
  dmUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "",
  axdUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "",
  mentorIframeUrl: typeof window !== "undefined" ? window.location.origin : "",
  authUrl: process.env.NEXT_PUBLIC_AUTH_URL ?? "",
};

const visibilityOptions: VisibilityOption[] = [
  { label: "Public", value: "public" },
  { label: "Private", value: "private" },
  { label: "Unlisted", value: "unlisted" },
];

function CopyCodeBlock({ code }: { code: string }) {
  return (
    <pre className="overflow-auto rounded bg-gray-100 p-3 text-xs">
      <code>{code}</code>
    </pre>
  );
}

export default function AgentEmbedPage() {
  return (
    <div className="flex h-full flex-col bg-white">
      <AgentEmbedTab
        urls={urls}
        CopyCodeBlock={CopyCodeBlock}
        visibilityOptions={visibilityOptions}
      />
    </div>
  );
}
```

## Step 3: Customize Labels (Optional)

```tsx
import { AgentEmbedTab } from "@iblai/iblai-js/web-containers/next";

<AgentEmbedTab
  urls={urls}
  CopyCodeBlock={CopyCodeBlock}
  visibilityOptions={visibilityOptions}
  labels={{
    header: { title: "Embed your mentor" },
  }}
/>;
```

## Step 4: Use MCP Tools for Customization

```
get_component_info("AgentEmbedTab")
get_component_info("AgentSettingsProvider")
```

## `<AgentEmbedTab>` Props

Import from `@iblai/iblai-js/web-containers/next`.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `urls` | `EmbedUrlConfig` | Yes | URL config: `{ dmUrl, axdUrl, mentorIframeUrl, authUrl }` |
| `CopyCodeBlock` | `ComponentType<{ code: string }>` | Yes | Renders code snippets with copy support |
| `visibilityOptions` | `VisibilityOption[]` | Yes | Options for the visibility dropdown |
| `labels` | `DeepPartial<EmbedTabLabels>` | No | Override user-visible strings |
| `ssoProviders` | `SsoProvider[]` | No | SSO provider list for embed auth config |
| `isSsoProvidersError` | `boolean` | No | Whether SSO providers failed to load (defaults to `true`) |
| `supportEmail` | `string` | No | Support email shown in SSO error states |

## Related Exports

From `@iblai/iblai-js/web-containers/next`:

- `AGENT_EMBED_TAB_LABELS` -- the default agent-facing label bundle.
- `EmbedTabLabels` -- type for the full label bundle.
- `EmbedUrlConfig` -- type for the `urls` prop.
- `VisibilityOption` -- type for visibility dropdown entries.
- `SsoProvider` -- type for SSO provider entries.

## Step 5: Verify

Run `/iblai-ops-test` before telling the user the work is ready:

1. `pnpm build` -- must pass with zero errors
2. `pnpm test` -- vitest must pass
3. Start dev server and touch test:
   ```bash
   pnpm dev &
   npx playwright screenshot http://localhost:3000/agents/<id>/embed /tmp/agent-embed.png
   ```

## Important Notes

- **Redux store**: Must include `mentorReducer` and `mentorMiddleware`
- **`initializeDataLayer()`**: 5 args (v1.2+)
- **`@reduxjs/toolkit`**: Deduplicated via webpack aliases in `next.config.ts`
- **Peer deps**: `sonner` and `@iblai/iblai-web-mentor` must be installed
  (`pnpm add sonner @iblai/iblai-web-mentor`)
- **Shared provider**: `AgentSettingsProvider` must wrap the route at a
  layout level. See `/iblai-agent-setting` Step 2 for the full snippet.
- **Required props**: Unlike most tabs, `AgentEmbedTab` requires three props
  (`urls`, `CopyCodeBlock`, `visibilityOptions`) because they are
  host-specific.
- **Brand guidelines**: [BRAND.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/BRAND.md)
