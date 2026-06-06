# Lead Sources API

Condensed from the CRM doc [Lead Sources API](../../../../docs/developer/applications/crm.md#74-lead-sources).

> **Base URL:** `${NEXT_PUBLIC_API_BASE_URL}/api/crm/`
> **Auth:** `Authorization: Token <token>`

Lead Sources record where a Deal originated (web traffic, referral,
outbound campaign…). They live under the `Ibl.CRM/Pipelines/` RBAC
bucket — anyone who can shape pipelines can shape lead sources.

## Seeded defaults

Every Platform ships with four lead sources, created automatically and
backfilled into existing Platforms via data migration:

| `code` | `name` |
|---|---|
| `web` | Web |
| `referral` | Referral |
| `cold_call` | Cold Call |
| `advertisement` | Advertisement |

`code` is the stable identifier. The display `name` can be renamed
freely without breaking integrations.

## Endpoints

| Method | Path | RBAC | Purpose |
|---|---|---|---|
| GET | `/lead-sources/` | `Ibl.CRM/Pipelines/list` | Paginated list |
| POST | `/lead-sources/` | `Ibl.CRM/Pipelines/action` | Create |
| GET | `/lead-sources/{id}/` | `Ibl.CRM/Pipelines/read` | Retrieve one |
| PUT | `/lead-sources/{id}/` | `Ibl.CRM/Pipelines/write` | Replace |
| PATCH | `/lead-sources/{id}/` | `Ibl.CRM/Pipelines/write` | Patch |
| DELETE | `/lead-sources/{id}/` | `Ibl.CRM/Pipelines/delete` | Delete — **SET NULL on referencing deals (destructive)** |

## Query parameters — `GET /lead-sources/`

| Name | Type | Description |
|---|---|---|
| `code` | string | Case-insensitive exact match |
| `name` | string | Case-insensitive substring match |
| `page` / `page_size` | integer | Pagination, `page_size` max 100 |

## Fields

| Field | Type | Notes |
|---|---|---|
| `id` | int | Server-assigned, stable across renames |
| `platform` | int | Server-set from auth token |
| `name` | string | Display name |
| `code` | string | Unique per Platform, lowercase letters/digits/hyphens |
| `metadata` | object | Free-form JSON, defaults to `{}` |
| `created_at` / `updated_at` | ISO 8601 | Timestamps |

## Error catalog

`400` on POST/PATCH with duplicate code:

```json
{"code": ["A LeadSource with code 'linkedin-outbound' already exists on this Platform."]}
```

`403 Forbidden` — caller missing `Ibl.CRM/Pipelines/action` (POST) /
`/write` (PATCH/PUT) / `/delete` (DELETE).

## Destructive-delete footgun

Unlike Pipelines and Stages — which return `409 Conflict` when Deals
reference them — deleting a Lead Source is **not blocked**. Instead, the
server clears the foreign key on every referencing Deal:

```
Deal.source = NULL  -- on every Deal that referenced this source
```

Treat this as destructive. Once the source is gone, the historical
"where did this Deal come from?" attribution is lost permanently. Surface
a confirmation dialog that explicitly says so — do not lean on the
generic shadcn confirm wording.

If you only want to retire the source without losing attribution,
PATCH the `name` instead (e.g. prefix with `[archived]`) and stop
offering it in the create-deal UI.

## Sample list response

```json
{
  "count": 5,
  "results": [
    {"id": 1, "platform": 1, "name": "Web", "code": "web", "metadata": {}},
    {"id": 2, "platform": 1, "name": "Referral", "code": "referral", "metadata": {}},
    {"id": 3, "platform": 1, "name": "Cold Call", "code": "cold_call", "metadata": {}},
    {"id": 4, "platform": 1, "name": "Advertisement", "code": "advertisement", "metadata": {}},
    {"id": 5, "platform": 1, "name": "LinkedIn Outbound", "code": "linkedin-outbound", "metadata": {"campaign": "q3-saas"}}
  ]
}
```
