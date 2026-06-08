# Activities API — `/api/crm/activities/`

Condensed from the [Activities API](../../../../docs/developer/applications/crm.md#76-activities) section of the CRM developer documentation. An Activity is a
timeline entry attached to a Deal **or** a Person (or both, when they
agree). It carries a type, optional schedule, optional reminder, an
owner, and a free-form metadata bag. Activities are also the audit row
the server writes when a Deal transitions stages — those rows arrive
already complete and are surfaced through the same endpoint.

> **Base URL:** `https://<your-platform-host>/api/crm/`
> **Auth:** `Authorization: Token <token>`
> **Pagination envelope:** `{count, next_page, previous_page, results[]}`
> **Default ordering:** newest-first by `created_at`

## Endpoint summary

| Method | Path | Purpose | Required permission |
|---|---|---|---|
| `GET` | `/activities/` | List activities (paginated) | `Ibl.CRM/Activities/list` |
| `POST` | `/activities/` | Create an activity | `Ibl.CRM/Activities/action` |
| `GET` | `/activities/{id}/` | Retrieve one activity | `Ibl.CRM/Activities/read` |
| `PUT` | `/activities/{id}/` | Replace all editable fields | `Ibl.CRM/Activities/write` |
| `PATCH` | `/activities/{id}/` | Patch supplied fields | `Ibl.CRM/Activities/write` |
| `DELETE` | `/activities/{id}/` | Delete the activity | `Ibl.CRM/Activities/delete` |
| `POST` | `/activities/{id}/done/` | Mark done (idempotent) | `Ibl.CRM/Activities/write` |

## Activity object

| Field | Type | Writable | Notes |
|---|---|---|---|
| `id` | integer | no | Server-assigned |
| `platform` | integer | no | Owning Platform id |
| `title` | string | yes | Short summary. Required on create. |
| `type` | string | yes | One of `call`, `meeting`, `email`, `note`, `task`, `lunch`, `deadline`. Required on create. |
| `location` | string | yes | Meeting location, dial-in URL, venue. Defaults to `""`. |
| `comment` | string | yes | Free-text body. Defaults to `""`. |
| `schedule_from` | datetime \| null | yes | Scheduled start (ISO-8601). |
| `schedule_to` | datetime \| null | yes | Scheduled end (ISO-8601). |
| `is_done` | boolean | yes | Defaults to `false`. Prefer `POST /activities/{id}/done/` to flip this — it stamps `done_at` for you and is idempotent. |
| `done_at` | datetime \| null | **no — read-only** | Stamped the first time `is_done` flips true. Preserved on repeat `done/` calls. |
| `deal` | integer \| null | yes | Attached Deal id. EXACTLY one of `deal`/`person` must be set on create (both is allowed only if they agree — see attachment rule). |
| `person` | UUID \| null | yes | Attached Person id. See attachment rule. |
| `owner` | integer \| null | yes | Owning user id. Defaults to the calling user. Must be an active member of your Platform. |
| `reminder_at` | datetime \| null | yes | When to remind the owner. Typically a fixed offset before `schedule_from` (15 min before is common). |
| `reminder_sent` | boolean | **no — read-only** | Flipped server-side after the reminder dispatch runs. Do not write from the client. |
| `metadata` | object | yes | Free-form JSON, defaults to `{}`. |
| `created_at` | datetime | no | Creation timestamp. |
| `updated_at` | datetime | no | Last-modified timestamp. |

## Attachment rule

Every activity must attach to a `deal` **or** a `person`:

- **Neither set** → `400 Bad Request`: `{"detail": "Activity must attach to a `deal` or a `person`."}`. The serializer raises before any database write, so a failed create has no side effects.
- **Only `deal` set** → attached to that deal only.
- **Only `person` set** → attached to that person only.
- **Both set** → the person must equal the deal's `person`. A mismatch returns `400` with a field-level error: `{"person": "Person does not match the Deal's Person."}`.

The rule is re-checked on every write. A `PATCH` that clears the only
remaining attachment field returns `400`.

## `GET /activities/`

Paginated list. Query parameters:

| Param | Type | Description |
|---|---|---|
| `type` | string | One of `call`, `meeting`, `email`, `note`, `task`, `lunch`, `deadline` |
| `is_done` | boolean | Filter completed vs open |
| `owner` | integer | Owning user id |
| `deal` | integer | Deal id |
| `person` | UUID | Person id |
| `schedule_from__gte` | ISO-8601 datetime | Scheduled start on or after |
| `schedule_from__lte` | ISO-8601 datetime | Scheduled start on or before |
| `metadata__has_key` | string | Only activities whose top-level `metadata` object contains this key |
| `page` | integer | Page number, defaults to 1 |
| `page_size` | integer | Items per page |

Combine filters freely — `?deal=314&type=call&is_done=false` powers an
"upcoming calls" panel for a deal; `?person=<uuid>&schedule_from__gte=<now>`
powers a "what is on this person's calendar" panel.

```bash
curl -X GET "https://api.iblai.app/dm/api/crm/activities/?deal=184&is_done=false" \
  -H "Authorization: Token YOUR_ACCESS_TOKEN"
```

Response is the standard envelope; each result is the full Activity
object documented above.

## `POST /activities/`

Create an activity. Required: `title`, `type`, and EXACTLY one of
`deal` / `person` (both allowed only if they agree).

```json
{
  "title": "Discovery call",
  "type": "call",
  "location": "Zoom",
  "comment": "Walk through requirements with VP Eng.",
  "schedule_from": "2026-06-02T15:00:00Z",
  "schedule_to": "2026-06-02T15:45:00Z",
  "deal": 184,
  "person": "c4d2b1a8-7c3e-4f9a-9d6b-9a2c4f1e7b80",
  "reminder_at": "2026-06-02T14:45:00Z",
  "metadata": {"meeting_link": "https://zoom.us/j/123"}
}
```

Response `201 Created` — full activity object.

### Error responses

`400 Bad Request` — attachment / validation failures:

```json
{"detail": "Activity must attach to a `deal` or a `person`."}
```

```json
{"person": "Person does not match the Deal's Person."}
```

```json
{"deal": "Deal belongs to a different platform."}
```

```json
{"owner": "User is not an active member of this Platform."}
```

`403 Forbidden` — caller missing `Ibl.CRM/Activities/action`.

## `GET /activities/{id}/`

Retrieve one activity by integer id. Returns the full Activity object.
`404 Not Found` if the id does not exist, or exists on another Platform
(the API does not leak cross-Platform existence — see [cross-platform isolation](../../../../docs/developer/applications/crm.md#153-cross-platform-isolation)).

## `PUT` / `PATCH /activities/{id}/`

Replace (PUT) or patch (PATCH) editable fields. `done_at` and
`reminder_sent` are read-only — attempting to set them is silently
ignored. The attachment rule is re-checked on every write — a PATCH that
clears the only attachment field returns `400`.

```json
{
  "title": "Discovery call — rescheduled",
  "schedule_from": "2026-06-03T15:00:00Z",
  "schedule_to": "2026-06-03T15:45:00Z"
}
```

Response `200 OK` — full updated activity.
`403 Forbidden` — missing `Ibl.CRM/Activities/write`.
`400 Bad Request` — attachment failures (see above).

## `DELETE /activities/{id}/`

Delete an activity. Response `204 No Content`. `404` if not found.

> **Be deliberate when deleting server-emitted stage-change rows**
> (`type === "note" && title === "Stage changed"`). They are the audit
> trail for the deal's `move-stage/`, `won/`, `lost/` transitions —
> once deleted there is no way to reconstruct that history. The
> recommended UI suppresses the delete control on these rows entirely.

## `POST /activities/{id}/done/`

Mark an activity as done. **Idempotent**: the first call flips
`is_done` to `true` and stamps `done_at` with the current server time;
subsequent calls return the same activity with the ORIGINAL `done_at`
preserved. Safe to retry from a flaky network without drifting
completion timestamps that downstream reports depend on.

- Request body: none. Any payload is ignored.
- Response `200 OK` — the full updated Activity object. Splice it into
  your local list to re-render without a follow-up `GET`.
- `403 Forbidden` — missing `Ibl.CRM/Activities/write`.
- `404 Not Found`.

```bash
curl -X POST "https://api.iblai.app/dm/api/crm/activities/4408/done/" \
  -H "Authorization: Token YOUR_ACCESS_TOKEN"
```

## Cross-references

- [Activities API](../../../../docs/developer/applications/crm.md#76-activities) — full Activities API reference (this file is its condensed form)
- [Activity Timeline & Auto-Records](../../../../docs/developer/applications/crm.md#10-activity-timeline--auto-records) — see `references/timeline-rendering.md`
- [Render system audit Activities differently](../../../../docs/developer/applications/crm.md#165-render-system-audit-activities-differently) — rendering system audit Activities
- [Deal audit trail](../../../../docs/developer/applications/crm.md#93-deal-audit-trail) — the source of stage-change Activities
- [Filtering and pagination](../../../../docs/developer/applications/crm.md#13-filtering-and-pagination)
- [RBAC roles and permissions](../../../../docs/developer/applications/crm.md#14-rbac-roles-and-permissions)
- [Error reference](../../../../docs/developer/applications/crm.md#15-error-reference)
