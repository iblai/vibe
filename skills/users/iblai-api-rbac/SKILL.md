---
name: iblai-api-rbac
description: Manage an ibl.ai organization's RBAC via the platform API — roles (actions + data actions), policies, groups, permission checks, resource/action discovery, agent and team access sharing, bulk user policies, and student creation/LLM-access toggles. Org-wide access control. Use to define who can do what.
metadata:
  kind: api
---

# iblai-api-rbac

Drive the organization's **role-based access control** from the API: define
roles and policies, attach them to groups and users, check permissions, discover
assignable resources and actions, share agents and teams, and toggle what
students may do — the org-wide "who can do what" surface under
`…/dm/api/core/rbac/…` (bulk user policies live under `…/dm/api/core/platform/…`).

## Auth & conventions

- **Base URL:** `https://api.iblai.app`
- **Header:** `Authorization: Api-Token $IBLAI_API_KEY` on every request.
- **Path vars:** `{org}` = `$IBLAI_ORG` (a.k.a. `platform_key`),
  `{username}` = `$IBLAI_USERNAME`, `{mentor_id}` = the agent's numeric id.
- Not connected yet? Run **`/iblai-api-login`** first to populate `IBLAI_ORG`,
  `IBLAI_USERNAME`, and `IBLAI_API_KEY`.
- The RBAC developer docs phrase auth as `Authorization: Token <key>` — that is
  the same platform key; use `Api-Token`.
- **`mentor`/`agent` route alias.** The `mentor-*` routes are canonical; the
  platform also serves an identical `agent-*` twin (same view, auth, and data)
  for `rbac/mentor-access/` and `rbac/student-mentor-creation/…`. Both spellings
  resolve. This skill uses `agent-*`; the canonical `mentor-*` path is noted
  inline.

## Concepts

Every permission check resolves to one question — *can this identity perform this
action on this resource?* — evaluated at two levels: **action** (the operation
gate: `list`/`read`/`write`/`delete`/`action`) and **data** (field-level read /
write masking). All RBAC state is scoped to the org.

- **Resource paths are hierarchical** and rooted at a platform, e.g.
  `/platforms/{pk}/mentors/{mentor_id}/documents/{id}/`. A policy granted on a
  parent resource applies to all its children. In request bodies you supply the
  **short, platform-relative form** — `/mentors/`, `/mentors/123/`, `/students/`,
  `/users/`, `/groups/`, `/usergroups/5/` — and the `/platforms/{pk}/` prefix is
  added server-side from your token / `platform_key`.
- **Actions** follow `Ibl.{Namespace}/{Resource}/{operation}`. Namespaces:
  `Mentor`, `Core`, `CRM`, `Catalog`, `Notifications`, `Analytics`, `Billing`.
  Operations are `read`, `write`, `list`, `delete`, and `action` (create/perform).
  Examples: `Ibl.Mentor/Chat/action`, `Ibl.Mentor/Settings/read`,
  `Ibl.Mentor/ChatHistory/list`, `Ibl.Core/Groups/write`,
  `Ibl.Core/Policies/delete`, `Ibl.Analytics/CanViewAnalytics/action`.
  Wildcards match any segment: `Ibl.Mentor/Settings/*`, `Ibl.Mentor/*`, `Ibl.*`
  (full admin).
- **Data actions** control **field-level** access:
  `Ibl.{Namespace}/{Resource}/{field}/{operation}`, e.g.
  `Ibl.Mentor/Settings/display_name/read`, `Ibl.Mentor/Settings/*/read`. Missing
  read permission → the field returns empty; missing write permission → `403`.
- **Model.** A **role** carries `actions` + `data_actions` (allow) and
  `not_actions` + `not_data_actions` (deny). A **policy** binds one role to a set
  of `resources` and to users/groups. A **group** bundles users. Permissions are
  **additive** — if any policy grants an action, it is allowed.
- **Well-known / owner roles** apply dynamically. Owner roles (`mentor-owner`,
  `document-owner`, `prompt-owner`, `user-group-owner`, …) are auto-granted to a
  resource's creator without an explicit policy. The agent-access `role` field
  takes friendly keys: `viewer`, `editor`, `chat`, `analytics_viewer`,
  `dataset_curator`.
- **Literal spelling.** The `mentor`/`agent` alias is a **URL-route** convenience
  only. Action, data-action, and resource **payload** strings are not aliased —
  always write the literal `Mentor` / `mentors` form in `actions`, `data_actions`,
  and `resources`. `Ibl.Agent/…` and `/agents/` are not recognized.

## Reads

### Roles

