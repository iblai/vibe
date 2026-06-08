# CRM Seeded Defaults

Every Platform ships with a working CRM configuration the first time
it is provisioned. Existing Platforms have the same seeds back-filled
by a data migration. You do not need to create any of the records
below — they are present on every Platform and can be edited,
renamed, or extended.

> **Reference seeds by `code`, not `id`.** The `code` value on
> stages and lead sources is stable across environments (dev /
> staging / prod) and survives display-name renames. The numeric `id`
> values differ between environments and should only be cached for
> the lifetime of a single request (e.g. saving the pipeline `id`
> long enough to build a deal payload).

## Default Pipeline

A single Pipeline is seeded and marked as the default:

| Field | Value |
|---|---|
| `code` | `default` |
| `is_default` | `true` |
| `rotten_days` | `30` |

Filter for it with `GET /api/crm/pipelines/?is_default=true`. The
response embeds the six default stages inline (no second request
needed).

## Default Stages (on the default Pipeline)

Six stages, ordered by `sort_order`. The first four are non-terminal
(in-flight). `won` and `lost` are terminal — moving a deal into one
of them stamps `closed_at` and updates `Deal.status` automatically.

| `code` | `name` | `probability` | `sort_order` | `is_won` | `is_lost` |
|---|---|---|---|---|---|
| `new` | New | 10 | 0 | false | false |
| `qualified` | Qualified | 25 | 1 | false | false |
| `proposal` | Proposal | 50 | 2 | false | false |
| `negotiation` | Negotiation | 75 | 3 | false | false |
| `won` | Won | 100 | 4 | **true** | false |
| `lost` | Lost | 0 | 5 | false | **true** |

Notes:
- `probability` is a 0–100 integer used for weighted-pipeline reports.
- `sort_order` drives kanban column placement left-to-right.
- The `/deals/{id}/won/` and `/deals/{id}/lost/` action endpoints
  resolve to the first stage of the matching kind by `sort_order`
  (`won` here, `lost` here). Pass `stage_code` only when a Platform
  has multiple terminal stages of one kind.

## Default Lead Sources

Four lead sources are seeded — the channels that produced a Deal.
They live under the `Ibl.CRM/Pipelines/` RBAC bucket because shaping
attribution categories is an administrative job.

| `code` | `name` |
|---|---|
| `web` | Web |
| `referral` | Referral |
| `cold_call` | Cold Call |
| `advertisement` | Advertisement |

The `source` field on Deal is a nullable foreign key — leave it
`null` for an unattributed deal.

## What is not seeded

- **No default Persons / Organizations / Deals / Activities / Tags.**
  The CRM is empty on Platform creation. The seeds above are the
  topology you can build on top of, not data.
- **No default Tag palette.** Tags must be created before they can be
  attached (see `/iblai-crm-tag`).
- **No default custom-metadata schema.** `metadata` is an open
  free-form JSON object on every resource — the integrator owns the
  shape end-to-end.
