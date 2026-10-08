---
name: iblai-vibe-agent-privacy
description: Add the agent Privacy tab: two sub-tabs, PII Filtering (detect personal information in messages and allow, redact, mask or block it, choose the entity types, filter AI responses too) and Incognito (whether conversations with this agent are kept out of chat history and memory: Users Decide, Always Incognito, or Never Incognito). Use when the user mentions PII, personal data, redaction, incognito for an agent, or "don't save conversations with this agent". For the in-chat Incognito toggle and how the org, agent, user and session tiers resolve see /iblai-vibe-incognito; for the user's own default see /iblai-vibe-profile; for the REST endpoints see /iblai-api-agent-privacy
globs:
alwaysApply: false
metadata:
  kind: ui
---

# /iblai-vibe-agent-privacy

Add the agent **Privacy tab** -- "Control what personal information the
agent sees and how Incognito works for its conversations." Two
sub-tabs behind one pill switcher:

- **PII Filtering** — an inline **PII filtering** toggle; when on,
  what to do when PII is detected (**Allow**, **Redact**, **Mask**,
  **Block**), the **Block Message**, the **Entity Types** chips
  (Person, Email, Phone, SSN, Credit Card, Location, Date / Time,
  Passport, Driver's License, IP Address, IBAN, Medical License, Bank
  Number) and **Also filter AI responses**.
- **Incognito** — one choice over how Incognito works for this agent:
  **Users Decide**, **Always Incognito**, or **Never Incognito**. This
  replaces the old Private Mode switch that lived on the Settings tab.

This is one tab in the wider agent-settings family. All tabs share the
same `AgentSettingsProvider` wrapper (optional for this tab — identity
can be passed as props).

![Privacy — PII Filtering sub-tab](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-vibe-agent-privacy/iblai-vibe-agent-privacy.png)

![Privacy — Incognito sub-tab](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-vibe-agent-privacy/iblai-vibe-agent-privacy-incognito.png)

> **Common setup (brand, conventions, env files, verification):** see [docs/skill-setup.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/docs/skill-setup.md).

## Related Incognito surfaces

Incognito is one feature with four tiers; this tab is the **agent**
tier. `/iblai-vibe-incognito` explains how they resolve and mounts the
in-chat toggle.

- **`/iblai-vibe-incognito`** — the chat-header **Incognito** toggle and
  its "Enable Incognito for this chat?" dialog, plus the tier order.
- **`/iblai-vibe-profile`** — the user's own **Privacy** tab: their
  default (Normal / Anonymized / Incognito).
- **`/iblai-vibe-account`** — organization settings → **Advanced** →
  "Allow users to control chat privacy", the gate that makes the
  Incognito sub-tab (and the toggle) exist at all.

## Prerequisites

- Auth must be set up first (`/iblai-vibe-auth`)
- MCP server + skills configured (`@iblai/mcp` in `.mcp.json`)
- `AgentSettingsProvider` wrapping the route (see `/iblai-vibe-agent-setting`
  Step 2), **or** pass `tenantKey` / `mentorId` / `username` as props.
- Ask the user for a real `mentorId` (agent UUID). Do NOT invent one.
- The **Incognito** sub-tab appears only when the organization allows
  user chat-privacy control (`allow_user_chat_privacy_control`). With
  the gate off there is no Incognito to govern, and the tab shows PII
  Filtering alone.

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
`<AgentSettingsProvider>`, loads the agent settings and the
organization's chat-privacy gate, and decides which sub-tabs to offer
(see **Which sub-tabs appear** below).

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

`enableRBAC` honors field-level permissions from agent settings — each
field (`enable_privacy_router`, `privacy_action`, `privacy_response`,
`privacy_entities`, `enable_privacy_output_filter`,
`disable_chathistory`, `disable_privacy_mode`) can be independently
read-only. `executeGatedAction` wraps every save so the host app can
interpose a confirmation or upgrade gate.

## Step 3: Customize Labels (Optional)

```tsx
import { AgentPrivacyTab } from "@iblai/iblai-js/web-containers/next";

<AgentPrivacyTab
  labels={{
    header: { title: "Data privacy", description: "Filter PII; decide how Incognito works." },
    subTabs: { piiFiltering: "Personal data", incognito: "Incognito" },
    incognito: {
      options: { always: { title: "Always private", description: "Nothing is ever saved." } },
    },
  }}
/>;
```

