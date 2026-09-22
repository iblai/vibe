---
name: iblai-api-catalog
description: Manage an ibl.ai organization's learning catalog via the platform API — courses, programs, pathways, resources, skills, roles, course/program metadata, plus enrollment, eligibility checks, catalog search, and course reviews. Org-wide content and enrollment operations. Use when wiring up the catalog, enrolling users, checking eligibility, or curating skills/roles/pathways.
metadata:
  kind: api
---

# iblai-api-catalog

Manage an organization's **learning catalog** from the API: courses, programs,
pathways, and resources; the skills and roles taxonomy (including each user's
desired/reported skills and roles); course and program metadata; plus
enrollment (course / program / pathway, admin and self), eligibility checks,
catalog search, and course reviews. Use when populating the catalog, enrolling
users, checking who can take what, or curating the skills/roles graph.

## Auth & conventions

- **Base URL:** `https://api.iblai.app/dm` — these are Data Manager (DM)
  endpoints, so the **`/dm` prefix is required**; the `/api/catalog/...` paths
  below are appended to it (e.g. `https://api.iblai.app/dm/api/catalog/courses/`).
- **Header:** `Authorization: Api-Token $IBLAI_API_KEY` on every request.
- **Path vars:** `{org}` = `$IBLAI_ORG` (a.k.a. `org` / `platform_key` /
  `platform_org` on the wire), `{username}` = `$IBLAI_USERNAME`. Org/user are
  passed as **query params or body fields**, **not** baked into the path.
- DELETE / destructive / outward-facing calls say "Confirm with the user first."
- `course_id` values must be **URL-encoded** in query strings.
- Not connected yet? Run **`/iblai-api-login`** first to populate `IBLAI_ORG`,
  `IBLAI_USERNAME`, and `IBLAI_API_KEY`.

## Reads

### Courses

- **GET** `/api/catalog/courses/` — retrieve courses; filter by `course_id`, `slug` (case-insensitive), `org` (query params). Returns `[{course_id, name, slug, org}]`.

### Programs

- **GET** `/api/catalog/programs/` — retrieve programs; filter by `program_id`, `course_id`, `name`, `slug`, `enabled`, `org` (query params). Returns `[{program_id, org, slug, name, program_type, platform_key, enabled, course_list}]`.

### Pathways

- **GET** `/api/catalog/pathways/` — retrieve pathway(s); filter (query params) by `pathway_id`, `pathway_uuid`, `user_id`/`username`, `platform_key`, `item_id`, `name`, `slug` (case-insensitive), `visible`. Returns a (non-paginated) list of pathways, each with a `path[]` of items.

### Resources

- **GET** `/api/catalog/resources/` — retrieve resources; filter (query params) by `id`, `user_id`/`username`, `platform_key`/`key`, `org`/`platform_org`, `resource_type`, `name`, `query` (matches `name` via icontains), `item_id`. Returns a non-paginated list.
- **GET** `/api/catalog/resources/search/` — paginated resource search; same filters, `page` (default `1`), `page_size` (default `50`). Results newest-first. Prefer this for large result sets.

### Metadata

#### Course

- **GET** `/api/catalog/metadata/course/` — read a course's metadata by `course_id` (query param; the response keys are dynamic, e.g. `{subject, tags, level, topics, promotion, slug, ...}`). `GET /api/catalog/metadata/course/{field}/` reads one metadata field.
- **GET** `/api/catalog/metadata/course-public/` — read a course's **public** metadata by `course_id` (no auth/permission required; ignores course visibility). `course-public/{field}/` reads one field. Read-only.

#### Program

- **GET** `/api/catalog/metadata/program/` — read a program's metadata; **`program_id` required**, optional `org` (query params). `program/{field}/` reads one field.
- **GET** `/api/catalog/metadata/program-public/` — read a program's **public** metadata (`program_id` required, optional `org`; no auth required). `program-public/{field}/` reads one field. Read-only.

#### Choices

- **GET** `/api/catalog/metadata/choices/` — query allowed metadata choices; requires `field_key` **or** `scope` (query params), optional `org`. Returns the choice dict (`404` if none).

