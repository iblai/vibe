---
name: iblai-vibe-agent-evals
description: Add the agent Evals tab (run the agent against benchmarks, score responses with LLM-as-Judge reviews or manual scores, export CSV) to your Next.js app
globs:
alwaysApply: false
---

# /iblai-vibe-agent-evals

Add the agent **Evals tab** -- run your agent against a benchmark (a set
of test questions) and score every response, so you can catch weak spots
and track improvements as you refine the agent. The tab bundles several
surfaces into one component: a benchmark picker, an evaluations table
with status badges and a per-row actions menu (View results / New review /
Check status / Export CSV / Delete), a **New Evaluation** dialog, an
embedded **Manage benchmarks** dialog (create benchmarks, add Q&A pairs
manually or via CSV upload), a results modal showing every trace with its
scores and LLM-as-Judge reviews, and an **Evaluate** (new review) modal
with an LLM provider/model picker. This is one tab in the wider
agent-settings family (`access`, `api`, `datasets`, `disclaimers`,
`embed`, `evals`, `history`, `llm`, `memory`, `prompts`, `safety`,
`settings`, `tasks`, `tools`). Each tab is a separate skill. All tabs
share the same `AgentSettingsProvider` wrapper -- set it up once and mount
as many tabs as you need.

![Evals tab with benchmark picker and evaluations table](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/iblai-vibe-agent-evals/iblai-vibe-agent-evals-1-list.png)
![Manage benchmarks dialog (search, New Benchmark)](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/iblai-vibe-agent-evals/iblai-vibe-agent-evals-3-manage-benchmarks.png)
![Results modal (traces, scores, reviews)](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/iblai-vibe-agent-evals/iblai-vibe-agent-evals-8-results.png)
![Evaluate modal (criteria, score name, concurrency, LLM)](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/iblai-vibe-agent-evals/iblai-vibe-agent-evals-10-new-review.png)

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

You MUST run `/iblai-vibe-ops-test` before telling the user the work is ready.

After all work is complete, start a dev server (`pnpm dev`) so the user
can see the result at http://localhost:3000.

`iblai.env` is NOT a `.env.local` replacement — it only holds the 3
shorthand variables (`DOMAIN`, `PLATFORM`, `TOKEN`). Next.js still reads
its runtime env vars from `.env.local`.

Use `pnpm` as the default package manager. Fall back to `npm` if pnpm
is not installed.

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

## Step 2: Mount `AgentEvaluationTab`

`AgentEvaluationTab` has one required prop: `getLLMProviderDetails`. This
maps a provider name to display info (logo URL, display name) for the LLM
picker inside the Evaluate (new review) modal. The host app provides this
because logos and display names are host-specific -- same contract as the
LLM tab (`/iblai-vibe-agent-llm`); if that tab is already mounted, reuse
the same function.

```tsx
// app/(app)/agents/[mentorId]/evals/page.tsx
"use client";

import {
  AgentEvaluationTab,
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

export default function AgentEvalsPage() {
  return (
    <div className="flex h-full flex-col bg-white">
      <AgentEvaluationTab getLLMProviderDetails={getLLMProviderDetails} />
    </div>
  );
}
```

`AgentEvaluationTab` reads `tenantKey`, `mentorId`, and `username` from
`AgentSettingsProvider` (via `useAgentSettings()`) and handles all of its
own data fetching and mutations (benchmarks, runs, reviews, scores,
export, delete).

### With custom pagination

The evaluations table paginates (10 per page). Without a
`PaginationComponent` the built-in web-containers `AdvancedPagination` is
used. Inject your own to match the host app's pagination UI:

```tsx
<AgentEvaluationTab
  getLLMProviderDetails={getLLMProviderDetails}
  PaginationComponent={({ currentPage, totalPages, onPageChange, disabled }) => (
    <MyPagination
      page={currentPage}
      total={totalPages}
      onChange={onPageChange}
      disabled={disabled}
    />
  )}
/>;
```

## Step 3: Customize Labels (Optional)

`AgentEvaluationTab` renders with the default agent-facing copy
(`AGENT_EVALUATION_TAB_LABELS`). Override any string via the `labels`
prop. Pass a full `EvaluationTabLabels` bundle (for a full re-skin) or a
partial object (for one-off edits).

```tsx
import {
  AgentEvaluationTab,
  type EvaluationTabLabels,
  AGENT_EVALUATION_TAB_LABELS,
} from "@iblai/iblai-js/web-containers/next";

<AgentEvaluationTab
  getLLMProviderDetails={getLLMProviderDetails}
  labels={{
    header: {
      title: "Benchmarks",
      description: "Score this agent against your test sets.",
    },
    actions: { newExperiment: "Run benchmark" },
  }}
/>;
```

The label bundle is grouped by surface: `header`, `benchmarkPicker`,
`actions`, `checkStatusToast`, `table`, `startExperimentModal`,
`manageBenchmarksModal`, `detailModal`, `evaluateModal`, and
`deleteModal`. Override only the keys you need.

## Step 4: Use MCP Tools for Customization

```
get_component_info("AgentEvaluationTab")
get_component_info("AgentSettingsProvider")
```

