---
name: iblai-api-catalog-invitation
description: Manage an ibl.ai organization's catalog invitations, licenses, access requests, and content suggestions via the platform API — platform/course/program invitations (single, bulk, blank, redeem, check); platform/user/course/program licenses (create/update) with per-user and per-group assignments; course/program access requests (request + approve/reject); and course/program/pathway suggestions (per-user, manage, bulk, group). These are the Data Manager (DM) "catalog invitations" REST endpoints, the entitlement/onboarding layer that sits on top of the catalog. Use when inviting users to a platform/course/program, issuing or assigning license seats, reviewing access requests, or pushing course/program/pathway suggestions.
metadata:
  kind: api
---

# iblai-api-catalog-invitation

Manage an organization's **catalog invitations, licenses, access requests, and
content suggestions** from the API. This is the Data Manager (DM)
`dl_catalog_invitations` app — the entitlement and onboarding layer on top of
the catalog (`/iblai-api-catalog`):

- **Invitations** — invite users (or generate redeemable "blank" invites) to a
  platform, a course, or a program; single, bulk, blank, redeem, and check.
- **Licenses** — create/update seat pools (platform / user / course / program
  licenses) and **assign** them to individual users or to user groups.
- **Access requests** — let members request course (or program) access and let
  admins approve/reject them.
- **Suggestions** — push course, program, or pathway suggestions to a user or a
  user group (single, bulk, group).

Use when inviting users, issuing or assigning license seats, reviewing access
requests, or suggesting content.

## Auth & conventions

- **Base URL:** `https://api.iblai.app/dm` — these are Data Manager (DM)
  endpoints, so the **`/dm` prefix is required**; the `/api/catalog/...` paths
  below are appended to it (e.g.
  `https://api.iblai.app/dm/api/catalog/invitations/platform/`). `/dm` is the
  gateway prefix and is **not** part of the app's own route table.
- **Header:** `Authorization: Api-Token $IBLAI_API_KEY` on every request
  (except the two public **check** endpoints, which take no auth).
- **Path vars:** none — every resource is selected by **query param** (GET /
  DELETE) or **body field** (POST). `{org}` = `$IBLAI_ORG` appears on the wire
  as `org` / `platform_key` / `key` / `platform_org` (all mean the org key);
  `course_id` (opaque-keys form, URL-encode in query strings) and `program_key`
  (e.g. `org+program-id`) identify catalog items.
- **Permission tiers** (enforced per view): `IsDMAdmin` = DM admin; `Is(DM|Platform)Admin`
  = platform admins or DM admins; `IsPlatformAdminReadOnly` = read-only for
  platform admins; `IsPlatformMember` = any platform member; `IsEdxUserReadOnly`
  / `IsDepartmentModeAdminInPlatform` widen suggestion access. **License
  create/update is DM-admin only.** When RBAC is enabled, invitation calls also
  require the matching `Ibl.Catalog/{Platform|Course|Program}Invitations/`
  permission for the target platform.
- DELETE / destructive / outward-facing calls (invite send, bulk invite, redeem,
  license assign/unassign, access-request approve) say "Confirm with the user
  first."
- Not connected yet? Run **`/iblai-api-login`** first to populate `IBLAI_ORG`,
  `IBLAI_USERNAME`, and `IBLAI_API_KEY`.

## Reads

### Platform invitations

`Is(DM|Platform)Admin` (the **check** endpoint is public). Invitation `to_json()`
returns `{id, user_id, username, email, created, started, source, redirect_to, expired, active, metadata, platform_key}`.

- **GET** `/api/catalog/invitations/platform/` — paginated list; filter by `platform_key`, `org`, `email`, `source`, `active`, `sort` (default `-id`); any other param becomes a `metadata__<key>` filter. (RBAC: `platform_key` required when RBAC is on.)
- **GET** `/api/catalog/invitations/platform/check/` — **public, no auth**; `email` (required, query). `200` if an active platform invitation exists, `404` if not.

### Course invitations

`IsDMAdmin | IsPlatformAdminReadOnly | IsPlatformAdminForCourse` on list/create;
`IsDMAdmin | IsPlatformAdminForCourse` on blank/redeem. Result `to_json()` carries `course_id` instead of `platform_key`.