### Skills

- **GET** `/api/catalog/skills/` — retrieve skills (paginated); filter by `id`, `name`, `name__iexact`, `slug`, `platform_key`; `sort` (default `id`).
- **GET** `/api/catalog/skills/desired/` — a user's desired skills by `user_id`/`username` (`400` if the user has none).
- **GET** `/api/catalog/skills/reported/` — a user's reported skills by `user_id`/`username` (`200` with an empty record `{"user_id":null,"username":null,"skills":[],"data":null}` when there are none).

### Roles

- **GET** `/api/catalog/roles/` — retrieve roles (paginated); filter by `id`, `name`, `name__iexact`, `slug`, `platform_key`; `sort` (default `id`). Each role embeds its `skills[]`.
- **GET** `/api/catalog/roles/desired/` — a user's desired roles by `user_id`/`username`.
- **GET** `/api/catalog/roles/reported/` — a user's reported roles by `user_id`/`username`.

### Eligibility

- **GET** `/api/catalog/eligibility/courses/` — list courses a user is eligible for; params `user_id`/`username`, `org`, `query`.
- **GET** `/api/catalog/eligibility/courses/check/` — check eligibility for one course; **`course_id` required** plus `user_id` **or** `username` (`course_id` URL-encoded), plus `org`, `local_only` (skip the remote edX enroll-status call). Always returns `{is_eligible}`; unless `local_only` is set, the response is merged with the edX enroll-status fields (e.g. `is_enrolled`, etc.).

### Enrollment

#### Courses

- **GET** `/api/catalog/enrollment/courses/search/` — paginated enrollment search; query params (at least one of `user_id`, `username`, `email`, `course_id`, `slug`, `org`, `platform_key` required) plus `course_name` (substring), `sort` (default `-id`), `include_default_platform`, `include_archived_courses` (default false), `page`, `page_size`. Returns `{count, next_page, previous_page, results[]}` of active enrollments.

#### Programs

- **GET** `/api/catalog/enrollment/programs/` — query program enrollments; a user identifier (`user_id`/`username`) is required (the call `400`s on an unresolvable user), and you may also filter by `program_id`/`slug`, `org`/`platform_key`, `program_type` (`standard`|`platform`|`custom`), `include_metadata` (default `true`), `include_default_platform`.
- **GET** `/api/catalog/enrollment/programs/search/` — paginated program-enrollment search; same params as the GET above plus `sort`, `page`, `page_size`. Active enrollments only.

#### Pathways

- **GET** `/api/catalog/enrollment/pathways/` — query pathway enrollments; a user identifier (`user_id`/`username`) is required, plus optional `pathway_id`/`pathway_uuid`/`slug`, `org`/`platform_key`, `include_metadata` (default `true`), `include_default_platform`.
- **GET** `/api/catalog/enrollment/pathways/search/` — paginated pathway-enrollment search; user identifier required, plus `pathway_id`/`slug`, `org`/`platform_key`, `sort`, `page`, `page_size`, `include_default_platform`. Active enrollments only.

### Recommendation

- **GET** `/api/catalog/recommendation/courses/` — get the recommended "next" course relative to a current course. **`course_id` required** (query param), plus optional `user_id` and `org`. Returns a single serialized course, or `null` (with `200`) when there is no next course.

### Reviews

#### Course reviews

- **GET** `/api/catalog/reviews/course/` — paginated list of (visible) course reviews; filter (query params) by `course_id`, `user_id`, `platform_key`, `platform_org`/`org`, `sort` (default `-id`), `page`, `page_size`. Returns `{count, next_page, previous_page, results[]}` where each result is `{user_id, username, content, rating, title, visible, created, modified, course_id, metadata}`.
- **GET** `/api/catalog/reviews/course/info/` — aggregate review stats for a course; **`course_id` required** (query param). Returns `{course_id, avg_rating, count}`.

#### Program reviews