- **GET** `https://api.iblai.app/dm/api/core/rbac/roles/?platform_key={org}` — list roles. Params: `name` (case-insensitive partial), `include_global_roles=true` (include platform-independent globals).
- **GET** `https://api.iblai.app/dm/api/core/rbac/roles/{id}/?platform_key={org}` — fetch one role.
- Full field reference for role bodies also lives in **`/iblai-api-management`**.

### Policies

- **GET** `https://api.iblai.app/dm/api/core/rbac/policies/?platform_key={org}` — list policies. Params: `role_id`, `name`, `group` (exact group name), `username`, `email`, `include_users=true`, `include_groups=true`.
- **GET** `https://api.iblai.app/dm/api/core/rbac/policies/{id}/?platform_key={org}` — fetch one policy.

### Groups

- **GET** `https://api.iblai.app/dm/api/core/rbac/groups/?platform_key={org}` — list groups. Params: `owner` (owner username), `name`, `username`, `email`, `include_users=true`.
- **GET** `https://api.iblai.app/dm/api/core/rbac/groups/{id}/?platform_key={org}` — fetch one group.

### Discovery

Use these to find the exact resource paths and action strings to put in policies
and roles (platform is taken from the token; service accounts pass `platform_key`).

- **GET** `https://api.iblai.app/dm/api/core/rbac/resources/` — resource-discovery tree for building policy resource paths; pass `path` to drill into a subtree.
- **GET** `https://api.iblai.app/dm/api/core/rbac/actions/tree/` — hierarchical catalog of all actions.
- **GET** `https://api.iblai.app/dm/api/core/rbac/actions/definitions/` — action definitions with human descriptions and each action's `assignable_resources`.

### Agent access

- **GET** `https://api.iblai.app/dm/api/core/rbac/agent-access/?platform_key={org}&mentor_id={id}` — list the users and groups that currently have access to an agent, each with its role. (Canonical `rbac/mentor-access/`.)

### Team (user-group) sharing

- **GET** `https://api.iblai.app/dm/api/core/rbac/teams/access/?platform_key={org}&usergroup_id={id}` — the team's access policy and the groups it can currently reach.

### Student toggles

- **GET** `https://api.iblai.app/dm/api/core/rbac/student-agent-creation/status/?platform_key={org}` — read the toggle (returns `allow_students_to_create_mentors`). Canonical `student-mentor-creation`.
- **GET** `https://api.iblai.app/dm/api/core/rbac/student-llm-access/status/?platform_key={org}` — read the allowed `llm_resources`.

## Writes

### Roles

- **POST** `https://api.iblai.app/dm/api/core/rbac/roles/` — create a role:
  ```json
  {
    "platform_key": "string (required)",
    "name": "string (required)",
    "actions": ["Ibl.Mentor/Settings/read", "Ibl.Mentor/Settings/write"],
    "data_actions": ["Ibl.Mentor/Settings/display_name/read"]
  }
  ```
  `id` and `is_internal` are read-only. See also **`/iblai-api-management`** (note: it labels the permission list `permissions`; the wire fields are `actions` + `data_actions`).
- **PUT / PATCH** `https://api.iblai.app/dm/api/core/rbac/roles/{id}/` — update a role (same shape).
- **DELETE** `https://api.iblai.app/dm/api/core/rbac/roles/{id}/?platform_key={org}` — delete a role. Destructive — confirm with the user first.

### Policies

- **POST** `https://api.iblai.app/dm/api/core/rbac/policies/` — create a policy:
  ```json
  {
    "platform_key": "string (required)",
    "name": "string (unique per org; a UUID is generated if omitted)",
    "role_id": 0,
    "resources": ["/mentors/", "/usergroups/5/"],
    "users_to_add": [0],
    "groups_to_add": [0]
  }
  ```
- **PUT / PATCH** `https://api.iblai.app/dm/api/core/rbac/policies/{id}/` — update; also accepts `users_to_remove` / `groups_to_remove`. See also **`/iblai-api-management`**.
- **DELETE** `https://api.iblai.app/dm/api/core/rbac/policies/{id}/?platform_key={org}` — delete a policy. Destructive — confirm with the user first.

### Groups

- **POST** `https://api.iblai.app/dm/api/core/rbac/groups/` — create a group: `{platform_key, name, description, unique_id (optional, client-supplied), users_to_add: [id]}`. Owner is set to the caller; `is_internal` is read-only.
- **PUT / PATCH** `https://api.iblai.app/dm/api/core/rbac/groups/{id}/` — update; also accepts `users_to_remove`. See also **`/iblai-api-management`**.
- **DELETE** `https://api.iblai.app/dm/api/core/rbac/groups/{id}/?platform_key={org}` — delete a group. Destructive — confirm with the user first.

### Permission check

