# iblai-vibe-workflow

> Add agent workflows to your Next.js app — the per-agent Workflows list and the visual workflow editor (step sidebar, canvas with If/else, While, User approval, Transform, Set state, File search, MCP and Guardrails steps, the step config panel with workflow variables, validation, Save / Publish / Activate, and a preview chat), both shipped as two SDK components. Use when the user mentions workflows, multi-step agents, branching or looping an agent, "chain agents", state variables, or a workflow builder. For the agent itself see /iblai-vibe-agent-setting; for the chat transport the preview reuses see /iblai-vibe-agent-chat; for datasets and MCP connectors the steps pick from see /iblai-vibe-agent-dataset and /iblai-vibe-agent-mcp

# /iblai-vibe-workflow

Add **agent workflows** -- multi-step flows that start from one agent and
branch, loop, call tools and set state. Two SDK components mount the whole
feature:

- **`WorkflowsList`** — the per-agent list: search, status (Active / Draft),
  **Create Workflow**.
- **`WorkflowEditor`** — the editor: a step sidebar (Core / Tools / Logic /
  Data), the canvas, the step config panel, workflow variables, validation,
  inline rename, **Save**, **Publish**, **Activate / Deactivate / Delete**,
  and a **Preview** chat that runs the workflow.

The canvas, the config panel, the preview chat and the node data model used
to live in the host app; they are now in `@iblai/iblai-js/web-containers/next`
and the host keeps only two thin pages plus a side-menu entry.

![Workflow editor](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-vibe-workflow/iblai-vibe-workflow.png)

> **Common setup (brand, conventions, env files, verification):** see [docs/skill-setup.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/docs/skill-setup.md).

## Related surfaces

- **`/iblai-vibe-agent-chat`** — the chat transport (`axdToken`, `baseWsUrl`,
  `redirectToAuthSpa`) the editor's Preview reuses; take the same values.
- **`/iblai-vibe-agent-setting`** — an **Agent** step's gear opens that
  agent's settings; wire `onOpenAgentSettings` to your settings route.
- **`/iblai-vibe-agent-dataset`**, **`/iblai-vibe-agent-mcp`** — what the
  **File search** and **MCP** steps pick from (the agent's datasets and
  connectors).
- **`/iblai-vibe-navbar`** — where the side-menu entry goes.

## Prerequisites

- Auth must be set up first (`/iblai-vibe-auth`)
- MCP server + skills configured (`@iblai/mcp` in `.mcp.json`)
- An agent to start from: workflows are listed **per agent** (`mentorId`),
  and every new workflow begins with a **Start → Agent** pair bound to it.
- `workflowsApiSlice` registered in the Redux store (Step 3) — it is **not**
  part of `mentorReducer`.

## Step 1: Check Environment

Before proceeding, check for an `iblai.env` in the project root. Look for
`PLATFORM`, `DOMAIN`, and `TOKEN` variables. If the file does not exist or
is missing these variables, tell the user:
"You need an `iblai.env` with your platform configuration. Download the
template and fill in your values:
`curl -o iblai.env https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/iblai.env`"

## Step 2: Two pages

### The list — `app/(app)/workflows/[mentorId]/page.tsx`

```tsx
// app/(app)/workflows/[mentorId]/page.tsx
"use client";

import { useParams, useRouter } from "next/navigation";
import { WorkflowsList } from "@iblai/iblai-js/web-containers/next";

export default function WorkflowsPage({ tenantKey }: { tenantKey: string }) {
  const router = useRouter();
  const { mentorId } = useParams<{ mentorId: string }>();

  return (
    <WorkflowsList
      tenantKey={tenantKey}
      mentorId={mentorId}
      onOpenWorkflow={(workflow) =>
        router.push(
          `/workflows/${workflow.entry_mentor_id}/${workflow.unique_id}?listMentorId=${mentorId}`,
        )
      }
    />
  );
}
```

