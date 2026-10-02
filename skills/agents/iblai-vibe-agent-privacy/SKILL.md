---
name: iblai-vibe-agent-privacy
description: Add the agent Privacy tab (PII filtering -- detect names, emails, phone numbers and more in chat messages and allow, redact, mask or block them, optionally in the agent's replies too) to your Next.js app. Use when the user mentions PII, personal data, privacy filtering, redacting or masking messages, or blocking sensitive input. For the REST contract and the detection audit log see /iblai-api-agent-privacy.
globs:
alwaysApply: false
metadata:
  kind: ui
---

# /iblai-vibe-agent-privacy

Add the agent **Privacy tab** -- find personal information (PII) in chat
messages and handle it before the agent sees it. **Scope: per agent.** Every
control saves at once to the agent's settings, so it applies to everyone who
chats with the agent. This is one tab in the agent-settings family indexed by
`/iblai-vibe-agent`; it shares the `AgentSettingsProvider` wrapper with every
other tab.

**PII filtering off** -- the switch at the top turns the Privacy Router on.
While it is off, the controls below stay visible but grayed out, so admins
can see what they would get.

![Privacy tab -- off](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-vibe-agent-privacy/iblai-vibe-agent-privacy-1-off.png)

**On, with Redact** -- **When PII is detected** picks the action (the line
under it explains it), **Entity Types** picks what to detect (none selected
means the defaults), and **Also filter AI responses** applies the same filter
to the agent's replies.

![Privacy tab -- Redact](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-vibe-agent-privacy/iblai-vibe-agent-privacy-2-redact.png)

**Actions** -- **Allow** (detect and log, leave the message unchanged),
**Redact** (replace with the type, e.g. `[EMAIL_ADDRESS]`), **Mask** (replace
with asterisks), **Block** (reject the message).

![Privacy tab -- actions](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-vibe-agent-privacy/iblai-vibe-agent-privacy-3-actions.png)

**Block** -- adds **Block Message**, the text the user sees instead of an
answer. It saves when the field loses focus.

![Privacy tab -- Block](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-vibe-agent-privacy/iblai-vibe-agent-privacy-4-block.png)

> **Common setup (brand, conventions, env files, verification):** see [docs/skill-setup.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/docs/skill-setup.md).

## Prerequisites

- Auth set up (`/iblai-vibe-auth`, or vibe-starter).
- `AgentSettingsProvider` wraps the route (`/iblai-vibe-agent` §1).
- `@iblai/iblai-js` ≥ 2.26 (resolves `@iblai/web-containers` 1.32). Check with
  `pnpm why @iblai/web-containers`.
- A real agent UUID. Ask the user; never invent one.

## Step 1: Check Environment

Look for `iblai.env` in the project root with `PLATFORM`, `DOMAIN`, and
`TOKEN`. If it is missing, tell the user:
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

The tab reads `tenantKey`, `mentorId`, `username`, `enableRBAC` and
`executeGatedAction` from `AgentSettingsProvider`; each can be passed as a
prop instead, for example to mount the tab outside the provider:

```tsx
import { AgentPrivacyTab } from "@iblai/iblai-js/web-containers/next";

export function PrivacyPanel(props: { org: string; agentId: string; username: string }) {
  return (
    <AgentPrivacyTab tenantKey={props.org} mentorId={props.agentId} username={props.username} />
  );
}
```

With `enableRBAC` on, each control follows the agent's field permissions
(`privacy_action`, `privacy_response`, `privacy_entities`,
`enable_privacy_output_filter`) and is disabled when the user may not edit
it. `executeGatedAction` wraps every save, so the host can put a paywall or
confirmation in front of it.

## Step 3: Customize Labels (Optional)

The tab renders with the default agent-facing copy
(`AGENT_PRIVACY_TAB_LABELS`, localized through the SDK's i18n). Pass a
partial `labels` object to change any string:

```tsx
import { AgentPrivacyTab } from "@iblai/iblai-js/web-containers/next";

<AgentPrivacyTab
  labels={{
    header: { title: "Data privacy" },
    fields: { action: { options: { allow: "Log only" } } },
  }}
/>;
```

Label groups (`PrivacyTabLabels`): `header` (`title`, `description`),
`capability` (the switch: `title`, `description`, `offHint`), `fields` --
`action` (`label`, `tooltip`, `options` and `descriptions` per action),
`blockMessage` (`label`, `placeholder`), `entities` (`label`, `tooltip`,
`emptyHint`, `labels` per entity type), `outputFilter` (`label`, `tooltip`),
`enableRouter` -- and `toasts` (`updateSuccess`, `updateError`).

## Step 4: Use MCP Tools for Customization

```
get_component_info("AgentPrivacyTab")
get_component_info("AgentSettingsProvider")
```

## `<AgentPrivacyTab>` Props

Import from `@iblai/iblai-js/web-containers/next`.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `labels` | `DeepPartial<PrivacyTabLabels>` | No | Override user-visible strings |
| `tenantKey` | `string` | No | Organization key; defaults to `AgentSettingsProvider` |
| `mentorId` | `string` | No | Agent UUID; defaults to `AgentSettingsProvider` |
| `username` | `string` | No | Signed-in username; defaults to `AgentSettingsProvider` |
| `enableRBAC` | `boolean` | No | Follow the agent's field permissions; defaults to the provider, else `false` |
| `executeGatedAction` | `(fn: () => unknown) => unknown` | No | Wrap every save (paywall, confirmation); defaults to the provider |

## Related Exports

From `@iblai/iblai-js/web-containers/next`:

- `AGENT_PRIVACY_TAB_LABELS` -- the default label bundle.
- `AgentPrivacyTabProps`, `PrivacyTabLabels` -- types.

From `@iblai/iblai-js/data-layer`: `PRIVACY_ACTIONS` (`allow`, `redact`,
`mask`, `block`), `PRIVACY_ENTITY_TYPES` (`PERSON`, `EMAIL_ADDRESS`,
`PHONE_NUMBER`, `US_SSN`, `CREDIT_CARD`, `LOCATION`, `DATE_TIME`,
`US_PASSPORT`, `US_DRIVER_LICENSE`, `IP_ADDRESS`, `IBAN_CODE`,
`MEDICAL_LICENSE`, `US_BANK_NUMBER`), and the `PrivacyAction` /
`PrivacyEntityType` types.

## How it saves

Each change sends one field as JSON to
`PUT /api/ai-mentor/orgs/{org}/users/{username}/mentors/{uuid}/settings/`,
then refetches the settings:

| Control | Field |
|---|---|
| PII filtering switch | `enable_privacy_router` |
| When PII is detected | `privacy_action` (`allow` \| `redact` \| `mask` \| `block`; default `redact`) |
| Block Message (on blur) | `privacy_response` |
| Entity Types chip | `privacy_entities` (the full new list; `[]` means defaults) |
| Also filter AI responses | `enable_privacy_output_filter` |

## Platform data

| Hook | Purpose |
|---|---|
| `useGetMentorSettingsQuery` | Current privacy fields and field permissions |
| `useEditMentorJsonMutation` | Save one field (JSON, so `privacy_entities` stays an array) |

REST twin: [`/iblai-api-agent-privacy`](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-api-agent-privacy/SKILL.md)
(also the `privacy-flags` audit log of every detection, which this tab does
not show).

## Step 5: Verify

Run `/iblai-vibe-ops-test` before telling the user the work is ready:

1. `pnpm build` -- must pass with zero errors.
2. `pnpm test` -- vitest must pass.
3. `pnpm dev`, sign in as an org admin, open `/agents/<uuid>/privacy`: the
   controls render grayed out. Turn PII filtering on, pick **Block** -- the
   Block Message field appears.
4. `npx playwright screenshot http://localhost:3000/agents/<uuid>/privacy /tmp/agent-privacy.png`

## Important Notes

- **Saves on every click**: there is no Save button. Try settings on a test
  agent.
- **Allow still detects**: detections are logged to the `privacy-flags`
  audit log; only the message is left alone.
- **Shared provider**: mount `AgentSettingsProvider` once at the layout
  level (`/iblai-vibe-agent` §1); do not wrap each tab.
- **Peer deps**: `sonner` and `@iblai/iblai-web-mentor`
  (`pnpm add sonner @iblai/iblai-web-mentor`).
- **Brand guidelines**: [BRAND.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/BRAND.md)
