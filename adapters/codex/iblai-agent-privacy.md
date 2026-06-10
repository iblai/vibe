# iblai-agent-privacy

> Add the agent Privacy tab (PII detection and filtering with redact/mask/block actions, entity-type selection, and AI-response filtering) to your Next.js app

# /iblai-agent-privacy

Add the agent **Privacy tab** -- detect and filter personally
identifiable information (PII) from chat messages. A master "Enable
Privacy Router" toggle reveals the action taken when PII is detected
(**Redact**, **Mask**, or **Block**), an optional block message, a set
of entity-type chips (Person, Email, Phone, SSN, Credit Card, Location,
Date/Time, Passport, Driver's License, IP Address, IBAN, Medical
License, Bank Number), and an "Also filter AI responses" toggle. This is
one tab in the wider agent-settings family. All tabs share the same
`AgentSettingsProvider` wrapper.

![Privacy Tab — Router Disabled](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/iblai-agent-privacy/iblai-agent-privacy-disabled.png)

![Privacy Tab — Block Action](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/iblai-agent-privacy/iblai-agent-privacy-block.png)

![Privacy Tab — Mask Action](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/iblai-agent-privacy/iblai-agent-privacy-mask.png)

![Privacy Tab — Redact Action](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/iblai-agent-privacy/iblai-agent-privacy-redact.png)

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
- MCP server + skills configured (`@iblai/mcp` in `.mcp.json`)
- `AgentSettingsProvider` must wrap the route (see `/iblai-agent-setting`
  Step 2 if not already set up)
- Ask the user for a real `mentorId` (agent UUID). Do NOT invent one.

## Step 1: Check Environment

Before proceeding, check for an `iblai.env` in the project root. Look for
`PLATFORM`, `DOMAIN`, and `TOKEN` variables. If the file does not exist or
is missing these variables, tell the user:
"You need an `iblai.env` with your platform configuration. Download the
template and fill in your values:
`curl -o iblai.env https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/iblai.env`"

## Step 2: Mount `AgentPrivacyTab`

```tsx
// app/(app)/agents/[mentorId]/privacy/page.tsx
"use client";

import { AgentPrivacyTab } from "@iblai/iblai-js/web-containers/next";

export default function AgentPrivacyPage() {
  return (
    <div className="flex h-full flex-col bg-white">
      <AgentPrivacyTab />
    </div>
  );
}
```

The tab reads `tenantKey`, `mentorId`, and `username` from the nearest
`<AgentSettingsProvider>`. The master **Enable Privacy Router** toggle
gates every dependent control — action, block message, entity types, and
the AI-response filter only render when the router is on. The default
action is **Redact**; the **Block Message** field only appears when the
action is **Block**.

### With identity overrides

When the tab is not rendered inside an `<AgentSettingsProvider>`, pass
identity explicitly:

```tsx
<AgentPrivacyTab
  tenantKey="my-tenant"
  mentorId="00000000-0000-0000-0000-000000000000"
  username="learner@example.com"
/>;
```

### With RBAC and gated mutations

```tsx
<AgentPrivacyTab
  enableRBAC
  executeGatedAction={(fn) => withConfirm(fn)}
/>;
```

`enableRBAC` honors field-level permissions from mentor settings (each
field — `enable_privacy_router`, `privacy_action`, `privacy_response`,
`privacy_entities`, `enable_privacy_output_filter` — can be
independently disabled). `executeGatedAction` wraps every save so the
host app can interpose a confirmation or upgrade gate.

## Step 3: Customize Labels (Optional)

```tsx
import { AgentPrivacyTab } from "@iblai/iblai-js/web-containers/next";

<AgentPrivacyTab
  labels={{
    header: { title: "Data privacy", description: "Filter PII from chats." },
  }}
/>;
```

## Step 4: Use MCP Tools for Customization

```
get_component_info("AgentPrivacyTab")
get_component_info("AgentSettingsProvider")
```

## `<AgentPrivacyTab>` Props

Import from `@iblai/iblai-js/web-containers/next`.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `labels` | `DeepPartial<PrivacyTabLabels>` | No | Override user-visible strings (header, field labels, tooltips, action descriptions, entity labels, toasts) |
| `tenantKey` | `string` | No | Identity override. Defaults to the nearest `<AgentSettingsProvider>` |
| `mentorId` | `string` | No | Agent UUID override. Defaults to the provider |
| `username` | `string` | No | Username override. Defaults to the provider |
| `enableRBAC` | `boolean` | No | Honor per-field permissions from mentor settings. Defaults to the provider value or `false` |
| `executeGatedAction` | `(fn: () => unknown) => unknown` | No | Wrap each save mutation (e.g. confirmation/upgrade gate). Defaults to the provider value |

## Related Exports

From `@iblai/iblai-js/web-containers/next`:

- `AGENT_PRIVACY_TAB_LABELS` -- the default agent-facing label bundle.
- `PrivacyTabLabels` -- type for the full label bundle.

The privacy action and entity-type vocabularies are owned by the data
layer (`@iblai/data-layer`): `PRIVACY_ACTIONS`, `PRIVACY_ENTITY_TYPES`,
and the `PrivacyAction` / `PrivacyEntityType` types.

## Step 5: Verify

Run `/iblai-ops-test` before telling the user the work is ready:

1. `pnpm build` -- must pass with zero errors
2. `pnpm test` -- vitest must pass
3. Start dev server and touch test:
   ```bash
   pnpm dev &
   npx playwright screenshot http://localhost:3000/agents/<id>/privacy /tmp/agent-privacy.png
   ```

## Important Notes

- **Redux store**: Must include `mentorReducer` and `mentorMiddleware`
- **`initializeDataLayer()`**: 5 args (v1.2+)
- **`@reduxjs/toolkit`**: Deduplicated via webpack aliases in `next.config.ts`
- **Peer deps**: `sonner` and `@iblai/iblai-web-mentor` must be installed
  (`pnpm add sonner @iblai/iblai-web-mentor`)
- **Shared provider**: `AgentSettingsProvider` must wrap the route at a
  layout level. See `/iblai-agent-setting` Step 2 for the full snippet.
- **JSON settings endpoint**: Privacy fields are persisted via the JSON
  `/settings/` mutation (not the multipart variant) so array fields like
  `privacy_entities` round-trip cleanly. The tab refetches mentor
  settings after each save because that mutation does not invalidate the
  settings cache tag.
- **Action descriptions**: Redact replaces PII with its type
  (`Email [EMAIL_ADDRESS]`); Mask hides it behind asterisks
  (`Email ***********`); Block rejects the message and shows your block
  message. Empty entity types means "use defaults".
- **Brand guidelines**: [BRAND.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/BRAND.md)