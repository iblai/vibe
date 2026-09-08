---
name: iblai-api-catalog-media
description: Manage an ibl.ai organization's catalog media resources via the Data Manager API — videos, images, documents, audio, and external links attached to a course, unit, or resource (item). Per-org, per-user CRUD plus search and by-item lookup, with multipart file upload. Use when attaching media to course/unit/resource content, listing or searching an org's media, or wiring media into catalog items.
metadata:
  kind: api
---

# iblai-api-catalog-media

Manage an organization's **catalog media resources** from the API: media files
and external links (videos, images, documents, audio, other) attached to a
course, a unit, a specific resource item, or any combination of the three.
Supports listing/filtering, full CRUD, a search action, and a by-item lookup.
The `item_type` (which catalog level the media is associated with) is derived
automatically from which of `course_id` / `unit_id` / `item_id` you supply.
Use when attaching media to catalog content, browsing/searching an org's media,
or uploading media files.

## Auth & conventions

- **Base URL:** `https://api.iblai.app/dm` — these are Data Manager (DM)
  endpoints, so the **`/dm` prefix is required**; the
  `/api/media/orgs/{org}/users/{user_id}/media/media-resources/...` paths below
  are appended to it (e.g.
  `https://api.iblai.app/dm/api/media/orgs/enterprise/users/36/media/media-resources/`).
- **Header:** `Authorization: Api-Token $IBLAI_API_KEY` on every request.
- **Path vars:** `{org}` = `$IBLAI_ORG` (the org key — matched against the
  platform's `org`), `{user_id}` = the **numeric** user id (matched against
  `User.id`; this is not the username). Both org and user are baked **into the
  path** here (unlike most catalog endpoints, which pass them as params).
- **Auth classes:** session, OAuth2 client-credential, and platform Api-Token.
- DELETE / destructive / outward-facing calls (delete, file upload) say
  "Confirm with the user first."
- Not connected yet? Run **`/iblai-api-login`** first to populate `IBLAI_ORG`,
  `IBLAI_USERNAME`, and `IBLAI_API_KEY`. (`user_id` is the numeric id, not the
  username `IBLAI_USERNAME`.)

All routes are under
`/api/media/orgs/{org}/users/{user_id}/media/media-resources/`.

## Reads

### Media resources (CRUD)

- **GET** `…/media-resources/` — list media resources for the org's platform
  (paginated, newest-first). Filters (query params, mutually exclusive in this
  precedence): `search` (icontains across `title`, `description`, `course_id`,
  `unit_id`, `item_id`, `file_url`), else `course_id` + `unit_id`, else
  `course_id`, else `unit_id`, else `item_id`. The id filters also pull in
  rows whose `item_type` spans that level (e.g. filtering by `course_id` also
  returns `course`, `course_unit`, `course_resource`, and `all` items).
- **GET** `…/media-resources/{id}/` — retrieve one media resource by numeric id.

### Search

- **GET** `…/media-resources/search/` — paginated search action. **`q`
  required** (icontains across `title`, `description`, `course_id`, `unit_id`,
  `item_id`, `file_url`). Optional result filters `course_id`, `unit_id`,
  `item_id` (same item_type-spanning behavior as the list endpoint, applied
  before the `q` match). Returns the standard paginated envelope.

### By-item

- **GET** `…/media-resources/by_item/` — fetch media for one catalog item.
  **`item_type` and `item_id` both required** (missing → `400`). `item_type`
  values: `course`, `unit`, `resource`, `course_unit`, `course_resource`,
  `unit_resource`, `all`. For `course`/`unit`/`resource`, the lookup matches
  the corresponding id (`course_id`/`unit_id`/`item_id` = `item_id`) **or** any
  `item_type` that spans that level; for the combined types it matches
  `item_type` + `item_id` exactly. Returns the standard paginated envelope.

## Writes

### Media resources (CRUD)

