# iblai-vibe-agent-llm

> Add the agent LLM tab (model provider selection, in-chat model change, models users can pick) to your Next.js app

# /iblai-vibe-agent-llm

Add the agent **LLM tab** -- a searchable grid of LLM provider cards with
a modal for selecting specific models within a chosen provider. This is
one tab in the wider agent-settings family. All tabs share the same
`AgentSettingsProvider` wrapper.

Above the grid sit two boxes:

- **Allow In-Chat Model Change** -- a switch that lets users pick another
  model for their own chat session (it resets to the agent's model on a new
  chat). It moved here from Settings → Capabilities in `@iblai/iblai-js`
  2.44.0.
- **Models Users Can Pick** -- shown only to an organization admin
  (`isTenantAdmin`) while the switch is on. It counts the models users are
  allowed and holds the **User Models** button.

![LLM tab -- Allow In-Chat Model Change and Models Users Can Pick above the provider grid](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-vibe-agent-llm/iblai-vibe-agent-llm.png)

Clicking a provider card opens **LLM Selection**, where you pick the model
this agent runs on:

![LLM Selection modal (models of the chosen provider)](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-vibe-agent-llm/iblai-vibe-agent-llm-2-model-selection.png)

**User Models** opens a dialog of provider cards (searchable, with
"N of M allowed" or "All allowed" on each). It sets which models users in
the organization can pick, for every agent:

![User Models dialog -- provider cards with how many models each allows](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-vibe-agent-llm/iblai-vibe-agent-llm-3-users-models.png)

A card opens the same LLM Selection modal as a checklist: **Allow All
{Provider} Models** (new models of that provider included), a checkbox per
model, "N of M selected" and **Done**. Every tick saves at once:

![LLM Selection as a checklist -- Allow All OpenAI Models and one checkbox per model](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-vibe-agent-llm/iblai-vibe-agent-llm-4-users-models-provider.png)

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

## Step 2: Mount `AgentLLMTab`

`AgentLLMTab` has no required props. Provider names and logos come from
the backend's model catalogue (the same `mentor-llms` read the picker
uses), so the host supplies no mapper. Older SDK releases took a required
`getLLMProviderDetails` prop; it no longer exists.

```tsx
// app/(app)/agents/[mentorId]/llm/page.tsx
"use client";

import { AgentLLMTab } from "@iblai/iblai-js/web-containers/next";
import { useAdminMode } from "@/lib/iblai/admin-mode";

export default function AgentLLMPage() {
  // An organization admin viewing in Admin mode (the starter's User/Admin switch).
  const { adminMode } = useAdminMode();
  return (
    <div className="flex h-full flex-col bg-white">
      <AgentLLMTab isTenantAdmin={adminMode} />
    </div>
  );
}
```

`isTenantAdmin` only decides whether the **Models Users Can Pick** box and
the User Models dialog render; the backend refuses the save for anyone who
is not an organization admin. Leave it out (default `false`) on surfaces
members reach, and in a "switch model" dialog opened from the chat.

The tab reads `tenantKey`, `mentorId` and `username` from the nearest
`<AgentSettingsProvider>`. Pass `mentorId` to configure a different agent
than the provider describes — a host can mount the tab in a "switch
model" dialog opened from the chat chrome, where the agent being
configured is the one in the chat (the ibl.ai OS does exactly this):

```tsx
<AgentLLMTab mentorId={chatMentorId} showConfigurationHeader={false} />;
```

## Step 3: Customize Labels (Optional)

```tsx
import { AgentLLMTab } from "@iblai/iblai-js/web-containers/next";

<AgentLLMTab
  labels={{
    header: { title: "Model Configuration" },
    inChatModelChange: { label: "Let Users Switch Models" },
  }}
/>;
```

`LLMTabLabels` groups: `header`, `infoBox`, `inChatModelChange` (`label`,
`description`, `tooltip`, `tooltipAriaLabel`), `search`, `providerLogoAlt`,
`toasts`, and `providerModal`. The User Models dialog's copy is not in
`labels`; it follows the SDK's locale.

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
| `showConfigurationHeader` | `boolean` | No | Show/hide the configuration header (default `true`) |
| `mentorId` | `string` | No | Configure this agent instead of the one from `<AgentSettingsProvider>` — for a model picker opened from a chat |
| `isTenantAdmin` | `boolean` | No | Organization admin acting as one: while Allow In-Chat Model Change is on, shows **Models Users Can Pick** and the User Models dialog (default `false`) |

## How it saves

| Control | Request | Body |
|---------|---------|------|
| Model in LLM Selection | `PUT /api/ai-mentor/orgs/{org}/users/{username}/mentors/{mentor}/settings/` (`useEditMentorMutation`) | `llm_provider`, `llm_name` |
| Allow In-Chat Model Change | same settings `PUT`, at once (through `executeGatedAction` when the provider sets one) | `enable_in_chat_llm_change` |
| User Models dialog (read) | `GET /api/core/rbac/llm-access/status/?platform_key={org}` (`useGetLlmAccessQuery`) | -- |
| Each tick in the checklist | `POST /api/core/rbac/llm-access/set/` (`useSetLlmAccessMutation`) | `{ platform_key, llm_resources }`, the whole list |

