---
name: iblai-vibe-agent-safety
description: Add the agent Safety tab (the moderation check on user messages, the safety check on agent replies, the reply each one sends, and a host-provided list of flagged prompts) to your Next.js app. Use when the user mentions moderation, safety prompts, guardrails, inappropriate content, blocked messages, or flagged prompts. For the REST contract and the moderation logs see /iblai-api-agent-safety.
globs:
alwaysApply: false
metadata:
  kind: ui
---

# /iblai-vibe-agent-safety

Add the agent **Safety tab** -- the two guardrails on an agent's chats.
**Scope: per agent.** The **Moderation Prompt** checks each user message
before the agent sees it; the **Safety Prompt** checks each reply before the
user sees it. Each has an Active switch, and each has a response sent
instead when it trips. This is one tab in the agent-settings family indexed
by `/iblai-vibe-agent`; it shares the `AgentSettingsProvider` wrapper with
every other tab.

**Safety** -- four cards (Moderation Prompt, Safety Prompt, Moderation
Response, Safety Response), each with **Edit** and **Copy**; the two prompt
cards have the Active switch. **View Flagged Prompts** shows only when you
pass a `FlaggedPromptsModal` and `showFlaggedPrompts` is true (Step 2).

![Safety tab -- overview](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-vibe-agent-safety/iblai-vibe-agent-safety-1-overview.png)

**Edit** -- a rich-text editor for the prompt or response; **Save** writes
it to the agent.

![Safety tab -- Edit Safety Prompt](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-vibe-agent-safety/iblai-vibe-agent-safety-2-edit-prompt.png)

**Flagged prompts** -- the modal your app supplies. This one is the
minimal modal from Step 2: who sent the message, which system caught it,
when, the message, and the reason.

![Safety tab -- flagged prompts](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-vibe-agent-safety/iblai-vibe-agent-safety-3-flagged-prompts.png)

> **Common setup (brand, conventions, env files, verification):** see [docs/skill-setup.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/docs/skill-setup.md).

## Prerequisites

- Auth set up (`/iblai-vibe-auth`, or vibe-starter).
- `AgentSettingsProvider` wraps the route (`/iblai-vibe-agent` §1).
- `@iblai/iblai-js` ≥ 2.26 (resolves `@iblai/web-containers` 1.32). Check with
  `pnpm why @iblai/web-containers`.
- A real agent UUID. Ask the user; never invent one.
- To list flagged prompts, the user needs the agent's
  `#view_moderation_logs` grant (org admins have it).

## Step 1: Check Environment

Look for `iblai.env` in the project root with `PLATFORM`, `DOMAIN`, and
`TOKEN`. If it is missing, tell the user:
"You need an `iblai.env` with your platform configuration. Download the
template and fill in your values:
`curl -o iblai.env https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/iblai.env`"

## Step 2: Mount `AgentSafetyTab`

The four cards need nothing but the provider: `<AgentSafetyTab />`. The
flagged-prompts list is not part of the SDK tab -- the host injects it.
These are the pieces a full mount wires (the ibl.ai OS mounts it the same
way):

- `FlaggedPromptsModal` -- your modal; it gets `isOpen`, `onClose`,
  `mentorId`, `tenantKey`, `username`.
- `showFlaggedPrompts` -- whether to show the button. Gate it on the
  `/mentors/<agent db id>/#view_moderation_logs` grant.
- `renderPromptContent` -- how the cards render prompt text (plain text by
  default, so line breaks and Markdown are lost). The OS passes its
  Markdown renderer.
- `executeGatedAction` on the provider -- wraps the two Active switches,
  for a paywall or free-trial check. Prompt edits are not gated.

A minimal flagged-prompts modal, built on the starter's `Dialog`:

