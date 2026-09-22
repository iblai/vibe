# CRM — resource schema

Field-level request/response shape for each CRM resource behind **`/iblai-api-crm`**. See
the skill's **Reads** / **Writes** for the endpoints; this is the field reference. **Mode**
is one of:

- **req** — required on create (`POST`).
- **opt** — optional; the listed default applies when omitted.
- **ro** — read-only; server-set, ignored (or rejected) on write.

Every resource also returns four read-only fields not repeated in the tables below: `id`
(UUID for Person and Organization, int otherwise — see the skill's **Resources** table),
`platform` (the org, resolved from your API token — you cannot set it or reference another
org's id), `created_at`, and `updated_at`.

### Person — `/api/crm/persons/`

| Field             | Type           | Mode | Notes                                                                                  |
| ----------------- | -------------- | ---- | -------------------------------------------------------------------------------------- |
| `name`            | string ≤255    | req  | Full display name.                                                                     |
| `primary_email`   | email          | opt  | Auto-links this Person to a platform user created with a matching email (case-insensitive). |
| `emails`          | list           | opt  | Additional emails, free-form shape. Default `[]`.                                      |
| `contact_numbers` | list           | opt  | Phone/contact numbers, free-form shape. Default `[]`.                                  |
| `job_title`       | string ≤255    | opt  | Display only; not validated. Default `""`.                                             |
| `organization`    | UUID           | opt  | An Organization in your org; cross-org references are rejected.                        |
| `owner`           | int (user id)  | opt  | Internal account owner; must be an active member of your org.                          |
| `platform_user`   | int (user id)  | ro   | Set when bound to a platform user — on email match, or via `link-user/`.               |
| `lifecycle_stage` | enum           | opt  | `lead` \| `qualified` \| `opportunity` \| `customer` \| `churned`. Default `lead`.     |
| `unique_id`       | string ≤128    | opt  | External system id; must be unique within your org when non-blank. Default `""`.       |
| `active`          | bool           | ro   | Flipped to `false` when the Person is linked to a user or merged away.                 |
| `tags`            | list           | ro   | Attached tag chips; manage via the tag actions below.                                  |
| `metadata`        | object         | opt  | Free-form JSON for org-defined attributes. Default `{}`.                               |

### Organization — `/api/crm/organizations/`

| Field      | Type          | Mode | Notes                                                          |
| ---------- | ------------- | ---- | -------------------------------------------------------------- |
| `name`     | string ≤255   | req  | Unique per org (case-sensitive).                               |
| `address`  | object        | opt  | Free-form JSON (street, city, country, …). Default `{}`.       |
| `owner`    | int (user id) | opt  | Must be an active member of your org.                          |
| `tags`     | list          | ro   | Attached tag chips; manage via the tag actions below.          |
| `metadata` | object        | opt  | Free-form JSON for org-defined attributes. Default `{}`.       |

### Pipeline — `/api/crm/pipelines/`

| Field         | Type        | Mode | Notes                                                                       |
| ------------- | ----------- | ---- | --------------------------------------------------------------------------- |
| `name`        | string ≤255 | req  | Display name (e.g. 'B2B Sales', 'Renewals').                                |
| `code`        | slug ≤64    | req  | Unique per org; lowercase letters, digits, hyphens.                         |
| `is_default`  | bool        | opt  | At most one default per org — un-flag the old default first. Default `false`. |
| `rotten_days` | int         | opt  | Days a Deal can sit in a stage before it's surfaced as stale. Default `30`. |
| `stages`      | list        | ro   | Embedded PipelineStage objects (read inline on the pipeline).               |
| `metadata`    | object      | opt  | Free-form JSON. Default `{}`.                                               |

### PipelineStage — `/api/crm/pipelines/{pipeline_id}/stages/`

| Field         | Type        | Mode | Notes                                                                           |
| ------------- | ----------- | ---- | ------------------------------------------------------------------------------- |
| `code`        | slug ≤64    | req  | Referenced by Deal stage moves (`stage_code`); unique within the pipeline.      |
| `name`        | string ≤255 | req  | Display name for the stage.                                                     |
| `probability` | int 0–100   | opt  | Win likelihood; used for revenue forecasting. Default `0`.                      |
| `sort_order`  | int         | opt  | Ordering position within the pipeline. Default `0`.                             |
| `is_won`      | bool        | opt  | Terminal won stage; moving a Deal here sets `status='won'`. Default `false`.    |
| `is_lost`     | bool        | opt  | Terminal lost stage; moving a Deal here sets `status='lost'`. Default `false`.  |
| `metadata`    | object      | opt  | Free-form JSON. Default `{}`.                                                   |
| `pipeline`    | int         | ro   | Set from the URL path; a stage cannot move between pipelines.                   |

A stage cannot be both `is_won` and `is_lost`.

### LeadSource — `/api/crm/lead-sources/`

| Field      | Type        | Mode | Notes                                                       |
| ---------- | ----------- | ---- | ----------------------------------------------------------- |
| `name`     | string ≤128 | req  | Display name for the lead source.                           |
| `code`     | slug ≤64    | req  | Unique per org; lowercase letters, digits, hyphens.         |
| `metadata` | object      | opt  | Free-form JSON. Default `{}`.                               |

### Deal — `/api/crm/deals/`

| Field                 | Type            | Mode | Notes                                                                                       |
| --------------------- | --------------- | ---- | ------------------------------------------------------------------------------------------- |
| `title`               | string ≤255     | req  | Short display name (e.g. 'Acme renewal — 2026').                                            |
| `description`         | text            | opt  | Free-text notes. Default `""`.                                                              |
| `lead_value`          | decimal(14,2)   | opt  | Estimated value in `currency`. Default `0`.                                                 |
| `currency`            | string(3)       | opt  | ISO 4217 code. Default `USD`.                                                               |
| `status`              | enum            | ro   | `open` \| `won` \| `lost`. Set by the deal actions; direct writes are rejected with `400`.  |
| `lost_reason`         | string ≤255     | opt  | Set on a `lost` transition. Default `""`.                                                   |
| `expected_close_date` | date            | opt  | Forecasted close date.                                                                      |
| `closed_at`           | datetime        | ro   | Set when the Deal enters a won/lost stage; cleared on re-open.                              |
| `person`              | UUID            | req  | Primary contact; must belong to your org. A Person with deals can't be deleted.            |
| `organization`        | UUID            | opt  | Must belong to your org, and must match the Person's Organization when the Person has one.  |
| `pipeline`            | int             | req  | Must belong to your org.                                                                    |
| `stage`               | int             | req  | Must belong to `pipeline`. Change after create via `move-stage/`.                           |
| `source`              | int (LeadSource)| opt  | Where the Deal originated; must belong to your org.                                         |
| `owner`               | int (user id)   | opt  | Sales rep. Defaults to the calling user on create.                                          |
| `tags`                | list            | ro   | Attached tag chips; manage via the tag actions below.                                       |
| `metadata`            | object          | opt  | Free-form JSON. Default `{}`.                                                               |

### Activity — `/api/crm/activities/`

| Field           | Type          | Mode | Notes                                                                          |
| --------------- | ------------- | ---- | ------------------------------------------------------------------------------ |
| `title`         | string ≤255   | req  | Short summary (e.g. 'Discovery call').                                          |
| `type`          | enum          | req  | `call` \| `meeting` \| `email` \| `note` \| `task` \| `lunch` \| `deadline`.   |
| `location`      | string ≤255   | opt  | Meeting location / dial-in / venue. Default `""`.                              |
| `comment`       | text          | opt  | Free-text notes. Default `""`.                                                 |
| `schedule_from` | datetime      | opt  | Scheduled start. Null for instant log entries.                                 |
| `schedule_to`   | datetime      | opt  | Scheduled end.                                                                 |
| `is_done`       | bool          | opt  | Default `false`. Flip via `POST .../done/` (stamps `done_at`).                 |
| `done_at`       | datetime      | ro   | Set the first time `is_done` becomes true.                                     |
| `deal`          | int           | opt  | Either `deal` or `person` is required.                                         |
| `person`        | UUID          | opt  | Either `deal` or `person` is required. When both are set, must be the Deal's Person. |
| `owner`         | int (user id) | opt  | Defaults to the calling user on create.                                        |
| `reminder_at`   | datetime      | opt  | When to remind the owner.                                                      |
| `reminder_sent` | bool          | ro   | Set when a reminder has fired; prevents a duplicate reminder.                  |
| `metadata`      | object        | opt  | Free-form JSON. Default `{}`.                                                  |

### Tag — `/api/crm/tags/`

| Field      | Type       | Mode | Notes                                                  |
| ---------- | ---------- | ---- | ------------------------------------------------------ |
| `name`     | string ≤64 | req  | Unique per org (case-sensitive).                       |
| `color`    | hex string | opt  | `#RRGGBB` (six hex digits). Default `#888888`.         |
| `metadata` | object     | opt  | Free-form JSON. Default `{}`.                          |

**Attaching tags** (Tags are created via `/api/crm/tags/`, then attached to a
Person, Organization, or Deal):

- **POST** `/api/crm/{persons|organizations|deals}/{id}/tags/` — attach one tag;
  body `{ "tag_id": int }` (required). `201` → `{ assignment_id, tag }`; `409`
  if it is already attached → `{ detail, assignment_id, tag }`.
- **DELETE** `/api/crm/{persons|organizations|deals}/{id}/tags/{tag_id}/` —
  detach a tag (`204`, or `404` if it was not attached). Confirm with the user first.

### Enums

- **lifecycle_stage** (Person): `lead`, `qualified`, `opportunity`, `customer`, `churned`.
- **status** (Deal): `open`, `won`, `lost`.
- **type** (Activity): `call`, `meeting`, `email`, `note`, `task`, `lunch`, `deadline`.

### Filter query params

Append to a list `GET` (results are paginated). Confirmed filters per resource:

| Resource     | Filters                                                                                                                                   |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Person       | `lifecycle_stage`, `owner`, `organization`, `tags`, `created_at__gte`, `created_at__lte`, `metadata__has_key`                            |
| Organization | `owner`, `name` (contains), `tags`                                                                                                        |
| Pipeline     | `code` (exact), `name` (contains), `is_default`                                                                                           |
| Stage        | `code` (exact), `is_won`, `is_lost`                                                                                                       |
| Lead Source  | `code` (exact), `name` (contains)                                                                                                         |
| Deal         | `status`, `pipeline`, `stage`, `owner`, `source`, `person`, `organization`, `tags`, `expected_close_date__gte/__lte`, `created_at__gte/__lte`, `metadata__has_key` |
| Activity     | `type`, `is_done`, `owner`, `deal`, `person`, `schedule_from__gte/__lte`, `metadata__has_key`                                            |
| Tag          | `name` (contains), `created_at__gte/__lte`                                                                                                |

`tags` (Person / Organization / Deal) takes tag **ids**, repeated
(`?tags=1&tags=2`) or CSV (`?tags=1,2`), matched with OR semantics. `name` /
`code` "contains" filters are case-insensitive substring matches; `code`
"exact" is case-insensitive. There is no `search=` or `ordering=` param — only
the fields above filter.
