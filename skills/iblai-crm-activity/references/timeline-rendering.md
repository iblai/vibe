# Timeline Rendering — [Activity Timeline & Auto-Records](../../../../docs/developer/applications/crm.md#10-activity-timeline--auto-records) + [Render system audit Activities differently](../../../../docs/developer/applications/crm.md#165-render-system-audit-activities-differently)

Condensed from [Activity Timeline & Auto-Records](../../../../docs/developer/applications/crm.md#10-activity-timeline--auto-records) and
[Render system audit Activities differently](../../../../docs/developer/applications/crm.md#165-render-system-audit-activities-differently). Use this alongside
`references/activities-api.md` when wiring the timeline panel.

## 10.1 Reading a timeline

The list endpoint is filterable by either parent. The panel is mounted
inside an existing Person or Deal detail surface, and filters by
exactly one host:

- Deal-centric panel: `GET /api/crm/activities/?deal={id}`
- Person-centric panel: `GET /api/crm/activities/?person={uuid}`

Both calls return the standard paginated envelope. Default ordering is
newest-first by `created_at`.

Combine filters to drive panel variants — for example
`?deal=314&type=call&is_done=false` renders an "upcoming calls" panel
on a deal page.

## 10.2 Distinguishing system rows from user rows

The CRM writes its own Activities when a Deal transitions stages, wins,
or is lost (see [Deal audit trail](../../../../docs/developer/applications/crm.md#93-deal-audit-trail)). These appear in the same `/activities/` feed as
user-authored entries. There is no dedicated `source` field — use a
client-side predicate:

```ts
const isStageChangeAudit = (a: Activity): boolean =>
  a.type === "note" && a.title === "Stage changed";
```

System rows arrive already complete: `is_done: true` and `done_at` set
to the transition timestamp. The `comment` body carries the transition
line, e.g. `"Discovery → Proposal"`.

**Do not** offer edit, delete, or mark-done controls for these rows —
the user did not author them and there is nothing left to mark done.

See also [Render system audit Activities differently](../../../../docs/developer/applications/crm.md#165-render-system-audit-activities-differently) below.

## 10.3 Marking an activity done

```bash
curl -X POST "https://api.iblai.app/dm/api/crm/activities/8821/done/" \
  -H "Authorization: Token $TOKEN"
```

- No request body.
- **Idempotent**: the first call flips `is_done=true` and stamps
  `done_at` with the current server time. Subsequent calls return the
  same activity with the ORIGINAL `done_at` preserved — the server does
  not re-stamp on repeat invocations.
- This matters for offline-capable clients that may retry the same
  request after a network blip; you will not see the completion time
  drift forward each time the queue flushes.
- The response is the full updated Activity object, so the client can
  replace the row in its local store without a follow-up `GET`.

## 10.4 Schedule semantics

`schedule_from` and `schedule_to` combine to express three intents.
Pick the shape that matches what you are recording — do not invent
dates to satisfy both fields:

| `schedule_from` | `schedule_to` | Read as |
|---|---|---|
| null | null | A past log entry — what happened, recorded after the fact (e.g. "logged call") |
| set | null | A scheduled task or deadline with a start time but no fixed end |
| set | set | A meeting or other time-bounded event |

A call note written ten minutes after the call ended is the first
shape. A "follow up next Tuesday" task is the second. A 30-minute demo
on the calendar is the third.

The server does not enforce a relationship between the two fields
beyond storage. A malformed combination (e.g. `schedule_to` earlier
than `schedule_from`) is the client's responsibility to prevent — wire
a simple ordering check into the create form.

## 10.5 Reminders

- `reminder_at` is set by the caller — typically a fixed offset before
  `schedule_from` (15 minutes before is a common default for meetings).
- `reminder_sent` is server-managed. **Do not write to it from the
  client.**

> **Reminder delivery is not currently dispatched server-side.** Set
> `reminder_at` to track intent and surface a local in-app prompt; the
> field round-trips correctly. `reminder_sent` will remain `false`
> until a server-side dispatcher is wired.

In the meantime, you can drive an in-app prompt from `reminder_at` for
the current user's own owned activities, and feed CRM event
notifications (see [Notifications](../../../../docs/developer/applications/crm.md#12-notifications) and `/iblai-notification`) into the bell UI.

## 10.6 Attaching an activity

Every activity must attach to a Deal **or** a Person — or both, where
they agree:

- Posting with neither set returns `400`:
  ```json
  { "detail": ["Activity must attach to a `deal` or a `person`."] }
  ```
  The serializer raises before any database write — a failed create
  has no side effects.
- If both `deal` and `person` are set, the person must equal the
  person already attached to the deal. A mismatch returns `400` with a
  field-level error rather than letting orphaned rows appear in the
  timeline.

A typical create call for a meeting attached to both:

```bash
curl -X POST "https://api.iblai.app/dm/api/crm/activities/" \
  -H "Authorization: Token $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "meeting",
    "title": "Pricing review",
    "deal": 314,
    "person": "9c6f4a2e-1b88-4a0e-9b71-2c2f7a1d6e44",
    "schedule_from": "2026-06-10T16:00:00Z",
    "schedule_to": "2026-06-10T16:45:00Z",
    "reminder_at": "2026-06-10T15:45:00Z"
  }'
```

The response is the created Activity — ready to splice into the
timeline view without a re-fetch.

## 16.5 Render system audit Activities differently

When a deal transitions stages (via `move-stage/`, `won/`, or
`lost/`), the server writes a system Activity with `type === "note"`
and `title === "Stage changed"`. These appear in the same
`/api/crm/activities/` list as user-authored notes, calls, and tasks.

In the timeline UI:

- Render them with a distinct icon — a system / arrow glyph works well.
- **Suppress edit, delete, and mark-done controls.** They are already
  complete (`is_done: true`, `done_at` set) and immutable in intent.
- Keep them visually quieter than user-authored entries — smaller text,
  muted color — so the timeline still reads as a human history with
  system audit beats woven in.
- The `comment` body (e.g. `"Discovery → Proposal"`) is the line of
  record. Use it as the row body.

See [Activities API](../../../../docs/developer/applications/crm.md#76-activities) and [Activity Timeline & Auto-Records](../../../../docs/developer/applications/crm.md#10-activity-timeline--auto-records) for the canonical references this guidance is built on.
