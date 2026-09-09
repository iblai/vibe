# CRM — filtering, permissions, errors & best practices

> Doc-sourced explanatory material complementing the verified endpoints in **`/iblai-api-crm`** — see [`SKILL.md`](../SKILL.md) and [`schema.md`](schema.md), which stay authoritative for endpoint methods/paths, field schemas, and filters. Curl examples use the skill convention (`https://api.iblai.app/dm/api/crm/...`, header `Authorization: Api-Token $IBLAI_API_KEY`); "org" denotes the customer workspace, distinct from the CRM **Organization** resource.

## 13. Filtering & Pagination

Every CRM list endpoint speaks the same dialect: the same pagination envelope, the same date-range suffixes, the same foreign-key-by-ID convention, and the same tag query shape. Learn it once and the rest of the API reads itself.

### 13.1 Pagination envelope

Every list endpoint returns the same envelope:

```json
{
  "count": 142,
  "next_page": 2,
  "previous_page": null,
  "results": [ ... ]
}
```

`next_page` and `previous_page` are integer page numbers (or `null`), NOT URLs. Walk pages with `?page=N`:

```
GET /api/crm/persons/?page=2
GET /api/crm/persons/?page=3
```

When `next_page` is `null` you have reached the last page. When `previous_page` is `null` you are on page 1.

`page_size` is org-configurable; 100 is a common deployment cap. Clients should treat the returned page size as authoritative and not assume a fixed number of results per page.

### 13.2 Common query parameters

Three patterns recur across resources. Once you have internalized them, you can predict the filter surface of any new endpoint.

**Date ranges.** Any field ending in `__gte` / `__lte` takes an ISO 8601 date or datetime. Both bounds are inclusive.

```
GET /api/crm/persons/?created_at__gte=2026-06-01T00:00:00Z
GET /api/crm/deals/?expected_close_date__lte=2026-12-31
```

Mix-and-match to bracket a window:

```
GET /api/crm/activities/?schedule_from__gte=2026-06-01T00:00:00Z&schedule_from__lte=2026-06-07T23:59:59Z
```

**Foreign-key filters.** Pass the related record's primary identifier — never its display name. Numeric IDs for Users and Pipelines; UUIDs for Persons, Organizations, and Deals.

```
GET /api/crm/deals/?owner=42
GET /api/crm/persons/?organization=4f2a1b8e-...-9c3d
GET /api/crm/deals/?pipeline=1
```

**Tag filters.** Any host with tags accepts either repeated params or a CSV:

```
GET /api/crm/persons/?tags=7&tags=12
GET /api/crm/persons/?tags=7,12
```

Both forms use OR semantics — a Person tagged with either `7` or `12` matches. The response never duplicates rows even when a record matches multiple tag IDs.

### 13.3 Custom-metadata filtering

Every resource carries a free-form `metadata` JSON object. Person and Deal list endpoints support `?metadata__has_key=fieldName` to find records that have that custom key set, regardless of its value. Useful for staged migrations or external-system tracking.

```
GET /api/crm/persons/?metadata__has_key=salesforce_id
GET /api/crm/deals/?metadata__has_key=external_quote_ref
```

The match is strict key presence — `null` values still count as present, missing keys do not.

There is no operator for filtering by metadata value. If you need value-based segmentation, fetch the page and filter client-side, or promote the field to a first-class column.

### 13.4 Cookbook

A copy-paste set of common queries. Substitute `{...}` placeholders with real IDs from your session.

