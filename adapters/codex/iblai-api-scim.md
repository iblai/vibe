# iblai-api-scim

> Provision and manage an ibl.ai organization's directory over the SCIM 2.0 REST API — users (with the Enterprise User extension) and RBAC groups, including RBAC group membership that auto-links users to the platforms behind those groups. Use when standing up or syncing directory provisioning (SCIM 2.0) for an org: creating/deactivating users, managing RBAC group membership, or wiring identity-provider provisioning.

# iblai-api-scim

Provision and manage an organization's **directory over the SCIM 2.0 REST API**:
users (modeled on the SCIM User schema plus the Enterprise User extension) and
**RBAC groups** (exposed via the SCIM Group schema), including RBAC group
membership that automatically links users to the platforms behind those groups.
Use when standing up or syncing directory provisioning for an org — creating or
deactivating users, managing RBAC group membership, or wiring an identity
provider's SCIM provisioning.

> **Scope is exactly two resources: `Users` and `Groups`.** The SCIM app in the
> DM service registers only these two — there are **no** Departments,
> DepartmentMembers, or GroupMembers SCIM endpoints. (Departments and non-RBAC
> groups still appear *inside* a user's Enterprise-extension response block, but
> they are read-only there; there are no SCIM routes to manage them.)

## Auth & conventions

- **Base URL:** `https://api.iblai.app/dm` — these are Data Manager (DM)
  endpoints, so the **`/dm` prefix is required**; the `/api/orgs/…/scim/v2/…`
  paths below are appended to it (e.g.
  `https://api.iblai.app/dm/api/orgs/{platform_key}/scim/v2/Users`).
- **Header:** SCIM accepts **two** auth schemes (both authentication classes are
  wired on every view: `PlatformApiKeyAuthentication`,
  `OAuth2ClientCredentialAuthentication`):
  - `Authorization: Api-Token $IBLAI_API_KEY` — the Platform API Token used by
    the other `iblai-*` skills; or
  - `Authorization: Bearer <oauth2-token>` — an OAuth2 client-credentials token.
- **Content type:** send `Content-Type: application/scim+json` on every write
  (the server also accepts plain `application/json`).
- **Path / scope:** SCIM paths are `/api/orgs/{platform_key}/scim/v2/...` where
  `{platform_key}` = `$IBLAI_ORG` (the org key). The token's scope must match the
  `platform_key` in the URL.
- **Resource casing — keep verbatim.** Both resources are **PascalCase**:
  `Users` and `Groups`. Do not lowercase them.
- **Trailing slash — keep verbatim.** Collection routes have **no** trailing
  slash (`/Users`, `/Groups`); single-resource detail routes **require** a
  trailing slash (`/Users/{id}/`, `/Groups/{id}/`). The group action routes
  (`/Groups/{id}/add_members`, `/Groups/{id}/remove_members`) have **no** trailing
  slash.
- DELETE / destructive calls — **confirm with the user first.**
- Not connected yet? Run **`/iblai-api-login`** first to populate `IBLAI_ORG`,
  `IBLAI_USERNAME`, and `IBLAI_API_KEY`.

## Reads

### Users

User resources use the SCIM core User schema
(`urn:ietf:params:scim:schemas:core:2.0:User`) with the Enterprise User
extension on responses
(`urn:ietf:params:scim:schemas:extension:enterprise:2.0:User`).

- **GET** `/api/orgs/{platform_key}/scim/v2/Users` — list users (filtering,
  sorting, and pagination supported — see Notes).
- **GET** `/api/orgs/{platform_key}/scim/v2/Users/{id}/` — retrieve one user.

**Response — Enterprise extension.** The extension block is returned under the
key `urn_ietf_params_scim_schemas_extension_enterprise_2_0_User` (underscores,
not colons) and carries:

- `edxData` — edX-specific user data.
- `userData` — additional user metadata.
- `departments` — departments the user belongs to (`id`, `name`, `$ref`, `isAdmin`).
- `groups` — user-groups the user belongs to (`id`, `name`, `$ref`).
- `rbacGroups` — RBAC groups (`id`, `uniqueId`, `name`, `description`, `platformKey`).
- `platforms` — platforms the user can access (`id`, `key`, `name`, `org`).

(On create/update/PATCH responses these lists are returned empty; the populated
lists come back on GET list/retrieve.)

### Groups (RBAC groups)

