# iblai-crm-deal-flow

> Build the revenue funnel CRM surface — pipelines, stages, lead sources, and the kanban deal board with move-stage / won / lost transitions. Use when the user mentions deals, kanban, pipeline, stages, lead sources, move stage, mark won, mark lost, lost reason, deal status, or sales funnel. See /iblai-crm-overview for setup and RBAC, /iblai-crm-lead-flow for persons (deals require one), /iblai-crm-activity for the timeline + audit rows, and /iblai-crm-notification for CRM_DEAL_STAGE_CHANGED routing.

# /iblai-crm-deal-flow

Build the revenue funnel: a pipeline selector, a kanban deal board (columns = stages, cards = deals), and the move-stage / won / lost state machine with `lost_reason` collection.

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
is not installed. The generated app should live in the current directory,
not in a subdirectory.

> **Common setup (brand, conventions, env files, verification):** see [docs/skill-setup.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/docs/skill-setup.md).

## Prerequisites

- Auth must be set up first (`/iblai-auth`) — reuse the same token wiring
- MCP and skills must be set up: `iblai add mcp`
- `iblai.env` populated with `PLATFORM`, `DOMAIN`, `TOKEN`. If missing:
  `curl -o iblai.env https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/iblai.env`
- A Person already exists in the CRM. Deals REQUIRE a `person` UUID — if
  you have not built the lead capture surface yet, do `/iblai-crm-lead-flow`
  first and come back.
- RBAC role on the caller:
  - `CRM User` — list, read, create, update, delete deals; call
    `move-stage/`, `won/`, `lost/`. This is what 95% of sales reps need.
  - `CRM Manager` — additionally lets you CRUD pipelines, stages, and
    lead sources. Only needed if you're building the admin UI in Step 8.
  - See `/iblai-rbac` for the full matrix.

## What you'll build

1. **Pipeline selector** — defaults to the seeded `default` pipeline; lets
   the user switch when more than one exists.
2. **Kanban board** — one column per stage in `sort_order`, cards grouped
   by `deal.stage`. Card shows title, `lead_value` + `currency`, person
   name, and days-in-stage.
3. **Drag-drop → `move-stage`** — using `@dnd-kit`, fires
   `POST /deals/{id}/move-stage/` with `{stage_code}`.
4. **Deal detail panel** — clicking a card opens a slide-over with full
   deal fields and **Won** / **Lost** buttons.
5. **Lost modal** — collects required `lost_reason` before hitting
   `POST /deals/{id}/lost/`.
6. **(Optional) Admin UI** — pipeline + stage + lead source CRUD for
   `CRM Manager` users.

## Step 0: Check for CLI Updates

Before running any `iblai` command, ensure the CLI is up to date.
Run `iblai --version`, then upgrade directly:
- pip: `pip install --upgrade iblai-app-cli`
- npm: `npm install -g @iblai/cli@latest`

## Step 1: Install shadcn primitives + dnd-kit

```bash
npx shadcn@latest add card badge dialog select button input textarea form sheet skeleton
pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

`@dnd-kit` is the recommended dnd primitive — accessible, headless, plays
well with shadcn `card`. Do not write a custom drag layer.

## Step 2: Typed API client wrappers

Reuse the auth token wiring from `/iblai-auth` — do NOT introduce a new
token-management layer. Read the same `Token` value the rest of the app
uses (the SDK persists it; client code can grab it from `localStorage` or
from the auth context).

Create `lib/iblai/crm.ts` with thin typed fetchers:

```ts
// lib/iblai/crm.ts
const BASE = `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/crm`;

type Stage = {
  id: number; pipeline: number; code: string; name: string;
  probability: number; sort_order: number;
  is_won: boolean; is_lost: boolean; metadata: Record<string, unknown>;
};

type Pipeline = {
  id: number; name: string; code: string; is_default: boolean;
  rotten_days: number; stages: Stage[]; metadata: Record<string, unknown>;
};

