# CRM Tags — API reference

Condensed from the [Tags API](../../../../docs/developer/applications/crm.md#77-tags) (Tags resource) and [Tagging](../../../../docs/developer/applications/crm.md#11-tagging) (Tagging workflow).

> **Base URL:** `${NEXT_PUBLIC_API_BASE_URL}/api/crm`
> **Auth:** `Authorization: Token <token>` (same token wired by `/iblai-auth`)
> **Scope:** Tags are scoped to your Platform. Existence across Platforms is
> never leaked — a 404 means "not in your Platform" or "does not exist," and
> the API does not distinguish.

## Mental model

- **Tag rows are the taxonomy; assignments are the chips you see on a record.**
- A single Tag (`{name, color}`) lives once and may be attached to many host
  records of different types.
- Host serializers (Person, Organization, Deal) expose a read-only `tags`
  array on every list and detail response. The array is always present —
  empty array, never `null`. No second call is needed to render chips.

## Tag CRUD

| Method | Path | Purpose | Permission |
|---|---|---|---|
| GET | `/tags/` | List tags. Query: `name`, `created_at__gte`, `created_at__lte`, `page`, `page_size` | `Ibl.CRM/Tags/list` |
| POST | `/tags/` | Create a tag | `Ibl.CRM/Tags/action` |
| GET | `/tags/{id}/` | Retrieve one tag | `Ibl.CRM/Tags/read` |
| PUT | `/tags/{id}/` | Replace editable fields | `Ibl.CRM/Tags/write` |
| PATCH | `/tags/{id}/` | Patch supplied fields | `Ibl.CRM/Tags/write` |
| DELETE | `/tags/{id}/` | Delete the tag — cascades to every host | `Ibl.CRM/Tags/delete` |

### Tag shape

```json
{
  "id": 7,
  "platform": 1,
  "name": "Enterprise",
  "color": "#3F6BFF",
  "metadata": {"order": 1},
  "created_at": "2026-02-08T09:12:01Z",
  "updated_at": "2026-02-08T09:12:01Z"
}
```

| Field | Type | Notes |
|---|---|---|
| `id` | integer | Server-assigned |
| `platform` | integer | Owning Platform id |
| `name` | string | Up to 64 chars, unique-per-Platform, **case-sensitive** after `.strip()` |
| `color` | string | Hex `#RRGGBB`. Defaults to `#888888`. Six hex digits required — `#FFF` shorthand is rejected |
| `metadata` | object | Free-form JSON, defaults to `{}` |
| `created_at` / `updated_at` | datetime | Server-managed |

### Hex color regex

The server validates `color` against:

```
^#[0-9A-Fa-f]{6}$
```

Validate the same regex client-side **before** submit so the user sees the
error immediately rather than on round-trip. Three-digit shorthand and
named CSS colors are rejected.

### POST `/tags/` body

```json
{"name": "Enterprise", "color": "#3F6BFF", "metadata": {"order": 1}}
```

### 400 errors

```json
{"name": ["A Tag with this name already exists in this Platform."]}
{"name": ["Name must not be blank."]}
{"name": ["Name must be at most 64 characters."]}
{"color": ["Color must be a hex string like `#3F6BFF`."]}
```

### Rename behavior

PATCH on `name` or `color` takes effect **immediately on every host** that
carries the tag chip. Chips render `{id, name, color}` live from the Tag
row, so a rename updates everywhere the tag appears without touching the
assignment tables.

### DELETE — destructive cascade

> **DESTRUCTIVE.** Deleting a Tag silently cascades: every assignment to
> every Person, Organization, and Deal is removed atomically. No preview,
> no confirmation step from the API, no undo. A tag deleted by mistake
> must be recreated by hand and re-attached to every record.

Response: `204 No Content`. UI **must** carry the warning — see best
practice [confirm before deleting a tag](../../../../docs/developer/applications/crm.md#167-confirm-before-deleting-a-tag). Pre-fetch impact counts with `?tags={id}&page_size=1`
against each host list endpoint and surface them in the confirmation
modal.

## Host attach / detach (uniform contract)

The contract is identical across host types — only the path prefix changes.
`{host}` is one of `persons`, `organizations`, `deals`. Person and
Organization ids are UUIDs; Deal ids are integers.

| Method | Path | Purpose | Permission |
|---|---|---|---|
| POST | `/persons/{person_id}/tags/` | Attach tag to a person | `Ibl.CRM/Tags/write` |
| DELETE | `/persons/{person_id}/tags/{tag_id}/` | Detach tag from a person | `Ibl.CRM/Tags/write` |
| POST | `/organizations/{organization_id}/tags/` | Attach tag to an organization | `Ibl.CRM/Tags/write` |
| DELETE | `/organizations/{organization_id}/tags/{tag_id}/` | Detach tag from an organization | `Ibl.CRM/Tags/write` |
| POST | `/deals/{deal_id}/tags/` | Attach tag to a deal | `Ibl.CRM/Tags/write` |
| DELETE | `/deals/{deal_id}/tags/{tag_id}/` | Detach tag from a deal | `Ibl.CRM/Tags/write` |

**Critical permission rule.** All six attach/detach routes are gated by
`Ibl.CRM/Tags/write`. Holding `Ibl.CRM/Persons/write`,
`Ibl.CRM/Organizations/write`, or `Ibl.CRM/Deals/write` does **not**
allow the caller to tag the record. A sales rep with full deal-edit rights
but no tag-write rights still gets `403 Forbidden` from
`POST /deals/{id}/tags/`. Check tag-write **separately** from host-write
when deciding whether to render the "Add tag" affordance — see [permission-aware affordances](../../../../docs/developer/applications/crm.md#1611-permission-aware-affordances).

### Attach request

```json
{"tag_id": 7}
```

`tag_id` is required, integer, must be ≥ 1, must belong to your Platform.

### Attach `201 Created`

```json
{
  "assignment_id": 532,
  "tag": {"id": 7, "name": "Enterprise", "color": "#3F6BFF"}
}
```

The embedded `tag` lets the client render the chip with no second
round-trip.

### Attach `409 Conflict` — already attached

Same shape as 201, but `assignment_id` is the **existing** row:

```json
{
  "detail": "Tag already attached.",
  "assignment_id": 488,
  "tag": {"id": 7, "name": "Enterprise", "color": "#3F6BFF"}
}
```

Treat 409 as a **no-op success**. The user clicked twice or two tabs raced;
the desired state is already in place. Use the returned `assignment_id`
to reconcile local state without a re-fetch. Do **not** show a red
error toast.

### Attach errors

| Status | Meaning |
|---|---|
| 400 | `{"tag_id": ["This field is required."]}` or `["Ensure this value is greater than or equal to 1."]` |
| 403 | Missing `Ibl.CRM/Tags/write` |
| 404 | Host id unknown, host on another Platform, or `{"detail": "Tag not found in this platform."}` |

### Detach `204 No Content`

Removes the assignment row only. The Tag itself is untouched.

### Detach `404 Not Found` — treat as no-op

```json
{"detail": "Tag not attached to this record."}
```

Detach is **not idempotent** server-side — a second DELETE for the same
pair returns 404, not 204. From the user's point of view both responses
mean the tag is gone, so client code should treat 204 and 404 identically
when reconciling local state.

## Filtering by tag

All three host list endpoints (`/persons/`, `/organizations/`, `/deals/`)
accept a `tags` filter with **OR** semantics. Two equivalent forms:

```
GET /api/crm/persons/?tags=7&tags=12
GET /api/crm/persons/?tags=7,12
```

Both queries return every person tagged with `7` *or* `12`. A record
carrying both tags appears **once** — the backend de-duplicates, no
client-side `DISTINCT` step needed.

`tags` composes with every other filter on the list endpoint:

```
GET /api/crm/persons/?tags=7&lifecycle_stage=customer&owner=4
```

Response uses the standard pagination envelope:

```json
{"count": 14, "next_page": null, "previous_page": null, "results": [...]}
```

`next_page` and `previous_page` are integer page numbers or `null` at the
boundaries — not URLs. Walk pages with `?page=N`. `page_size` is
Platform-configurable; default may be smaller than your data set. See
[pagination best practices](../../../../docs/developer/applications/crm.md#169-pagination).

## Reading tags off a host

Person, Organization, and Deal serializers expose a read-only `tags`
array on every list and detail response:

```json
"tags": [
  {"id": 7, "name": "VIP", "color": "#3F6BFF"},
  {"id": 12, "name": "trial", "color": "#22AA66"}
]
```

The array is **always present** — empty array, never `null` or missing.
Renderers can iterate unconditionally.

## RBAC summary

| Verb | Permission | Default CRM role with it |
|---|---|---|
| List tags | `Ibl.CRM/Tags/list` | CRM Viewer + above |
| Read tag | `Ibl.CRM/Tags/read` | CRM Viewer + above |
| Create tag | `Ibl.CRM/Tags/action` | CRM User + above |
| Update tag | `Ibl.CRM/Tags/write` | CRM User + above |
| Delete tag | `Ibl.CRM/Tags/delete` | CRM User + above |
| Attach / detach on any host | `Ibl.CRM/Tags/write` | CRM User + above |

See `/iblai-rbac` for the full CRM role matrix.
