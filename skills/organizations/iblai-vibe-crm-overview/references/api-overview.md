# CRM REST API — Overview

The at-a-glance contract that every CRM skill builds on. Pair with the
per-resource references in the `crm-contacts`, `crm-person-onboarding`,
`crm-pipeline`, `crm-activities`, and `crm-tags` skills.

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
| `409` | Conflict — tag already attached, pending invitation exists, or a person / pipeline / stage delete while deals still reference it (`protected_by: {"deals": n}`) |
| `422` | Unprocessable — e.g. invite attempted on a person already linked to a Platform user |
| `503` | `app_scope_unavailable` — the request names an app (`?app=`) and the Platform can't keep apps apart yet |

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

## The resources

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
| Favorite | `/api/crm/favorites/` | integer | Platform + calling user |
| Saved view | `/api/crm/views/` | integer | Platform + calling user |
| Web form | `/api/crm/web-forms/` | `slug` | Platform |
| Member | `/api/crm/members/` (read-only) | integer (user id) | Platform |

Persons and Organizations use UUIDs so they can be minted client-side
and survive cross-system imports. Everything else uses integer IDs.
Favorites and saved views are personal: every call sees the calling
user's rows only.

Within a Platform, persons, organizations, pipelines, lead sources,
deals, activities, tags, web forms and saved views also belong to an
app: `?app=<app>` on every call names it (blank or absent: the CRM
itself), every response carries a read-only `app`, and another app's
record is a `404`. Stages, favorites, tag assignments and submissions
follow their parent. `GET /api/crm/overview/` echoes the `app`.

Cross-resource reads: `GET /api/crm/search/?q=` (persons, organizations,
deals), `GET /api/crm/overview/` (dashboard figures), `GET
/api/crm/deals/board/` (the kanban), `GET …/{id}/history/` on persons,
organizations and deals.

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
| Create a Person (any code path: API, admin, bulk import, a web form) | `CRM_PERSON_CREATED` notification — for the CRM's own records only, never an app's |
| A public web form submission | Finds the person by email (or creates one), opens a deal when the form routes to one, tags both and logs a note — in one transaction |
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

Exact lookups: `?primary_email=` on persons, `?name__iexact=` on
organizations and tags (both ignore case).

Person and Deal list endpoints additionally support
`?metadata__has_key=fieldName` — strict key presence (`null` values
count, missing keys do not). There is no operator for filtering by
metadata value.

Every list also takes `?search=` (substring over the resource's text
fields), `?ordering=field` / `-field`, and a created-at window
`?date_filter=today|7d|30d|90d|all_time|custom` (`custom` with
`start_date` and `end_date`, which override a preset). `GET /api/crm/search/?q=` searches
persons, organizations and deals in one call.