type Deal = {
  id: number; title: string; description: string;
  lead_value: string; currency: string;
  status: "open" | "won" | "lost"; lost_reason: string;
  expected_close_date: string | null; closed_at: string | null;
  person: string; organization: string | null;
  pipeline: number; stage: number;
  source: number | null; owner: number | null;
  tags: { id: number; name: string; color: string }[];
  metadata: Record<string, unknown>;
  created_at: string; updated_at: string;
};

const h = (token: string) => ({
  Authorization: `Token ${token}`,
  "Content-Type": "application/json",
});

export const crm = {
  listPipelines: (token: string, params = "") =>
    fetch(`${BASE}/pipelines/${params}`, { headers: h(token) }).then(r => r.json()),
  listLeadSources: (token: string) =>
    fetch(`${BASE}/lead-sources/`, { headers: h(token) }).then(r => r.json()),
  listDeals: (token: string, pipelineId: number) =>
    fetch(`${BASE}/deals/?pipeline=${pipelineId}&status=open`, { headers: h(token) })
      .then(r => r.json()),
  createDeal: (token: string, body: Partial<Deal>) =>
    fetch(`${BASE}/deals/`, { method: "POST", headers: h(token), body: JSON.stringify(body) })
      .then(r => r.json()),
  moveStage: (token: string, id: number, stage_code: string) =>
    fetch(`${BASE}/deals/${id}/move-stage/`, {
      method: "POST", headers: h(token), body: JSON.stringify({ stage_code }),
    }).then(r => r.json()),
  won: (token: string, id: number, stage_code?: string) =>
    fetch(`${BASE}/deals/${id}/won/`, {
      method: "POST", headers: h(token),
      body: JSON.stringify(stage_code ? { stage_code } : {}),
    }).then(r => r.json()),
  lost: (token: string, id: number, lost_reason: string, stage_code?: string) =>
    fetch(`${BASE}/deals/${id}/lost/`, {
      method: "POST", headers: h(token),
      body: JSON.stringify({ lost_reason, ...(stage_code ? { stage_code } : {}) }),
    }).then(r => r.json()),
};
```

Full endpoint catalogs and field tables live in
[`references/pipelines-api.md`](./references/pipelines-api.md),
[`references/lead-sources-api.md`](./references/lead-sources-api.md), and
[`references/deals-api.md`](./references/deals-api.md).

## Step 3: Fetch the default pipeline once on mount

Every Platform is seeded with a default pipeline (`code=default`) carrying
six stages — `new`, `qualified`, `proposal`, `negotiation`, `won`, `lost`.
The list response embeds the ordered `stages` array inline, so you do not
need a second roundtrip.

```ts
const { results } = await crm.listPipelines(token, "?is_default=true");
const pipeline = results[0];
// Index stages by CODE — not id. Codes are stable across environments;
// ids differ between dev / staging / prod (see the CRM doc's [best practice: reference stages by code, not by display name](../../../docs/developer/applications/crm.md#162-reference-stages-by-code-not-by-display-name)).
const stagesByCode = Object.fromEntries(pipeline.stages.map((s) => [s.code, s]));
const stagesById = Object.fromEntries(pipeline.stages.map((s) => [s.id, s]));
```

Cache `pipeline.id` and the stages object in your store (Zustand, Redux,
or React state). The board only needs to re-fetch when the user switches
pipelines.

## Step 4: Render the kanban board

```ts
const { results: deals } = await crm.listDeals(token, pipeline.id);
const columns = pipeline.stages
  .filter((s) => !s.is_won && !s.is_lost)        // hide terminal columns on the open board
  .sort((a, b) => a.sort_order - b.sort_order);
