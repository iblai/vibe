---
name: iblai-llm-tab
description: Add the agent LLM tab (model provider selection) to your Next.js app
globs:
alwaysApply: false
---

# /iblai-llm-tab

Add the agent **LLM tab** -- a searchable grid of LLM provider cards with
a modal for selecting specific models within a chosen provider. This is
one tab in the wider agent-settings family. All tabs share the same
`AgentSettingsProvider` wrapper.

![LLM Tab](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/iblai-llm-tab/llm-tab.png)

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

## Step 2: Mount `AgentLLMTab`

`AgentLLMTab` has one required prop: `getLLMProviderDetails`. This maps a
provider name to display info (logo URL, display name). The host app
provides this because logos and display names are host-specific.

```tsx
// app/(app)/agents/[mentorId]/llm/page.tsx
"use client";

import {
  AgentLLMTab,
  type LLMProviderDetails,
} from "@iblai/iblai-js/web-containers/next";

function getLLMProviderDetails(
  providerName: string,
  llmName?: string,
): LLMProviderDetails {
  const providers: Record<string, LLMProviderDetails> = {
    openai: { name: "OpenAI", logo: "/logos/openai.svg" },
    anthropic: { name: "Anthropic", logo: "/logos/anthropic.svg" },
    google: { name: "Google", logo: "/logos/google.svg" },
  };
  return (
    providers[providerName] ?? {
      name: providerName,
      logo: "/logos/default.svg",
    }
  );
}

export default function AgentLLMPage() {
  return (
    <div className="flex h-full flex-col bg-white">
      <AgentLLMTab getLLMProviderDetails={getLLMProviderDetails} />
    </div>
  );
}
```

## Step 3: Customize Labels (Optional)

```tsx
import { AgentLLMTab } from "@iblai/iblai-js/web-containers/next";

<AgentLLMTab
  getLLMProviderDetails={getLLMProviderDetails}
  labels={{
    header: { title: "Model configuration" },
  }}
/>;
```

## Step 4: Use MCP Tools for Customization

```
get_component_info("AgentLLMTab")
get_component_info("AgentSettingsProvider")
```

## `<AgentLLMTab>` Props

Import from `@iblai/iblai-js/web-containers/next`.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `getLLMProviderDetails` | `(providerName: string, llmName?: string) => LLMProviderDetails` | Yes | Maps provider name to display info (logo, display name) |
| `labels` | `DeepPartial<LLMTabLabels>` | No | Override user-visible strings |
| `showConfigurationHeader` | `boolean` | No | Show/hide the configuration header |

## Related Exports

From `@iblai/iblai-js/web-containers/next`:

- `AGENT_LLM_TAB_LABELS` -- the default agent-facing label bundle.
- `LLMTabLabels` -- type for the full label bundle.
- `LLMProviderDetails` -- type for the return value of `getLLMProviderDetails`.
- `LLMProvider`, `Provider` -- types for provider data structures.

## Step 5: Verify

Run `/iblai-test` before telling the user the work is ready:

1. `pnpm build` -- must pass with zero errors
2. `pnpm test` -- vitest must pass
3. Start dev server and touch test:
   ```bash
   pnpm dev &
   npx playwright screenshot http://localhost:3000/agents/<id>/llm /tmp/llm-tab.png
   ```

## Important Notes

- **Redux store**: Must include `mentorReducer` and `mentorMiddleware`
- **`initializeDataLayer()`**: 5 args (v1.2+)
- **`@reduxjs/toolkit`**: Deduplicated via webpack aliases in `next.config.ts`
- **Peer deps**: `sonner` and `@iblai/iblai-web-mentor` must be installed
  (`pnpm add sonner @iblai/iblai-web-mentor`)
- **Shared provider**: `AgentSettingsProvider` must wrap the route at a
  layout level. See `/iblai-settings-tab` Step 2 for the full snippet.
- **Required prop**: `getLLMProviderDetails` is host-provided because
  logos and display names vary per deployment.
- **Brand guidelines**: [BRAND.md](https://github.com/iblai/vibe/blob/main/BRAND.md)