| Goal | Query |
|---|---|
| Qualified leads owned by me | `/api/crm/persons/?lifecycle_stage=qualified&owner={my_user_id}` |
| People in an Organization, created this month | `/api/crm/persons/?organization={uuid}&created_at__gte=2026-06-01T00:00:00Z` |
| People with a custom metadata key | `/api/crm/persons/?metadata__has_key=salesforce_id` |
| Organizations by name typeahead | `/api/crm/organizations/?name={q}` |
| Open deals in a pipeline | `/api/crm/deals/?pipeline={id}&status=open` |
| Deals expected to close this month | `/api/crm/deals/?expected_close_date__gte=2026-06-01&expected_close_date__lte=2026-06-30` |
| My open tasks this week | `/api/crm/activities/?type=task&is_done=false&owner={my_user_id}&schedule_from__gte={week_start}&schedule_from__lte={week_end}` |
| Anything tagged X OR Y | `/api/crm/persons/?tags=7&tags=12` |
| All activities on a deal, newest first | `/api/crm/activities/?deal={deal_id}` |
| Activities completed on a person | `/api/crm/activities/?person={uuid}&is_done=true` |

These compose freely — add `&page=2`, layer a date range on top of an owner filter, or stack a tag filter onto a lifecycle filter. The backend ANDs distinct parameters and ORs repeated values of the same parameter (the tag rule above).

### 13.5 Per-resource filter index

Quick lookup of every filter exposed, by resource. If a parameter is not listed here, the endpoint silently ignores it.

| Resource | Filters |
|---|---|
| Persons | `lifecycle_stage`, `owner`, `organization`, `created_at__gte`, `created_at__lte`, `metadata__has_key`, `tags` |
| Organizations | `name`, `owner`, `tags` |
| Pipelines | `code`, `name`, `is_default` |
| Stages (nested) | `code`, `is_won`, `is_lost` |
| Lead Sources | `code`, `name` |
| Deals | `status`, `pipeline`, `stage`, `owner`, `source`, `person`, `organization`, `expected_close_date__gte`, `expected_close_date__lte`, `created_at__gte`, `created_at__lte`, `metadata__has_key`, `tags` |
| Activities | `type`, `is_done`, `owner`, `deal`, `person`, `schedule_from__gte`, `schedule_from__lte`, `metadata__has_key` |
| Tags | `name`, `created_at__gte`, `created_at__lte` |

> **No global search.** There is no cross-resource search endpoint and no substring filter on `Person.name`. Combine the filters above and do final substring matching client-side if needed.

---
## 14. Roles & Permissions

> Cross-ref: assign these roles through **`/iblai-api-rbac`** (the standard role-management surface). The CRM does not expose its own role-assignment endpoints; what follows documents the CRM-specific roles, permission buckets, and HTTP-verb → action-code mapping.

The CRM ships four roles per org. Assign them through the standard org role-management surface. Roles are seeded automatically — you do not create them.

### 14.1 The four roles

| Role | Mandate |
|---|---|
| **CRM Viewer** | Read everything across the CRM. Write nothing. |
| **CRM User** | Day-to-day operator. Full create / update / delete on people, organizations, deals, activities, tags. Pipelines are read-only — pipeline topology is an admin job. Cannot send invitations. |
| **CRM Manager** | Wildcard access to every CRM action, including invitations and pipeline editing. |
| **CRM Inviter** | Narrow role: read people and send invitations only. Cannot edit or create people. |

### 14.2 Full permission matrix

| Resource (bucket) | Action codes | CRM Viewer | CRM User | CRM Manager | CRM Inviter |
|---|---|---|---|---|---|
| `Ibl.CRM/Persons` | `list`, `read` | ✓ | ✓ | ✓ | ✓ |
| `Ibl.CRM/Persons` | `action`, `write`, `delete` | — | ✓ | ✓ | — |
| `Ibl.CRM/Organizations` | `list`, `read` | ✓ | ✓ | ✓ | — |
| `Ibl.CRM/Organizations` | `action`, `write`, `delete` | — | ✓ | ✓ | — |
| `Ibl.CRM/Pipelines` | `list`, `read` | ✓ | ✓ | ✓ | — |
| `Ibl.CRM/Pipelines` | `action`, `write`, `delete` | — | — | ✓ | — |
| `Ibl.CRM/Deals` | `list`, `read` | ✓ | ✓ | ✓ | — |
| `Ibl.CRM/Deals` | `action`, `write`, `delete` | — | ✓ | ✓ | — |
| `Ibl.CRM/Activities` | `list`, `read` | ✓ | ✓ | ✓ | — |
| `Ibl.CRM/Activities` | `action`, `write`, `delete` | — | ✓ | ✓ | — |
| `Ibl.CRM/Tags` | `list`, `read` | ✓ | ✓ | ✓ | — |
| `Ibl.CRM/Tags` | `action`, `write`, `delete` | — | ✓ | ✓ | — |
| `Ibl.CRM/Invite` | `action` | — | — | ✓ | ✓ |