`onOpenWorkflow` receives the full `Workflow`; route on its
`entry_mentor_id` (the agent the Start step hands off to — which may
differ from the list's `mentorId`) and keep the list's agent in a query
parameter so **Back** / **Delete** can return to the right list.

### The editor — `app/(app)/workflows/[mentorId]/[id]/page.tsx`

```tsx
// app/(app)/workflows/[mentorId]/[id]/page.tsx
"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { WorkflowEditor } from "@iblai/iblai-js/web-containers/next";
import { redirectToAuthSpa } from "@/lib/iblai/auth-utils";

export default function WorkflowEditorPage({
  tenantKey,
  username,
  axdToken,
  baseWsUrl,
}: {
  tenantKey: string;
  username: string;
  axdToken: string;
  baseWsUrl: string;
}) {
  const router = useRouter();
  const { mentorId, id } = useParams<{ mentorId: string; id: string }>();
  const listMentorId = useSearchParams().get("listMentorId") ?? mentorId;

  return (
    <WorkflowEditor
      tenantKey={tenantKey}
      workflowId={id}
      username={username}
      axdToken={axdToken}
      baseWsUrl={baseWsUrl}
      redirectToAuthSpa={(to, key, logout) => void redirectToAuthSpa(to, key, logout)}
      onBack={() => router.back()}
      onDeleted={() => router.push(`/workflows/${listMentorId}`)}
      onOpenAgentSettings={(agentId) => router.push(`/agents/${agentId}/settings`)}
    />
  );
}
```

`axdToken`, `baseWsUrl` and `redirectToAuthSpa` are the same three values
the chat surface takes — reuse what `/iblai-vibe-agent-chat` wires
(`useAxdToken()`, `config.baseWsUrl()`, `lib/iblai/auth-utils`). Both pages
take `tenantKey` / `username` the way the rest of your app resolves them.

### Side-menu entry

Workflows hang off an agent, so put **Workflows** in the sidebar next to the
agent's other sections rather than in the top nav. The SDK's own app renders
a collapsible **Workflows** section with **New Workflow** and **My
Workflows**, both routing to `/workflows/<current agent>`; it shows only
for admins (and free-trial / anonymous admin previews), and with no agent
selected it opens a "pick an agent" prompt instead of navigating.

## Step 3: Register `workflowsApiSlice` in the store

The workflow hooks live on their own slice that `mentorReducer` does not
include. Add its reducer and middleware to the starter's
`store/iblai-store.ts` (two lines — the rest is the file vibe-starter
already ships):

```typescript
// store/iblai-store.ts
import { configureStore } from "@reduxjs/toolkit";
import {
  coreApiSlice,
  mentorReducer,
  mentorMiddleware,
  workflowsApiSlice,
} from "@iblai/iblai-js/data-layer";
import {
  hostChatReducer,
  chatInputSliceReducer,
  chatSliceReducerShared,
  filesReducer,
  rbacReducer,
  subscriptionReducer,
  topBannerReducer,
} from "@iblai/iblai-js/web-utils";

export const iblaiStore = configureStore({
  reducer: {
    [coreApiSlice.reducerPath]: coreApiSlice.reducer,
    [workflowsApiSlice.reducerPath]: workflowsApiSlice.reducer, // + workflows
    ...mentorReducer,
    chat: hostChatReducer,
    chatInput: chatInputSliceReducer,
    chatSliceShared: chatSliceReducerShared,
    files: filesReducer,
    rbac: rbacReducer,
    subscription: subscriptionReducer,
    topBanner: topBannerReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({ serializableCheck: false })
      .concat(coreApiSlice.middleware)
      .concat(workflowsApiSlice.middleware) // + workflows
      .concat(...mentorMiddleware),
});

export type IblaiRootState = ReturnType<typeof iblaiStore.getState>;
export type IblaiAppDispatch = typeof iblaiStore.dispatch;
```

Without it every workflow hook returns `undefined` and both pages render
their error state.

## Step 4: Use MCP Tools for Customization

```
get_component_info("WorkflowEditor")
get_component_info("WorkflowsList")
get_hook_info("useGetWorkflowsQuery")
```

## Component Props

Both import from `@iblai/iblai-js/web-containers/next`.

### `<WorkflowsList>`

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `tenantKey` | `string` | Yes | Organization key |
| `mentorId` | `string` | Yes | The agent whose workflows are listed; new workflows start with an Agent step bound to it |
| `onOpenWorkflow` | `(workflow: Workflow) => void` | Yes | Called with the full record on card click **and** right after **Create** |

### `<WorkflowEditor>`

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `tenantKey` | `string` | Yes | Organization key |
| `workflowId` | `string` | Yes | The workflow's `unique_id` |
| `username` | `string` | Yes | Signed-in user — loads each Agent step's settings and tools; pass `""` for a signed-out preview |
| `axdToken` | `string` | Yes | Chat token for the preview chat |
| `baseWsUrl` | `string` | Yes | WebSocket origin for the preview chat (`${baseWsUrl}/ws/langflow/`) |
| `redirectToAuthSpa` | `(redirectTo?, platformKey?, logout?) => void` | Yes | Host auth redirect (wrap an async helper to `=> void`) |
| `onBack` | `() => void` | Yes | Header back button, and **Go Back** when the workflow fails to load |
| `onDeleted` | `() => void` | Yes | After a successful delete — go back to your list |
| `onOpenAgentSettings` | `(mentorId?: string) => void` | No | Clicking an Agent step's settings; nothing opens when omitted |
| `agentSettings` | `WorkflowAgentSettingsConfig` | No | RBAC, paywall gate and dataset-upload config for the pieces the editor embeds (below) |

### `WorkflowAgentSettingsConfig` (from `@iblai/iblai-js/web-containers`)

The Agent step's **Tools** switches and the **File search** / **MCP** pickers
are the agent-settings tabs embedded in the editor, so they take the same
host config:

| Field | Description |
|---|---|
| `enableRBAC`, `rbacPermissions` | Forwarded to the pickers' `AgentSettingsProvider` and field-level permission checks |
| `executeGatedAction` | Paywall / trial gate around the pickers' writes; called directly when omitted |
| `datasetResourceConfig` | Add Resource options for the File search step's dataset picker (`disabledResourceTypes`, `maxUploadSizeMb`) |
| `dmUrl` | Base the dataset picker resolves root-relative media paths against |

## What the editor renders

### Header

Back · inline-editable **name** (pencil; saves on blur / Enter) · status
pill **Active** / **Draft** · **Unsaved** while the canvas differs from the
server · **Preview** (becomes **Close preview** + **New Chat**) · **Save** ·
**Publish** · a more-options menu with **Activate** / **Deactivate** and
**Delete** (confirm dialog).

### Step sidebar

Sections come from the organization's `node-types` endpoint (falling back
to the built-in set): **Core** — Agent, End, Note · **Tools** — File search,
Guardrails, MCP · **Logic** — If / else, While, User approval · **Data** —
Transform, Set state. Drag a step onto the canvas, or click it to drop it
next to the selected step.