The Group resource maps to the platform's **RBAC groups** and is exposed via the
SCIM Group schema (`urn:ietf:params:scim:schemas:core:2.0:Group`). The SCIM `id`
field is the RBAC group's **`unique_id`** (not a numeric id). These endpoints
**manage existing RBAC groups only** — POST does not create a new group; if the
referenced group's `unique_id` does not exist you get a `404` SCIM error.

- **GET** `/api/orgs/{platform_key}/scim/v2/Groups` — list RBAC groups
  (filtering supported; pass `excludedAttributes=members` to omit the member list).
- **GET** `/api/orgs/{platform_key}/scim/v2/Groups/{id}/` — retrieve one RBAC
  group by `unique_id`.

## Writes

### Users

- **POST** `/api/orgs/{platform_key}/scim/v2/Users` — create (or, with
  `"update": true`, modify an existing) user.
- **PUT** `/api/orgs/{platform_key}/scim/v2/Users/{id}/` — replace a user's core
  fields (`userName`, `name.formatted`, primary `emails` value, `active`); only
  the fields present in the body are changed.
- **PATCH** `/api/orgs/{platform_key}/scim/v2/Users/{id}/` — patch a user. Accepts
  either a SCIM **PatchOp** body (`Operations` with `op`/`path`/`value`; supported
  paths: `userName`, `name.formatted`, `emails[type eq "work"].value`, `active`,
  `displayName`, and `externalId` — where `externalId` is treated as an RBAC group
  `unique_id` to add the user to) **or** a plain partial body (`userName`, `name`,
  `emails`, `active`, `displayName`).
- **DELETE** `/api/orgs/{platform_key}/scim/v2/Users/{id}/` — **not supported**;
  returns `405 Method Not Allowed`. (User deactivation is done by setting
  `active: false`, not by DELETE.)

Request body for POST (key attributes):

```json
{
  "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
  "userName": "john.doe@example.com",
  "name": { "formatted": "John Doe", "givenName": "John", "familyName": "Doe" },
  "emails": [{ "value": "john.doe@example.com", "primary": true }],
  "password": "securepassword123",
  "provider": "google-oauth2",
  "tpaUid": "john.doe@example.com",
  "isStaff": false,
  "active": true,
  "update": false,
  "platformOrgs": ["org1", "org2"],
  "departmentIds": [1, 2, 3],
  "groupIds": [1, 2, 3],
  "rbacGroupUniqueIds": ["students", "course_123_enrolled"]
}
```

Field notes: `userName` is the unique username/email (required); `emails` is
required; `name` is required (may be partly blank); `password` / `provider` /
`tpaUid` / `isStaff` are optional and forwarded to the LMS on create;
`active` toggles account activation (set `false` to deactivate); `update: true`
modifies an existing user instead of creating (skips the duplicate check);
`platformOrgs` links the user to those org platforms; `departmentIds` /
`groupIds` assign existing departments / user-groups by integer id (validated —
unknown ids return `400`); `rbacGroupUniqueIds` assigns RBAC groups by unique id
and auto-links the required platforms (see Notes). On a create that finds the
user already exists, the API returns the existing user with HTTP `200` and still
applies the link fields, rather than erroring.

### Groups (RBAC groups)

- **POST** `/api/orgs/{platform_key}/scim/v2/Groups` — manage an existing RBAC
  group: optionally update its `displayName` / `description` and **set** its full
  member list. The group is located by `id` (or `externalId`), both of which map
  to the RBAC group's `unique_id`.

  ```json
  {
    "schemas": ["urn:ietf:params:scim:schemas:core:2.0:Group"],
    "id": "students",
    "displayName": "Students",
    "description": "All enrolled students",
    "members": [{ "value": "user-id-1", "display": "john.doe@example.com" }]
  }
  ```

  `members[].value` is resolved as a user id, then username, then email; if no
  user matches, one is created from the member data. The member list passed here
  **replaces** the group's current membership.

- **PUT** `/api/orgs/{platform_key}/scim/v2/Groups/{id}/` — update an existing RBAC
  group's `displayName` / `description`, and (if `members` is present) **replace**
  its complete member list (same body shape as POST, without needing `id` in the
  body — the id comes from the URL).
- **PATCH** `/api/orgs/{platform_key}/scim/v2/Groups/{id}/` — patch an RBAC group.
  Accepts a SCIM **PatchOp** body whose `Operations` support
  `replace` on `displayName` / `description` / `members` (replace whole list),
  `add` on `members`, and `remove` with a `members[value eq "<user-id>"]` path —
  **or** a plain partial body (`displayName`, `description`, `members`).