Notes:
- Lead source endpoints fall under the `Ibl.CRM/Pipelines` bucket — they are administrative.
- Stage CRUD also lives under `Ibl.CRM/Pipelines` — moving a stage is admin work; moving a deal between stages is a deal action.

### 14.3 Action verb mapping

HTTP verbs map onto the five canonical action codes as follows:

| HTTP | Action code |
|---|---|
| `GET` (list endpoint) | `list` |
| `GET` (detail endpoint) | `read` |
| `POST` (create) | `action` |
| `POST` (custom action: `move-stage`, `won`, `lost`, `done`, `link-user`, `merge`) | `action` |
| `POST` attach-tag, `DELETE` detach-tag | `write` (on `Ibl.CRM/Tags`) |
| `PATCH` / `PUT` | `write` |
| `DELETE` (resource delete) | `delete` |

### 14.4 Two permissions worth a second look

- **Invitation is its own bucket.** A role with `Ibl.CRM/Persons/write` does not have `Ibl.CRM/Invite/action`. Check the invitation right independently when deciding whether to expose an "Invite" affordance.
- **Tag attach/detach require `Ibl.CRM/Tags/write`.** A role with `Ibl.CRM/Persons/write` cannot tag people unless it also has tag write. This is intentional — it lets you delegate tag-graph mutation separately from person mutation.

---
## 15. Error Reference

The API returns standard HTTP status codes with JSON bodies. The table below covers every class of failure you should plan for so the frontend can route the user to the correct recovery path without guessing.

### 15.1 Status codes

| Status | Class | Common causes | What to do |
|---|---|---|---|
| 400 | Validation | Required field missing or invalid; enum out of range; blank or whitespace-only `name`; invalid tag color hex; attempt to write a server-managed field (`Deal.status`, `Deal.closed_at`, `Activity.done_at`); Activity attached to neither deal nor person; Activity's `person` does not match `Deal.person`; `lost` action missing `lost_reason` | Fix the field and retry. For deal status changes, use the `move-stage`, `won`, or `lost` action endpoints (Section 9). |
| 401 | Unauthorized | Missing or invalid token | Provide `Authorization: Api-Token $IBLAI_API_KEY` |
| 403 | Permission denied | RBAC role does not grant the required action; service-account API key is bound to a different org than the resource | Verify the role assignment (Section 14). The invitation action is its own bucket — check `Ibl.CRM/Invite/action` independently from `Ibl.CRM/Persons/write`. |
| 404 | Not found | Resource does not exist OR exists on another org (existence is not leaked across orgs) | Verify the ID and that the caller's org owns it. Do not differentiate "not found" from "no access" in user-facing copy. |
| 409 | Conflict | Tag already attached to the host (response carries the existing `assignment_id`); pending invitation already exists for the person (response carries existing `invitation_id`); pipeline or stage delete attempted while deals are attached | For tag/invitation conflicts, treat the existing assignment / invitation as the result. For pipeline / stage deletes, move or close attached deals first. |
| 422 | Unprocessable | Invitation attempted on a person already linked to a Platform user | Skip the invitation — the person already has an account |

### 15.2 Sample error bodies

**Validation (400) — direct write to a server-managed field**:

```json
{
  "status": "Service-managed — write via `POST /deals/{id}/move-stage/`, `won/`, or `lost/`."
}
```

**Validation (400) — Activity with no parent**:

```json
{
  "detail": ["Activity must attach to a `deal` or a `person`."]
}
```

**Conflict (409) — tag already attached**:

```json
{
  "detail": "Tag already attached.",
  "assignment_id": 491,
  "tag": {"id": 7, "name": "VIP", "color": "#3F6BFF"}
}
```

**Conflict (409) — pending invitation**:

```json
{
  "detail": "Active PlatformInvitation already exists for this email + platform.",
  "invitation_id": 8821,
  "person_id": "8f1c2d4e-7a93-4b21-9e1f-2a6c8d4f5b10",
  "platform_key": "acme-learning"
}
```

**Unprocessable (422) — person already linked**:

```json
{
  "detail": "Person already linked to a platform user."
}
```

### 15.3 Cross-org existence is not leaked

A 404 from any endpoint means *either* the resource does not exist *or* it exists on another org. Treat the two cases identically — do not surface a distinction in your UI. This is a deliberate design choice to prevent enumeration attacks across orgs.

---
## 16. Best Practices

Ground-tested advice for building reliable integrations on the CRM API. Each item is short, opinionated, and links back to the section that explains the underlying mechanic. Treat this as a pre-flight checklist before you ship.

### 16.1 Inspect the default seed before creating pipelines

Every org is seeded with one default pipeline and a set of default lead sources at creation time. The pipeline contains six stages with the codes `new`, `qualified`, `proposal`, `negotiation`, `won`, and `lost`. The lead sources are `web`, `referral`, `cold_call`, and `advertisement`.

Before your onboarding flow offers a "Create pipeline" button or seeds its own lead sources, call:

- `GET /api/crm/pipelines/`
- `GET /api/crm/lead-sources/`

If the seed is present, surface it as the working pipeline and skip creation entirely. Re-seeding produces duplicate records that confuse later filters. See Sections 7.3 and 7.4 for the full seed contract.

### 16.2 Reference stages by `code`, not by display name

Stage `name` values are editable by org admins — a stage labeled "Qualified" today may be "Discovery" tomorrow. The `code` field is stable and is what the action endpoints, terminal-stage resolution, and the auto-Activity audit row all key off internally.

Any code path that branches on which stage a deal occupies — kanban column placement, conditional UI, analytics rollups — should read `stage.code`, not `stage.name`. Reserve `name` for rendering. See Section 7.3.

### 16.3 Use the action endpoints for deal status changes

The deal serializer rejects direct writes to `status` and `closed_at` with a 400. Status transitions only happen through:

- `POST /api/crm/deals/{id}/move-stage/`
- `POST /api/crm/deals/{id}/won/`
- `POST /api/crm/deals/{id}/lost/`

Each of these writes the audit Activity row, fires the deal-stage-changed notification, and (for `won` / `lost`) sets `closed_at` atomically. PATCHing the fields directly would skip every one of those side effects and leave the timeline silently incomplete. See Section 7.5 and Section 9.

### 16.4 Always provide a `lost_reason`

`POST /deals/{id}/lost/` requires a non-empty `lost_reason` in the body and returns 400 if it is missing. Build the field into your UI before the user can submit the action — a free-text textarea with a short required-field hint is the minimum viable shape.

Do not infer or auto-fill a reason on the user's behalf. Lost reasons drive pipeline analytics; a synthetic value pollutes the data permanently. See `POST /deals/{id}/lost/` in Section 7.5.

### 16.5 Render system audit Activities differently

When a deal transitions stages, the move-stage action writes a system Activity with `type === 'note'` and `title === 'Stage changed'`. These appear in the same `/api/crm/activities/` list as user-authored notes, calls, and tasks.

In your timeline UI:

- Render them with a distinct icon (a system / arrow glyph works well)
- Suppress edit, delete, and mark-done controls — they are already complete and immutable in intent
- Keep them visually quieter than user-authored entries so the timeline still reads as a human history

See Section 7.6 and Section 10.

### 16.6 Verify the response of `link-user`