const byStage = Object.groupBy(deals, (d) => d.stage); // group cards by Deal.stage (the stage id)
```

Card content:
- `title` — bold, truncated to 1 line
- `lead_value` formatted with `Intl.NumberFormat` + `currency`
- Person name (look up via `/iblai-crm-lead-flow` person store)
- Days-in-stage = `dayjs().diff(deal.updated_at, "day")`; flag in red when
  it exceeds `pipeline.rotten_days` (default 30)

Use shadcn `card` for cards, `badge` for the stage chip, `skeleton` for
the initial loading state.

## Step 5: Drag-drop → move-stage

Wire `@dnd-kit`'s `DndContext` around the columns. On drop, derive the
destination stage CODE (never raw id — see [best practice: reference stages by code, not by display name](../../../docs/developer/applications/crm.md#162-reference-stages-by-code-not-by-display-name)) and call:

```ts
async function onDragEnd(deal: Deal, destStageCode: string) {
  const dest = stagesByCode[destStageCode];
  if (!dest) return;
  if (dest.id === deal.stage) return;      // no-op guard — see [Idempotency](../../../docs/developer/applications/crm.md#96-idempotency)
  const updated = await crm.moveStage(token, deal.id, destStageCode);
  setDeals((prev) => prev.map((d) => (d.id === deal.id ? updated : d)));
}
```

**Server side effects to call out in the UI:**

- The server appends an audit Activity (`type=note`,
  `title="Stage changed"`, `comment="<from> → <to>"`,
  `is_done=true`). This row will appear in the deal timeline — render it
  with a distinct icon and no edit controls per
  `/iblai-crm-activity` ([best practice: render system audit Activities differently](../../../docs/developer/applications/crm.md#165-render-system-audit-activities-differently)).
- A `CRM_DEAL_STAGE_CHANGED` notification fires. See
  `/iblai-crm-notification` for recipient routing and channel config.
- `Deal.status` is recomputed from the destination stage's `is_won` /
  `is_lost` flags. Do **not** echo the optimistic status — re-read from
  the server response.
- Dragging onto the same column is **suppressed server-side** (no write,
  no notification, no audit row). Gate the call client-side too so the
  UI does not flash. See `references/state-machine.md`.

## Step 6: Won / Lost buttons

On the deal detail panel, add two buttons:

```ts
// Won — picks the first is_won stage by sort_order automatically
const updated = await crm.won(token, deal.id);

// Won — disambiguate when the pipeline has multiple is_won stages
const updated = await crm.won(token, deal.id, "closed-won-expansion");
```

**Lost** requires `lost_reason` — the API returns `400` if missing or
blank (see [best practice: always provide a lost_reason](../../../docs/developer/applications/crm.md#164-always-provide-a-lost_reason)). Always collect it in a modal:

```tsx
<Dialog open={lostOpen} onOpenChange={setLostOpen}>
  <DialogContent>
    <DialogTitle>Mark as Lost</DialogTitle>
    <Textarea
      placeholder="Why did this deal slip?"
      value={reason}
      onChange={(e) => setReason(e.target.value)}
      maxLength={255}
      required
    />
    <Button
      disabled={!reason.trim()}
      onClick={async () => {
        const updated = await crm.lost(token, deal.id, reason.trim());
        setLostOpen(false);
        // refresh board — deal is now status="lost"
      }}
    >
      Confirm Lost
    </Button>
  </DialogContent>
