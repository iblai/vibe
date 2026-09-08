# edX user-roles reference

> Role catalog and endpoint detail backing the **Users** promote/demote call in
> `/iblai-api-management`. These roles live on the **edX** service (LMS/CMS
> hosts), not the DM `rbac/roles` ViewSet documented in `/iblai-api-rbac` -
> different system, different role model. Do not confuse the two.

**Terminology note.** The `org` field on these endpoints is the **edX
course-organization short name** (e.g. `edX`, the string before `+` in a
course id like `course-v1:edX+DemoX+Demo_Course`) - it is **not** the ibl.ai
`org key` / `$IBLAI_ORG` used elsewhere in this repo. These endpoints take no
`platform_key`; the LMS/CMS host you call is already scoped to one ibl.ai org.

## Role catalog

### General (global) roles

No `course` or `org` field required.

| Role key | Definition |
|----------|------------|
| `staff` | Global staff access across the whole edX instance. |
| `support-staff` | Support-staff role. |
| `course-creator` | Can create courses in **every** organization. Only assignable through the **CMS** (Studio) host - the LMS host rejects it with `400`. On a multi-tenant deployment prefer `org-course-creator` instead (scoped to one org). |

### Course roles

Require `course` (course id, e.g. `course-v1:edX+DemoX+Demo_Course`).

| Role key | Definition |
|----------|------------|
| `course-staff` | Course staff member. |
| `course-instructor` | Course instructor - equivalent to admin for that course. |
| `course-limited-staff` | Course staff without Studio access. Requires Open edX **Quince or later**; on older releases (Olive, Palm) this key is not offered and assignment returns `400`. |
| `course-finance-admin` | Course finance administrator. |
| `course-sales-admin` | Course sales administrator. |
| `course-beta-tester` | Course beta tester. |
| `course-library-user` | Course library user. |
| `course-ccx-coach` | Course CCX coach. |
| `course-data-researcher` | Can access the instructor dashboard's Data Downloads tab for the course. |

`course-limited-staff` and `course-data-researcher` can also be granted from
the LMS instructor dashboard's Membership tab - role rows assigned there are
returned by the list-roles read too.

### Organization roles

Require `org` (edX course-organization short name, see terminology note above).

| Role key | Definition |
|----------|------------|
| `org-staff` | Organization staff member. |
| `org-instructor` | Organization instructor - equivalent to admin for that org. |
| `org-library-user` | Organization library user. |
| `org-data-researcher` | Data researcher across the organization. |
| `org-course-creator` | Can create courses within a **single** organization. Wire role string is `org_course_creator_group`. The scoped alternative to global `course-creator`. |

**`instructor` == `admin`.** Wherever a role name is `*-instructor`
(`course-instructor`, `org-instructor`), it grants admin-equivalent access for
that scope - there is no separate `admin` role key.

## Endpoints

All three are available on **both** the LMS host (`learn.iblai.app`,
deprecated for roles) and the **CMS host** (`studio.learn.iblai.app`,
recommended) - prefer CMS since it is the only host that accepts
`course-creator`.

- **GET** `https://studio.learn.iblai.app/api/ibl/users/manage/roles/?username={username}` - list every role assigned to a user (global + course + org). Identify the user with `username`, `email`, or `user_id` (one required). A role row whose role string this API does not recognize is silently omitted from the response (and logged as a warning) rather than erroring.
- **POST** `https://studio.learn.iblai.app/api/ibl/users/manage/roles/` - assign or unassign one role (the call already documented under Writes > Users in `/iblai-api-management`); add `course` for a course role or `org` for an org role.
- **POST** `https://studio.learn.iblai.app/api/ibl/users/manage/roles/sync/` - bulk-replace a batch of role assignments for **one** user in a single atomic request:
  ```json
  {
    "username": "string (one of username/email/user_id required)",
    "roles": [
      {"role": "org-instructor", "org": "edX", "active": true},
      {"role": "org-staff", "org": "edX", "active": false}
    ]
  }
  ```
  Every entry is validated first - one invalid entry fails the whole request
  with `400` and a per-entry error list, and nothing is applied. Valid
  batches apply inside a single transaction (all succeed or all roll back).
  Response:
  ```json
  {
    "success": true,
    "processed": 2,
    "skipped": 0,
    "results": [
      {"role": "org-instructor", "org": "edX", "course": null, "active": true, "status": "success", "action": "added"},
      {"role": "org-staff", "org": "edX", "course": null, "active": false, "status": "success", "action": "removed"}
    ]
  }
  ```
  Staff/admin only. Used by the DM to sync roles to edX; signal handlers skip
  relaying these changes back to avoid sync loops.

## Notes

- **Inactive users:** if the target user is inactive, the platform ignores
  role *grants* for them - `POST roles/` and `roles/sync/` both return
  `200`/success but report the grant entry as skipped (`{"status": "skipped",
  "detail": "..."}` for the single-role call; `"status": "skipped"` +
  `"reason"` per entry for the bulk call, counted in the top-level `skipped`).
  Role *removals* (`active: false`) still apply regardless of active state.
- **Idempotent grants:** assigning a role a user already holds returns `200`
  without error.
- **`active` must be a real JSON boolean** - omitted or `true` assigns, `false`
  removes; any other type (`null`, the string `"false"`) fails validation.
- **`course-creator` is CMS-only** - the LMS host rejects it with `400`.
  Prefer `org-course-creator` on multi-tenant deployments regardless of host.
