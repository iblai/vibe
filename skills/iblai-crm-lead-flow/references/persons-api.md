# Persons API — Reference

Condensed from the [Persons API section of the CRM doc](../../../../docs/developer/applications/crm.md#71-persons). Every endpoint is scoped to the caller's
Platform; cross-Platform reads return `404` and cross-Platform writes
are rejected. All examples send `Authorization: Token <token>`.

**Base path:** `/api/crm/persons/`

**Pagination envelope** (used by every list endpoint in the CRM):

```json
{
  "count": 0,
  "next_page": null,
  "previous_page": null,
  "results": []
}
```

## Endpoint summary

| Method | Path | RBAC | Purpose |
|--------|------|------|---------|
| `GET`    | `/persons/`                            | `Ibl.CRM/Persons/list`   | List persons in your Platform |
| `POST`   | `/persons/`                            | `Ibl.CRM/Persons/action` | Create a person |
| `GET`    | `/persons/{id}/`                       | `Ibl.CRM/Persons/read`   | Retrieve one person |
| `PUT`    | `/persons/{id}/`                       | `Ibl.CRM/Persons/write`  | Replace all editable fields |
| `PATCH`  | `/persons/{id}/`                       | `Ibl.CRM/Persons/write`  | Patch a subset of fields |
| `DELETE` | `/persons/{id}/`                       | `Ibl.CRM/Persons/delete` | Hard-delete a person |
| `POST`   | `/persons/{id}/link-user/`             | `Ibl.CRM/Persons/write`  | Bind a person to an existing Platform user |
| `POST`   | `/persons/{id}/invite/`                | `Ibl.CRM/Invite/action`  | Send a Platform invitation to `primary_email` |
| `POST`   | `/persons/merge/`                      | `Ibl.CRM/Persons/write`  | Merge duplicates into a primary |
| `POST`   | `/persons/{id}/tags/`                  | `Ibl.CRM/Tags/write`     | Attach a Tag (see `/iblai-crm-tag`) |
| `DELETE` | `/persons/{id}/tags/{tag_id}/`         | `Ibl.CRM/Tags/write`     | Detach a Tag |

## Person object

| Field | Type | R/W | Notes |
|-------|------|-----|-------|
| `id` | UUID | R | Server-assigned. Stable across renames and merges. |
| `platform` | string/int | R | Set server-side from the auth token. |
| `name` | string | RW | Display name (required on create). |
| `primary_email` | string \| null | RW | Canonical email. Drives the auto-link signal (case-insensitive match). |
| `emails` | `{label, email}[]` | RW | Free-form additional emails. |
| `contact_numbers` | `{label, number}[]` | RW | Free-form phone numbers. |
| `job_title` | string | RW | Display only; not validated. |
| `organization` | UUID \| null | RW | Org in your Platform. Cross-Platform refs rejected. |
| `owner` | int \| null | RW | Platform user id of the internal account manager (must be an active member). |
| `platform_user` | int \| null | R | Set once the person is bound to a Platform user. |
| `lifecycle_stage` | enum | RW | `lead \| qualified \| opportunity \| customer \| churned`. Default `lead`. |
| `unique_id` | string | RW | External import key; unique per Platform when non-blank; ≤128 chars. |
| `active` | boolean | R | Flipped to `false` on link / merge-as-duplicate. |
| `tags` | `{id,name,color}[]` | R | Always present; empty array when none. |
| `metadata` | object | RW | Free-form JSON. |
| `created_at` / `updated_at` | ISO 8601 | R | Server-managed timestamps. |

---

## `GET /persons/`

Paginated list.

**Query parameters**

| Name | Type | Notes |
|------|------|-------|
| `lifecycle_stage` | enum | `lead \| qualified \| opportunity \| customer \| churned` |
| `owner` | int | Platform user id of the account manager |
| `organization` | UUID | Organization id |
| `created_at__gte` / `created_at__lte` | ISO 8601 | Created-at window |
| `metadata__has_key` | string | Persons whose `metadata` has the given top-level key |
| `tags` | int (repeatable) | OR semantics: `?tags=1&tags=2` or `?tags=1,2`. Results de-duplicated. |
| `page` / `page_size` | int | `page_size` max 100 |

Response is the pagination envelope above with `results: Person[]`.

```bash
curl "https://api.iblai.app/dm/api/crm/persons/?lifecycle_stage=qualified&page=1&page_size=25" \
  -H "Authorization: Token <token>"
```

---

## `POST /persons/`

Create a person. `platform` is set server-side.

**Request body**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `name` | string | Yes | Display name |
| `primary_email` | string | No | Auto-link binding key |
| `emails` | `{label,email}[]` | No | Defaults to `[]` |
| `contact_numbers` | `{label,number}[]` | No | Defaults to `[]` |
| `job_title` | string | No | Defaults to `""` |
| `organization` | UUID | No | Must belong to your Platform |
| `owner` | int | No | Active member of your Platform |
| `lifecycle_stage` | enum | No | Defaults to `lead` |
| `unique_id` | string | No | Unique per Platform when non-blank |
| `metadata` | object | No | Defaults to `{}` |

**Response** `201 Created` — full Person object.

**Errors**

| Code | Cause |
|------|-------|
| `400` | Validation: duplicate `unique_id`, cross-Platform `organization`, owner not in Platform, etc. Body has per-field arrays. |
| `403` | Missing `Ibl.CRM/Persons/action`. |

```bash
curl -X POST "https://api.iblai.app/dm/api/crm/persons/" \
  -H "Authorization: Token <token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice Chen","primary_email":"alice@example.com","lifecycle_stage":"lead"}'
```

---

## `GET /persons/{id}/`

Retrieve one person.

**Responses:** `200 OK` (full Person), `404 Not Found` (existence is
not leaked across Platforms).

---

## `PUT /persons/{id}/`

Replace every editable field. Omitted fields are reset to their
serializer defaults. Server-managed fields (`id`, `platform`,
`platform_user`, `active`, `created_at`, `updated_at`) are ignored if
sent.

**Responses:** `200 OK`, `400`, `404`.

---

## `PATCH /persons/{id}/`

Partial update — only fields present in the body are touched.

**Responses:** `200 OK`, `400`, `404`.

---

## `DELETE /persons/{id}/`

Hard delete.

**Responses:** `204 No Content`, `404`.

---

## `POST /persons/{id}/link-user/`

Bind a person to an existing Platform user.

**Request body**

```json
{ "user_id": 1184 }
```

**Response** `200 OK` — full Person object. On a successful bind,
`platform_user` is set to the requested `user_id` and `active` flips
to `false`.

### Silent-refusal footgun

A `200` response whose `platform_user` does **not** equal the
requested `user_id` means the person was **already bound to a
different Platform user** — the existing binding was preserved and
the API will not silently re-parent. There is **no error response**
for this case.

Clients **MUST** assert:

```ts
if (response.platform_user !== requested_user_id) {
  // Refusal — surface "already linked to user X" instead of "success".
}
```

**Status codes**

| Code | When |
|------|------|
| `200` | Success **or** silent refusal (compare `platform_user`). |
| `400` | `user_id` missing or not an integer. |
| `403` | Caller missing `Ibl.CRM/Persons/write`, **or** target user has no active `UserPlatformLink` to your Platform. |
| `404` | Person or user does not exist. |

```bash
curl -X POST "https://api.iblai.app/dm/api/crm/persons/<id>/link-user/" \
  -H "Authorization: Token <token>" \
  -H "Content-Type: application/json" \
  -d '{"user_id": 1184}'
```

---

## `POST /persons/{id}/invite/`

Send a Platform invitation to the person's `primary_email`. On
acceptance, the invitee joins the Platform with the privileges
configured here and the auto-link signal binds the person to the new
user account.

**Request body**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `is_admin` | boolean | No | Defaults to `false`. |
| `is_staff` | boolean | No | Defaults to `false`. |
| `enrollment_config` | object | No | Forwarded to the invitation (courses / programs / pathways auto-enrollment). |
| `redirect_to` | string | No | Post-acceptance URL. Max 255 chars. |

**Response** `201 Created`

```json
{
  "person_id": "<uuid>",
  "invitation_id": 8821,
  "invitation_email": "alice@example.com",
  "platform_key": "acme-learning",
  "auto_accept": true,
  "active": true,
  "redirect_to": "https://acme.iblai.app/welcome",
  "created": "2026-06-04T08:12:01Z"
}
```

**Status codes**

| Code | When |
|------|------|
| `201` | Invitation queued. |
| `400` | Person has no `primary_email`. |
| `403` | Caller missing `Ibl.CRM/Invite/action`. |
| `404` | Person not found. |
| `409` | Active invitation already exists. Body carries the pre-existing `invitation_id` — treat as "already done". |
| `422` | Person already linked to a Platform user. |

```bash
curl -X POST "https://api.iblai.app/dm/api/crm/persons/<id>/invite/" \
  -H "Authorization: Token <token>" \
  -H "Content-Type: application/json" \
  -d '{"is_admin":false,"is_staff":false,"redirect_to":"https://acme.iblai.app/welcome"}'
```

---

## `POST /persons/merge/`

Re-parent Deals, Activities, and Tag assignments from duplicates onto
a primary in a single transaction; soft-delete the duplicates.

**Request body**

```json
{
  "primary_id": "<uuid>",
  "duplicate_ids": ["<uuid>", "<uuid>"]
}
```

- `primary_id` must belong to your Platform.
- `duplicate_ids` must be non-empty, belong to your Platform, and not
  include `primary_id`.

**Response** `200 OK`

```json
{
  "primary_id": "<uuid>",
  "merged_ids": ["<uuid>"],
  "reparented": { "deals": 4, "activities": 11, "tags": 3 }
}
```

Notes:

- Duplicates are **soft-deleted** — `active=false`, row still
  retrievable by id. `GET /persons/{duplicate_id}/` returns the
  inactive row, not `404`. Filter on `active=true` to hide.
- `reparented.tags` counts every assignment *touched* — both moved
  and dropped (the `(tag, person)` unique constraint forbids
  stacking, so a tag the primary already carries is dropped silently
  but still counted).

**Status codes**

| Code | When |
|------|------|
| `200` | Merge complete (also returned on no-op rerun). |
| `400` | `primary_id` appears in `duplicate_ids`, `duplicate_ids` empty, or cross-Platform duplicate. |
| `403` | Caller missing `Ibl.CRM/Persons/write`. |
| `404` | Primary person not found in your Platform. |

```bash
curl -X POST "https://api.iblai.app/dm/api/crm/persons/merge/" \
  -H "Authorization: Token <token>" \
  -H "Content-Type: application/json" \
  -d '{"primary_id":"<uuid>","duplicate_ids":["<uuid>"]}'
```

---

## `POST /persons/{id}/tags/` and `DELETE /persons/{id}/tags/{tag_id}/`

Tag attach/detach. Body for attach: `{ "tag_id": <int> }`.

| Code | Meaning |
|------|---------|
| `201` | Attached. Response: `{ "assignment_id": <int>, "tag": {id,name,color} }`. |
| `409` | Already attached. Body includes the existing `assignment_id`. |
| `404` | Tag not found / wrong Platform (attach), or tag was not attached (detach). |
| `204` | Detach success. |

See `/iblai-crm-tag` for tag CRUD.