## Step 4: Use MCP Tools for Customization

```
get_component_info("AgentPrivacyTab")
get_component_info("AgentSettingsProvider")
get_component_info("ChatPrivacyToggle")
```

## `<AgentPrivacyTab>` Props

Import from `@iblai/iblai-js/web-containers/next`.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `labels` | `DeepPartial<PrivacyTabLabels>` | No | Override user-visible strings (header, capability card, field labels, tooltips, action descriptions, entity labels, sub-tab names, the three Incognito cards, toasts) |
| `tenantKey` | `string` | No | Identity override. Defaults to the nearest `<AgentSettingsProvider>` |
| `mentorId` | `string` | No | Agent UUID override. Defaults to the provider |
| `username` | `string` | No | Username override. Defaults to the provider |
| `enableRBAC` | `boolean` | No | Honor per-field permissions from agent settings. Defaults to the provider value or `false` |
| `executeGatedAction` | `(fn: () => unknown) => unknown` | No | Wrap each save mutation (e.g. confirmation/upgrade gate). Defaults to the provider value |

## What each sub-tab renders

### PII Filtering

- **PII filtering** capability card — the on/off switch sits inline at
  the top of the sub-tab with its explanation. When it is **off** the
  controls below stay visible but inert, so an admin can preview what
  they will get before turning it on.
- **When PII is detected** — a select with an inline description of
  the chosen action:

  | Action | Wire value | What happens |
  |---|---|---|
  | Allow | `allow` | Detected but left untouched — the message passes through unchanged. For monitoring or auditing without altering messages |
  | Redact (default) | `redact` | Replaced with its type — e.g. `Email [EMAIL_ADDRESS]` |
  | Mask | `mask` | Hidden behind asterisks — e.g. `Email ***********` |
  | Block | `block` | The message is rejected and your block message is shown |

- **Block Message** — a textarea shown only for **Block**; saves on
  blur.
- **Entity Types** — the 13 chips, multi-select. With none selected the
  hint reads *"Using defaults."*
- **Also filter AI responses** — scrubs PII from the agent's output as
  well (may add slight latency to streamed responses).

### Incognito

*"Incognito keeps a conversation out of chat history and memory.
Choose how it works for this agent."* Three radio cards:

| Card | Flags saved | Effect in the chat header |
|---|---|---|
| **Users Decide** | `disable_chathistory: false`, `disable_privacy_mode: false` | Users can turn Incognito on for any conversation; otherwise chats are saved as usual |
| **Always Incognito** | `disable_chathistory: true` | Every conversation is incognito, for anyone. The Incognito pill shows **locked on** |
| **Never Incognito** | `disable_privacy_mode: true` | Incognito isn't available for this agent; the toggle disappears. Users whose profile default is Incognito are saved **anonymously** instead |

One control writes both flags in the same PUT, so the contradictory
"always *and* never" pair cannot be configured from here. A record that
still carries both (older data) **behaves as Always Incognito**: the
backend checks `disable_chathistory` first, answers `mode: disabled`,
`source: mentor`, and writes no history — even though the tab displays
it as Never Incognito. Choosing any card rewrites both flags and clears
the mismatch.

## Which sub-tabs appear

| Condition | Result |
|---|---|
| Organization gate `allow_user_chat_privacy_control` off | Incognito sub-tab not offered |
| `enableRBAC` and **no** PII field is readable (`permissions.field`) | PII Filtering not offered |
| `enableRBAC` and **either** Incognito flag is unreadable | Incognito not offered |
| Nothing readable | The tab shows a single notice: *"You don't have permission to view this agent's privacy settings."* |

Members typically see Incognito read-only and no PII Filtering. Writes
stay per control: a field the user may read but not write renders
disabled.

## Settings fields

Read with `GET` and written with `PUT` on
`${dmUrl}/api/ai-mentor/orgs/{org}/users/{username}/mentors/{mentor_unique_id}/settings/`
(a partial update — send only what changes):

