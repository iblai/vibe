# Organizations API — Reference

Condensed from the [Organizations API section of the CRM doc](../../../../docs/developer/applications/crm.md#72-organizations). Every endpoint is scoped to the caller's
Platform. All examples send `Authorization: Token <token>`.

**Base path:** `/api/crm/organizations/`

**Pagination envelope** (shared across the CRM):

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
| `GET`    | `/organizations/`                            | `Ibl.CRM/Organizations/list`   | List organizations in your Platform |
| `POST`   | `/organizations/`                            | `Ibl.CRM/Organizations/action` | Create an organization |
| `GET`    | `/organizations/{id}/`                       | `Ibl.CRM/Organizations/read`   | Retrieve one organization |
| `PUT`    | `/organizations/{id}/`                       | `Ibl.CRM/Organizations/write`  | Replace all editable fields |
| `PATCH`  | `/organizations/{id}/`                       | `Ibl.CRM/Organizations/write`  | Patch a subset of fields |
| `DELETE` | `/organizations/{id}/`                       | `Ibl.CRM/Organizations/delete` | Hard-delete an organization |
| `POST`   | `/organizations/{id}/tags/`                  | `Ibl.CRM/Tags/write`           | Attach a Tag (see `/iblai-crm-tag`) |
| `DELETE` | `/organizations/{id}/tags/{tag_id}/`         | `Ibl.CRM/Tags/write`           | Detach a Tag |

## Organization object

| Field | Type | R/W | Notes |
|-------|------|-----|-------|
| `id` | UUID | R | Server-assigned. |
| `platform` | string/int | R | Set server-side from the auth token. |
| `name` | string | RW | Display name. **Unique per Platform**, case-sensitive, trimmed of surrounding whitespace before comparison. Max 255 chars. |
| `address` | object | RW | **Free-form JSON.** Recommended (but not enforced) shape: `{street, city, state, zip, country}`. |
| `owner` | int \| null | RW | Platform user id of the internal account manager. Must be an active member of your Platform. |
| `tags` | `{id,name,color}[]` | R | Always present; empty array when none. |
| `metadata` | object | RW | Free-form JSON. |
| `created_at` / `updated_at` | ISO 8601 | R | Server-managed. |

---

## `GET /organizations/`

Paginated list.

**Query parameters**

| Name | Type | Notes |
|------|------|-------|
| `owner` | int | Filter by owning Platform user id |
| `name` | string | Case-insensitive substring match |
| `tags` | int (repeatable) | OR semantics; results de-duplicated |
| `page` / `page_size` | int | `page_size` max 100 |

Response is the pagination envelope with `results: Organization[]`.

```bash
curl "https://api.iblai.app/dm/api/crm/organizations/?name=acme" \
  -H "Authorization: Token <token>"
```

---

## `POST /organizations/`

Create an organization. `platform` is set server-side.

**Request body**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `name` | string | Yes | Unique per Platform (case-sensitive, trimmed). Max 255 chars. |
| `address` | object | No | Free-form JSON. Defaults to `{}`. |
| `owner` | int | No | Active member of your Platform. |
| `metadata` | object | No | Free-form JSON. Defaults to `{}`. |

**Response** `201 Created` — full Organization object.

**Errors**

| Code | Cause | Sample body |
|------|-------|-------------|
| `400` | Duplicate name | `{"name":["An Organization with name 'Acme Inc' already exists on this Platform."]}` |
| `400` | Blank name | `{"name":["Name must not be blank."]}` |
| `403` | Missing `Ibl.CRM/Organizations/action` | — |

```bash
curl -X POST "https://api.iblai.app/dm/api/crm/organizations/" \
  -H "Authorization: Token <token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Acme Inc","address":{"city":"New York"},"metadata":{"industry":"edtech"}}'
```

---

## `GET /organizations/{id}/`

Retrieve one. `200 OK` returns the full Organization; `404 Not Found`
when the row is missing or belongs to another Platform (existence is
not leaked).

---

## `PUT /organizations/{id}/`

Replace every editable field. Same body shape as `POST /organizations/`.
Server-managed fields (`id`, `platform`, `created_at`, `updated_at`)
are ignored if sent.

**Responses:** `200 OK`, `400`, `404`.

---

## `PATCH /organizations/{id}/`

Partial update — only fields present in the body are touched.

**Responses:** `200 OK`, `400`, `404`.

---

## `DELETE /organizations/{id}/`

Hard-delete the organization.

**No cascade.** Persons and Deals that referenced the deleted org are
**kept**; their `organization` foreign key is set to `null` on every
row. Tag assignments on the organization are removed.

Practical UI implication: deleting an org from this skill's
organizations table will not delete its Persons (rendered in the
contacts table by `/iblai-crm-lead-flow`) or Deals (rendered by
`/iblai-crm-deal-flow`) — those rows will simply lose their
`organization` link. Surface this in the confirm dialog.

**Responses:** `204 No Content`, `404`.

---

## `POST /organizations/{id}/tags/` and `DELETE /organizations/{id}/tags/{tag_id}/`

Same shape as the person tag endpoints.

| Code | Meaning |
|------|---------|
| `201` | Attached. Response: `{ "assignment_id": <int>, "tag": {id,name,color} }`. |
| `409` | Already attached. Body includes existing `assignment_id`. |
| `404` | Tag not found / wrong Platform (attach), or tag was not attached (detach). |
| `204` | Detach success. |

See `/iblai-crm-tag` for tag CRUD.