### Canvas

Steps connect left-to-right. If / else cards have one row per condition
plus **Else**; While has **Loop** and **Done**; User approval has
**Approve** and **Reject**. Start accepts no incoming connection and Notes
are never connected. Right-click a step for **Change Agent** / **Delete**,
a connection for **Delete Connection**. The floating toolbar has Pan /
Select, Undo / Redo and Zoom.

### Step config panel

Opens on click (not on drag). What each step edits:

| Step | Fields |
|---|---|
| Start | **State Variables** — name, type, optional default (validated per type) |
| Agent | the agent (**Change**), **Instructions**, **Model**, **Tools** switches, output format, continue on error |
| File search | **Dataset**, **Max Results**, **Query** (variables in `{{ double curly braces }}`) |
| MCP | **Connected Tools** — the agent's MCP connectors |
| Guardrails | PII · Moderation · Jailbreak · Hallucination checks; **Continue on Error** |
| If / else | **If** + **Else If n** rows: case name (optional) + expression |
| While | **Condition**, **Max Iterations** (default 10) |
| User approval | **Message** shown to the person |
| Transform | **Key** / **Value** expressions |
| Set state | **Assign Value** → **To Variable** rows; **New** creates a variable |
| End | finishes with the last step's reply |

### Variables and expressions