`llm_resources` holds RBAC paths: `llms/` (every model), `llms/<provider>/`
(every model of one provider, new ones included) and
`llms/<provider>/models/<llm_name>` (one model), built from the provider
`name` and the model `llm_name`. Saves run one at a time and the last tick
wins. A failed save puts the tick back; a 400 names the model that is no
longer offered and offers **Remove It**; unticking the last model asks
first (**Save with No Models?**). The backend enforces the list: users
who are not admins see only the allowed models in the chat's model
picker. The endpoints are in [`/iblai-api-rbac`](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/users/iblai-api-rbac/SKILL.md).

Under RBAC (`enableRBAC`) the switch follows the agent's field permissions
for `enable_in_chat_llm_change` and is read-only without write access.

## Test ids

| Element | `data-testid` |
|---------|---------------|
| Info box | `llm-info-box` |
| Allow In-Chat Model Change switch | `llm-in-chat-model-change-toggle` |
| Models Users Can Pick box, its count, its button | `users-models-summary`, `users-models-summary-count`, `llm-users-models-button` |
| Provider card (grid) | `llm-provider-card` (`data-provider`, `data-disabled`) |
| User Models dialog, provider card, card count | `users-models-dialog`, `users-models-provider-card` (`data-provider`), `users-models-count-<provider>` |
| Checklist rows, Done | `users-models-allow-all-<provider>`, `users-models-model-<provider>-<llm_name>`, `users-models-done` |
| Save refused, Remove It, confirm empty | `users-models-save-error`, `users-models-remove-rejected`, `users-models-confirm-empty-save` |

## Related Exports

From `@iblai/iblai-js/web-containers/next`:

- `AGENT_LLM_TAB_LABELS` -- the default agent-facing label bundle.
- `LLMTabLabels` -- type for the full label bundle.
- `LLMProvider`, `LLMProviderType` -- types for provider data structures
  (`LLMProviderType` is the `{ name, chat_models }` provider row).
- `LLMProviderModal` -- the LLM Selection modal, for opening it outside the
  tab. Pass `selection` (type `LLMModelSelection`: `isSelected`, `toggle`,
  `allSelected`, `toggleAll`, `labels`, `testIdPrefix`) instead of
  `onSelect` / `isSelecting` / `mentorSettings` / `llms` to get the
  checklist the User Models dialog uses.

From `@iblai/iblai-js/data-layer`:

- `useGetLlmAccessQuery({ platform_key })`,
  `useSetLlmAccessMutation()` -- read and replace the models users can pick.

From `@iblai/iblai-js/web-containers`, for custom UI that shows a
provider's name or logo (an agents table, a transcript row):

- `useLlmProviderCatalogue({ org, userId, mentorId })` -- returns a
  resolver `(llmProvider?, llmName?) => LlmProviderDetails` over the same
  `mentor-llms` rows the tab reads (the tab reads them directly; the SDK
  uses this hook for `LlmModelBadge`); a key the catalogue does not list
  resolves to the raw key and no logo.
- `LlmProviderDetails` -- `{ logo: string | null; displayName: string }`.
- `inferProviderKeysFromModel` -- the provider keys a model name implies.

## Step 5: Verify

Run `/iblai-vibe-ops-test` before telling the user the work is ready:

1. `pnpm build` -- must pass with zero errors
2. `pnpm test` -- vitest must pass
3. Touch test `/agents/<id>/llm` in the browser as `/iblai-vibe-ops-test` says: open it,
   use every control this skill added, read the console, check the phone width.
   As an organization admin, turn on Allow In-Chat Model Change and check
   that **Models Users Can Pick** appears and User Models opens.

## Important Notes

- **Redux store**: Must include `mentorReducer` and `mentorMiddleware`
- **`initializeDataLayer()`**: 5 args (v1.2+)
- **`@reduxjs/toolkit`**: Deduplicated via webpack aliases in `next.config.ts`
- **Peer deps**: `sonner` and `@iblai/iblai-web-mentor` must be installed
  (`pnpm add sonner @iblai/iblai-web-mentor`)
- **Shared provider**: `AgentSettingsProvider` must wrap the route at a
  layout level. See `/iblai-vibe-agent-setting` Step 2 for the full snippet.
- **The switch moved**: Allow In-Chat Model Change used to be in
  Settings → Capabilities. Since `@iblai/iblai-js` 2.44.0 it is only here,
  and the Settings tab no longer sends `enable_in_chat_llm_change`.
- **User Models is organization-wide**: the list applies to every agent in
  the organization, not just the one being edited.
- **Provider naming is backend-owned**: logos and display names come from
  the organization's model catalogue, so the tab needs no host mapper.
  Older SDK releases took a required `getLLMProviderDetails` prop; it no
  longer exists.
- **Brand guidelines**: [BRAND.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/BRAND.md)