## Tab surfaces

`AgentEvaluationTab` is a single mounted component, but it renders several
distinct surfaces. The corresponding web-containers source (under
`web-containers/.../edit-mentor-modal/tabs/evaluation-tab`) is listed for
reference -- these pieces are internal to `AgentEvaluationTab` and are not
mounted separately.

| Surface | Screenshot | Source component | What it shows |
|---------|-----------|------------------|---------------|
| **Evaluations list** | [list](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/iblai-vibe-agent-evals/iblai-vibe-agent-evals-1-list.png) / [actions](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/iblai-vibe-agent-evals/iblai-vibe-agent-evals-2-actions.png) | `index` (tab root) / `benchmark-combobox` | Info box, benchmark combobox, Manage benchmarks + New Evaluation buttons, and a table of runs (Evaluation / Status / Initiated by / Created) with a per-row menu: View results, New review, Check status, Export CSV, Delete |
| **New Evaluation dialog** | -- | `start-experiment-modal` | Benchmark (read-only) + optional evaluation name (auto-generated if blank); starts a background run of the agent over every benchmark item |
| **Manage benchmarks dialog** | [benchmarks](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/iblai-vibe-agent-evals/iblai-vibe-agent-evals-3-manage-benchmarks.png) / [new](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/iblai-vibe-agent-evals/iblai-vibe-agent-evals-4-new-benchmark.png) | `profile/benchmarks` (embedded `BenchmarksTab`) | Tenant-wide benchmark list with search, a New Benchmark dialog (name + description), and per-benchmark view |
| **Benchmark Q&A items** | [items](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/iblai-vibe-agent-evals/iblai-vibe-agent-evals-5-benchmark-items.png) / [manual](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/iblai-vibe-agent-evals/iblai-vibe-agent-evals-6-add-qa-manual.png) / [csv](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/iblai-vibe-agent-evals/iblai-vibe-agent-evals-7-add-qa-csv.png) | `profile/benchmarks/benchmark-items-modal` | Question/answer pairs used to evaluate agents; Add Q&A supports manual rows or CSV upload (required `input` column, optional `expected_output`, max 10 MB / 10,000 rows) |
| **Results modal** | [results](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/iblai-vibe-agent-evals/iblai-vibe-agent-evals-8-results.png) / [review details](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/iblai-vibe-agent-evals/iblai-vibe-agent-evals-9-review-details.png) | `experiment-detail-modal` | Trace count, a Reviews section (LLM-as-Judge runs with status pill, criteria, and scores produced), and every trace with Input / Expected output / Actual output, its score chips (removable), and an Add-a-score form (name, 0-1 value, comment) |
| **Evaluate modal (new review)** | [evaluate](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/iblai-vibe-agent-evals/iblai-vibe-agent-evals-10-new-review.png) / [llm picker](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/iblai-vibe-agent-evals/iblai-vibe-agent-evals-11-llm-picker.png) | `llm-judge-modal` / `evaluate-llm-picker` | Criteria textarea, score name, max concurrency, and a provider-then-model LLM picker; kicks off an LLM-as-Judge run that scores every trace |
| **Delete confirmation** | [delete](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/iblai-vibe-agent-evals/iblai-vibe-agent-evals-12-delete.png) | `delete-experiment-modal` | Confirm-then-delete for an evaluation run; cannot be undone |

Evaluations run in the background: the table shows a status badge
(COMPLETED green / FAILED red / anything else blue) and **Check status**
refetches a single run and pushes the fresh status into the table.
**View results**, **New review**, and **Export CSV** are disabled until
the run completes.

## `<AgentEvaluationTab>` Props

Import from `@iblai/iblai-js/web-containers/next`.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `getLLMProviderDetails` | `(providerName: string, llmName?: string) => LLMProviderDetails` | Yes | Maps a provider name to display info (logo, display name) for the review-modal LLM picker |
| `labels` | `DeepPartial<EvaluationTabLabels>` | No | Override user-visible strings |
| `PaginationComponent` | `ComponentType<{ currentPage, totalPages, onPageChange, disabled }>` | No | Custom pagination for the evaluations table. Defaults to the web-containers `AdvancedPagination` |

## Related Exports

From `@iblai/iblai-js/web-containers/next`:

- `AGENT_EVALUATION_TAB_LABELS` -- the default agent-facing label bundle.
- `EvaluationTabLabels` -- type for the full label bundle.
- `AgentEvaluationTabProps` -- props type for the tab.
- `LLMProviderDetails` -- type for the return value of
  `getLLMProviderDetails` (shared with `/iblai-vibe-agent-llm`).

From `@iblai/data-layer` (the same RTK Query hooks the tab uses, for
custom UI): `useListEvalDatasetsQuery`, `useListEvalRunsQuery`,
`useStartEvalRunMutation`, `useGetEvalRunQuery`,
`useEvaluateEvalRunMutation`, `useListEvalRunJudgesQuery`,
`useCreateEvalScoreMutation`, `useDeleteEvalScoreMutation`,
`useExportEvalRunMutation`, `useDeleteEvalRunMutation`, plus the
`EvalDataset`, `EvalDatasetRun`, `EvalDatasetRunDetail`, `EvalJudgeTask`,
`EvalScore` payload types.