| Field | Type | Sub-tab |
|---|---|---|
| `enable_privacy_router` | `boolean` | PII Filtering — the capability switch |
| `privacy_action` | `"allow" \| "redact" \| "mask" \| "block"` | PII Filtering |
| `privacy_response` | `string` | PII Filtering — the block message |
| `privacy_entities` | `string[]` (`PERSON`, `EMAIL_ADDRESS`, …) — `[]` means defaults | PII Filtering |
| `enable_privacy_output_filter` | `boolean` | PII Filtering |
| `disable_chathistory` | `boolean` | Incognito — Always |
| `disable_privacy_mode` | `boolean \| null` (`null` = off on older records) | Incognito — Never |

## Related Exports

From `@iblai/iblai-js/web-containers/next`:

- `AgentPrivacyTab`, `AgentPrivacyTabProps` — this tab.
- `AGENT_PRIVACY_TAB_LABELS`, `PrivacyTabLabels` — the default label
  bundle and its type (now including `subTabs` and `incognito`).

From `@iblai/iblai-js/web-containers`:

- `ChatPrivacyToggle` — the chat-header toggle that reacts to the
  Incognito policy (`/iblai-vibe-incognito`).

From `@iblai/iblai-js/data-layer`:

- `PRIVACY_ACTIONS` (`['allow','redact','mask','block']`),
  `PRIVACY_ENTITY_TYPES`, `DEFAULT_PRIVACY_ACTION`,
  `DEFAULT_PRIVACY_RESPONSE`, and the `PrivacyAction` /
  `PrivacyEntityType` types.
- `isPrivacyBlockedError`, `PRIVACY_BLOCKED_ERROR_KIND` — recognise the
  `privacy_blocked` error a **Block** action sends over the chat
  stream, to style it apart from a moderation block.
- `useGetMentorSettingsQuery`, `useEditMentorJsonMutation` — the read
  and the JSON PUT the tab uses.
- `useGetTenantChatPrivacyConfigQuery` — the organization gate the
  Incognito sub-tab depends on.
- `MentorChatPrivacyPublicSettings` — `disable_privacy_mode` as members
  read it from the agent's public settings.

The policy ↔ flags mapping helpers (`INCOGNITO_POLICIES`,
`incognitoPolicyFrom`, `incognitoFlags`) live in the tab's source but
are **not** re-exported from the package entry — custom UI should
mirror the table above.

SDK source: `packages/web-containers/src/components/modals/edit-mentor-modal/tabs/privacy-tab.tsx`
(with `privacy-tab/incognito-policy.ts` and `privacy-tab/labels.ts`).

## Step 5: Verify

Run `/iblai-vibe-ops-test` before telling the user the work is ready:

1. `pnpm build` -- must pass with zero errors
2. `pnpm test` -- vitest must pass
3. Start dev server and touch test:
   ```bash
   pnpm dev &
   npx playwright screenshot http://localhost:3000/agents/<id>/privacy /tmp/agent-privacy.png
   ```

Stable selectors: `privacy-sub-tab-pii`, `privacy-sub-tab-incognito`,
`privacy-capability-toggle`, `privacy-incognito-{users|always|never}`
(with `aria-pressed`), `privacy-no-access`.

## Important Notes

- **Redux store**: Must include `mentorReducer` and `mentorMiddleware`
- **`initializeDataLayer()`**: 5 args (v1.2+)
- **`@reduxjs/toolkit`**: Deduplicated via webpack aliases in `next.config.ts`
- **Peer deps**: `sonner` and `@iblai/iblai-web-mentor` must be installed
  (`pnpm add sonner @iblai/iblai-web-mentor`)
- **Provider optional**: this tab uses `useAgentSettingsOptional`, so it
  works inside `AgentSettingsProvider` or with explicit identity props.
- **JSON settings endpoint**: all fields are persisted via the JSON
  `/settings/` mutation (`useEditMentorJsonMutation`), not the
  multipart variant, so `privacy_entities` round-trips cleanly. The tab
  refetches agent settings after each save because that mutation does
  not invalidate the settings cache tag.
- **Incognito saves refresh the chat header**: choosing a card also
  invalidates `ChatPrivacyEffective` and the agent's
  `mentorPublicSettings` caches, so an open chat's Incognito pill locks,
  unlocks or disappears without a reload. Custom UI writing the two
  flags must do the same.
- **Private Mode moved**: the switch that used to sit on the Settings
  tab's capabilities is gone; the Incognito sub-tab here is its
  replacement, and the user-facing name is now **Incognito** everywhere.
- **Brand guidelines**: [BRAND.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/BRAND.md)
