# Pipelines & Stages API

Condensed from the CRM doc [Pipelines & Stages API](../../../../docs/developer/applications/crm.md#73-pipelines--stages).

> **Base URL:** `${NEXT_PUBLIC_API_BASE_URL}/api/crm/`
> **Auth:** `Authorization: Token <token>`
> All responses are scoped to the Platform on the token.

## Seeded defaults

Every Platform is seeded with one pipeline and six stages on creation
(existing Platforms were backfilled via data migration).

| Pipeline `code` | `name` | `is_default` | `rotten_days` |
|---|---|---|---|
| `default` | Default Pipeline | `true` | `30` |

Stages on the default pipeline, in `sort_order`:

| `code` | `name` | `probability` | `sort_order` | `is_won` | `is_lost` |
|---|---|---|---|---|---|
| `new` | New | 10 | 0 | false | false |
| `qualified` | Qualified | 25 | 1 | false | false |
| `proposal` | Proposal | 50 | 2 | false | false |
| `negotiation` | Negotiation | 75 | 3 | false | false |
| `won` | Won | 100 | 4 | **true** | false |
| `lost` | Lost | 0 | 5 | false | **true** |

Treat `code` as the stable identifier in client payloads. `id` differs
across environments.

## Endpoint summary

| Method | Path | RBAC | Purpose |
|---|---|---|---|
| GET | `/pipelines/` | `Ibl.CRM/Pipelines/list` | List pipelines (each carries `stages` inline) |
| POST | `/pipelines/` | `Ibl.CRM/Pipelines/action` | Create a pipeline |
| GET | `/pipelines/{id}/` | `Ibl.CRM/Pipelines/read` | Retrieve one |
| PUT | `/pipelines/{id}/` | `Ibl.CRM/Pipelines/write` | Replace editable fields |
| PATCH | `/pipelines/{id}/` | `Ibl.CRM/Pipelines/write` | Patch editable fields |
| DELETE | `/pipelines/{id}/` | `Ibl.CRM/Pipelines/delete` | Delete pipeline (cascades stages) |
| GET | `/pipelines/{pipeline_id}/stages/` | `Ibl.CRM/Pipelines/list` | List stages (ordered by `sort_order`) |
| POST | `/pipelines/{pipeline_id}/stages/` | `Ibl.CRM/Pipelines/action` | Create stage in this pipeline |
| GET | `/pipelines/{pipeline_id}/stages/{id}/` | `Ibl.CRM/Pipelines/read` | Retrieve one stage |
| PUT | `/pipelines/{pipeline_id}/stages/{id}/` | `Ibl.CRM/Pipelines/write` | Replace stage fields |
| PATCH | `/pipelines/{pipeline_id}/stages/{id}/` | `Ibl.CRM/Pipelines/write` | Patch stage fields |
| DELETE | `/pipelines/{pipeline_id}/stages/{id}/` | `Ibl.CRM/Pipelines/delete` | Delete stage |

Stages are nested — they cannot be moved between pipelines, and the
nested route refuses access to stages of pipelines on other Platforms.

## Query parameters

### `GET /pipelines/`

| Name | Type | Description |
|---|---|---|
| `code` | string | Case-insensitive exact match |
| `name` | string | Case-insensitive substring match |
| `is_default` | boolean | Filter to default (or non-default) |
| `page` / `page_size` | integer | Pagination, max `page_size=100` |

### `GET /pipelines/{pipeline_id}/stages/`

| Name | Type | Description |
|---|---|---|
| `code` | string | Case-insensitive exact match |
| `is_won` | boolean | Filter terminal won stages |
| `is_lost` | boolean | Filter terminal lost stages |
| `page` / `page_size` | integer | Pagination |

## Pipeline fields

| Field | Type | Write rules |
|---|---|---|
| `id` | int | Server-assigned |
| `platform` | int | Server-set from auth token |
| `name` | string | Required on create |
| `code` | string | Required, unique per Platform, lowercase letters/digits/hyphens |
| `is_default` | boolean | At most one default per Platform — un-flag the existing default first |
| `rotten_days` | int | Defaults to `30` |
| `stages` | array | **Read-only on pipeline.** Manage via nested endpoints |
| `metadata` | object | Free-form JSON, defaults to `{}` |
| `created_at` / `updated_at` | ISO 8601 | Timestamps |

## Stage fields

| Field | Type | Write rules |
|---|---|---|
| `id` | int | Server-assigned |
| `pipeline` | int | **Immutable** — set automatically from URL on POST, read-only thereafter |
| `code` | string | Required, unique within the pipeline |
| `name` | string | Required, shown on kanban cards |
| `probability` | int | 0–100, defaults to `0`, used for revenue forecasting |
| `sort_order` | int | Left-to-right column order, defaults to `0` |
| `is_won` | boolean | Terminal won. Moving a deal here sets `Deal.status="won"` |
| `is_lost` | boolean | Terminal lost. Moving a deal here sets `Deal.status="lost"` |
| `metadata` | object | Free-form JSON, defaults to `{}` |

A stage cannot be both `is_won` and `is_lost`.

## Error catalog

### POST/PATCH pipeline

```json
{"code": ["A Pipeline with code 'b2b-sales' already exists on this Platform."]}
```

```json
{"is_default": ["Another Pipeline on this Platform is already the default. Un-flag the existing default first."]}
```

### POST/PATCH stage

```json
{"code": ["A stage with code 'discovery' already exists in this Pipeline."]}
```

```json
{"probability": ["probability must be between 0 and 100."]}
```

```json
{"detail": ["A stage cannot be both is_won and is_lost."]}
```

`404 Not Found` — parent pipeline does not exist or belongs to another
Platform.

### DELETE pipeline

`409 Conflict`:

```json
{"detail": "Pipeline still has Deals attached."}
```

Stages cascade-delete with the pipeline when no deals reference them.

### DELETE stage

`409 Conflict`:

```json
{"detail": "Stage still has Deals attached."}
```

Migrate deals off the stage first.

## Sample list response (truncated)

```json
{
  "count": 1,
  "next_page": null,
  "previous_page": null,
  "results": [
    {
      "id": 1, "platform": 1, "name": "Default Pipeline", "code": "default",
      "is_default": true, "rotten_days": 30,
      "stages": [
        {"id": 1, "pipeline": 1, "code": "new", "name": "New", "probability": 10, "sort_order": 0, "is_won": false, "is_lost": false, "metadata": {}},
        {"id": 5, "pipeline": 1, "code": "won", "name": "Won", "probability": 100, "sort_order": 4, "is_won": true, "is_lost": false, "metadata": {}},
        {"id": 6, "pipeline": 1, "code": "lost", "name": "Lost", "probability": 0, "sort_order": 5, "is_won": false, "is_lost": true, "metadata": {}}
      ],
      "metadata": {}
    }
  ]
}
```
