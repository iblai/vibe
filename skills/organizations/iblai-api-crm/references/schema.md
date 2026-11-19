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
org's id), `created_at`, and `updated_at` (Favorite has no `updated_at`).

Persons, organizations, lead sources, pipelines, deals, activities, tags, web forms and
saved views also return **`app`** (ro): the app whose record it is, blank for the CRM
itself. A create stamps the request's `?app=`; it never changes after.

### Person — `/api/crm/persons/`

| Field             | Type           | Mode | Notes                                                                                  |
| ----------------- | -------------- | ---- | -------------------------------------------------------------------------------------- |
| `name`            | string ≤255    | req  | Full display name.                                                                     |
| `primary_email`   | email          | opt  | Auto-links this Person to a platform user created with a matching email (case-insensitive). |
| `emails`          | list           | opt  | Additional emails, free-form shape. Default `[]`.                                      |
| `contact_numbers` | list           | opt  | Phone numbers as strings (`["+1 555 0100"]`, what the CRM apps and web forms write); the API takes any JSON list. Default `[]`. |
| `job_title`       | string ≤255    | opt  | Display only; not validated. Default `""`.                                             |
| `organization`    | UUID           | opt  | An Organization in your org; cross-org references are rejected.                        |
| `organization_name` | string \| null | ro   | The organization's name; follows the person's verb, not `Organizations/`.              |
| `owner`           | int (user id)  | opt  | Internal account owner; must be an active member of your org.                          |
| `platform_user`   | int (user id)  | ro   | Set when bound to a platform user — on email match, or via `link-user/`.               |
| `lifecycle_stage` | enum           | opt  | `lead` \| `qualified` \| `opportunity` \| `customer` \| `churned`. Default `lead`.     |
| `unique_id`       | string ≤128    | opt  | External system id; must be unique within your org and app when non-blank. Default `""`. |
| `active`          | bool           | ro   | Flipped to `false` when the Person is linked to a user or merged away.                 |
| `tags`            | list           | ro   | Attached tag chips; manage via the tag actions below.                                  |
| `metadata`        | object         | opt  | Free-form JSON for org-defined attributes. Default `{}`.                               |

### Organization — `/api/crm/organizations/`

| Field      | Type          | Mode | Notes                                                          |
| ---------- | ------------- | ---- | -------------------------------------------------------------- |
| `name`     | string ≤255   | req  | Unique per org and app (case-sensitive).                       |
| `address`  | object        | opt  | Free-form JSON (street, city, country, …). Default `{}`.       |
| `owner`    | int (user id) | opt  | Must be an active member of your org.                          |
| `tags`     | list          | ro   | Attached tag chips; manage via the tag actions below.          |
| `metadata` | object        | opt  | Free-form JSON for org-defined attributes. Default `{}`.       |

### Pipeline — `/api/crm/pipelines/`

| Field         | Type        | Mode | Notes                                                                       |
| ------------- | ----------- | ---- | --------------------------------------------------------------------------- |
| `name`        | string ≤255 | req  | Display name (e.g. 'B2B Sales', 'Renewals').                                |
| `code`        | slug ≤64    | req  | Unique per org and app; lowercase letters, digits, hyphens.                 |
| `is_default`  | bool        | opt  | At most one default per org and app — un-flag the old default first. Default `false`. |
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
| `code`     | slug ≤64    | req  | Unique per org and app; lowercase letters, digits, hyphens. |
| `metadata` | object      | opt  | Free-form JSON. Default `{}`.                               |

### Deal — `/api/crm/deals/`

| Field                 | Type            | Mode | Notes                                                                                       |
| --------------------- | --------------- | ---- | ------------------------------------------------------------------------------------------- |
| `title`               | string ≤255     | req  | Short display name (e.g. 'Acme renewal — 2026').                                            |
| `description`         | text            | opt  | Free-text notes. Default `""`.                                                              |
| `lead_value`          | decimal(14,2)   | opt  | Estimated value in `currency`. Default `0`.                                                 |
| `currency`            | string(3)       | opt  | ISO 4217 code. Default `USD`.                                                               |
| `status`              | enum            | ro   | `open` \| `won` \| `lost`. Set by the deal actions; direct writes are rejected with `400`.  |
| `is_stale`            | bool            | ro   | Open and untouched for longer than the pipeline's `rotten_days`.                           |
| `person_name`         | string          | ro   | The person's name, for cards and tables; follows the deal's verb, not `Persons/`.          |
| `organization_name`   | string \| null  | ro   | The organization's name; follows the deal's verb.                                          |
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
| `deal`          | int           | opt  | One of `deal`, `person`, `organization` is required.                           |
| `person`        | UUID          | opt  | One of `deal`, `person`, `organization` is required. When both deal and person are set, must be the Deal's Person. |
| `organization`  | UUID          | opt  | An Organization in your org — the company timeline.                            |
| `owner`         | int (user id) | opt  | Defaults to the calling user on create.                                        |
| `reminder_at`   | datetime      | opt  | When to remind the owner.                                                      |
| `reminder_sent` | bool          | ro   | Set when a reminder has fired; prevents a duplicate reminder.                  |
| `metadata`      | object        | opt  | Free-form JSON. Default `{}`.                                                  |