- **POST** `https://api.iblai.app/dm/api/core/rbac/permissions/check/` — check the caller's access to resources (read-only, no mutation):
  ```json
  {
    "platform_key": "string (required)",
    "resources": ["/mentors/", "/mentors/123/", "/users/"]
  }
  ```
  Each resource must start and end with `/`. The response is an object keyed by
  each requested resource path, whose value is that resource's permission map
  (action → allowed); the exact keys vary by resource type. The check is
  ownership-aware — owner well-known roles apply automatically, so a resource's
  creator sees their owner permissions here without an explicit policy.

### Agent access

- **POST** `https://api.iblai.app/dm/api/core/rbac/agent-access/` — grant or revoke access to one agent (canonical `rbac/mentor-access/`). Confirm with the user first (shares an agent outward):
  ```json
  {
    "platform_key": "string (required)",
    "mentor_id": 0,
    "role": "viewer | editor | chat | analytics_viewer | dataset_curator",
    "users_to_add": [0],
    "users_to_remove": [0],
    "groups_to_add": [0],
    "groups_to_remove": [0],
    "usernames_to_add": ["string"],
    "emails_to_add": ["string"]
  }
  ```

### Team (user-group) sharing

- **POST** `https://api.iblai.app/dm/api/core/rbac/teams/access/` — share a user-group (team) by granting it a role on resources. Body carries `platform_key`, `usergroup_id`, a role, and users/groups to add/remove — see **`/iblai-api-management`** for the full shape. Confirm with the user first.

### Bulk user policies

- **PUT** `https://api.iblai.app/dm/api/core/platform/users/policies/` — set policies for an array of users. Body shape (`username` + `policies_to_set`) is documented in **`/iblai-api-management`**. Grants/revokes access — confirm with the user first.

### Student toggles

- **POST** `https://api.iblai.app/dm/api/core/rbac/student-agent-creation/set/` — enable/disable student agent creation (canonical `student-mentor-creation`): `{"platform_key": "…", "allow_students_to_create_mentors": true}`. Org-wide policy change — confirm with the user first.
- **POST** `https://api.iblai.app/dm/api/core/rbac/student-llm-access/set/` — set which LLMs students may use: `{"platform_key": "…", "llm_resources": ["llms/openai/models/gpt-4", "llms/openai/", "llms/"]}`. Shorter paths grant every sub-resource. Org-wide policy change — confirm with the user first.

## Example

Check whether the caller can act on users and groups in the org:

```bash
curl -X POST \
  "https://api.iblai.app/dm/api/core/rbac/permissions/check/" \
  -H "Authorization: Api-Token $IBLAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"platform_key\": \"$IBLAI_ORG\", \"resources\": [\"/users/\", \"/groups/\"]}"
```

## Notes

- This is the **authoritative RBAC surface** for the organization.
  `/iblai-api-management` documents the same roles / policies / groups /
  `teams/access` / `users/policies` endpoints from its admin view, and
  `/iblai-api-agent-access` touches agent-access — cross-reference them when
  working across surfaces.
- Reads carry `platform_key={org}` as a query param; writes (POST/PUT/PATCH)
  carry `platform_key` in the body.
- Resource paths are hierarchical: a policy on a parent grants its children, so
  scope policies at the right level.
- `rbac/roles`, `rbac/policies`, and `rbac/groups` are full CRUD ViewSets
  (list / retrieve / create / update / partial-update / delete); admin token
  required (platform or DM admin).
- A user-centric group-access endpoint also exists —
  **GET / POST** `https://api.iblai.app/dm/api/core/rbac/user-group-access/`
  (manage which groups a given user can reach) — not yet fully documented here.

## Schema

Core RBAC objects (fields the serializers expose; `*` = list/JSON):

- **Role** (`rbac/roles`): `id`, `name`, `platform` (null ⇒ a global role),
  `is_internal` (read-only), `actions*`, `data_actions*` (allow), plus
  `not_actions*` / `not_data_actions*` (deny) and `assignable_resources*`.
- **Policy** (`rbac/policies`): `id`, `name` (unique per org), `role`,
  `resources*` (platform-relative paths), `users*`, `groups*`, `platform`,
  `is_internal`.
- **Group** (`rbac/groups`): `id`, `unique_id`, `name`, `description`, `owner`,
  `users*`, `platform`, `is_internal`.
- **Well-known role** (applied dynamically, not stored as a policy): supplies
  contextual `actions*` / `data_actions*` (and `override_*`) for owner-style and
  "everyone" grants; drives the `mentor-owner` / `document-owner` / … behavior.

## Reference material

- **[`references/permissions-reference.md`](references/permissions-reference.md)**
  — the gating/role lookup complementing the endpoints above: which RBAC action
  gates each endpoint, the built-in role catalog, permission-evaluation order and
  owner roles, the `permissions.field` / `permissions.object` response metadata
  and field masking, and the operations each resource type exposes.
