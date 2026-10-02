# iblai-vibe-agent-llm

> Add the agent LLM tab (pick the provider and model the agent answers with) to your Next.js app. Use when the user mentions the agent's model, LLM, provider, switching to GPT / Claude / Gemini, or the model picker. For the REST contract see /iblai-api-agent-llm.

# /iblai-vibe-agent-llm

Add the agent **LLM tab** -- which provider and model the agent answers with.
**Scope: per agent.** The choice is saved on the agent's settings
(`llm_provider` + `llm_name`), so every user who chats with the agent gets the
same model. The tab shows a searchable grid of provider cards; clicking a card
opens that provider's models, and clicking a model saves it. This is one tab
in the agent-settings family indexed by `/iblai-vibe-agent`; it shares the
`AgentSettingsProvider` wrapper with every other tab.

**Providers** -- one card per provider the platform offers. The agent's
current provider has a blue border. Providers the organization holds no
usable key for are tinted gray and sorted last. Names and logos come from the
API; a provider without a logo shows its initial.

![LLM tab -- providers](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-vibe-agent-llm/iblai-vibe-agent-llm-1-providers.png)

**Model picker** -- a card opens **LLM Selection** with that provider's
models, searchable. The current model is highlighted. Clicking another model
saves it at once (no confirm step) and toasts "LLM updated successfully".

![LLM tab -- model picker](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-vibe-agent-llm/iblai-vibe-agent-llm-2-models.png)

> **Common setup (brand, conventions, env files, verification):** see [docs/skill-setup.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/docs/skill-setup.md).

## Prerequisites

- Auth set up (`/iblai-vibe-auth`, or vibe-starter).
- `AgentSettingsProvider` wraps the route (`/iblai-vibe-agent` §1).
- `@iblai/iblai-js` ≥ 2.26 (resolves `@iblai/web-containers` 1.32). Check with
  `pnpm why @iblai/web-containers`.
- A real agent UUID. Ask the user; never invent one.
- Provider keys are organization settings, not part of this tab. A provider
  without a key stays grayed out; adding keys is an admin task
  (`/iblai-api-integration`).

## Step 1: Check Environment

Look for `iblai.env` in the project root with `PLATFORM`, `DOMAIN`, and
`TOKEN`. If it is missing, tell the user:
"You need an `iblai.env` with your platform configuration. Download the
template and fill in your values:
`curl -o iblai.env https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/iblai.env`"

## Step 2: Mount `AgentLLMTab`

```tsx
// app/(app)/agents/[mentorId]/llm/page.tsx
"use client";

import { AgentLLMTab } from "@iblai/iblai-js/web-containers/next";

export default function AgentLLMPage() {
  return (
    <div className="flex h-full flex-col bg-white">
      <AgentLLMTab />
    </div>
  );
}
```

The tab reads `tenantKey`, `mentorId`, and `username` from
`AgentSettingsProvider` and does its own fetching and saving. No props are
required. Provider names and logos are owned by the API, so there is no logo
map to pass: the old `getLLMProviderDetails` prop and `LLMProviderDetails`
type are gone.

To reuse the tab outside the settings page -- for example a "switch model"
dialog opened from the chat header -- drop the header and point it at the
agent in the chat:

```tsx
import { AgentLLMTab } from "@iblai/iblai-js/web-containers/next";

export function SwitchModel({ agentId }: { agentId: string }) {
  return <AgentLLMTab showConfigurationHeader={false} mentorId={agentId} />;
}
```

## Step 3: Customize Labels (Optional)

