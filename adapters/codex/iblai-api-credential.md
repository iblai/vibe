# iblai-api-credential

> Manage an ibl.ai organization's digital credentials via the platform API — credential CRUD, user/group assignments, assertions, course-scoped credential import/export, external provider config + mapping (Accredible), and issuance analytics. Use when issuing, assigning, importing, or reporting on digital credentials and certificates.

# iblai-api-credential

Manage an organization's **digital credentials** from the API: create and edit
credentials, assign them to users and groups, read the resulting assertions
(issued credentials), import/export course-scoped credentials between platforms,
wire up external issuing providers (e.g. Accredible) via provider config and
per-credential external mappings, and pull issuance analytics over time. Use when
issuing, assigning, importing, or reporting on digital credentials and
certificates.

## Auth & conventions

- **Base URL:** `https://api.iblai.app/dm` — these are Data Manager (DM)
  endpoints, so the **`/dm` prefix is required**; the `/api/credentials/…` paths
  below are appended to it (e.g. `https://api.iblai.app/dm/api/credentials/…`).
- **Header:** `Authorization: Api-Token $IBLAI_API_KEY` on every request.
- **Path vars:** `{org}` = `$IBLAI_ORG` (the credentials API path segment is
  `platform_key`; it resolves against `Platform.key`, with `Platform.org` as a
  fallback; on the wire it is also the `platform_org` query param). The user
  segment accepts **either** a numeric `{user_id}` **or** a `{username}` — both
  route shapes exist (`…/users/<int:user_id>/…` and `…/users/<str:username>/…`),
  so `$IBLAI_USERNAME` works directly in the path. For provider-config/mapping
  paths that user segment is the admin making the request (use `$IBLAI_USERNAME`).
  `{course_id}` = an Open edX course id such as `course-v1:org+course+run`.
- **Most paths are user-scoped** under
  `/api/credentials/orgs/{org}/users/{user}/…` (where `{user}` is a numeric id or
  username). Below, that prefix is written as **`…/`** for brevity. The course
  import/export (`exim`) endpoints, the public assertion lookup, and the public
  provider list are platform-agnostic and live directly under
  `/api/credentials/…` with **no** org/user segment.
- **Ids:** id-taking detail endpoints (credentials, assertions, assignments)
  look up **by `entity_id`** (the UUID string) only — numeric database ids are
  not accepted. `{id}` below means the `entity_id`.
- **Responses** are wrapped: `{"status": {"success": bool, "description": str},
  "result": {…}}`. Paged list `result` objects carry `count`, `next`,
  `previous`, and either `results` or `data`.
- DELETE / destructive / outward-facing (assign, issue, import/export) calls —
  **confirm with the user first.**
- Not connected yet? Run **`/iblai-api-login`** first to populate `IBLAI_ORG`,
  `IBLAI_USERNAME`, and `IBLAI_API_KEY`.

## Pagination, ordering & search (list endpoints)

- `page` (default `1`), `page_size` (default `10`, max `100`; provider/mapping
  lists default `50`, max `1000`).
- `search` — case-insensitive match across the relevant fields (username, email,
  full name, credential name/description, group name, platform name, course/program
  name, assigned-by username, depending on the endpoint).
- Results are ordered newest-first (by creation / assignment date). For
  department admins, results are automatically filtered to their department scope.

## Reads

### Credentials — `…/`

- **GET** `…/` — list credentials for the org (only `public=True` credentials are
  returned). Query params: `search` (name / name_override / description),
  `course` (course id), `program` (program id), `page`, `page_size`.
- **GET** `…/{id}` — read one credential (`{id}` = `entity_id`).
- **GET** `…/course-credentials/` — list credentials grouped by course. Query
  params: `search` (course name / course id), `page`, `page_size`. The paged
  `result` carries `results` (not `data`).
- **GET** `…/images/` — search uploaded credential images. **Requires** a
  `query` param (case-insensitive name match); returns an array of
  `{id, name, image}`.

### Issuers & signatories — `…/issuers/`

An issuer is required to create a credential (its `entityId` is the `issuer`
field above). Issuers are keyed to the platform.

- **GET** `…/issuers/` — list issuers for the org. Query params: `q` (search by
  name), plus `page`/`page_size`. Each issuer has `name`, `org`, `entityId`,
  `signatories`, `url`, `iconImage`, `allowed_template_tags`.
- **GET** `…/issuers/{id}` — read one issuer (`{id}` = issuer `entity_id`, or its
  `org` identifier).