`POST /api/crm/persons/{id}/link-user/` returns 200 even when the link is silently refused — for example, when the person is already bound to a different Platform user. The endpoint does not raise; it just declines to overwrite.

Compare `response.platform_user` against the `user_id` you sent in the request body. A mismatch means the link did not take and manual reconciliation is required. Surface that case as an explicit warning in your UI, not a success toast. See `POST /persons/{id}/link-user/` in Section 7.1 and Section 8.1.

### 16.7 Confirm before deleting a tag

Tag deletion cascades silently and completely: every assignment of that tag on every host type — people, organizations, and deals — is removed in a single transaction. There is no dry-run preview endpoint, no soft-delete, and no undo.

Use a confirmation modal that:

- Names the tag explicitly ("Delete tag *Enterprise*?")
- States the consequence plainly ("This will remove the tag from N records across people, organizations, and deals.")
- Requires an affirmative click, not just a single OK button

See Section 7.7 and Section 11.

### 16.8 Treat 404 as "not visible to you"

A 404 from any CRM endpoint may mean the resource genuinely does not exist *or* that it exists on another org and the resolved org scope hides it from your token. The API intentionally does not distinguish the two — leaking existence across orgs would itself be a permission violation.

Do not differentiate in user-facing copy. A single "Not found or not accessible" message is the correct response. See Section 3 and Section 15.3.

### 16.9 Paginate every list call

Every list endpoint returns the envelope `{count, next_page, previous_page, results}`. `count` is the total matching records. `next_page` and `previous_page` are integer page numbers (or `null` at the boundaries) — not URLs.

Walk pages with `?page=N`. Do not assume the first page holds the full result set: `page_size` is org-configurable and the default may be smaller than your data. Build pagination into list views from day one rather than retrofitting it after a customer complains about missing records. See Section 13.1.

### 16.10 Use `metadata` for ad-hoc fields, then filter on key presence

Every CRM resource carries a `metadata` JSON object that is yours to write to. Stash external-system identifiers, one-off custom fields, integration-specific flags, and anything the canonical schema does not model.

For people and deals, the API supports `?metadata__has_key=fieldName` — the right way to find every record carrying a specific custom key without enumerating values. Pair this with a naming convention (e.g. always write `external_id` rather than mixing `externalId` and `ext_id`) so the filter stays useful as the integration grows. See Section 13.3.

### 16.11 Check tag and invitation permissions separately

The RBAC model splits person actions from tag actions from invitation actions into separate buckets. A role with full `Ibl.CRM/Persons/*` rights does not automatically have `Ibl.CRM/Tags/*` or `Ibl.CRM/Invite/*` rights.

In practice this means:

- The "Add tag" affordance on a person card needs a tag-attach permission check, not a person-write check
- The "Invite to org" button needs an invite-action check
- The "Link existing user" button needs its own action check

Hide each control based on the specific permission it requires. Granting a generic "edit person" role is not enough to expose the full surface. See Section 14.

### 16.12 Handle the `active` flip

When the auto-link signal binds a person to a Platform user — either via explicit `link-user` or because the system matched on email at user creation — `Person.active` flips from `true` to `false` automatically.

Your UI may load the person in `active: true` state and see it return as `active: false` on the very next request, with no edit having taken place. This is intentional: an active person is one without a bound user, and binding consumes that state.

Code defensively:

- Do not cache `active` aggressively
- Treat the value as advisory for list filtering, not as an audit trail
- Re-fetch after any link or merge action before re-rendering the badge

See Section 8.4.

### 16.13 Use stable IDs to correlate across systems

When you import people from an external system, store the foreign identifier in `metadata.external_id` (or a convention of your choosing) at creation time. Do this in the same request that creates the record — not in a follow-up PATCH.

That foreign ID lets you re-match the record on subsequent syncs without relying on name or email, both of which can change without notice. The `?metadata__has_key=external_id` filter then becomes a cheap way to enumerate everything you originated, separately from records created in the CRM UI. See Section 16.10 and Section 12.

---