The tab renders with the default agent-facing copy (`AGENT_LLM_TAB_LABELS`,
localized through the SDK's i18n). Pass a partial `labels` object to change
any string:

```tsx
import { AgentLLMTab } from "@iblai/iblai-js/web-containers/next";

<AgentLLMTab
  labels={{
    header: { title: "Model" },
    providerModal: { title: "Choose a model" },
  }}
/>;
```

Label groups (`LLMTabLabels`): `header` (`title`, `description`), `infoBox`,
`search.placeholder`, `providerLogoAlt(name)`, `toasts` (`updateSuccess`,
`updateError`), and `providerModal` -- `title`, `description(name)`,
`searchPlaceholder`, `helpText`, `providerIconAlt(name)`, the on-device
download dialogs (`tooLargeTitle`, `tooLargeDescription`, `cancel`,
`downloadAnyway`, `alreadyDownloadingTitle`, `alreadyDownloadingDescription`,
`unnamedModel`, `gotIt`), screen-reader announcements (`announce*`), and
`localModel` (`LocalModelRowLabels`, the on-device row copy).

## Step 4: Use MCP Tools for Customization

```
get_component_info("AgentLLMTab")
get_component_info("AgentSettingsProvider")
```

## `<AgentLLMTab>` Props

Import from `@iblai/iblai-js/web-containers/next`.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `labels` | `DeepPartial<LLMTabLabels>` | No | Override user-visible strings |
| `showConfigurationHeader` | `boolean` | No | Show the title bar and side padding. Defaults to `true`; pass `false` inside a dialog |
| `mentorId` | `string` | No | Agent UUID to configure, overriding `AgentSettingsProvider` |

## Related Exports

From `@iblai/iblai-js/web-containers/next`:

- `AGENT_LLM_TAB_LABELS`, `resolveLLMTabLabels` -- the default label bundle
  and its merge helper.
- `LLMProviderModal` (`LLMProviderModalProps`) -- the model picker on its own.
- `LocalModelRow` (`LocalModelRowProps`, `LocalRowStatus`) -- an on-device
  model row.
- `getProviderName` -- folds provider keys and display names onto one id
  (`"Microsoft"` and `"azure_openai"` both give `azure_openai`).
- `AgentLLMTabProps`, `LLMTabLabels`, `LocalModelRowLabels`, `LLMProvider`,
  `LLMProviderType` -- types.

## How it saves

| Action | Request |
|---|---|
| Load | `GET mentor-llms/?mentor_id=<uuid>` (providers with `chat_models`, `logo`, and credential flags) and the agent's settings (current `llm_provider`, `llm_name`) |
| Click a model | `PUT mentors/{uuid}/settings/` with `llm_provider` and `llm_name` |

A model is disabled when its provider has no usable key or no models, or
when it is already selected.

## Platform data

| Hook | Purpose |
|---|---|
| `useGetLlmsQuery` | Providers and their models |
| `useGetMentorSettingsQuery` | The agent's current provider and model |
| `useEditMentorMutation` | Save the new provider and model |

REST twin: [`/iblai-api-agent-llm`](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-api-agent-llm/SKILL.md).

## Step 5: Verify

Run `/iblai-vibe-ops-test` before telling the user the work is ready:

1. `pnpm build` -- must pass with zero errors.
2. `pnpm test` -- vitest must pass.
3. `pnpm dev`, sign in, open `/agents/<uuid>/llm`: the provider grid renders
   with the current provider outlined; open it -- the current model is
   highlighted.
4. `npx playwright screenshot http://localhost:3000/agents/<uuid>/llm /tmp/agent-llm.png`

## Important Notes

- **Per agent, not per user**: everyone who chats with the agent gets the
  model chosen here.
- **No confirm step**: clicking a model saves it. Explore on a test agent.
- **On-device models**: in the ibl.ai desktop app (Tauri) the picker also
  lists downloadable on-device models (`/iblai-vibe-local-llm`); on the web it
  shows cloud models only.
- **Shared provider**: mount `AgentSettingsProvider` once at the layout
  level (`/iblai-vibe-agent` §1); do not wrap each tab.
- **Peer deps**: `sonner` and `@iblai/iblai-web-mentor`
  (`pnpm add sonner @iblai/iblai-web-mentor`).
- **Brand guidelines**: [BRAND.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/BRAND.md)