# Deals API

Condensed from the CRM doc [Deals API](../../../../docs/developer/applications/crm.md#75-deals).

> **Base URL:** `${NEXT_PUBLIC_API_BASE_URL}/api/crm/`
> **Auth:** `Authorization: Token <token>`
> All responses are scoped to the Platform on the token. Cross-Platform
> deals return `404 Not Found` — never `403` — so existence is never leaked.

## Endpoint catalog

| Method | Path | RBAC | Purpose |
|---|---|---|---|
| GET | `/deals/` | `Ibl.CRM/Deals/list` | Paginated list |
| POST | `/deals/` | `Ibl.CRM/Deals/action` | Create |
| GET | `/deals/{id}/` | `Ibl.CRM/Deals/read` | Retrieve one |
| PUT | `/deals/{id}/` | `Ibl.CRM/Deals/write` | Replace editable fields |
| PATCH | `/deals/{id}/` | `Ibl.CRM/Deals/write` | Patch editable fields |
| DELETE | `/deals/{id}/` | `Ibl.CRM/Deals/delete` | Delete (cascades audit Activities + tag assignments) |
| POST | `/deals/{id}/move-stage/` | `Ibl.CRM/Deals/write` | Move to any stage in the deal's pipeline |
| POST | `/deals/{id}/won/` | `Ibl.CRM/Deals/write` | Move to first `is_won` stage (or `stage_code`-specified) |
| POST | `/deals/{id}/lost/` | `Ibl.CRM/Deals/write` | Move to first `is_lost` stage; **requires `lost_reason`** |
| POST | `/deals/{id}/tags/` | `Ibl.CRM/Tags/write` | Attach a tag (see /iblai-crm-tag) |
| DELETE | `/deals/{id}/tags/{tag_id}/` | `Ibl.CRM/Tags/write` | Detach a tag |

Holding `Ibl.CRM/Deals/write` is **not** sufficient for tag attach/detach
— they require `Ibl.CRM/Tags/write`.

## Query parameters — `GET /deals/`

| Param | Type | Description |
|---|---|---|
| `status` | string | `open`, `won`, `lost` |
| `pipeline` | integer | Pipeline id |
| `stage` | integer | PipelineStage id |
| `owner` | integer | Owning user id |
| `source` | integer | LeadSource id |
| `person` | UUID | Primary person on the deal |
| `organization` | UUID | Organization on the deal |
| `expected_close_date__gte` / `__lte` | ISO 8601 | Forecast close window |
| `created_at__gte` / `__lte` | ISO 8601 | Creation window |
| `metadata__has_key` | string | Top-level key in `metadata` |
| `tags` | int (repeatable) or CSV | OR-match on tag ids. `?tags=1&tags=2` or `?tags=1,2`. Non-numeric pieces dropped silently |
| `page` / `page_size` | integer | Pagination |

## Deal fields

| Field | Type | Write rules |
|---|---|---|
| `id` | int | Server-assigned |
| `platform` | int | Server-set from auth token |
| `title` | string | **Required on POST** |
| `description` | string | Defaults to `""` |
| `lead_value` | decimal string | Defaults to `"0"` |
| `currency` | string | ISO 4217, defaults to `"USD"` |
| `status` | string | **Server-managed. READ-ONLY.** Derived from current stage's `is_won`/`is_lost` flags. PUT/PATCH with `status` → 400 |
| `lost_reason` | string | Persisted by the `lost/` action; empty otherwise. Max 255 chars |
| `expected_close_date` | datetime\|null | Forecast close date |
| `closed_at` | datetime\|null | **Server-managed. READ-ONLY.** Stamped on entry to terminal stage; cleared on re-open |
| `person` | UUID | **Required on POST.** Must belong to your Platform |
| `organization` | UUID\|null | Must belong to your Platform. If the Person has an organization, this MUST match it |
| `pipeline` | int | **Required on POST.** Must belong to your Platform |
| `stage` | int | **Required on POST.** Must belong to `pipeline`. Not directly writable on update — use `move-stage/`, `won/`, or `lost/` |
| `source` | int\|null | LeadSource id; must belong to your Platform |
| `owner` | int\|null | Defaults to the calling user. Must be an active member of your Platform |
| `tags` | array | Flat `[{id, name, color}]` — read-only here, mutate via tag sub-routes |
| `metadata` | object | Free-form JSON, defaults to `{}` |
| `created_at` / `updated_at` | datetime | Timestamps |

### Server-managed fields rule

The serializer rejects writes to `status` and `closed_at` on POST, PUT,
and PATCH. The only way to change either is via one of the three
transition endpoints — they recompute both atomically from the destination
stage's `is_won`/`is_lost` flags.

## POST `/deals/` errors

```json
{"status": "Service-managed — write via `POST /deals/{id}/move-stage/`, `won/`, or `lost/`."}
```

```json
{"stage": "Stage does not belong to the supplied pipeline."}
```

```json
{"organization": "Organization does not match the Person's Organization."}
```

```json
{"person": "Person belongs to a different platform."}
```

```json
{"owner": "User is not an active member of this Platform."}
```

`403 Forbidden` — caller missing `Ibl.CRM/Deals/action`.

## PUT/PATCH `/deals/{id}/` errors

```json
{
  "status": "Service-managed — write via `POST /deals/{id}/move-stage/`, `won/`, or `lost/`.",
  "closed_at": "Service-managed — write via `POST /deals/{id}/move-stage/`, `won/`, or `lost/`."
}
```

## Transition endpoint bodies

### `POST /deals/{id}/move-stage/`

```json
{"stage_code": "negotiation"}
```

or:

```json
{"stage_id": 12}
```

Provide **one** of `stage_id` or `stage_code`. `stage_code` is the
integration-safe choice (ids differ across environments).

Errors:

```json
{"detail": "Provide either `stage_id` or `stage_code`."}
```

```json
{"detail": "Destination stage does not belong to this Deal's pipeline."}
```

```json
{"detail": "Stage 'negotiation' not found in Deal's pipeline."}
```

### `POST /deals/{id}/won/`

```json
{}
```

or:

```json
{"stage_code": "closed-won-expansion"}
```

Errors:

```json
{"detail": "Pipeline 3 has no is_won=True stage configured."}
```

```json
{"detail": "Stage 'closed-won-expansion' is not marked is_won=True."}
```

### `POST /deals/{id}/lost/`

```json
{
  "lost_reason": "Chose competitor — Pied Piper undercut us on price.",
  "stage_code": "closed-lost-price"
}
```

`lost_reason` is **required** and must be non-blank. Max 255 chars.

Errors:

```json
{"lost_reason": ["This field is required."]}
```

```json
{"detail": "Pipeline 3 has no is_lost=True stage configured."}
```

```json
{"detail": "Stage 'closed-lost-price' is not marked is_lost=True."}
```

## Sample list response (truncated)

```json
{
  "count": 47,
  "next_page": 2,
  "previous_page": null,
  "results": [
    {
      "id": 184,
      "platform": 1,
      "title": "Acme renewal — 2026",
      "description": "Multi-year renewal, 220 seats.",
      "lead_value": "48000.00",
      "currency": "USD",
      "status": "open",
      "lost_reason": "",
      "expected_close_date": "2026-09-30T00:00:00Z",
      "closed_at": null,
      "person": "c4d2b1a8-7c3e-4f9a-9d6b-9a2c4f1e7b80",
      "organization": "b2a1e7d3-6f4c-4b2a-8e9d-1c3a5b7d9f10",
      "pipeline": 3,
      "stage": 12,
      "source": 5,
      "owner": 91,
      "tags": [
        {"id": 7, "name": "Enterprise", "color": "#3F6BFF"},
        {"id": 11, "name": "Renewal", "color": "#22A06B"}
      ],
      "metadata": {"region": "NA", "campaign_id": "fy26-renewals"},
      "created_at": "2026-04-12T08:14:22Z",
      "updated_at": "2026-05-30T17:02:11Z"
    }
  ]
}
```
