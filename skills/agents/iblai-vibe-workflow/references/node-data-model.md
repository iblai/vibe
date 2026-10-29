# Workflow node data model

What `WorkflowEditor` writes into `definition.nodes[].data` for each step,
and what the backend's validator and compiler read. The API types
`definition.nodes` / `edges` as `unknown[]`; these shapes are the
`NodeConfig` type and definition helpers exported from
`@iblai/iblai-js/web-containers`, mirrored by the backend's workflow
compiler. **The backend ignores keys it does not
know** — a misnamed field does not fail, it silently turns the step into a
no-op.

## Node and edge

```ts
// definition.nodes[]
{
  id: string;                 // step id — what step_results['<id>'] refers to
  type: string;               // 'start' | 'mentor' | 'end' | 'note' | 'file-search' | 'guardrails'
                              // | 'mcp' | 'if-else' (API alias 'conditional') | 'while'
                              // | 'user-approval' | 'transform' | 'set-state'
  position: { x: number; y: number };
  data: NodeConfig;           // below
  width?: number; height?: number;      // notes keep their size
  draggable?: boolean; selectable?: boolean; connectable?: boolean;
}

// definition.edges[]
{
  id: string;                 // `e-<source>-<handle>-<target>`; condition edges are re-indexed on save
  source: string;
  target: string;
  sourceHandle?: string;      // a side ('left' | 'right' | 'top' | 'bottom') or a branch handle
  targetHandle?: string;
}
```

Branch handles: If / else rows (`condition-0`, `condition-1`, …, else), While
`continue` (**Loop**) and `done` (**Done**), User approval **Approve** /
**Reject**. Start accepts no incoming edge; a Note accepts none and is never
executed.

## `NodeConfig`

```ts
interface NodeConfig {
  // Common
  label: string;
  subtitle?: string;
  color?: string;
  content?: string;                       // Note text

  // Start
  stateVariables?: Variable[];            // { id, name, type, defaultValue? }

  // Agent ('mentor') — the run reads only mentor_id (and outputSchema);
  // the rest is editor state. Model is read-only in the panel and the
  // Tools switches write the agent's own settings, not this step.
  entry_mentor_id?: string;
  mentor_id?: string;
  instructions?: string;
  includeChatHistory?: boolean;
  model?: string;
  reasoningEffort?: string;
  tools?: { id: string; type: string; name: string; config?: unknown }[];
  outputFormat?: string;
  verbosity?: string;
  displayResponseInChat?: boolean;
  showSearchSources?: boolean;
  continueOnError?: boolean;
  writeToHistory?: boolean;

  // If / else
  conditionCount?: number;
  conditions?: Condition[];               // { id, caseName, expression }

  // While
  condition?: string;
  maxIterations?: number;                 // default 10

  // User approval
  userApprovalMessage?: string;

  // Transform
  expressions?: TransformExpression[];    // { id, target, expression }

  // Set state
  assignments?: SetStateAssignment[];     // { id, variable, expression }

  // MCP
  mcpConnectors?: McpConnector[];         // { id, name, icon? }

  // File search
  datasetId?: string;
  datasetName?: string;
  maxResults?: number;
  fileSearchQuery?: string;               // `{{ variable }}` placeholders
}
```

## Variables and expressions

- A variable name matches `^[a-zA-Z][a-zA-Z0-9_]*$`; the backend skips
  names that do not.
- A Start variable's `defaultValue` is parsed by its `type`
  (`parseVariableDefault`): numbers must parse, objects and lists must be
  valid JSON, booleans are `true` / `false`.
- Expressions evaluate **subscript** access only:
  - `variables['attempts'] < 3` (While condition)
  - `variables['counter'] + 1` (Set state value)
  - `step_results['mentor-1']['output']` (Transform value — an earlier
    step's reply). Only Agent, Transform, Set state and While steps write
    `step_results`.
  - `variables.counter` fails validation and evaluates to nothing.
- `collectWorkflowVariables(nodes)` = Start's variables plus names any Set
  state step assigns; `collectVariableUsages(nodes)` lists, per variable,
  the steps that assign or read it (assignments, Transform expressions, If /
  else conditions, the While condition). The panel refuses to delete a
  Start variable with usages.

## Migrations applied on open (`migrateWorkflowDefinition`)

Older definitions are converted for display and the editor shows
**Unsaved** until the next save:

| Old | Now |
|---|---|
| `whileExpression`, `expression` | `condition` (While) |
| `transformMode`, `transformExpressions[{ key, value }]` | `expressions[{ target, expression }]` |
| `setStateAssignments[{ variable, value }]` | `assignments[{ variable, expression }]` |
| rows still holding the prototype default `input.foo + 1` | dropped — it never meant anything and fails validation |
| two-way If / else connections (`true` / `false`) | `condition-0` / `else` |
| old While connections | `continue` / `done` |
| connections into a Note | dropped (the backend cannot compile them) |
| duplicate edge ids | renamed with a `-n` suffix only where they collide |

A published workflow keeps running unchanged until someone edits and saves
it — opening alone never writes.

## Validation copy the editor rewrites

The backend's connectivity check only exempts Start and End, so it warns
about every Note; `withoutNoteConnectivityWarnings` drops those. Two
specific messages — the agent-is-checked-at-run-time notice and "an Agent
step has no agent selected" — are reworded to "agent"; everything else is
shown as the backend sent it.
