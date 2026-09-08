---
name: iblai-api-management
description: Administer an ibl.ai organization via the platform API - manage Users (list, activate, promote/demote, bulk role sync, set policies), edX roles (full catalog: global/course/org), Groups, RBAC Roles and Policies, Teams (user-groups + team access), and Alerts (watched groups/users/watchers). Use for organization-level user and access administration.
metadata:
  kind: api
---

# iblai-api-management

Administer an organization from the API: manage **Users, Groups, Roles,
Policies, Teams, and Alerts** for organization-level user and access
administration.

## Auth & conventions

- **Base URL:** `https://api.iblai.app`
- **Header:** `Authorization: Api-Token $IBLAI_API_KEY` on every request.
- **Path vars:** `{org}` = `$IBLAI_ORG` (a.k.a. `platform_key`),
  `{username}` = `$IBLAI_USERNAME`.
- **Host:** these endpoints live on the DM host under `/api/core/…`. The
  exception is edX user roles (list / promote-demote / bulk sync), which flip
  to the edX LMS/CMS host - see the **Users > Roles (edX)** entries below. The
  `org` field on those calls is the edX course-organization short name, not
  the ibl.ai `org key` - see the reference doc linked in `## Reference
  material`.
- Not connected yet? Run **`/iblai-api-login`** first to populate `IBLAI_ORG`,
  `IBLAI_USERNAME`, and `IBLAI_API_KEY`.

## Reads

### Users

- **GET** `…/core/platform/users/?platform_key={org}&platform_org={org}&query={q}&page={n}&page_size=10&return_policies=true` — user list + policies.

#### Roles (edX)

- **GET** `https://studio.learn.iblai.app/api/ibl/users/manage/roles/?username={username}` - list a user's edX roles (global + course + org). Identify the user with `username`, `email`, or `user_id`. Full role catalog (what each role key means, which need `course`/`org`) and endpoint detail in **[`references/edx-roles-reference.md`](references/edx-roles-reference.md)**.

### Groups

`…/core/rbac/groups/`

- **GET** `…/groups/?platform_key={org}&include_users=true[&name=&email=&owner=&username=&page=&page_size=]` — list.
- **GET** `…/groups/{id}/` — detail.

### Roles

`…/core/rbac/roles/` (all calls include `include_global_roles=true`)

- **GET** `…/roles/?include_global_roles=true&platform_key={org}[&name=&page=&page_size=]` — list.
- **GET** `…/roles/{id}/?include_global_roles=true&platform_key={org}` — detail.

### Policies

`…/core/rbac/policies/`

- **GET** `…/policies/?platform_key={org}&include_groups=true&include_users=true[&role_id=&group=&name=&username=&email=&page=&page_size=]` — list.
- **GET** `…/policies/{id}/?platform_key={org}` — detail.

### Teams

`…/core/user-groups/` plus team access (`…/core/rbac/teams/access/`)

- **GET** `…/user-groups/?platform_key={org}[&include_users=&name=&with_permissions=&page=&page_size=]` — list.
- **GET** `…/user-groups/{id}/?platform_key={org}` — detail.
- **GET** `…/core/rbac/teams/access/?platform_key={org}&usergroup_id={id}` — list a team's access policies.

## Writes

### Users

#### Roles (edX)

- **POST** `https://studio.learn.iblai.app/api/ibl/users/manage/roles/` - promote/demote, i.e. assign or unassign one role:
  ```json
  {
    "username": "string (required)",
    "role": "e.g. org-instructor (required - see role catalog)",
    "course": "course id - required for course roles",
    "org": "edX course-org short name - required for org roles",
    "active": "boolean (optional, default true - true assigns, false removes)"
  }
  ```
  General roles (`staff`, `support-staff`, `course-creator`) take neither
  `course` nor `org`. `course-creator` is CMS-only (the LMS host rejects it
  with `400`). Full role catalog - what each key means and its scope
  requirement - is in **[`references/edx-roles-reference.md`](references/edx-roles-reference.md)**.
- **POST** `https://studio.learn.iblai.app/api/ibl/users/manage/roles/sync/` - bulk-replace a batch of role assignments for one user in a single atomic request (all entries validated first; all succeed or all roll back). Body and response shape, plus inactive-user and idempotency behavior, in the reference doc above.
- **POST** `…/core/users/platforms/` — activate/deactivate:
  ```json
  {
    "user_id": "number (required)",
    "platform_key": "string (required)",
    "active": "boolean (required)"
  }
  ```
- **PUT** `…/core/platform/users/policies/` — set policies (array):
  ```json
  [
    {
      "user_id": "number (required)",
      "platform_key": "string (required)",
      "policies_to_set": "string[] (required, may be [])"
    }
  ]
  ```

### Groups

`…/core/rbac/groups/`