```tsx
// app/(app)/agents/[mentorId]/safety/flagged-prompts-modal.tsx
"use client";

import { useGetModerationLogsQuery } from "@iblai/iblai-js/data-layer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type FlaggedPromptsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  mentorId: string;
  tenantKey: string;
  username: string;
};

type ModerationLog = {
  id: number;
  username: string;
  email: string | null;
  prompt: string;
  reason: string;
  target_system: string;
  date_created: string;
};

export function FlaggedPromptsModal({
  isOpen,
  onClose,
  mentorId,
  tenantKey,
  username,
}: FlaggedPromptsModalProps) {
  const { data, isLoading } = useGetModerationLogsQuery(
    {
      org: tenantKey,
      // @ts-expect-error userId (the path's user) is read at runtime but missing from the type
      userId: username,
      mentor: mentorId,
      page: 1,
      pageSize: 20,
      ordering: "-date_created",
    },
    { skip: !isOpen },
  );
  const logs = (data?.results ?? []) as unknown as ModerationLog[];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Flagged prompts</DialogTitle>
          <DialogDescription>
            {data?.count ?? 0} messages stopped by the moderation or safety system.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-3 overflow-y-auto">
          {isLoading && <p className="text-sm text-gray-500">Loading…</p>}
          {!isLoading && logs.length === 0 && (
            <p className="py-8 text-center text-sm text-gray-500">No flagged prompts for this agent.</p>
          )}
          {logs.map((log) => (
            <div key={log.id} className="rounded-md border border-gray-200 p-3">
              <div className="flex justify-between gap-4 text-xs text-gray-500">
                <span>{log.email ?? log.username}</span>
                <span>
                  {log.target_system} · {new Date(log.date_created).toLocaleString()}
                </span>
              </div>
              <p className="mt-2 text-sm text-gray-900">{log.prompt}</p>
              <p className="mt-1 text-xs text-gray-600">{log.reason}</p>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

`userId` is the signed-in user (the path segment). SDK 2.26 types the
hook's argument without it, but the request needs it -- hence the
`@ts-expect-error`; `username` in that type filters to the flagged user
instead. `mentor` filters to this agent. Add search, a system filter (`targetSystem`: `Moderation System` or
`Safety System`), a date range and paging the same way.

The page loads the agent's grants, gates the button, and passes the
paywall gate through a nested provider:

```tsx
// app/(app)/agents/[mentorId]/safety/page.tsx
"use client";

import { useEffect, useState } from "react";
import {
  AgentSafetyTab,
  AgentSettingsProvider,
  useAgentSettings,
} from "@iblai/iblai-js/web-containers/next";
import {
  useGetMentorSettingsQuery,
  useGetRbacPermissionsMutation,
} from "@iblai/iblai-js/data-layer";
import { checkRbacPermission } from "@iblai/iblai-js/web-utils";
import { FlaggedPromptsModal } from "./flagged-prompts-modal";

export default function AgentSafetyPage() {
  const settings = useAgentSettings();
  const { tenantKey, mentorId, username } = settings;
  const [grants, setGrants] = useState<object>({});
  const [getRbacPermissions] = useGetRbacPermissionsMutation();
  const { data } = useGetMentorSettingsQuery({
    mentor: mentorId,
    org: tenantKey,
    // @ts-expect-error userId is accepted at runtime
    userId: username,
  });
  const mentorDbId = (data as { mentor_id?: number } | undefined)?.mentor_id;

  useEffect(() => {
    if (!mentorDbId) return;
    getRbacPermissions({
      requestBody: { platform_key: tenantKey, resources: [`/mentors/${mentorDbId}/`] },
    })
      .unwrap()
      .then((permissions) => setGrants({ ...permissions }))
      .catch(() => {});
  }, [mentorDbId, tenantKey, getRbacPermissions]);

  return (
    <div className="flex h-full flex-col bg-white">
      <AgentSettingsProvider
        {...settings}
        rbacPermissions={grants}
        executeGatedAction={(action) => action()}
      >
        <AgentSafetyTab
          FlaggedPromptsModal={FlaggedPromptsModal}
          showFlaggedPrompts={checkRbacPermission(
            grants,
            `/mentors/${mentorDbId}/#view_moderation_logs`,
          )}
          renderPromptContent={(content) => (
            <p className="whitespace-pre-wrap text-sm text-gray-700">{content}</p>
          )}
        />
      </AgentSettingsProvider>
    </div>
  );
}
```

Replace `(action) => action()` with your paywall or trial check (run
`action` once the user may proceed). The grant path uses the agent's numeric
`mentor_id`, not the UUID. Without a `FlaggedPromptsModal` the button never
shows, whatever `showFlaggedPrompts` says (it defaults to `true`).

## Step 3: Customize Labels (Optional)

The tab renders with the default agent-facing copy
(`AGENT_SAFETY_TAB_LABELS`, localized through the SDK's i18n). Pass a partial
`labels` object to change any string:

```tsx
import { AgentSafetyTab } from "@iblai/iblai-js/web-containers/next";