- **GET** `/api/catalog/invitations/course/` — paginated list; filter by `course_id`, `email`, `source`, `active`, `platform_key`/`key`, `org`/`platform_org`, `sort` (default `-id`); other params → `metadata__<key>`.

### Program invitations

`IsDMAdmin | IsPlatformAdminReadOnly | IsPlatformAdminForProgram` on list/create;
`IsDMAdmin | IsPlatformAdminForProgram` on blank/redeem (bulk is `Is(DM|Platform)Admin`). Result `to_json()` carries `program_key`.

- **GET** `/api/catalog/invitations/program/` — paginated list; filter by `program_key`, `program_id`, `email`, `source`, `active`, `platform_key`/`key`, `org`/`platform_org`, `sort` (default `-id`); other params → `metadata__<key>`.

### Platform licenses

Seat pools at the platform level. **GET** is `IsDMAdmin | IsPlatformAdminReadOnly`; **create/update are `IsDMAdmin` only.** License `to_json()` returns `{id, created, started, expired, name, count, active, metadata, source, external_id, platform_key}`.

- **GET** `/api/catalog/licenses/platform/` — paginated list; filter by `platform_key`/`key`, `name`, `source`, `active`, `query` (name icontains), `sort` (default `-id`); other params → `metadata__<key>`.

### User licenses

Platform-level seat pools assignable to specific users/groups. **GET** is `IsDMAdmin | IsPlatformAdminReadOnly`; **create/update `IsDMAdmin` only**; **assignments `Is(DM|Platform)Admin`** (the assignment **check** is public).

- **GET** `/api/catalog/licenses/user/` — paginated list; same filters as platform licenses. Each result embeds an `assignments` summary `{total, active, pending}`.
- **GET** `/api/catalog/licenses/user/assignment/` — paginated per-user assignments; **`license_id` required**, plus `platform_key`/`platform_org` (required when multitenancy is on), `sort` (default `id`).
- **GET** `/api/catalog/licenses/user/assignment/group/` — paginated per-group assignments; **`license_id` required**, plus platform params, `sort`.
- **GET** `/api/catalog/licenses/user/assignment/check/` — **public, no auth**; `email` (required, query). `200` if an active user-license assignment exists, `404` if not.

### Course licenses

Seat pools tied to a course. **GET** `IsDMAdmin | IsPlatformAdminReadOnly`; **create/update `IsDMAdmin` only**; **assignments `Is(DM|Platform)Admin`**. License `to_json()` adds `course_id`.

- **GET** `/api/catalog/licenses/course/` — paginated list; filter by `platform_key`/`key`, `course_id`, `name`, `source`, `active`, `query`, `sort` (default `-id`); other params → `metadata__<key>`.
- **GET** `/api/catalog/licenses/course/assignment/` — paginated per-user assignments; **`license_id` required**, platform params, `sort` (default `id`).
- **GET** `/api/catalog/licenses/course/assignment/group/` — paginated per-group assignments; **`license_id` required**, platform params, `sort`.

### Program licenses

Seat pools tied to a program. Permissions identical to course licenses; result `to_json()` adds `program_id`/`program_key`.

- **GET** `/api/catalog/licenses/program/` — paginated list; filter by `platform_key`/`key`, `program_id`, `name`, `source`, `active`, `query`, `sort` (default `-id`); other params → `metadata__<key>`. Each result embeds an `assignments` summary.
- **GET** `/api/catalog/licenses/program/assignment/` — paginated per-user assignments; **`license_id` required**, platform params, `sort` (default `id`).
- **GET** `/api/catalog/licenses/program/assignment/group/` — paginated per-group assignments; **`license_id` required**, platform params, `sort`.

### Access requests (course)

Members request access to a course; admins review. The **user** endpoint is
`IsPlatformMember`; the **manage** endpoint is `Is(DM|Platform)Admin`. Request
`to_json()` returns `{id, user_id, username, name, approved, reviewed, created, modified, metadata, platform_key, course_id}`.