- **POST** `…/groups/` — create:
  ```json
  {
    "name": "string (required)",
    "platform_key": "string (required)",
    "description": "string",
    "users": "number[]"
  }
  ```
- **PUT** `…/groups/{id}/` — update (same shape).
- **DELETE** `…/groups/{id}/?platform_key={org}` — delete. Destructive — confirm with the user first.

### Roles

`…/core/rbac/roles/` (all calls include `include_global_roles=true`)

- **POST** `…/roles/?include_global_roles=true` — create:
  ```json
  {
    "name": "string (required)",
    "platform_key": "string (required)",
    "actions": "string[] (RBAC action strings, e.g. Ibl.Mentor/Mentors/read)",
    "data_actions": "string[]"
  }
  ```
  The permission list is **`actions`** (+ optional **`data_actions`**), not
  `permissions`. See **`/iblai-api-rbac`** for the full role/policy model
  (action namespaces, resource paths).
- **PUT** / **PATCH** `…/roles/{id}/?include_global_roles=true` — update (same shape).
- **DELETE** `…/roles/{id}/?include_global_roles=true&platform_key={org}` — delete. Destructive — confirm with the user first.

### Policies

`…/core/rbac/policies/`

- **POST** `…/policies/` — create:
  ```json
  {
    "name": "string (required)",
    "platform_key": "string (required)",
    "role": "number role id (required)",
    "resources": "string[]",
    "users": "number[]",
    "groups": "number[]"
  }
  ```
- **PUT** / **PATCH** `…/policies/{id}/` — update (same shape).
- **DELETE** `…/policies/{id}/?platform_key={org}` — delete. Destructive — confirm with the user first.

### Teams

`…/core/user-groups/` plus team access (`…/core/rbac/teams/access/`)

- **POST** `…/user-groups/` — create:
  ```json
  {
    "name": "string (required)",
    "platform_key": "string (required)",
    "description": "string",
    "users": "number[]"
  }
  ```
- **PUT** `…/user-groups/{id}/` — update (same shape).
- **DELETE** `…/user-groups/{id}/` — delete. Destructive — confirm with the user first.
- **POST** `…/core/rbac/teams/access/` — set team access:
  ```json
  {
    "platform_key": "string (required)",
    "usergroup_id": "number (required)",
    "groups": "[{group_id, role}]",
    "users": "[{user_id, role}]"
  }
  ```

### Alerts

`…/core/watched-groups/`

- **GET** / **POST** `…/watched-groups/` — list / create watched group.
- **GET** / **PATCH** / **DELETE** `…/watched-groups/{id}/` — watched group detail / update / delete. DELETE is destructive — confirm with the user first.
- **GET** / **POST** `…/watched-groups/{watchedGroupPk}/watched-users/` — list / add watched users.
- **DELETE** `…/watched-users/{id}/` — remove watched user. Destructive — confirm with the user first.
- **GET** / **POST** `…/watched-groups/{watchedGroupPk}/watchers/` — list / add watchers.
- **PATCH** / **DELETE** `…/watchers/{id}/` — update / remove watcher (notification-event flags in body). DELETE is destructive — confirm with the user first.

## Example

List the first page of organization users with their policies:

```bash
curl -s \
  "https://api.iblai.app/dm/api/core/platform/users/?platform_key=$IBLAI_ORG&platform_org=$IBLAI_ORG&page=1&page_size=10&return_policies=true" \
  -H "Authorization: Api-Token $IBLAI_API_KEY"
```

## Notes

- Most endpoints require `platform_key={org}` as a query param even on POST/PUT
  bodies that also carry it — send both.
- The edX user-roles calls (list, promote/demote, bulk sync) are the only
  ones on the edX LMS/CMS host and take **no** `platform_key`; every other
  endpoint here is on the DM host under `/api/core/…`. Prefer the CMS host
  (`studio.learn.iblai.app`) for edX roles - it accepts every role key,
  including `course-creator`, which the LMS host rejects.
- edX roles (this section) and DM `rbac/roles` (the **Roles** subsection
  below) are two unrelated systems that happen to share the word "role" - an
  edX role key like `org-instructor` is not a DM RBAC role id, and vice versa.
- Policies bind a `role` (RBAC role id) to `resources`, `users`, and `groups` —
  create the Role first, then reference its id when creating the Policy.
- DELETE on any sub-section is destructive — confirm with the user before
  removing groups, roles, policies, teams, watched groups/users, or watchers.

## Reference material

- **[`references/edx-roles-reference.md`](references/edx-roles-reference.md)** - full edX role catalog (every global/course/org role key and what it grants), the list/assign/bulk-sync endpoint bodies and responses, and gotchas (inactive-user grant skipping, idempotency, `course-creator`'s CMS-only restriction, Open edX release gates on `course-limited-staff`).
