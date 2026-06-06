---
name: iblai-crm-activity
description: Build the CRM activity timeline panel that mounts inside a Person or a Deal detail surface — list calls, meetings, emails, notes, tasks, lunches, and deadlines, schedule them, set reminders, mark them done idempotently, and render server-emitted stage-change audit rows distinctly. Use when the user mentions CRM activity, activities, timeline, log a call, schedule a meeting, sales notes, tasks, deadlines, reminders, or mark done. See /iblai-crm-overview for shared setup and RBAC, /iblai-crm-lead-flow for the person host, /iblai-crm-deal-flow for the deal host and stage-change audit rows, /iblai-notification for the bell that surfaces reminders, /iblai-rbac for the CRM User role, and /iblai-auth for token wiring.
globs:
alwaysApply: false
---

# /iblai-crm-activity

Build the activity timeline panel that lives inside a Person or Deal detail
surface: list activities, create them (call, meeting, email, note, task,
lunch, deadline), schedule + remind, mark done, and render server-emitted
audit rows distinctly.

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

- Auth must be set up first (`/iblai-auth`) — this skill reuses the
  token that `/iblai-auth` wired into `.env.local`. Do not introduce
  a new auth layer.
- MCP and skills must be set up: `iblai add mcp`
- `iblai.env` populated with `PLATFORM`, `DOMAIN`, `TOKEN`. If missing,
  tell the user to download the template:
  `curl -o iblai.env https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/iblai.env`
- Caller must hold the **CRM User** role for activity CRUD and the
  `done/` action. See `/iblai-rbac` for the full matrix.
- A host surface must already exist. The timeline is a **panel**, not a
  standalone page. Either:
  - `/iblai-crm-lead-flow` — for the Person detail timeline, OR
  - `/iblai-crm-deal-flow` — for the Deal detail timeline (which is
    also the source of the server-emitted `Stage changed` audit rows
    you will render).

## What you'll build

- A **timeline panel** that mounts inside the existing Person detail
  page (filtered by `person=<uuid>`) and inside the existing Deal
  detail page (filtered by `deal=<id>`), backed by
  `GET /api/crm/activities/` and the standard
  `{count, next_page, previous_page, results}` envelope.
- A **create-activity form** with a type selector covering all seven
  types — `call`, `meeting`, `email`, `note`, `task`, `lunch`,
  `deadline` — plus `title`, `comment`, optional `location`,
  `schedule_from`, `schedule_to`, `reminder_at`, and free-form
  `metadata`.
- A **done checkbox** on each open user row that calls
  `POST /api/crm/activities/{id}/done/` — idempotent, safe to retry.
