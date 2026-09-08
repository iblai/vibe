# RBAC permissions reference

> Gating and role lookup complementing `/iblai-api-rbac`. The RBAC model
> (action/data-action format, resource-path hierarchy, roles/policies/groups,
> additive evaluation) is in the skill's `## Concepts` — not repeated here. Every
> call carries `Authorization: Api-Token $IBLAI_API_KEY` and the identity must
> hold the action gating that endpoint. Wire spelling is literal: `Ibl.Mentor`
> namespace, `mentor-owner` owner role, `mentors` segment (never `Ibl.Agent` /
> `agent-owner` / `agents`), org key as `platform_key`.

## Which action gates each endpoint

### CRUD — roles, policies, groups

The three ViewSets share one CRUD→action map; only the action prefix differs:
`Ibl.Core/Roles/`, `Ibl.Core/Policies/`, `Ibl.Core/Groups/`.

| Method | Path | Action suffix |
|--------|------|---------------|
| GET (list) | `/dm/api/core/rbac/{roles,policies,groups}/` | `list` |
| POST | `/dm/api/core/rbac/{roles,policies,groups}/` | `action` |
| GET (one) | `…/{id}/` | `read` |
| PUT/PATCH | `…/{id}/` | `write` |
| DELETE | `…/{id}/` | `delete` |

### Access, sharing, toggles

| Operation | Method | Path | Required action |
|-----------|--------|------|-----------------|
| Permission check | POST | `/dm/api/core/rbac/permissions/check/` | none — any authed user checks their own access |
| Grant/revoke agent access | POST | `/dm/api/core/rbac/agent-access/` | `Ibl.Mentor/ShareMentor/action` |
| List agent access | GET | `…/agent-access/` | `Ibl.Mentor/ShareMentor/read` |
| Share team | POST | `/dm/api/core/rbac/teams/access/` | `Ibl.Core/ShareUserGroups/action` |
| List team access | GET | `…/teams/access/` | `Ibl.Core/ShareUserGroups/read` |
| Bulk user policies | PUT | `/dm/api/core/platform/users/policies/` | `Ibl.Core/UserPolicies/write` |
| Student agent-creation `{set,status}` | POST/GET | `…/rbac/student-agent-creation/…` | org admin (no extra action) |
| Student LLM access `{set,status}` | POST/GET | `…/rbac/student-llm-access/…` | org admin (no extra action) |

Gating specifics:

- **Agent access** gates on the agent path `/platforms/{pk}/mentors/{mentor_id}/`; `mentor-owner` applies if the caller created it.
- **Team sharing** gates on `/platforms/{pk}/usergroups/{id}/`; `user-group-owner` applies to the owner. Team `role` values are `"read"`, `"edit"`, `"view analytics"`, `"send notifications"`; List-Teams / List-Users secondary policies are managed automatically.
- **Bulk user policies** takes `policies_to_add`, `policies_to_remove`, `policies_to_set` (set replaces all — removals apply before additions). Only policies from the org's assignable list are accepted.
- **Student agent-creation** toggle adds/removes the Students group on the Agent Creator policy.

## Built-in roles

Global roles (`platform=null`) present in every org; org admins can't edit them —
compose custom org-scoped roles instead.

| Role | Grants |
|------|--------|
| Tenant Admin | Full access (`Ibl.*`) |
| Students | Chat, read agent settings, manage own artifacts |
| Agent Viewer | Read-only on agent settings, documents, prompts |
| Agent Editor | Full read/write on agent settings, documents, prompts |
| Agent Chat | Chat access (same as Students) |
| Student Agent Creators | Create agents |
| Analytics Viewer | View analytics for permitted teams |
| Notification Manager | Send notifications to permitted teams, manage templates |
| Enrollment Manager | Course/program/pathway enrollments; invite users |
| LLM Users | List available LLMs |
| LLM Model Access | Use specific LLM models |
| List Users | List org users |
| List Teams | List teams |
| Create Teams | Create teams |
| Read Team | Read team details |
| Edit Team | Read/write team details |
| Billing Manager | Manage credits |

