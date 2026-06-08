# CRM REST API — Overview

The at-a-glance contract that every CRM sub-skill builds on. Pair with
the per-resource references in the `iblai-crm-lead-flow`,
`iblai-crm-deal-flow`, `iblai-crm-activity`, and `iblai-crm-tag`
skills.

## Base URL

```
/api/crm/
```

Mounted on the same Platform host as the rest of the ibl.ai API. In a
Next.js app the host comes from `NEXT_PUBLIC_API_BASE_URL`
(e.g. `https://api.iblai.app/dm/api/crm/...`). The Platform is inferred
from the token — there is no `?platform_key=` parameter on the
consumer surface.

## Authentication

```
Authorization: Token YOUR_ACCESS_TOKEN
```

Required on every method (`GET`, `POST`, `PATCH`, `PUT`, `DELETE`)
and every resource. Tokens bind to exactly one Platform; cross-Platform
records return `404 Not Found`, never `403 Forbidden`.

Failure modes:

| Status | Meaning |
|---|---|
| `401` | Header missing / malformed / expired token |
| `403` | Authenticated but role does not grant this action (or a service-account key is bound to a different Platform) |
| `404` | Record does not exist *on your Platform* (existence is not leaked across Platforms) |
| `409` | Conflict — tag already attached, pending invitation exists, or pipeline/stage delete attempted with deals still attached |
| `422` | Unprocessable — e.g. invite attempted on a person already linked to a Platform user |

## Pagination envelope

Every list endpoint returns:

```json
{
  "count": 142,
  "next_page": 2,
  "previous_page": null,
  "results": [ ... ]
}
```

- `next_page` and `previous_page` are **integer page numbers** (or
  `null` at the edges). They are NOT URLs.
- Walk pages with `?page=N`.
- `page_size` is configurable per Platform; **max `page_size=100`**.
  Treat the returned page size as authoritative — do not assume a
  fixed number of rows.

## The eight resources

| Resource | URL prefix | ID type | Scoped to |
|---|---|---|---|
| Person | `/api/crm/persons/` | UUID string | Platform |
| Organization | `/api/crm/organizations/` | UUID string | Platform |
| Pipeline | `/api/crm/pipelines/` | integer | Platform |
| Stage | `/api/crm/pipelines/{pipeline_id}/stages/` | integer | Pipeline |
| Lead Source | `/api/crm/lead-sources/` | integer | Platform |
| Deal | `/api/crm/deals/` | integer | Platform |
| Activity | `/api/crm/activities/` | integer | Platform |
| Tag | `/api/crm/tags/` | integer | Platform |

Persons and Organizations use UUIDs so they can be minted client-side
and survive cross-system imports. Everything else uses integer IDs.

## Common envelope fields

Every resource returns three standard fields on read:

- `created_at` — ISO-8601 timestamp, set on insert
- `updated_at` — ISO-8601 timestamp, refreshed on every save
- `metadata` — free-form JSON object the integrator owns

`Person`, `Organization`, `Deal`, and `Activity` additionally carry an
`owner` foreign key (Platform user id). `Person`, `Organization`, and
`Deal` expose a read-only `tags` array — mutate via the attach/detach
endpoints, never by `PATCH`ing the host.

Server-managed fields that clients must never send on write:

| Resource | Fields | Why |
|---|---|---|
| Person | `platform_user`, `active` | Set by `/link-user/` or auto-link signal |
| Deal | `status`, `closed_at` | Derived from current stage + won/lost actions |
| Activity | `done_at`, `reminder_sent` | Stamped on completion / reminder dispatch |

## Side effects on write

Three classes of write trigger automatic follow-up work. All
notifications dispatch asynchronously **after the transaction
commits** — a write that rolls back produces no notification.

| Trigger | Side effect |
|---|---|
| Create a Person (any code path: API, admin, bulk import) | `CRM_PERSON_CREATED` notification |
| `POST /deals/{id}/move-stage/`, `/won/`, `/lost/` to a different stage | (1) audit `Activity` row — `type="note"`, `title="Stage changed"`, marked done, with from→to display names in the `comment`; (2) `CRM_DEAL_STAGE_CHANGED` notification to the deal's owner |
| `POST /persons/{id}/link-user/` (explicit) or signup auto-link by email | `CRM_PERSON_LINKED_TO_USER` notification |

Transitions that resolve to the deal's current stage are suppressed:
no write, no audit row, no notification.

## Pagination + filtering dialect

Three patterns recur across resources:

- **Date ranges.** Any field suffixed `__gte` / `__lte` accepts an
  ISO-8601 date or datetime. Both bounds are inclusive.
- **Foreign-key filters.** Pass the related record's primary
  identifier — numeric IDs for users / pipelines, UUIDs for persons /
  organizations / deals.
- **Tag filters.** `?tags=7&tags=12` or `?tags=7,12`. Both forms use
  OR semantics; the response never duplicates rows when a record
  matches multiple tag IDs.

Person and Deal list endpoints additionally support
`?metadata__has_key=fieldName` — strict key presence (`null` values
count, missing keys do not). There is no operator for filtering by
metadata value.

There is **no cross-resource search endpoint** and no substring
filter on `Person.name`. Combine the filters above and do final
substring matching client-side if needed.
