# CRM RBAC Matrix

The CRM ships four roles per Platform. Roles are seeded automatically
on Platform provisioning — there is nothing to create. Assign them
through the standard Platform role-management surface (`<Admin>` →
Roles + Policies — see `/iblai-rbac`); the CRM does not expose its own
role-assignment endpoints. A single user may hold more than one role
and effective permissions are the union.

## The four roles

**CRM Viewer.** Read-only across the entire CRM. Sees every Person,
Organization, Pipeline, Stage, Lead Source, Deal, Activity, and Tag,
but cannot create, update, delete, or send invitations. Right role
for sales-ops dashboards, finance reviewers, and any audience that
needs visibility without write access.

**CRM User.** The day-to-day operator. Full create / update / delete
on people, organizations, deals, activities, and tags — the records
that move during normal sales work. Pipelines, stages, and lead
sources are **read-only** for this role — pipeline topology is an
admin job. Cannot send invitations (that lives in a separate bucket).
Right role for individual sales reps and account managers.

**CRM Manager.** Wildcard access to every CRM action. Adds
pipeline / stage / lead-source administration and invitation sending
on top of everything the CRM User can do. Right role for sales
leadership and CRM admins.

**CRM Inviter.** A narrow role: read people and send invitations
only. Cannot edit or create people, cannot see organizations or
deals. Right role for partner-portal flows, gated onboarding teams,
or any surface that needs to turn known leads into Platform users
without exposing the broader pipeline.

## Action-by-action matrix

Action codes follow the bucket convention `Ibl.CRM/<Resource>/<verb>`
with five canonical verbs: `list`, `read`, `action`, `write`,
`delete`. `action` covers create (`POST`) and custom verb endpoints
(`move-stage`, `won`, `lost`, `done`, `link-user`, `merge`).

| Resource bucket | Action codes | Viewer | User | Manager | Inviter |
|---|---|---|---|---|---|
| `Ibl.CRM/Persons` | `list`, `read` | ✓ | ✓ | ✓ | ✓ |
| `Ibl.CRM/Persons` | `action`, `write`, `delete` | — | ✓ | ✓ | — |
| `Ibl.CRM/Organizations` | `list`, `read` | ✓ | ✓ | ✓ | — |
| `Ibl.CRM/Organizations` | `action`, `write`, `delete` | — | ✓ | ✓ | — |
| `Ibl.CRM/Pipelines` | `list`, `read` | ✓ | ✓ | ✓ | — |
| `Ibl.CRM/Pipelines` | `action`, `write`, `delete` | — | — | ✓ | — |
| `Ibl.CRM/Deals` | `list`, `read` | ✓ | ✓ | ✓ | — |
| `Ibl.CRM/Deals` | `action`, `write`, `delete` | — | ✓ | ✓ | — |
| `Ibl.CRM/Activities` | `list`, `read` | ✓ | ✓ | ✓ | — |
| `Ibl.CRM/Activities` | `action`, `write`, `delete` | — | ✓ | ✓ | — |
| `Ibl.CRM/Tags` | `list`, `read` | ✓ | ✓ | ✓ | — |
| `Ibl.CRM/Tags` | `action`, `write`, `delete` | — | ✓ | ✓ | — |
| `Ibl.CRM/Invite` | `action` | — | — | ✓ | ✓ |

Notes:
- **Lead Source endpoints fall under `Ibl.CRM/Pipelines`.** They are
  administrative — only CRM Manager can create / update / delete a
  lead source even though CRM Users will reference them on Deals.
- **Stage CRUD also lives under `Ibl.CRM/Pipelines`.** Moving a
  *stage* is admin work (Manager only); moving a *deal* between
  stages is a Deal `action` (User or Manager).

## HTTP verb → action code mapping

| HTTP | Action code |
|---|---|
| `GET` (list endpoint) | `list` |
| `GET` (detail endpoint) | `read` |
| `POST` (create) | `action` |
| `POST` (custom: `move-stage`, `won`, `lost`, `done`, `link-user`, `merge`) | `action` |
| `POST` attach-tag, `DELETE` detach-tag | `write` (on `Ibl.CRM/Tags`) |
| `PATCH` / `PUT` | `write` |
| `DELETE` (resource delete) | `delete` |

## Two permissions worth a second look

- **Invitation is its own bucket.** A role with
  `Ibl.CRM/Persons/write` does **not** have `Ibl.CRM/Invite/action`.
  Gate the "Invite" affordance independently of the Person edit
  affordance — they are distinct rights.
- **Tag attach/detach requires `Ibl.CRM/Tags/write`.** A role with
  `Ibl.CRM/Persons/write` cannot tag a person without it. This is
  intentional — it lets you delegate tag-graph mutation separately
  from person mutation.

## Assigning the roles

The CRM does not ship a role-assignment UI of its own. Use the
SDK-provided management surface:

- `<Admin>` (mounted via `<Account>` — see `/iblai-account`) →
  **Roles** tab to inspect / edit the seeded CRM roles, and
  **Policies** tab to bind a role to a user or group on the
  Platform resource scope.
- Or call `POST rbac/policies/` directly (see the REST contract
  under `/iblai-agent-access` → "Roles CRUD").
- For per-action gating in your CRM surfaces, hydrate
  `rbacPermissions` via `POST rbac/permissions/check/` and gate the
  affordance with `checkRbacPermission(rbacPermissions, path,
  enableRbac)` from `@iblai/iblai-js/web-utils`.

See `/iblai-rbac` for the full management-UI walkthrough and the
action-definitions endpoint.