- **GET** `/api/catalog/access_requests/course/request/` — check the signed-in user's request status for a course; **`course_id` required** (query), plus `platform_key`/`platform_org`. Returns `{active, approved, exists}`.
- **GET** `/api/catalog/access_requests/course/manage/` — admin: paginated list of access requests; **`platform_key` or `platform_org` required**, plus `reviewed` (filter), `sort` (default `-id`).

> Note: `urls.py` registers **only the course** access-request routes
> (`course/request`, `course/manage`). There are no program/pathway
> access-request endpoints in this app.

### Suggestions (course / program / pathway)

Push catalog suggestions to users or groups. The **user** (read) endpoint is
`IsDMAdmin | IsPlatformAdminReadOnly | IsEdxUserReadOnly`; **manage / bulk /
group** are `IsDMAdmin | IsPlatformAdmin | IsDepartmentModeAdminInPlatform`. The
three resource families (course, program, pathway) are structurally identical;
only the item identifier differs: **course →** `course_id`, **program →**
`program_key`, **pathway →** `pathway_id`.

#### Course suggestions

- **GET** `/api/catalog/suggestions/course/user/` — a user's suggestions; **`user` required** (username or id, query), plus `platform_key`/`platform_org`, `sort` (default `-id`), `page`, `page_size`.
- **GET** `/api/catalog/suggestions/course/manage/` — admin: platform suggestions; **`platform_key` or `platform_org` required**, plus `query`, `sort` (default `-id`), `department_mode`, `page`, `page_size`.
- **GET** `/api/catalog/suggestions/course/manage/group/` — admin: group suggestions; **`platform_key` or `platform_org` required**, plus `query`, `sort` (default `id`), `department_mode`, `page`, `page_size`.

#### Program suggestions

Same shapes; the item field is **`program_key`** (instead of `course_id`).

- **GET** `/api/catalog/suggestions/program/user/` — a user's program suggestions (`user` required).
- **GET** `/api/catalog/suggestions/program/manage/` — admin list (`platform_key`/`platform_org` required).
- **GET** `/api/catalog/suggestions/program/manage/group/` — admin group list.

#### Pathway suggestions

Same shapes; the item field is **`pathway_id`**.

- **GET** `/api/catalog/suggestions/pathway/user/` — a user's pathway suggestions (`user` required).
- **GET** `/api/catalog/suggestions/pathway/manage/` — admin list (`platform_key`/`platform_org` required).
- **GET** `/api/catalog/suggestions/pathway/manage/group/` — admin group list.

## Writes

### Platform invitations

- **POST** `/api/catalog/invitations/platform/` — create/update one invitation. **Confirm with the user first** (outward-facing). `{ "platform_key": "str (required)", "email": "str (required)", "active": "bool", ...metadata }`.
- **POST** `/api/catalog/invitations/platform/bulk/` — bulk-create. **Confirm with the user first.** `{ "platform_key": "str (required)", "invitation_data": [{ "platform_key": "...", "email": "...", "active": "bool", ...metadata }] }`. All items must belong to `platform_key`. Returns `{successes, error_codes}`.
- **POST** `/api/catalog/invitations/platform/blank/` — create N redeemable blank invitations (no user yet). **Confirm with the user first.** `{ "platform_key": "str (required)", "source": "str (required)", "count": "int (required)", ...metadata }`. Returns `{successes, error_codes}`.
- **POST** `/api/catalog/invitations/platform/redeem/` — redeem a blank invitation onto a user. **Confirm with the user first.** `{ "platform_key": "str (required)", "source": "str (required)", "email": "str", "username": "str", ...metadata }`.

### Course invitations

- **POST** `/api/catalog/invitations/course/` — create/update one invitation (`404` if course unknown). **Confirm with the user first.** `{ "course_id": "str (required)", "email": "str (required)", "active": "bool", ...metadata }`.
- **POST** `/api/catalog/invitations/course/bulk/` — bulk-create. **Confirm with the user first.** `{ "invitation_data": [{ "course_id": "...", "email": "...", "active": "bool", ...metadata }], "platform_key": "str (optional; inferred from first course if omitted)" }`. All courses must share one platform. Returns `{successes, error_codes}`.
- **POST** `/api/catalog/invitations/course/blank/` — create N blank course invitations. **Confirm with the user first.** `{ "course_id": "str (required)", "source": "str (required)", "count": "int (required)", ...metadata }`. Returns `{successes, error_codes}`.
- **POST** `/api/catalog/invitations/course/redeem/` — redeem a blank course invitation. **Confirm with the user first.** `{ "course_id": "str (required)", "source": "str (required)", "email": "str", "username": "str", ...metadata }`.