## Step 5: Verify

Run `/iblai-vibe-ops-test` before telling the user the work is ready:

1. `pnpm build` -- must pass with zero errors
2. `pnpm test` -- vitest must pass
3. Start dev server and touch test:
   ```bash
   pnpm dev &
   npx playwright screenshot http://localhost:3000/agents/<id>/evals /tmp/agent-evals.png
   ```

## Important Notes

- **Redux store**: Must include `mentorReducer` and `mentorMiddleware` --
  the evaluations API slice (datasets / runs / judges / scores) ships
  inside those bundles.
- **`initializeDataLayer()`**: 5 args (v1.2+)
- **`@reduxjs/toolkit`**: Deduplicated via webpack aliases in `next.config.ts`
- **Peer deps**: `sonner` and `@iblai/iblai-web-mentor` must be installed
  (`pnpm add sonner @iblai/iblai-web-mentor`)
- **Shared provider**: `AgentSettingsProvider` must wrap the route at a
  layout level. See `/iblai-vibe-agent-setting` Step 2 for the full snippet.
- **Benchmarks are tenant-wide, runs are agent-scoped**: a benchmark can
  be evaluated against multiple agents. The tab filters runs client-side
  to the current agent via `metadata.mentor_unique_id`; pending runs
  without populated metadata are kept only when the current user initiated
  them (their freshly-started evaluation).
- **Manual scores are 0-1**: the Add-a-score form requires a numeric
  value between 0 and 1. Score writes are ingested asynchronously by the
  eval store -- the modal patches its cache optimistically and the real
  record appears on the next refresh.
- **CSV format** (benchmark Q&A upload): UTF-8, required `input` column,
  optional `expected_output` column, max 10 MB / 10,000 rows; rows with a
  blank question are skipped.
- **First benchmark auto-selected**: the combobox picks the first
  benchmark automatically; New Evaluation stays disabled until a
  benchmark exists (use Manage benchmarks to create one).
- **Brand guidelines**: [BRAND.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/BRAND.md)

## Evaluations REST API

For custom UI beyond `<AgentEvaluationTab>`. All endpoints are prefixed
with `${dmUrl}/api/ai-mentor/orgs/{org}/users/{user_id}/evaluations`
where `dmUrl` is `NEXT_PUBLIC_API_BASE_URL`.

### Benchmarks (datasets)

| Method | Path | Purpose |
|---|---|---|
| GET | `datasets/` | List benchmarks (params: `page`, `limit`, `name`, `user_email`) |
| POST | `datasets/` | Create a benchmark (`{ "name", "description" }`) |
| GET | `datasets/{name}/` | Get one benchmark |
| GET | `datasets/{name}/items/` | List Q&A items (params: `page`, `limit`, `include_trace`) |
| POST | `datasets/{name}/items/` | Add Q&A items |
| POST | `datasets/{name}/items/upload/` | Upload items CSV (multipart) |
| PUT | `datasets/{name}/items/{item_id}/` | Update an item |
| DELETE | `datasets/{name}/items/{item_id}/` | Delete an item |

### Evaluation runs

| Method | Path | Purpose |
|---|---|---|
| GET | `datasets/{name}/runs/` | List runs for a benchmark |
| POST | `datasets/{name}/runs/` | Start a run |
| GET | `datasets/{name}/runs/{run}/` | Run detail (traces + scores) |
| DELETE | `datasets/{name}/runs/{run}/` | Delete a run |
| GET | `datasets/{name}/runs/{run}/export/` | Export results as CSV (text response) |

**Start-run body** (bind the run to the agent being evaluated):

```json
{
  "mentor_unique_id": "agent-uuid",
  "run_name": "qa-eval-v1"
}
```

`run_name` is optional -- the backend auto-generates one (e.g.
`run-091c4937`) when omitted.

### LLM-as-Judge reviews

| Method | Path | Purpose |
|---|---|---|
| POST | `datasets/{name}/runs/{run}/evaluate/` | Start a review (LLM scores every trace) |
| GET | `datasets/{name}/runs/{run}/evaluate/` | List reviews for a run (params: `page`, `limit`, `status`) |
| GET | `judges/` | List reviews across runs (params: `dataset_name`, `status`) |

**Review body:**

```json
{
  "criteria": "Evaluate the response on accuracy",
  "score_name": "accuracy",
  "llm_provider": "openai",
  "llm_name": "gpt-5",
  "max_concurrency": 4
}
```

### Scores

| Method | Path | Purpose |
|---|---|---|
| GET | `scores/` | List scores (params: `dataset_run_id`, `trace_id`, `name`) |
| POST | `scores/` | Add a manual score (`{ "trace_id", "name", "value", "comment"?, "dataset_run_id"? }`, value 0-1) |
| DELETE | `scores/{score_id}/` | Remove a score |
| GET | `score-configs/` | List score configs |
| POST | `score-configs/` | Create a score config |

Task status polling (used by Check status) goes through
`/api/ai-mentor/orgs/{org}/users/{user_id}/tasks/{task_id}`.