### Assignments (users & groups) — `…/assignments/`

Assignments link a credential to users or groups; issuing an assignment produces
assertions. Group assignments are processed asynchronously (Celery). Department
admins only see/act on assignments within their department scope.

- **GET** `…/assignments/users/` — list/search user assignments (also serves as
  the role-filtered **assertions for users** view — see Notes). Only assignments
  with `status == "COMPLETED"` that have a matching non-revoked assertion are
  returned. Supports `search` (credential name / username / email), `page`,
  `page_size`, and optional `platform_org`.
- **GET** `…/assignments/groups/` — list group assignments (department-filtered).
  Optional `group_id` filter; `page`, `page_size`.

### Assertions — `…/assertions/`

An assertion is an issued credential (a credential granted to a user).

- **GET** `…/assertions/` — list all assertions for this user/org. Query params:
  `course` (filter by course id), `include_revoked` (default false),
  `include_expired` (default false), `exclude_main_tenant_assertions` (default
  false), `page`, `page_size`. Response fields are camelCase: `entityId`,
  `issuedOn`, `credentialDetails`, `recipient`, `course`, `program`, `revoked`,
  `revocationReason`, `acceptance`, `expires`, `metadata`, `narrative`.
- **GET** `…/assertions/{id}` — read one assertion (`{id}` = assertion
  `entity_id`).
- **GET** `/api/credentials/public/assertions/{id}/` — **public**, unauthenticated
  lookup of a single assertion by `entity_id` (no org/user segment, no auth
  header needed). Returns 404 if not found or revoked (revoked responses include
  the revocation reason).

### Course import/export (exim) — `/api/credentials/exim/…`

Platform-agnostic; no org/user segment. **DM admin only.** Export converts item
ids to course ids in the response; import converts course ids to item ids and
replaces the issuer with the platform's default issuer.

- **GET** `/api/credentials/exim/credentials/course/{course_id}/export/` — export
  all credential definitions for a course (returns `course_id` + a `credentials`
  array with `entityId`, `name`, templates, `expires`, `issuerDetails`,
  `signatories`, `courses`, `programs`, `pathways`, etc.).

### Provider config / external mapping — `…/provider-config/`, `…/external-mapping/`

**Platform admin only** (`Requires platform admin access`). Path uses
`…/users/{username}/…` where `{username}` is the admin making the request. These
configure external issuers (e.g. Accredible) and map internal credentials to
external templates.

#### Available providers (public list) — `/api/credentials/providers/`

- **GET** `/api/credentials/providers/` — list enabled credential providers (no
  org/user segment; only requires authentication, not admin). Optional `page`,
  `page_size` (default 50, max 1000). Each entry: `name`, `display_name`,
  `description`, `enabled`, `metadata`.

#### Provider configuration — `…/provider-config/`

- **GET** `…/provider-config/` — list provider configs. Optional `provider_name`,
  `page`, `page_size`. Each entry has `provider_name`, `provider_name_display`,
  `config` (provider settings), `enabled`.

#### External credential mapping — `…/external-mapping/`

- **GET** `…/external-mapping/` — list mappings. Optional `credential_id`
  (filter by credential entity_id), `provider_name`, `page`, `page_size`.

### Analytics — `…/`

All take optional `start_date` / `end_date` (`YYYY-MM-DD`) query params and return
`{ "data": { "<date>": count, … } }` (back-filled with zero-value days when a
range is given).

- **GET** `…/assertions-over-time/` — assertion (issuance) counts over time.
  **Platform admin only.** Also returns a `meta` block with totals and percent
  changes.
- **GET** `…/course-assertions-over-time/` — per-course assertion counts over
  time. **Platform admin only.**
- **GET** `…/credentials-over-time/` — credential-creation counts over time.

## Writes

### Credentials — `…/`

- **POST** `…/` — create a credential. Confirm with the user first. `name` and
  `issuer` (the **issuer entity_id**) are **required**; everything else is
  optional:
  ```json
  {
    "name": "string",
    "issuer": "issuer-entity-id",
    "description": "string",
    "criteriaUrl": "string",
    "criteriaNarrative": "string",
    "credentialType": "string",
    "signal": "COURSE_PASSED",
    "html_template": "string",
    "css_template": "string",
    "tags": [],
    "metadata": {},
    "expires": { "amount": 365, "duration": "days" },
    "iconImage": "url", "backgroundImage": "url", "thumbnailImage": "url",
    "courses": ["course-v1:org+course+run"],
    "programs": ["program-id"],
    "pathways": ["pathway-id"]
  }
  ```
  `signal` defaults to `COURSE_PASSED`. Body field names are camelCase as shown
  (these map to the credential output fields). The response `result` uses
  `entityId`, `criteriaUrl`, `criteriaNarrative`, `credentialType`, `signal`,
  `issuerDetails`, `signatories`, `courses`, `programs`, `pathways`, `expires`,
  etc.