### Program invitations

- **POST** `/api/catalog/invitations/program/` — create/update one invitation (`404` if program unknown). **Confirm with the user first.** `{ "program_key": "str (required)", "email": "str (required)", "active": "bool", ...metadata }`.
- **POST** `/api/catalog/invitations/program/bulk/` — bulk-create. **Confirm with the user first.** `{ "invitation_data": [{ "program_key": "...", "email": "...", "active": "bool", ...metadata }], "platform_key": "str (optional; inferred from first program)" }`. All programs must share one platform. Returns `{successes, error_codes}`.
- **POST** `/api/catalog/invitations/program/blank/` — create N blank program invitations. **Confirm with the user first.** `{ "program_key": "str (required)", "source": "str (required)", "count": "int (required)", ...metadata }`. Returns `{successes, error_codes}`.
- **POST** `/api/catalog/invitations/program/redeem/` — redeem a blank program invitation. **Confirm with the user first.** `{ "program_key": "str (required)", "source": "str (required)", "email": "str", "username": "str", ...metadata }`.

### Platform licenses

- **POST** `/api/catalog/licenses/platform/create/` — create a license. `{ "platform_key": "str (required)", "name": "str", "count": "int (default 0)", "started": "datetime", "expired": "datetime", "active": "bool (default true)", "metadata": {}, "source": "str", "external_id": "str (unique)" }`.
- **POST** `/api/catalog/licenses/platform/update/` — update a license; identify by `license_id` **or** `external_id`. `{ "license_id": "int", "external_id": "str", "name": "str", "count": "int", "started": "datetime", "expired": "datetime", "active": "bool", "metadata": {}, "source": "str", "change_type": "str (default 'update')" }`. The platform cannot be changed; each update writes a history record.

### User licenses

- **POST** `/api/catalog/licenses/user/create/` — create. Same body as platform create plus optional `enrollment_config` (dict). `platform_key` required.
- **POST** `/api/catalog/licenses/user/update/` — update; identify by `license_id` or `external_id`; same fields as platform update plus `enrollment_config`.
- **POST** `/api/catalog/licenses/user/assignment/` — assign/update a seat for one user. **Confirm with the user first.** `{ "license_id": "int (required)", "user_id": "int", "email": "str", "platform_key": "str", "platform_org": "str", "active": "bool", "fulfilled": "bool", "metadata": {} }` (one of `user_id`/`email` required).
- **DELETE** `/api/catalog/licenses/user/assignment/` — unassign one seat; **`assignment_id` required** (query), optional `platform_key`/`platform_org`. Confirm with the user first.
- **POST** `/api/catalog/licenses/user/assignment/group/` — assign/update a seat for a user group. **Confirm with the user first.** `{ "license_id": "int (required)", "group_id": "int (required)", "platform_key": "str", "platform_org": "str", "active": "bool", "fulfilled": "bool", "metadata": {} }`.
- **DELETE** `/api/catalog/licenses/user/assignment/group/` — unassign a group seat; **`assignment_id` required** (query). Confirm with the user first.

### Course licenses