## Permission evaluation

Order the backend resolves a request in:

1. Load the user's policies (direct + via groups).
2. Add well-known policies (e.g. "everyone").
3. Per policy: does the resource path match hierarchically **and** the action list match the requested action?
4. If ownership is relevant, load and check the owner well-known role.
5. Any matching policy that grants access → allowed (additive).
6. Data access: each field is checked individually against `data_actions`.

Owner roles are auto-granted to a resource's creator with no explicit policy:
`mentor-owner`, `document-owner`, `prompt-owner`, `user-group-owner`,
`artifact-owner`, `memory-owner`, `workflow-owner`, `mcp-server-owner`,
`mcp-server-connection-owner`, `connected-service-owner`. Owning a parent agent
also grants the owner role on its nested documents/prompts.

**Worked example (additive + hierarchical).** A user in the `Students` group who
also holds an `Agent Editor` policy scoped to `/mentors/5/` gets the union:
Student-level permissions across all org resources (chat, list agents, …) **plus**
Editor-level permissions on agent 5 specifically (write settings, manage its
documents, …). A narrower policy only ever adds to the broader one — it never
overrides it.

## Action & data-action matching

`*` is a wildcard matching any one segment of an action string. Action patterns
and data-action patterns expand differently — watch the third segment.

**Action patterns** (`Ibl.{Namespace}/{Resource}/{operation}`):

| Pattern | Grants |
|---------|--------|
| `Ibl.Mentor/Settings/read` | exactly that action |
| `Ibl.Mentor/Settings/*` | every operation on Settings (`read`, `write`, …) |
| `Ibl.Mentor/*` | any Mentor action |
| `Ibl.*` | everything (Tenant Admin) |

**Data-action patterns** (`Ibl.{Namespace}/{Resource}/{field}/{operation}`):

| Pattern | Grants |
|---------|--------|
| `Ibl.Mentor/Settings/display_name/read` | read the `display_name` field |
| `Ibl.Mentor/Settings/*/read` | read any Settings field |
| `Ibl.Mentor/Settings/*` | read **and** write any Settings field |

In an action pattern, `Settings/*` wildcards the *operation*; in a data-action
pattern, `Settings/*` wildcards the *field* (and covers both read and write).

## Response permission metadata

Object responses carry a `permissions` object the caller can read to drive access:

- `permissions.field` — per-field `{read, write}` map.
- `permissions.object` — object-level `{delete, write}`.

Fields the caller can't read are masked (`""`, `[]`, or `{}` by type) with
`read: false`; writing a field without write permission returns `403`.

## Resource-type operations

The permission-check response (and internal gating) exposes different operations
per resource type.

### Collection-level (`…/mentors/`)

| Resource | Operations |
|----------|-----------|
| `mentors` | list, create, chat, web_search, attach_document, voice_record, voice_call, export_chat_history, view_chat_history, view_analytics, view_prompts, share, sell_mentor |
| `prompts`, `documents`, `tools`, `settings`, `llms`, `mcpservers`, `usergroups`, `groups`, `policies`, `roles` | list, create |
| `users` | list, write |

### Instance-level (`…/mentors/42/`)

| Resource | Operations |
|----------|-----------|
| `mentors` | read, write, delete, chat, web_search, attach_document, voice_record, voice_call, export_chat_history, view_chat_history, view_analytics, view_prompts, show_settings, share_mentor, read_shared_mentor, sell_mentor, can_use_embed, view_moderation_logs, view_safety_logs, view_disclaimers, view_prompts_menu, view_tools_menu, view_disclaimers_menu |
| `prompts`, `documents`, `tools`, `settings`, `llms`, `mcpservers` | read, write, delete |
| `usergroups` | read, write, delete, share_usergroup, read_shared_usergroup |
| `platforms` | can_send_notifications, can_view_analytics, can_manage_users, can_invite |