- **PUT** `…/{id}` — update one credential (partial; only present fields change).
  Updatable fields: `name`, `description`, `html_template`, `css_template`,
  `credentialType`, `criteriaUrl`, `criteriaNarrative`, `signal`, `iconImage`,
  `backgroundImage`, `thumbnailImage`, `metadata` (merged into existing).
- **DELETE** `…/{id}` — delete one credential. Confirm with the user first.
  Returns **409 Conflict** if the credential still has active (non-revoked,
  unexpired) assertions — revoke/delete those first.
- **POST** `…/images/` — upload an image as multipart form
  data (`image` file, optional `name`); returns the created `{id, name, image}`.

### Issuers & signatories — `…/issuers/`

- **POST** `…/issuers/` — create an issuer. Confirm with the user first. Body:
  `name` (and optionally `iconImage`, `email`, `url`, `allowed_template_tags`).
- **PUT** `…/issuers/{id}` — update an issuer. Confirm with the user first.
- **DELETE** `…/issuers/{id}` — delete an issuer. Confirm with the user first.
- **POST** `…/issuers/authority/` — create a signatory (issuer authority).
  Confirm with the user first. Body: `name`, `title`, `signature` (image url)
  required; optionally `org`, `entityId` (issuer entity id), or `credential`
  (credential entity id) to associate it. If none of `org`/`entityId`/`credential`
  is given, it falls back to the platform from the URL.

### Assignments (users & groups) — `…/assignments/`

- **POST** `…/assignments/users/` — assign a credential to users. Confirm with the user first:
  ```json
  { "credential_id": "credential-entity-id", "user_ids": [123, 456] }
  ```
  `user_ids` are numeric user ids. Returns `result` with `successful_assignments`,
  `failed_assignments`, and `message`.
- **POST** `…/assignments/groups/` — assign a credential to groups (async). Confirm with the user first:
  ```json
  { "credential_id": "credential-entity-id", "group_ids": ["group-id-1", "group-id-2"] }
  ```
  `credential_id` and `group_ids` are both required (`group_ids` are strings).
  Returns `result` with `successful_assignments` / `failed_assignments`.
- **DELETE** `…/assignments/{id}` — delete one assignment (`{id}` = the
  assignment `entity_id`; resolves to either a group or individual assignment).
  Confirm with the user first. (This endpoint is DELETE-only — there is no GET on
  a single assignment.) For a group assignment this cascades to all related user
  assignments and assertions; for an individual assignment it deletes the
  assignment and its assertion. The response is a simple
  `{ "status": { "success": true, "description": "…" } }`.

### Assertions — `…/assertions/`

- **PUT** `…/assertions/{id}` — revoke an assertion. This is outward-facing —
  confirm with the user first. Body: `{ "revoked": true, "revocationReason":
  "string" }`.
- **POST** `…/{id}/assertions/` — issue (create) an assertion for credential
  `{id}` (= credential `entity_id`). This issues a credential — confirm with the
  user first. Body requires a `recipient` object and an item the credential is
  attached to:
  ```json
  {
    "recipient": { "identity": "username" },
    "course": "course-v1:org+course+run",
    "metadata": {}
  }
  ```
  Instead of `course` you may pass `catalog_item` (item id), `program` /
  `program_id`, or `pathway` / `pathway_id` to identify the item.
- **POST** `…/{id}/assertions/bulk/` — issue the credential to many users at once.
  Confirm with the user first. Body: `users` is a list of usernames, plus the
  same item field (`course` / `catalog_item` / `program` / `pathway`) and
  optional `metadata`. Returns `{ "skipped": [...], "issued": [...] }`.

### Course import/export (exim) — `/api/credentials/exim/…`