- Variable names start with a letter and use letters, digits and underscores;
  a name that fails this is skipped at run time.
- Expressions use **subscript** access only — `variables['score'] > 5`,
  `variables['counter'] + 1`, `step_results['mentor-1']['output']`.
  `variables.score` fails validation. **Copy Reference to {step}** on a
  step puts its `step_results[...]` key on the clipboard.
- The Set state picker lists every variable the workflow defines (Start's
  State Variables plus names other Set state steps assign).
- Deleting a Start variable that a step still reads or assigns is refused —
  **Variable In Use** names the steps.
- Untouched rows saved by older builds with the prototype expression
  `input.foo + 1` are dropped on open; old field names (`whileExpression`,
  `transformExpressions`, `setStateAssignments`, …) are converted to the
  current ones and the workflow shows **Unsaved** until you save.

### Saving, validating, publishing

- **Auto-save**: 1 s after the last change the definition is `PATCH`ed and
  then validated; errors and warnings appear in a collapsible banner. Merely
  opening a workflow never saves it.
- **Save** patches now. **Publish** patches and publishes in one call; a
  `400` with `is_valid: false` fills the banner instead.
- **Activate** saves first, then activates; **Deactivate** and **Delete**
  act directly. **Preview** also saves first so the run matches the canvas.
- Connectivity warnings about Notes are filtered out (the backend's check
  does not know Notes are decorative).

## Lower-level pieces

Also exported, for a host that composes its own editor:

- From `/next`: `WorkflowCanvas` (`initialNodes` / `initialEdges` /
  `onStateChange`, `onDraggedItem` / `onClickedItem` from the sidebar,
  `previewMode`, `org` / `defaultMentorId` / `username`,
  `onOpenAgentSettings`, `agentSettings`), `NodeConfigPanel` (`nodeId`,
  `nodeType`, `nodeData`, `onUpdateNode`, `onDeleteNode`,
  `workflowVariables`, `stepReferences`, `variableUsages`, …),
  `WorkflowPreviewChat`, and their `*Props` types.
- From `@iblai/iblai-js/web-containers`: `WorkflowSidebar` (`nodeTypes?:
  NodeTypeSection[]`), `CreateWorkflowModal` (`open`, `onOpenChange`,
  `onCreateWorkflow`, `isCreating`), `DeleteWorkflowModal` (`isOpen`,
  `onClose`, `onConfirm`, `isDeleting`, `workflowName`),
  `ConnectorManagementDialog` (`open`, `onClose`), `ToolDialogs`, and the
  definition helpers: `NodeConfig`, `Variable`, `Condition`,
  `TransformExpression`, `SetStateAssignment`, `collectWorkflowVariables`,
  `collectVariableUsages`, `migrateWorkflowDefinition`,
  `isValidVariableName`, `parseVariableDefault`, `EXPRESSION_EXAMPLES`,
  `WHILE_DEFAULT_MAX_ITERATIONS`.

The node data model (every `NodeConfig` field per step, the handles, the
migrations) is in [`references/node-data-model.md`](references/node-data-model.md).

## Related Exports

From `@iblai/iblai-js/data-layer` (`workflowsApiSlice`):

- `useGetWorkflowsQuery` / `useLazyGetWorkflowsQuery` — `{ org, params?: {
  search, is_active, is_template, created_by, sort, limit, offset } }` →
  `PaginatedWorkflowList`
- `useGetWorkflowQuery`, `useCreateWorkflowMutation` (`{ org, data: { name,
  description?, definition? } }`), `usePatchWorkflowMutation` (`{ org,
  uniqueId, data: { name?, description?, definition?, chat_name?,
  chat_proactive_response? } }`), `useUpdateWorkflowMutation`,
  `useDeleteWorkflowMutation`
- `useValidateWorkflowMutation`, `usePublishWorkflowMutation` (`{ org,
  uniqueId, data?: { definition? } }`), `useUnpublishWorkflowMutation`,
  `useActivateWorkflowMutation`, `useDeactivateWorkflowMutation` — the last
  three and validate answer `WorkflowValidationResponse` `{ is_valid,
  errors, warnings, workflow? }`