- **POST** `/api/catalog/licenses/course/create/` — create. `{ "platform_key": "str (required)", "course_id": "str (required)", "name": "str", "count": "int", "started": "datetime", "expired": "datetime", "active": "bool", "metadata": {}, "enrollment_config": {}, "source": "str", "external_id": "str" }`.
- **POST** `/api/catalog/licenses/course/update/` — update; identify by `license_id` or `external_id`; same updatable fields as user-license update (platform/course immutable).
- **POST** `/api/catalog/licenses/course/assignment/` — assign/update a course seat to a user. **Confirm with the user first.** `{ "license_id": "int (required)", "user_id": "int" | "email": "str", "platform_key": "str", "platform_org": "str", "active": "bool", "fulfilled": "bool", "metadata": {} }`.
- **DELETE** `/api/catalog/licenses/course/assignment/` — unassign one course seat; **`assignment_id` required** (query). Confirm with the user first.
- **POST** `/api/catalog/licenses/course/assignment/group/` — assign/update a course seat to a group. **Confirm with the user first.** `{ "license_id": "int (required)", "group_id": "int (required)", "platform_key": "str", "platform_org": "str", "active": "bool", "fulfilled": "bool", "metadata": {} }`.
- **DELETE** `/api/catalog/licenses/course/assignment/group/` — unassign a group course seat; **`assignment_id` required** (query). Confirm with the user first.

### Program licenses

- **POST** `/api/catalog/licenses/program/create/` — create. `{ "platform_key": "str (required)", "program_id": "str (required)", "name": "str", "count": "int", "started": "datetime", "expired": "datetime", "active": "bool", "metadata": {}, "enrollment_config": {}, "source": "str", "external_id": "str" }`.
- **POST** `/api/catalog/licenses/program/update/` — update; identify by `license_id` or `external_id`; same updatable fields (platform/program immutable).
- **POST** `/api/catalog/licenses/program/assignment/` — assign/update a program seat to a user. **Confirm with the user first.** `{ "license_id": "int (required)", "user_id": "int" | "email": "str", "platform_key": "str", "platform_org": "str", "active": "bool", "fulfilled": "bool", "metadata": {} }`.
- **DELETE** `/api/catalog/licenses/program/assignment/` — unassign one program seat; **`assignment_id` required** (query). Confirm with the user first.
- **POST** `/api/catalog/licenses/program/assignment/group/` — assign/update a program seat to a group. **Confirm with the user first.** `{ "license_id": "int (required)", "group_id": "int (required)", "platform_key": "str", "platform_org": "str", "active": "bool", "fulfilled": "bool", "metadata": {} }`.
- **DELETE** `/api/catalog/licenses/program/assignment/group/` — unassign a group program seat; **`assignment_id` required** (query). Confirm with the user first.

### Access requests (course)

- **POST** `/api/catalog/access_requests/course/request/` — create an access request as the signed-in user. `{ "course_id": "str (required)", "platform_key": "str", "platform_org": "str", ...metadata }`.
- **POST** `/api/catalog/access_requests/course/manage/` — admin: approve/reject a request. **Confirm with the user first** (approving grants access). `{ "request_id": "int (required)", "approved": "bool", "active": "bool", "platform_key": "str", "platform_org": "str" }`.

### Suggestions (course / program / pathway)

#### Course suggestions

- **POST** `/api/catalog/suggestions/course/manage/` — create/update a per-user suggestion (`201` created, `200` updated). `{ "platform_key": "str (required)", "course_id": "str (required)", "user_id": "str|int (required)", "accepted": "bool", "visible": "bool", "metadata": {} }`.
- **DELETE** `/api/catalog/suggestions/course/manage/` — delete a suggestion; **`suggestion_id` required** (query). Confirm with the user first.
- **POST** `/api/catalog/suggestions/course/manage/bulk/` — bulk-create. `{ "platform_key": "str (required)", "suggestion_data": [{ "course_id": "...", "user_id": "...", "accepted": "bool", "visible": "bool", "metadata": {} }] }`. Returns `{successes, error_codes}`.
- **POST** `/api/catalog/suggestions/course/manage/group/` — create/update a group suggestion. `{ "platform_key": "str (required)", "course_id": "str (required)", "group_id": "str|int (required)", "accepted": "bool", "visible": "bool", "metadata": {} }`.
- **DELETE** `/api/catalog/suggestions/course/manage/group/` — delete a group suggestion; **`suggestion_id` required** (query). Confirm with the user first.

#### Program suggestions

Same shapes; the item field is **`program_key`** (instead of `course_id`).