- A **system-row renderer** that visually de-emphasizes
  server-emitted stage-change audit rows
  (`type === "note" && title === "Stage changed"`) and suppresses
  their edit / delete / done controls per [best practice: render system audit Activities differently](../../../docs/developer/applications/crm.md#165-render-system-audit-activities-differently).

Reference tables for every endpoint and field live in:

- `references/activities-api.md`
- `references/timeline-rendering.md`

## Step 0: Check for CLI Updates

Before running any `iblai` command, ensure the CLI is up to date. Run
`iblai --version` to check the current version, then upgrade directly:

- pip: `pip install --upgrade iblai-app-cli`
- npm: `npm install -g @iblai/cli@latest`

This is safe to run even if already at the latest version.

## Step 1: Install shadcn primitives

There is no dedicated `iblai add` generator for the timeline panel — it is
plain shadcn/ui glued to the CRM REST API. Install the primitives you need:

```bash
npx shadcn@latest add card select input textarea checkbox button dialog calendar popover badge
```

You will use `card` for each row, `select` for the type picker, `input`
and `textarea` for title/comment, `calendar` + `popover` for date
pickers, `checkbox` for the done toggle, `dialog` for the create form,
and `badge` for the type chip.

## Step 2: Wrap the activities REST API

Create `lib/iblai/crm-activities.ts`. Read the token and base URL the way
`/iblai-auth` already wired them — do not introduce a parallel auth layer.

Endpoints (every activity row is scoped to your Platform; cross-Platform
rows return 404):

| Verb | Path | Use |
|---|---|---|
| `GET` | `/api/crm/activities/?person={uuid}` | List a person's timeline |
| `GET` | `/api/crm/activities/?deal={id}` | List a deal's timeline |
| `POST` | `/api/crm/activities/` | Create — body MUST set EXACTLY one of `person`/`deal` (or both, where the person equals the deal's person). Neither = 400. |
| `PATCH` | `/api/crm/activities/{id}/` | Edit user-authored rows. Do NOT call on system rows. |
| `DELETE` | `/api/crm/activities/{id}/` | Delete user-authored rows. Do NOT call on system rows. |
| `POST` | `/api/crm/activities/{id}/done/` | Mark done — idempotent, no body |

Every list call uses the standard pagination envelope
`{count, next_page, previous_page, results[]}`. Default ordering is
newest-first by `created_at`.

Server-managed fields you MUST NOT write from the client:

- `done_at` — stamped server-side the first time `is_done` flips true
- `reminder_sent` — flipped server-side after reminder dispatch

See `references/activities-api.md` for the full field list, every
filter, the attachment-rule errors, and curl examples.

## Step 3: Activity-type selector

Render a shadcn `select` whose values map 1:1 to the `type` field on the
POST body. All seven types are first-class — none are aliases.

| Value | Suggested chip color | Suggested icon |
|---|---|---|
| `call` | sky | Phone |
| `meeting` | indigo | CalendarClock |
| `email` | violet | Mail |
| `note` | slate | StickyNote |
| `task` | amber | CheckSquare |
| `lunch` | rose | Utensils |
| `deadline` | red | AlarmClock |

The chip color is cosmetic — drive it from a small lookup table next to
your renderer. The `type` you POST must be one of the seven strings
above verbatim.

## Step 4: Scheduling and reminders

Collect three ISO-8601 datetime fields in the create form. Match the
shape to the intent — do not invent dates to fill empty slots:

| `schedule_from` | `schedule_to` | Read as |
|---|---|---|
| null | null | A past log entry recorded after the fact (a logged call, a written note) |
| set | null | A scheduled task or deadline with a start time but no fixed end |
| set | set | A meeting or other time-bounded event |

Add an optional `reminder_at` — typically a fixed offset before
`schedule_from` (15 minutes before is a common meeting default). The
server stamps `reminder_sent` after dispatch — DO NOT set it from the
client. The server also stamps `done_at` on completion — DO NOT set it
from the client.

> Reminder delivery is not yet dispatched server-side (see [Reminders](../../../docs/developer/applications/crm.md#105-reminders)).
> `reminder_at` round-trips and you can surface a local in-app prompt
> from it today; `reminder_sent` will stay `false` until the dispatcher
> ships.

## Step 5: Mark-done checkbox

Render a shadcn `checkbox` on every open user row. When checked, POST
to `/api/crm/activities/{id}/done/` with no body. The response is the
full updated activity object — splice it into your local list so the
row re-renders with `is_done=true` and `done_at` populated without a
follow-up GET.

This action is **idempotent**: repeat calls on an already-done activity
return the SAME `done_at` the server stamped on the first call. That
makes the checkbox safe to retry from a flaky network without drifting
completion timestamps that downstream reports depend on.

Do not render the checkbox on system rows — see Step 7.

## Step 6: Render the timeline

Order rows newest-first. Default to `created_at` desc (which is what
the API returns); when you want a calendar-style view (e.g. an
upcoming-meetings panel), sort by `schedule_from` instead and filter
`?is_done=false` to hide completed entries.

Each row should show, at minimum: the type chip (with the color +
icon from Step 3), `title`, `comment`, the relative time, the owner,
and — for scheduled rows — `schedule_from` (and `schedule_to` when
present). Combine list filters to drive panel variants — for example
`?deal=314&type=call&is_done=false` powers an "upcoming calls" panel
on a deal.

## Step 7: Render system audit rows distinctly

Per [best practice: render system audit Activities differently](../../../docs/developer/applications/crm.md#165-render-system-audit-activities-differently), the CRM writes a system Activity every time a deal moves
stage, wins, or is lost. Detect them client-side with one predicate:

```ts
const isStageChangeAudit = (a: Activity): boolean =>
  a.type === "note" && a.title === "Stage changed";
```

For rows where that returns true:

- Use a distinct system icon (a small arrow / system glyph)
- Render at smaller size with muted text
- Suppress edit, delete, and done controls — the row is server-authored
  and arrives already complete (`is_done: true`, `done_at` set to the
  transition timestamp)
- Use the `comment` body (e.g. `"Discovery → Proposal"`) as the line
  of record

See `references/timeline-rendering.md` for the full rationale and the
schedule / reminder / attachment semantics.

## Filters

The list endpoint accepts a focused set of query parameters useful for
the panel variants you will build. The most commonly used here:

| Param | Type | Use |
|---|---|---|
| `person` | UUID | Person timeline (mount on person detail) |
| `deal` | integer | Deal timeline (mount on deal detail) |
| `type` | string | One of the seven types — narrow to a single kind |
| `is_done` | boolean | Hide completed / show only open |
| `owner` | integer | Filter by owning user id |
| `schedule_from__gte` | datetime | Calendar window start |
| `schedule_from__lte` | datetime | Calendar window end |
| `metadata__has_key` | string | Activities whose `metadata` JSON contains this top-level key |
| `page`, `page_size` | integer | Standard pagination |

The full list — including `metadata__has_key` semantics and combining
rules — lives in `references/activities-api.md`.

## Verify

Run `/iblai-ops-test` before telling the user the work is ready:

1. `pnpm build` — must pass with zero errors.
2. `pnpm dev` and open the relevant detail pages:
   - Open a Person detail page from `/iblai-crm-lead-flow`. Create an
     activity with `type=call`, no schedule, a short comment. Confirm
     it appears at the top of the timeline. Mark it done with the
     checkbox; confirm `is_done` flips and `done_at` populates.
   - Open a Deal detail page from `/iblai-crm-deal-flow`. Create a
     `meeting` with `schedule_from` and `schedule_to` set 30 minutes
     apart, and `reminder_at` 15 minutes before `schedule_from`.
     Confirm the row renders with the type chip, scheduled time, and
     reminder.
   - From the deal kanban, move the deal to a new stage. Reload the
     deal timeline and confirm a server-emitted row appears with
     `type="note"`, `title="Stage changed"`, `is_done=true`, and is
     rendered distinctly (smaller, muted, system icon, no edit /
     delete / done controls).
3. Screenshot the timeline so the user can see it:
   ```bash
   pnpm dev &
   npx playwright screenshot http://localhost:3000/crm/deals/<id> /tmp/deal-timeline.png
   npx playwright screenshot http://localhost:3000/crm/contacts/<uuid> /tmp/person-timeline.png
   ```

## Related skills

- `/iblai-crm-overview` — setup, RBAC, seeded defaults
- `/iblai-crm-lead-flow` — person timeline host
- `/iblai-crm-deal-flow` — deal timeline host + audit row source (stage moves emit notes)
- `/iblai-notification` — bell UI for activity reminders + CRM events
- `/iblai-rbac` — CRM User role
- `/iblai-auth` — token wiring