- **GET** `/api/catalog/reviews/program/` — paginated list of (visible) program reviews; filter by `program_id`, `user_id`, `platform_key`, `platform_org`/`org`, `sort`, `page`, `page_size`. Each result includes `program_key`.
- **GET** `/api/catalog/reviews/program/info/` — aggregate review stats; **`program_key` required** (query param). Returns `{program_key, avg_rating, count}`.

## Writes

### Courses

- **POST** `/api/catalog/courses/` — create/update a course (`200` updated, `201` created):
  ```json
  { "course_id": "string (required)", "org": "string (required)", "name": "string (optional)" }
  ```
  Newly created courses are assigned to the org's platform (default platform if `org` is unknown). On update the org is only changed if you also send `overwrite_existing_org: true`. (The handler ignores `slug`/`data` on write.)
- **DELETE** `/api/catalog/courses/` — delete a course by `course_id` (query param). Confirm with the user first.

### Programs

- **POST** `/api/catalog/programs/` — create/update a program (`200` updated, `201` created). Identify the platform by `program_id` + (`org`/`platform_key`) **or** by `program_key`. `program_id`, `name`, and `course_list` are required:
  ```json
  {
    "program_id": "string (required)", "name": "string (required)",
    "course_list": [{ "course_id": "course-v1:A+B+C" }],
    "org": "string", "platform_key": "string", "program_key": "string",
    "slug": "string", "enabled": "boolean (default true)",
    "program_type": "number (1=standard, 2=platform, 3=custom)",
    "data": "object"
  }
  ```
- **DELETE** `/api/catalog/programs/` — delete a program by `program_id` + `org` (query params, both required). Returns `{count, type}`. Confirm with the user first.

### Pathways

- **POST** `/api/catalog/pathways/` — create/update a pathway. **`user_id` (required), `name` (required), and `path` (required)**. Use (`user_id`/`username` or `platform_key`) + `pathway_id` to create; do **not** send `pathway_uuid` on create (generated). For an existing pathway, identify by `pathway_uuid`. Each `path[]` item is keyed by `item_type`: `resource` (resource fields below; created on the fly when no `id`), `course` (`course_id`), `program` (`program_key`), or `pathway` (`pathway_id`).
  ```json
  {
    "user_id": "number (required)", "name": "string (required)",
    "username": "string", "platform_key": "string",
    "pathway_id": "string", "pathway_uuid": "uuid (update only)",
    "slug": "string", "visible": "boolean (default true)",
    "path": [
      { "item_type": "resource", "id": "number (omit to create)", "resource_type": "string", "url": "string", "name": "string", "description": "string", "data": "object" },
      { "item_type": "course", "course_id": "course-v1:A+B+C" },
      { "item_type": "program", "program_key": "program-v1:org+id" }
    ],
    "data": "object"
  }
  ```

### Resources

- **POST** `/api/catalog/resources/` — create/update a resource (omit `id` to create). Accepts JSON or multipart (for `image`):
  ```json
  { "id": "number (update only)", "username": "string", "user_id": "number", "platform_key": "string", "platform_org": "string", "name": "string", "url": "string", "resource_type": "string", "description": "string", "skills": ["string"], "image": "file (multipart)", "data": "object" }
  ```
- **DELETE** `/api/catalog/resources/` — delete a resource; requires `id` plus `user_id` or `platform_key` (query params). Returns `{count, type}`. Confirm with the user first.

### Metadata

#### Course

- **POST** `/api/catalog/metadata/course/` — create/update course metadata. **`course_id` and `metadata` required.** With `update: true` (default) the supplied keys are merged; `update: false` overwrites. Special keys inside `metadata`: `slug`, `skills` (list of **existing** skill names). Field-path POSTs (`course/{field}/`) are not supported (`404`).
  ```json
  { "course_id": "string", "update": "boolean (default true)", "metadata": { "subject": "string", "tags": ["string"], "level": "string", "topics": ["string"], "promotion": "string|null", "slug": "string", "skills": ["string"] } }
  ```
- **POST** `/api/catalog/metadata/course-search/` — return course info (`to_json()`) for courses matching metadata filters in the body, e.g. `{ "data__contains": {...}, "slug": "string", "course_id": "string" }`. Body must be non-empty; invalid filter keys return `400`.