- **POST** `/api/catalog/suggestions/program/manage/` — create/update per-user: `{ "platform_key": "...", "program_key": "...", "user_id": "...", "accepted": "bool", "visible": "bool", "metadata": {} }`.
- **DELETE** `/api/catalog/suggestions/program/manage/` — delete by `suggestion_id` (query). Confirm with the user first.
- **POST** `/api/catalog/suggestions/program/manage/bulk/` — bulk; `{ "platform_key": "...", "suggestion_data": [{ "program_key": "...", "user_id": "...", ... }] }`.
- **POST** `/api/catalog/suggestions/program/manage/group/` — create/update group: `{ "platform_key": "...", "program_key": "...", "group_id": "...", ... }`.
- **DELETE** `/api/catalog/suggestions/program/manage/group/` — delete group suggestion by `suggestion_id` (query). Confirm with the user first.

#### Pathway suggestions

Same shapes; the item field is **`pathway_id`**.

- **POST** `/api/catalog/suggestions/pathway/manage/` — create/update per-user: `{ "platform_key": "...", "pathway_id": "...", "user_id": "...", "accepted": "bool", "visible": "bool", "metadata": {} }`.
- **DELETE** `/api/catalog/suggestions/pathway/manage/` — delete by `suggestion_id` (query). Confirm with the user first.
- **POST** `/api/catalog/suggestions/pathway/manage/bulk/` — bulk; `{ "platform_key": "...", "suggestion_data": [{ "pathway_id": "...", "user_id": "...", ... }] }`.
- **POST** `/api/catalog/suggestions/pathway/manage/group/` — create/update group: `{ "platform_key": "...", "pathway_id": "...", "group_id": "...", ... }`.
- **DELETE** `/api/catalog/suggestions/pathway/manage/group/` — delete group suggestion by `suggestion_id` (query). Confirm with the user first.

## Example

Assign one user-license seat to a user by email (outward-facing — confirm first):

```bash
curl -X POST \
  "https://api.iblai.app/dm/api/catalog/licenses/user/assignment/" \
  -H "Authorization: Api-Token $IBLAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
        "license_id": 789,
        "email": "newhire@example.com",
        "platform_key": "'"$IBLAI_ORG"'",
        "active": true
      }'
```

## Notes

- **All endpoints are DM endpoints** under `https://api.iblai.app/dm`
  (`/dm` + `/api/catalog/...`); omitting `/dm` will not resolve.
- **No path parameters.** Select every resource by query param (GET/DELETE) or
  body field (POST). License/assignment IDs are integers (`license_id`,
  `assignment_id`, `suggestion_id`, `request_id`); identify a license to update
  by `license_id` **or** `external_id`.
- **Bulk and blank/redeem operations are write-heavy and user-facing** — bulk
  invites send to every listed email, blank invites create redeemable codes,
  redeem associates a code with a real user. Treat all of them, plus every
  license assign/unassign and every access-request approval, as actions to
  **confirm with the user first**.
- **Bulk invitations must stay within one platform** — the server rejects
  (`400`) any item whose course/program/platform differs from the request's
  `platform_key`.
- **Org on the wire** appears as `org`, `platform_key`, `key`, or
  `platform_org` (all the org key). When multitenancy is enabled, license- and
  assignment-related GETs **require** a `platform_key`/`platform_org`.
- **Pagination envelope** is the standard `{count, next, previous, results[]}`
  for every list endpoint here (invitations, licenses, assignments, access
  requests, suggestions); `sort` defaults to `-id` on most lists but `id` on the
  assignment and group-suggestion lists.
- **Public, unauthenticated** endpoints: `invitations/platform/check/` and
  `licenses/user/assignment/check/` — both take only `email` and answer `200`
  (exists) / `404` (none).
- **RBAC gating on invitations.** When `rbac_enabled()`, invitation calls
  additionally enforce `Ibl.Catalog/{Platform|Course|Program}Invitations/`
  permission for the target platform (and platform invitation GET then requires
  `platform_key`); a missing permission returns `403`.
- **DELETE on the invitation collection endpoints is a stub.** The `delete()`
  handlers on `invitations/platform/`, `invitations/course/`, and
  `invitations/program/` are unimplemented (return `200` without deleting) — they
  are not usable for removing invitations, so they are not listed above.
