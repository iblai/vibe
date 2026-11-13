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
  id: string;                 // step id — what step_results['<id>'] and {{steps.<id>}} refer to
  type: string;               // 'start' | 'mentor' | 'end' | 'note' | 'classifier' | 'if-else'
                              // (API alias 'conditional') | 'while' | 'transform' | 'set-state'
                              // — and, not offered for new steps: 'file-search' | 'guardrails'
                              // | 'mcp' | 'user-approval'
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

Branch handles:

| Step | Handles |
|---|---|
| If / Else | `condition-0`, `condition-1`, …, `else` |
| While | `continue` (**Loop**), `done` (**Done**) |
| Classifier, Pick a Category | each category's `id`, then `fallback` |
| Classifier, Yes or No | `true` (**Yes**), `false` (**No**), `fallback` |
| Classifier, Rate on a Scale | `next` (**Next**), `fallback` |
| User Approval | **Approve** / **Reject** |

Start accepts no incoming edge; a Note accepts none and is never executed.
`CLASSIFIER_HANDLES` and `classifierBranches(data)` give the Classifier's
handles in card order; publish refuses an edge on an answer the step no
longer has, which is why `reconcileClassifierEdges` moves a renamed
category's edge and drops a removed one.

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

  // Agent ('mentor') — the run reads mentor_id, instructions,
  // output_variable and outputSchema; the rest is editor state. Model is
  // read-only in the panel and the Tools switches write the agent's own
  // settings, not this step.
  entry_mentor_id?: string;
  mentor_id?: string;
  instructions?: string;                  // added to the user's message; takes placeholders
  output_variable?: string;               // Agent and Classifier; left out when unset
  outputSchema?: Record<string, unknown>; // ask for JSON of this shape; the variable holds its fields
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

  // Classifier (also model, instructions and output_variable)
  answer_type?: 'choice' | 'noul' | 'score'; // Pick a Category | Yes or No | Rate on a Scale
  input?: string;                         // the text judged; empty = the user's message
  categories?: { id: string; label: string; description?: string }[];  // 2–20
  levels?: { label: string; description?: string }[];                  // 2–10, lowest first
  examples?: { category: string; text: string }[]; // a category id, 'true' / 'false', or a level label
  true_means?: string;
  false_means?: string;
  include_history?: { enabled: boolean; turns?: number };  // 1–10, default 3
  confidence_threshold?: number;          // 0–1, default 0.6
  when_unsure?: 'fallback' | 'best_and_flag';

  // If / else
  conditionCount?: number;
  conditions?: Condition[];               // { id, caseName, expression }

  // While
  condition?: string;
  maxIterations?: number;                 // default 10, at most 100

  // Transform
  expressions?: TransformExpression[];    // { id, target, expression }

  // Set state
  assignments?: SetStateAssignment[];     // { id, variable, expression }

  // Not offered for new steps
  userApprovalMessage?: string;           // User approval
  mcpConnectors?: McpConnector[];         // MCP — { id, name, icon? }
  datasetId?: string;                     // File search
  datasetName?: string;
  maxResults?: number;
  fileSearchQuery?: string;
}
```

A new Classifier is `newClassifierData(label, [first, second])`:
`answer_type: 'choice'`, `model: 'iblai'` (`IBLAI_DECISION_MODEL`, the
organization's default decision model), empty instructions and two
categories. A category's `id` follows its label in the backend's form
(`^[a-z][a-z0-9_]*$`, at most 40 characters): `categoryIdFor` lowercases
it, turns everything else into `_`, prefixes `category_` when it would not
start with a letter, adds `_answer` to `fallback`, `next`, `true` and
`false`, and `_2`, `_3`, … to a duplicate.

## Variables, placeholders and expressions

- A variable name matches `^[a-zA-Z][a-zA-Z0-9_]*$`; the backend skips
  names that do not.
- A Start variable's `defaultValue` is parsed by its `type`
  (`parseVariableDefault`): numbers must parse, objects and lists must be
  valid JSON, booleans are `true` / `false`.
- **Placeholders** (`instructions`, a Classifier's `input`) are text the
  backend fills in before the step runs: `{{input}}`
  (`INPUT_PLACEHOLDER`), `{{variables.<name>}}` (`variablePlaceholder`),
  `{{steps.<id>}}` (`stepPlaceholder`). `placeholderSources(nodeId, nodes,
  edges)` lists what a step can name: Start's variables and what steps
  that run before it set. Publish refuses a placeholder that is always
  empty at that step.
- **Expressions** (conditions, values) evaluate **subscript** access only:
  - `variables['attempts'] < 3` (While condition)
  - `variables['counter'] + 1` (Set state value)
  - `step_results['mentor-1']['output']` (an earlier step's reply). Only
    Agent, Classifier, Transform, Set state and While steps write
    `step_results` (`stepHasResult`).
  - `variables['items'][0]`, `variables['items'][-1]` (first, last item)
  - `variables.counter` fails validation and evaluates to nothing.
- `collectWorkflowVariables(nodes)` = Start's variables, names any Set
  state step assigns, and every Agent or Classifier `output_variable`.
  `collectVariableUsages(nodes)` lists, per variable, the steps that assign
  or read it (assignments, Transform expressions, If / else conditions, the
  While condition, placeholders, Output Variables). The panel refuses to
  delete a Start variable with usages. A pasted step whose
  `output_variable` is taken gets a free name.
- A Classifier try sends `startVariableDefaults(nodes)` as `variables`.

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

The editor also drops an Agent step's `instructions` when they are only
the agent's own prompt or the old builder's default, "You are a helpful
assistant." (`isAuthoredInstructions`): earlier builds saved those, and the
backend never sends them.

A published workflow keeps running unchanged until someone edits and saves
it — opening alone never writes.

## Validation copy the editor rewrites

The backend ends most messages with where it found the problem (`at
nodes[2].data (field: instructions)`), and sends each line again in
`error_details` / `warning_details` with its `node_id`. The editor links a
line to that step and focuses the named field when it is opened, and words
the backend's messages in terms of agents and step names: the
agent-is-checked-at-run-time notice (shown once, not per step), an Agent
step with no agent, one that uses the workflow's own run agent or an agent
that no longer exists, an invalid Output Variable, a Classifier path that
goes straight to End, two steps saving into one variable, and a Classifier
model that is not switched on. The backend's connectivity check only
exempts Start and End, so it warns about every Note;
`withoutNoteConnectivityWarnings` drops those. Everything else is shown as
the backend sent it.