- `useChatWithWorkflowMutation` (`{ org, uniqueId, message }` →
  `{ response, workflow_id, session_id }`), `useGetNodeTypesQuery` →
  `{ node_types: Record<id, NodeTypeInfo>, categories }`
- Types: `Workflow` (`unique_id`, `name`, `definition`, `is_active`,
  `entry_mentor_id`, `node_count`, `edge_count`, `created_by_username`,
  `updated_at`, …), `WorkflowDefinition`, `PaginatedWorkflowList`,
  `NodeTypeInfo`, `NodeTypesResponse`.

SDK source: `packages/web-containers/src/components/workflows/` and
`packages/data-layer/src/features/workflows/`.

## Step 5: Verify

Run `/iblai-vibe-ops-test` before telling the user the work is ready:

1. `pnpm build` -- must pass with zero errors
2. `pnpm test` -- vitest must pass
3. Start dev server and touch test:
   ```bash
   pnpm dev &
   npx playwright screenshot http://localhost:3000/workflows/<agentId> /tmp/workflows.png
   ```

Stable selectors: the editor's step panel is `workflow-node-panel`; the
list and dialogs expose their buttons by accessible name (**Create
Workflow**, **Publish**, **More workflow options**).

## Important Notes

- **Redux store**: Must include `mentorReducer`, `mentorMiddleware` **and**
  `workflowsApiSlice` (reducer + middleware)
- **`initializeDataLayer()`**: 5 args (v1.2+)
- **`@reduxjs/toolkit`**: Deduplicated via webpack aliases in `next.config.ts`
- **Peer deps**: `sonner` and `@iblai/iblai-web-mentor` must be installed
  (`pnpm add sonner @iblai/iblai-web-mentor`)
- **Import paths**: `WorkflowsList`, `WorkflowEditor`, `WorkflowCanvas`,
  `NodeConfigPanel`, `WorkflowPreviewChat` come from
  `@iblai/iblai-js/web-containers/next` (they use `next/dynamic` and
  `next/navigation`); the sidebar, dialogs and definition helpers from
  `@iblai/iblai-js/web-containers`.
- **Two agent ids**: the list is per `mentorId`; a workflow's
  `entry_mentor_id` is the agent its Start step hands to. Route the editor
  on `entry_mentor_id` and carry the list's id along (`?listMentorId=`).
- **A new workflow is Start → Agent**, both selectable and connectable,
  with the Agent step bound to the list's agent.
- **Agent steps are checked at run time**: the editor loads each Agent
  step's settings before rendering and says so when one has no agent.
- **Definition is opaque to the API**: `definition.nodes` / `edges` are
  `unknown[]`; the editor owns the shapes (see the reference). A misnamed
  field is ignored by the backend and silently turns a step into a no-op.
- **Brand guidelines**: [BRAND.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/BRAND.md)

## Workflows REST API

All endpoints are under `${dmUrl}/api/ai-mentor/orgs/{org}/workflows/`
where `dmUrl` is `NEXT_PUBLIC_API_BASE_URL`.

| Method | Path | Purpose |
|---|---|---|
| GET | `workflows/` | List. Params `search`, `is_active`, `is_template`, `created_by`, `sort`, `limit`, `offset` |
| POST | `workflows/` | Create `{ name, description?, definition? }` |
| GET / PUT / PATCH / DELETE | `workflows/{unique_id}/` | One workflow; PATCH any of `name`, `description`, `definition`, `chat_name`, `chat_proactive_response` |
| POST | `workflows/{unique_id}/validate/` | `{ is_valid, errors[], warnings[] }` |
| POST | `workflows/{unique_id}/publish/` · `unpublish/` | Publish accepts an optional `{ definition }` to save first; a failed validation is a `400` with the same shape |
| POST | `workflows/{unique_id}/activate/` · `deactivate/` | Activate validates and answers the validation shape |
| POST | `workflows/{unique_id}/chat/` | `{ message }` → `{ response, workflow_id, session_id }` |
| GET | `workflows/node-types/` | The step catalogue: `{ node_types: { [id]: { label, category, executable, description, required_fields, optional_fields } }, categories }` |