</Dialog>
```

**Re-opening a deal.** Won/lost are not one-way doors. To re-open, call
`crm.moveStage(token, dealId, "<non-terminal-stage-code>")`. The server
clears `closed_at`, flips `status` back to `open`, writes an audit
Activity, and fires `CRM_DEAL_STAGE_CHANGED` again. There is no dedicated
"reopen" endpoint — the stage move IS the reopen.

## Step 7: Client-side footguns (must enforce in the UI)

- **Never PATCH `status` or `closed_at`.** Both are server-managed; sending
  either on PUT/PATCH returns 400 with the message
  *"Service-managed — write via move-stage/, won/, or lost/."* Do not
  surface these fields on a deal edit form.
- **`Deal.stage` must belong to `Deal.pipeline`.** If you let the user
  switch a deal's pipeline, also force them to pick a stage from the new
  pipeline before submit. Mismatch returns 400.
- **`Deal.organization` must match `Person.organization`** when the person
  already has one. Pre-fill the organization field from the selected
  person and disable it when set, or you will hit a 400.
- **`owner` defaults to the calling user.** Only send it when you are
  explicitly reassigning the deal.

## Step 8 (optional): Pipeline, Stage, and Lead Source admin

Only build this when the user has the `CRM Manager` role. Gate the menu
entry behind that role — see `/iblai-rbac`.

Destructive-delete behavior differs across these resources — surface a
confirmation dialog that explains the consequence:

| Resource | DELETE behavior |
|---|---|
| Pipeline | `409 Conflict` if any Deal references it. Migrate deals first. |
| Stage | `409 Conflict` if any Deal references it. Move those deals to another stage first. |
| Lead Source | **Not blocked.** SETs `Deal.source = NULL` on every referencing deal. Historical attribution is lost. Treat as destructive. |

Other admin guardrails:

- Pipeline `code` is unique per Platform (duplicate → 400).
- At most one pipeline can have `is_default=true` per Platform — un-flag
  the existing default first.
- Stage `code` is unique within its pipeline.
- A stage cannot be both `is_won` and `is_lost` (400 if you try).
- `probability` is 0–100 (400 otherwise).

Full tables, error payloads, and curl examples live in
[`references/pipelines-api.md`](./references/pipelines-api.md) and
[`references/lead-sources-api.md`](./references/lead-sources-api.md).

## State machine

A Deal's `status` is **derived** from the stage it currently sits in —
never written directly. Three endpoints change the stage:

- `POST /deals/{id}/move-stage/` — go anywhere in the pipeline.
- `POST /deals/{id}/won/` — go to the first `is_won` stage (or a specific
  one via `stage_code`).
- `POST /deals/{id}/lost/` — go to the first `is_lost` stage; **requires**
  `lost_reason`.

Every successful, non-no-op transition:
1. Recomputes `status` (`is_won` → `won`, `is_lost` → `lost`, else `open`).
2. Stamps or clears `closed_at`.
3. Writes a `type=note`, `title="Stage changed"` audit Activity.
4. Fires `CRM_DEAL_STAGE_CHANGED`.

Idempotency: moving to the current stage is a no-op (no write, no signal,
no audit row, no notification). `lost/` is the one exception — it overwrites
`lost_reason` unconditionally even when the stage move is a no-op, so
pass the original reason on retries.

Concurrency: transitions serialize on a row lock. Two simultaneous
requests cannot both observe the same `from_stage`. Refresh the deal
after a transition so the UI matches reality.

Full diagrams + edge cases: [`references/state-machine.md`](./references/state-machine.md).

## Verify

Run `/iblai-ops-test` before telling the user the work is ready:

1. `pnpm build` — must pass with zero errors.
2. `pnpm dev` and drive the board:
   ```bash
   pnpm dev &
   npx playwright screenshot http://localhost:3000/crm/deals /tmp/deals.png
   ```
3. Drag a card from `qualified` → `negotiation`. Confirm:
   - The card lands and `updated_at` advances.
   - The deal timeline (via `/iblai-crm-activity`) shows a new system
     row: title `"Stage changed"`, comment `"Qualified → Negotiation"`.
   - The notification bell (via `/iblai-crm-notification` →
     `/iblai-notification`) shows a fresh `CRM_DEAL_STAGE_CHANGED` entry.
4. Click **Lost** with an empty textarea → submit button is disabled (or
   the server returns 400 with `{"lost_reason": ["This field is required."]}`).
5. Click **Won** on an open deal → confirm `status` flips to `won`,
   `closed_at` is stamped, and the card moves off the open board.

## Related skills

- `/iblai-crm-overview` — auth, Platform scoping, seeded defaults, RBAC matrix.
- `/iblai-crm-lead-flow` — deals REQUIRE a person; build that flow first.
- `/iblai-crm-activity` — deal timeline rendering; system audit rows look
  different from user-logged activities (see [best practice: render system audit Activities differently](../../../docs/developer/applications/crm.md#165-render-system-audit-activities-differently)).
- `/iblai-crm-tag` — attach tags to deals; filter the kanban board by tag.
- `/iblai-crm-notification` — `CRM_DEAL_STAGE_CHANGED` fires from every
  transition in this skill.
- `/iblai-rbac` — `CRM User` (deals) vs `CRM Manager` (pipelines, stages,
  lead sources) permission matrix.
- `/iblai-auth` — token wiring; do not introduce a parallel token layer.