- **POST** `/api/orgs/{platform_key}/scim/v2/Groups/{id}/add_members` — add members
  via a SCIM PatchOp (only `op: add`, `path: members` operations are applied).

  ```json
  {
    "schemas": ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
    "Operations": [
      { "op": "add", "path": "members",
        "value": [{ "value": "user-id-3", "display": "bob.wilson@example.com" }] }
    ]
  }
  ```

- **POST** `/api/orgs/{platform_key}/scim/v2/Groups/{id}/remove_members` — remove
  members via a SCIM PatchOp. Each operation must be `op: remove` with a path of
  the form `members[value eq "<user-id>"]`.

  ```json
  {
    "schemas": ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
    "Operations": [
      { "op": "remove", "path": "members[value eq \"user-id-1\"]" }
    ]
  }
  ```

- **DELETE** `/api/orgs/{platform_key}/scim/v2/Groups/{id}/` — hard-delete the RBAC
  group (returns `204`). **Confirm with the user first.**

## Example

Create a SCIM user with RBAC groups (which auto-link the user's platforms):

```bash
curl -X POST \
  "https://api.iblai.app/dm/api/orgs/$IBLAI_ORG/scim/v2/Users" \
  -H "Authorization: Api-Token $IBLAI_API_KEY" \
  -H "Content-Type: application/scim+json" \
  -d '{
    "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
    "userName": "jane.smith@example.com",
    "name": { "formatted": "Jane Smith", "givenName": "Jane", "familyName": "Smith" },
    "emails": [{ "value": "jane.smith@example.com", "primary": true }],
    "active": true,
    "rbacGroupUniqueIds": ["students", "course_123_enrolled"]
  }'
```

## Notes

- **Error schema.** Group-not-found returns the SCIM error object:
  `{"schemas": ["urn:ietf:params:scim:api:messages:2.0:Error"],
  "scimType": "invalidValue", "detail": "..."}` with `404`. Other failures return
  a plain `{"error": "..."}` body. Standard HTTP codes apply: `400`
  invalid/missing fields (e.g. unknown `departmentIds` / `groupIds` /
  `rbacGroupUniqueIds`), `401` missing/invalid auth, `404` not found, `405`
  on `DELETE Users/{id}/`, `409` the user already exists on create (on a local
  match the API instead returns the existing user with `200` — use `update: true`
  to modify), `500` server error.
- **Editing semantics.** **Users** are edited by re-POSTing with `update: true`,
  or via `PUT Users/{id}/` / `PATCH Users/{id}/`. **Groups** are edited via
  `PUT Groups/{id}/` (replaces the whole `members` list) or `PATCH Groups/{id}/`;
  incremental membership changes go through the dedicated
  `add_members` / `remove_members` actions, which take a **PatchOp** body
  (`urn:ietf:params:scim:api:messages:2.0:PatchOp` with an `Operations` array of
  `op` / `path` / `value`).
- **RBAC group assignment auto-links platforms.** Assigning
  `rbacGroupUniqueIds` on a user validates the groups exist, then automatically
  creates platform links for any platforms behind those RBAC groups the user
  isn't already linked to — so you can grant RBAC access without listing
  `platformOrgs` explicitly. RBAC assignment runs after all other linking. Default
  RBAC groups (server-configured) are applied to every user on platform link;
  `rbacGroupUniqueIds` is additive on top of those.
- **Group lookup is platform-scoped, with optional fallback.** Group lookups try
  `(unique_id, platform_key)` first; if the server has strict platform matching
  disabled, they fall back to matching `unique_id` on any platform.
- **Filtering, sorting & pagination.** Both list endpoints accept SCIM `filter`
  expressions (e.g. `userName eq "john.doe"`, `displayName eq "Students"`; user
  filters support `userName`, `name.formatted`, `emails.value`, `active`, `id`,
  `externalId`; group filters support `displayName`, `id`, `description`).
  **`Users` list** also honors `startIndex` / `count` pagination (1-based;
  defaults `startIndex=1`, `count=50`), `sortBy` (`userName`, `name.formatted`,
  `active`) / `sortOrder` (`ascending` / `descending`), and `attributes` /
  `excludedAttributes`. **`Groups` list** does **not** paginate (it returns all
  matching groups) but does honor `excludedAttributes=members`.
- **Enterprise extension key.** On responses the extension block's key uses
  underscores — `urn_ietf_params_scim_schemas_extension_enterprise_2_0_User` —
  not the colon-delimited URN.
- **Schema reference.** Interactive SCIM API docs (drf-spectacular) are published
  at `https://base.manager.iblai.tech/api-docs/#/scim`.
</content>
</invoke>