- **POST** `/api/credentials/exim/credentials/course/{course_id}/import/` — import
  credential definitions into a course. Confirm with the user first:
  ```json
  {
    "course_id": "course-v1:org+course+run",
    "credentials": [
      {
        "entityId": "credential-entity-id",
        "name": "Credential Name",
        "description": "string",
        "criteriaUrl": "string",
        "criteriaNarrative": "string",
        "credentialType": "COURSE_CERTIFICATE",
        "expires": { "amount": 365, "duration": "days" },
        "signatories": [
          { "entityId": "authority-entity-id", "name": "string", "title": "string", "signature": "url" }
        ],
        "html_template": "string",
        "css_template": "string",
        "signal": "COURSE_PASSED",
        "courses": [ { "name": "string", "course_id": "course-v1:org+course+run" } ]
      }
    ]
  }
  ```
  Existing credentials (matched by name + course + default issuer) are updated;
  missing ones are created. Response `result` lists `course_id`,
  `imported_credentials` (each with `entityId`, `name`, and `status` =
  `created`|`updated`) and `errors`. Status is 201 if all succeed, **207
  Multi-Status** if some succeed with errors, 400 if none succeed.

### Provider config / external mapping — `…/provider-config/`, `…/external-mapping/`

#### Provider configuration — `…/provider-config/`

- **POST** `…/provider-config/` — create or update a provider config (201 on
  create, 200 on update). Confirm with the user first:
  ```json
  {
    "provider_name": "accredible",
    "config": {
      "accredible_api_key": "your-api-key",
      "accredible_base_url": "https://dashboard.accredible.com/",
      "accredible_api_base_url": "https://api.accredible.com/v1/",
      "accredible_group_id": "123456",
      "accredible_template_id": "789012",
      "use_sandbox": false
    },
    "enabled": true
  }
  ```
  `provider_name` is required; `config` and `enabled` are each optional. Config
  keys are normalized to lowercase; values are preserved verbatim. For
  `provider_name: "accredible"`, `config` must include `accredible_api_key`
  (validation rejects it otherwise). Returns 201 + description `Created` on
  create, 200 + `Updated` on update.
- **DELETE** `…/provider-config/` — deactivate a provider config (sets
  `enabled=false`; external issuance is then skipped; the record is not removed).
  Confirm with the user first. Body: `{ "provider_name": "accredible" }`. Returns
  description `Deactivated` with the updated config object.

#### External credential mapping — `…/external-mapping/`

- **POST** `…/external-mapping/` — create or update a mapping (201 on create, 200
  on update; unique per credential + platform + provider). Confirm with the user first:
  ```json
  {
    "credential_id": "credential-entity-id",
    "provider_name": "accredible",
    "external_template_id": "123456789",
    "group_id": "679866",
    "metadata": {}
  }
  ```
  `credential_id` and `provider_name` are required; `external_template_id`,
  `group_id`, and `metadata` are optional.
- **DELETE** `…/external-mapping/` — delete a mapping. Confirm with the user first.
  Body: `{ "credential_id": "credential-entity-id", "provider_name": "accredible" }`.

## Example

List a user's issued credentials (assertions), searching for "python":

```bash
curl -G \
  "https://api.iblai.app/dm/api/credentials/orgs/$IBLAI_ORG/users/$IBLAI_USERNAME/assignments/users/" \
  -H "Authorization: Api-Token $IBLAI_API_KEY" \
  --data-urlencode "search=python" \
  --data-urlencode "page_size=20"
```

## Notes

- **Role-based assertion filtering** (`…/assignments/users/`): the `{user}` in the
  path is the user whose role determines visibility — platform admins see
  assignments for all users in the org; department admins see only users in their
  department groups; everyone else sees only their own. If the resolved set is
  empty the call returns 403 ("You don't have permission to view these
  assignments").
- **Ids:** detail lookups for credentials, assertions, and assignments are **by
  `entity_id`** (UUID) only — numeric database ids are not accepted. Course ids
  are Open edX ids (`course-v1:org+course+run`).
- **`{org}`** is the `platform_key` URL segment; it resolves against
  `Platform.key` first, then `Platform.org` as a fallback, and may also be passed
  as the `platform_org` query param.
- **Accredible provider specifics:** `config` keys are lowercased on save (values
  preserved); when issuing, the system uses the mapping's `group_id` first and
  falls back to the provider config's `accredible_group_id`. `use_sandbox` toggles
  the Accredible sandbox. Disabling a provider config (`enabled=false`) skips
  external issuance for that org.
- **Pagination defaults differ:** assignment/assertion lists default to
  `page_size=10` (max 100); provider-config and external-mapping lists default to
  `50` (max 1000).
- **Group assignments are asynchronous** (Celery); the immediate response confirms
  acceptance, not completion.
- Errors use the standard codes: 400 (bad input), 401 (unauthenticated),
  403 (insufficient permissions, e.g. "Requires platform admin access"),
  404 (not found), 500 (server error).