### Tag — `/api/crm/tags/`

| Field      | Type       | Mode | Notes                                                  |
| ---------- | ---------- | ---- | ------------------------------------------------------ |
| `name`     | string ≤64 | req  | Unique per org and app (case-sensitive).               |
| `color`    | hex string | opt  | `#RRGGBB` (six hex digits). Default `#888888`.         |
| `metadata` | object     | opt  | Free-form JSON. Default `{}`.                          |

**Attaching tags** (Tags are created via `/api/crm/tags/`, then attached to a
Person, Organization, or Deal):

- **POST** `/api/crm/{persons|organizations|deals}/{id}/tags/` — attach one tag;
  body `{ "tag_id": int }` (required). `201` → `{ assignment_id, tag }`; `409`
  if it is already attached → `{ detail, assignment_id, tag }`.
- **DELETE** `/api/crm/{persons|organizations|deals}/{id}/tags/{tag_id}/` —
  detach a tag (`204`, or `404` if it was not attached). Confirm with the user first.

### Favorite — `/api/crm/favorites/`

Personal: list / read / create / delete see the calling user's rows only.

| Field          | Type   | Mode | Notes                                                                 |
| -------------- | ------ | ---- | --------------------------------------------------------------------- |
| `person`       | UUID   | opt  | Exactly one of `person`, `organization`, `deal` on create.            |
| `organization` | UUID   | opt  | —                                                                     |
| `deal`         | int    | opt  | —                                                                     |
| `target_type`  | enum   | ro   | `person` \| `organization` \| `deal`.                                 |
| `label`        | string | ro   | The target's display name.                                            |

### SavedView — `/api/crm/views/`

Personal: every method sees the calling user's rows only. `name` is unique per
platform, app, user and `object_type`.

| Field         | Type        | Mode | Notes                                                                                |
| ------------- | ----------- | ---- | ------------------------------------------------------------------------------------ |
| `object_type` | enum        | req  | `persons` \| `organizations` \| `deals` \| `activities`.                             |
| `name`        | string ≤120 | req  | Unique per platform, app, user and list.                                             |
| `type`        | enum        | opt  | `table` \| `kanban`. Default `table`; `kanban` only for `deals`.                      |
| `columns`     | list        | opt  | `[{"id": "<field>", "visible": true}]` in display order. Default `[]`.               |
| `filters`     | list        | opt  | `[{"field": "<field>", "op": "<op>", "value": <any>}]`, all ANDed. Default `[]`.      |
| `sorts`       | list        | opt  | `[{"field": "<field>", "dir": "asc" \| "desc"}]`. Default `[]`.                      |
| `group_by`    | string ≤64  | opt  | Kanban column field (e.g. `stage`). Default `""`.                                    |

### WebForm — `/api/crm/web-forms/` (by `slug`)

| Field             | Type        | Mode | Notes                                                                                     |
| ----------------- | ----------- | ---- | ----------------------------------------------------------------------------------------- |
| `slug`            | slug ≤64    | req  | The URL segment (`/web-forms/{slug}/`, the public routes); unique per org and app.        |
| `name`            | string ≤255 | req  | Shown to visitors; names the lead source and the note.                                    |
| `is_published`    | bool        | opt  | Live on the public routes. Needs an email field and a name field (below). Default `false`. |
| `fields`          | list        | opt  | What a visitor fills in — see below.                                                      |
| `routing`         | object      | opt  | Where a submission lands — see below.                                                     |
| `metadata`        | object      | opt  | The app's page copy (≤ 64 KB), served as is on the public read. Default `{}`.             |
| `success_title`   | string ≤255 | opt  | Shown after a submission.                                                                 |
| `success_message` | text        | opt  | —                                                                                         |

Each entry of `fields` is `{key, label, type, required, placeholder, help, options,
maps_to}`. `type` is `text`, `email`, `tel`, `number`, `date`, `select` (with `options`),
`textarea` or `checkbox`. `maps_to` lists where the answer is written:

| Target                                                  | Writes                                                        |
| ------------------------------------------------------- | ------------------------------------------------------------- |
| `person.name`, or `person.first_name` + `person.last_name` | the person's name (`name` wins)                            |
| `person.primary_email` (an `email` field)               | the person's email, and the key a submission finds them by    |
| `person.phone`, `person.job_title`                      | the first of `contact_numbers`, the job title                 |
| `organization.name`                                     | the person's organization, found or created by name           |
| `deal.description`                                      | the deal's description                                        |
| `person.metadata.<key>`, `deal.metadata.<key>`          | one metadata key                                              |