#### Program

- **POST** `/api/catalog/metadata/program/` — create/update program metadata; **`program_id` required**, optional `org`, plus `metadata` and `update` (default true) in the body. Field-path POSTs not supported (`404`).

### Skills

- **POST** `/api/catalog/skills/` — create/update a skill (omit `id` to create; `platform_key: null` for global):
  ```json
  { "id": "number (update only)", "name": "string", "slug": "string", "platform_key": "string|null", "data": "object" }
  ```
- **POST** `/api/catalog/skills/public/` — create a skill, open to any user (config-gated; names lowercased/trimmed): `{ "name": "string", "slug": "string", "data": "object" }`.
- **POST** `/api/catalog/skills/desired/` — set a user's desired skills (refer to skills by `id`):
  ```json
  { "user_id": "number", "username": "string", "skills": [{ "id": "number" }], "data": "object" }
  ```
- **POST** `/api/catalog/skills/reported/` — set a user's reported skills (same shape as desired).

### Roles

- **POST** `/api/catalog/roles/` — create/update a role (omit `id` to create):
  ```json
  { "id": "number (update only)", "name": "string", "slug": "string", "platform_key": "string", "data": "object" }
  ```
- **POST** `/api/catalog/roles/public/` — create a role, open to any user (config-gated; names lowercased/trimmed): `{ "name": "string", "slug": "string", "data": "object" }`.
- **POST** `/api/catalog/roles/desired/` — set a user's desired roles: `{ "user_id": "number", "roles": ["string"|{ "id": "number" }], "data": "object" }`.
- **POST** `/api/catalog/roles/reported/` — set a user's reported roles (same shape as desired).

### Enrollment

#### Programs

- **POST** `/api/catalog/enrollment/programs/` — create/update an enrollment. Requires a user (`user_id`/`username`) and a program (`program_key` **or** `program_id` + `org`/`platform_key`):
  ```json
  { "user_id": "number", "username": "string", "program_id": "string", "program_key": "string", "org": "string", "platform_key": "string", "started": "datetime", "expired": "datetime", "active": "boolean (default true)" }
  ```
- **DELETE** `/api/catalog/enrollment/programs/` — deactivate an enrollment (query params: user `user_id`/`username` + program `program_id`/`program_key` + `org`/`platform_key`, optional `ignore_expiration` default `false`). Confirm with the user first.
- **POST** `/api/catalog/enrollment/programs/self/` — self-enrollment (the program must be in a platform the target user belongs to; `403` otherwise). Same body as the admin POST, including `user_id`/`username`:
  ```json
  { "user_id": "number", "username": "string", "program_id": "string", "program_key": "string", "org": "string", "platform_key": "string", "started": "datetime", "expired": "datetime", "active": "boolean (default true)" }
  ```
- **DELETE** `/api/catalog/enrollment/programs/self/` — self-unenroll (same identifiers as the admin DELETE; membership-checked, optional `ignore_expiration` default `false`). Confirm with the user first.

#### Pathways

- **POST** `/api/catalog/enrollment/pathways/` — create a pathway enrollment; requires a user (`user_id`/`username`) and a pathway (`pathway_uuid`, **or** `pathway_id` + `org`/`platform_key`):
  ```json
  { "username": "string", "user_id": "number", "pathway_id": "string", "pathway_uuid": "uuid", "org": "string", "platform_key": "string", "active": "boolean (default true)" }
  ```