<AgentSafetyTab
  labels={{
    header: { title: "Guardrails" },
    actions: { viewFlaggedPrompts: "Blocked messages" },
  }}
/>;
```

Label groups (`SafetyTabLabels`): `header` (`title`, `description`),
`prompts` -- `moderation` and `safety` (`title`, `tooltip`, `activeLabel`,
`inactiveLabel`), `moderationResponse` and `safetyResponse` (`title`) --
`actions` (`edit`, `viewFlaggedPrompts`), and `toasts` (`updateSuccess`,
`updateError`).

## Step 4: Use MCP Tools for Customization

```
get_component_info("AgentSafetyTab")
get_component_info("AgentSettingsProvider")
```

## `<AgentSafetyTab>` Props

Import from `@iblai/iblai-js/web-containers/next`.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `FlaggedPromptsModal` | `ComponentType<{ isOpen, onClose, mentorId, tenantKey, username }>` | No | Your flagged-prompts modal. Without it there is no button |
| `showFlaggedPrompts` | `boolean` | No | Show **View Flagged Prompts**. Defaults to `true`; gate it on `#view_moderation_logs` |
| `renderPromptContent` | `(content: string) => ReactNode` | No | Render card text (e.g. Markdown). Defaults to plain text |
| `labels` | `DeepPartial<SafetyTabLabels>` | No | Override user-visible strings |

Identity, `enableRBAC` (per-field permissions on the cards) and
`executeGatedAction` come from `AgentSettingsProvider`.

## Related Exports

From `@iblai/iblai-js/web-containers/next`:

- `AGENT_SAFETY_TAB_LABELS` -- the default label bundle.
- `SafetySelectedPrompt`, `SafetyEditFormValues` -- the edit dialog's
  prompt and form types.
- `AgentSafetyTabProps`, `SafetyTabLabels` -- types.

## How it saves

Every change is one field on
`PUT /api/ai-mentor/orgs/{org}/users/{username}/mentors/{uuid}/settings/`:

| Control | Field |
|---|---|
| Moderation Prompt switch / **Save** | `enable_moderation` / `moderation_system_prompt` |
| Safety Prompt switch / **Save** | `enable_safety_system` / `safety_system_prompt` |
| Moderation Response **Save** | `moderation_response` |
| Safety Response **Save** | `safety_response` |

The flagged-prompts modal above reads
`GET /api/ai-mentor/orgs/{org}/users/{username}/moderation-logs/?mentor=<uuid>`
(rows: `prompt`, `reason`, `target_system`, `date_created`, and who sent it).

## Platform data

| Hook | Purpose |
|---|---|
| `useGetMentorSettingsQuery` / `useEditMentorMutation` | Read and save the prompts, responses and switches |
| `useGetModerationLogsQuery` / `useDeleteModerationLogMutation` | Flagged prompts, for your modal |
| `useGetRbacPermissionsMutation` | Load the `#view_moderation_logs` grant (Step 2) |

All from `@iblai/iblai-js/data-layer`. REST twin:
[`/iblai-api-agent-safety`](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-api-agent-safety/SKILL.md).

## Step 5: Verify

Run `/iblai-vibe-ops-test` before telling the user the work is ready:

1. `pnpm build` -- must pass with zero errors.
2. `pnpm test` -- vitest must pass.
3. `pnpm dev`, sign in as an org admin, open `/agents/<uuid>/safety`: the four
   cards and **View Flagged Prompts** render. With moderation Active, send
   the agent a clearly harmful request in chat -- it shows up in the modal.
4. `npx playwright screenshot http://localhost:3000/agents/<uuid>/safety /tmp/agent-safety.png`

## Important Notes

- **Switches save at once**: flipping Active changes the agent for everyone
  who chats with it. Try changes on a test agent.
- **Moderation runs before the agent, safety after**: a moderated message
  never reaches the agent; a reply that fails the safety check is replaced
  by the Safety Response.
- **Shared provider**: mount `AgentSettingsProvider` once at the layout
  level (`/iblai-vibe-agent` §1); the page above nests a second one only to
  add grants and the gate.
- **Peer deps**: `sonner` and `@iblai/iblai-web-mentor`
  (`pnpm add sonner @iblai/iblai-web-mentor`).
- **Brand guidelines**: [BRAND.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/BRAND.md)