A field with no target is kept on the submission and in the note only. Publishing needs a
field mapped to `person.primary_email` and one to `person.name` or `person.first_name`.

`routing` keys: `create_deal` (bool), `pipeline_code` (blank: the default pipeline),
`stage_code` (blank: its first open stage), `lead_source_code` (created on first use, named
after the form), `tags` (names, created on first use), `owner` (an active member's user id;
owns new persons, the deal and the note), `lifecycle_stage` (for new persons),
`deal_title` (`{name}`, `{form}` and `{<deal metadata key>}`; a missing token drops with
the separators after it) and `deal_metadata` (defaults that mapped answers override).
`fields` and `routing` are validated whole and stored with every key present: a `PATCH`
replaces either whole, defaults filled.

### WebFormSubmission — `/api/crm/web-forms/{slug}/submissions/` (read-only)

| Field      | Type         | Notes                                              |
| ---------- | ------------ | -------------------------------------------------- |
| `id`       | UUID         | —                                                  |
| `person`   | UUID \| null | The person it landed in (may since be deleted).    |
| `deal`     | int \| null  | The deal it opened.                                |
| `answers`  | object       | The cleaned answers, by field key.                 |
| `utm`      | object       | The `utm_*` tags sent with it.                     |
| `page_url` | string ≤500  | The page it came from.                             |

The client IP is kept for the Django admin only.

### Member — `/api/crm/members/` (read-only)

| Field      | Type           | Notes                                          |
| ---------- | -------------- | ---------------------------------------------- |
| `id`       | int            | The user id, as `owner` takes it.              |
| `username` | string         | —                                              |
| `name`     | string         | —                                              |
| `email`    | string \| null | `null` without `Ibl.Core/Users/list`.          |
| `is_admin` | bool           | An admin of the organization.                  |

### Enums

- **lifecycle_stage** (Person): `lead`, `qualified`, `opportunity`, `customer`, `churned`.
- **status** (Deal): `open`, `won`, `lost`.
- **type** (Activity): `call`, `meeting`, `email`, `note`, `task`, `lunch`, `deadline`.

### Filter query params

Append to a list `GET` (results are paginated). Confirmed filters per resource:

| Resource     | Filters                                                                                                                                   |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Person       | `lifecycle_stage`, `owner`, `organization`, `active`, `tags`, `primary_email` (exact), `created_at__gte`, `created_at__lte`, `metadata__has_key` |
| Organization | `owner`, `name` (contains), `name__iexact` (exact), `tags`                                                                               |
| Pipeline     | `code` (exact), `name` (contains), `is_default`                                                                                           |
| Stage        | `code` (exact), `is_won`, `is_lost`                                                                                                       |
| Lead Source  | `code` (exact), `name` (contains)                                                                                                         |
| Deal         | `status`, `pipeline`, `stage`, `owner`, `source`, `person`, `organization`, `tags`, `expected_close_date__gte/__lte`, `created_at__gte/__lte`, `metadata__has_key` |
| Activity     | `type`, `is_done`, `owner`, `deal`, `person`, `organization`, `schedule_from__gte/__lte`, `metadata__has_key`                            |
| Tag          | `name` (contains), `name__iexact` (exact), `created_at__gte/__lte`                                                                       |
| Saved view   | `object_type`, `type`                                                                                                                     |
| Favorite     | `person`, `organization`, `deal` — ids; the way to ask whether one record is starred                                                      |
| Web form     | — (`search=` over `name`, `slug`)                                                                                                         |
| Member       | `query` (username or name)                                                                                                                |

`tags` (Person / Organization / Deal) takes tag **ids**, repeated
(`?tags=1&tags=2`) or CSV (`?tags=1,2`), matched with OR semantics. `name` /
`code` "contains" filters are case-insensitive substring matches; `code`,
`primary_email` and `name__iexact` "exact" are case-insensitive.

Every list also accepts three shared parameters (favorites: no `search=`):

- `search=` — case-insensitive substring over the resource's text fields
  (Person: `name`, `primary_email`, `job_title`, `unique_id`; Organization:
  `name`; Deal: `title`, `description`; Activity: `title`, `comment`,
  `location`; Tag / Lead Source / Pipeline / Stage: `name`, `code`).
- `ordering=` — a scalar column, `-` prefix for descending (e.g.
  `ordering=-created_at`, `ordering=name`, `ordering=lead_value`); ties break on
  the id, so pages stay stable. An unknown column is ignored.
- `date_filter=` — `today` | `7d` | `30d` | `90d` | `all_time` | `custom`, rows
  created in that window; `custom` needs `start_date` and `end_date`
  (`YYYY-MM-DD`, inclusive), and those two override any preset. Omitted = all time.