- **DELETE** `/api/catalog/enrollment/pathways/` — deactivate a pathway enrollment (same identifiers, query params). Confirm with the user first.
- **POST** `/api/catalog/enrollment/pathways/self/` — self-enrollment (membership-checked; `403` if the user is not in the pathway's platform). Same body as the admin POST, including `user_id`/`username`.
- **DELETE** `/api/catalog/enrollment/pathways/self/` — self-unenroll (same identifiers, membership-checked). Confirm with the user first.

### Search

- **POST** `/api/catalog/search/programs/` — full-text program search across `program_id`, `name`, `slug`, and `metadata`; returns catalog program objects with `metadata`:
  ```json
  { "query": "string", "org": "string (optional)" }
  ```

### Reviews

#### Course reviews

- **POST** `/api/catalog/reviews/course/update/` — create/update a course review (`201` created, `200` updated). **`course_id` and `username` required** (or `user_id`):
  ```json
  { "course_id": "string", "username": "string", "user_id": "number", "rating": "number", "title": "string", "content": "string", "visible": "boolean (default true)", "metadata": "object" }
  ```
- **DELETE** `/api/catalog/reviews/course/update/` — delete a user's course review; **`course_id` + `username`/`user_id` required** (query params). Confirm with the user first.

#### Program reviews

- **POST** `/api/catalog/reviews/program/update/` — create/update a program review. **`program_key` and `username` required** (or `user_id`):
  ```json
  { "program_key": "program-v1:org+id", "username": "string", "user_id": "number", "rating": "number", "title": "string", "content": "string", "visible": "boolean (default true)", "metadata": "object" }
  ```
- **DELETE** `/api/catalog/reviews/program/update/` — delete a user's program review; **`program_key` + `username`/`user_id` required** (query params). Confirm with the user first.

## Example

Check whether a user is eligible for a specific course (note the URL-encoded `course_id`):

```bash
curl -G \
  "https://api.iblai.app/dm/api/catalog/eligibility/courses/check/" \
  -H "Authorization: Api-Token $IBLAI_API_KEY" \
  --data-urlencode "user_id=36" \
  --data-urlencode "org=$IBLAI_ORG" \
  --data-urlencode "course_id=course-v1:IBLTEST+IBL000+RUN"
```

## Notes

- **All endpoints are DM endpoints** served under `https://api.iblai.app/dm` (`/dm` + `/api/catalog/...`). Omitting the `/dm` prefix will not resolve.
- **Course id format** is the opaque-keys form `course-v1:ORG+NUMBER+RUN` (e.g. `course-v1:IBLTEST+IBL000+RUN`). Always URL-encode it in query strings (`%3A`, `%2B`).
- **Program ids** are slug-like strings (e.g. `test-program-000`); `program_type` is a numeric code on write. **Resource / skill / role ids** are integers; resources also carry a UUID `item_id`; pathways carry a UUID `pathway_uuid` (generated on create — never send it on a create call).
- **Org on the wire** appears as `org`, `platform_key`, or (resource search legacy) `platform_org`/`key` — all mean the org key. Pass it as a query param (GET) or body field (POST), not in the path.
- **Skills/roles by id, not name.** When setting a user's desired/reported skills or roles, reference them by `{"id": …}` (recommended) rather than name. Course-metadata `skills` must reference **existing** skill names.
- **Self vs admin enrollment.** Both the non-self and the `…/self/` enrollment endpoints take an explicit `user_id`/`username` in the request. The difference is permission scope: `…/self/` additionally checks that the target user is a member of the program/pathway's platform (returns `403` if not), so it is the endpoint to use for non-admin (user-token) self-service; the non-self endpoints are for admin tokens enrolling other users.
- **Pagination envelope** is `{count, next_page, previous_page, results[]}` for the search/paginated endpoints (course/program/pathway enrollment search, resource search, skills, roles, course/program review query); plain `GET`s like `resources/` and `pathways/` are **not** paginated.
- `public/` skill and role creation endpoints are config-gated (`ALLOW_PUBLIC_SKILL_CREATE` / `ALLOW_PUBLIC_ROLE_CREATE`) and return `404` when disabled; created names are lowercased and trimmed.
- **Auto-increment utility.** `GET`/`POST /api/catalog/increment/` reads/advances per-platform auto-increment numbers (`org`/`key`, and `number_type` on `POST`). It is an internal numbering helper, not a catalog-management operation — included for completeness only.
- The source repo also ships Django management commands (`convert_slugs_lower`, `link_item_objects`, `verify_course_existence`); those are server-side operations, not REST endpoints, and are out of scope for this skill.