- **POST** `…/media-resources/` — create a media resource. **Admin only.**
  Accepts JSON or **multipart/form-data** (for the `file` upload). At least one
  of `course_id` / `unit_id` / `item_id` is required; `item_type` is computed
  server-side and is read-only. Confirm with the user first (file upload /
  write):
  ```json
  {
    "title": "string (required)",
    "media_type": "video|image|document|audio|other (required)",
    "description": "string",
    "file": "binary file (multipart only)",
    "file_url": "https://… (external URL)",
    "course_id": "course-v1:ORG+NUM+RUN",
    "unit_id": "block-v1:ORG+NUM+RUN+type@vertical+block@…",
    "item_id": "string"
  }
  ```
  Provide either `file` (upload) or `file_url` (external link). Creating a
  second resource with the same `file`/`file_url` for the same
  `item_type` + `item_id` is rejected as a duplicate (`400`). `created_by` is
  set to the path `{user_id}`; `platform` is set from `{org}`.
- **PUT** `…/media-resources/{id}/` — full update. **Admin only.** Same body
  fields as create (multipart supported). Same duplicate-`file`/`file_url`
  guard. `item_type`/`platform`/`created_by` stay read-only. Confirm with the
  user first.
- **PATCH** `…/media-resources/{id}/` — partial update (same rules as PUT).
  Confirm with the user first.
- **DELETE** `…/media-resources/{id}/` — delete a media resource by id. Confirm
  with the user first.

## Example

List the first page of an org's media resources filtered to one course (note
the URL-encoded `course_id`):

```bash
curl -G \
  "https://api.iblai.app/dm/api/media/orgs/$IBLAI_ORG/users/36/media/media-resources/" \
  -H "Authorization: Api-Token $IBLAI_API_KEY" \
  --data-urlencode "course_id=course-v1:main+NB101+2025-T1" \
  --data-urlencode "page_size=10"
```

Search across an org's media for "lecture":

```bash
curl -G \
  "https://api.iblai.app/dm/api/media/orgs/$IBLAI_ORG/users/36/media/media-resources/search/" \
  -H "Authorization: Api-Token $IBLAI_API_KEY" \
  --data-urlencode "q=lecture"
```

## Notes

- **item_type values** (the catalog level a media resource is associated with):
  `course`, `unit`, `resource`, `course_unit`, `course_resource`,
  `unit_resource`, `all`. It is **never sent by the client** — the server
  computes it from which of `course_id` / `unit_id` / `item_id` are present
  (`course`+`unit`+`item` → `all`; `course`+`unit` → `course_unit`;
  `course`+`item` → `course_resource`; `unit`+`item` → `unit_resource`; a
  single id → that single type). It is exposed read-only in responses.
- **media_type values:** `video`, `image`, `document`, `audio`, `other`.
- **File upload.** Send `file` as `multipart/form-data` (binary), or instead
  give an external `file_url`. Uploading the same file/URL for the same
  item is rejected as a duplicate. Treat uploads as outward-facing — confirm
  with the user first.
- **Pagination envelope** (custom; not the catalog `{count,next_page,…}`
  shape). List/search/by-item return:
  ```json
  {
    "status": { "success": true, "description": "Successfully retrieved media resources" },
    "results": { "count": 1, "next": null, "previous": null, "data": [ … ] }
  }
  ```
  Page size is `page_size` (default `10`, max `100`); page via `page`. Detail,
  create, and update responses return the bare serialized object instead.
- **Resource fields** in `data[]`: `id`, `title`, `description`, `media_type`,
  `item_type`, `course_id`, `unit_id`, `item_id`, `platform`, `file_url`,
  `file`, `created_by`, `created_at`, `updated_at`. `created_by`, `created_at`,
  `updated_at`, `item_type`, and `platform` are read-only.
- **Permissions** (`MediaResourcePermission`): the path `{user_id}` must have an
  **active `UserPlatformLink`** to the `{org}` platform. Reads (safe methods)
  need only that active link; **writes (POST/PUT/PATCH/DELETE) additionally
  require that link to be admin** (`is_admin`). A missing user, unknown org, or
  no active link all fail the check. Object-level access also requires the
  resource's `platform.org` to equal the path `{org}`.
- **Org / user resolution.** `{org}` is matched against `Platform.org` and
  `{user_id}` against `User.id`; an unknown org yields an empty result set (or
  permission failure on writes). Unlike the rest of `/iblai-api-catalog`, org and
  user are **path segments**, not query/body params.
