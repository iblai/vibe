# CRM — quickstart — capture a lead, open a deal, close it

> Doc-sourced explanatory material complementing the verified endpoints in **`/iblai-api-crm`** — see [`SKILL.md`](../SKILL.md) and [`schema.md`](schema.md), which stay authoritative for endpoint methods/paths, field schemas, and filters. Curl examples use the skill convention (`https://api.iblai.app/dm/api/crm/...`, header `Authorization: Api-Token $IBLAI_API_KEY`); "org" denotes the customer workspace, distinct from the CRM **Organization** resource.

## 4. Quickstart: Capture a Lead, Open a Deal, Close It

End-to-end happy path in five steps. By the end you will have created a person, looked up your default pipeline, opened a deal in the `new` stage, advanced it through the pipeline, and closed it as won — exercising the full state machine the rest of this guide builds on.

### Prerequisites

Before you start, make sure you have:

- **An API token** issued for your org. All requests in this section use the `Authorization: Api-Token $IBLAI_API_KEY` header (see Section 3).
- **A seeded org.** On org creation, the CRM auto-seeds:
  - **One default Pipeline** with `code="default"` (`is_default=true`, `rotten_days=30`).
  - **Six stages** on that Pipeline, referenced by stable `code`:
    | `code`        | `name`        | `probability` | `is_won` | `is_lost` |
    |---------------|---------------|---------------|----------|-----------|
    | `new`         | New           | 10            | false    | false     |
    | `qualified`   | Qualified     | 25            | false    | false     |
    | `proposal`    | Proposal      | 50            | false    | false     |
    | `negotiation` | Negotiation   | 75            | false    | false     |
    | `won`         | Won           | 100           | true     | false     |
    | `lost`        | Lost          | 0             | false    | true      |
  - **Four lead sources**: `web`, `referral`, `cold_call`, `advertisement`.

You do not need to create any of these yourself — they are present on every org. You can edit, rename, or add to them later (see Section 9).

---

### Step 1: Create a person

A **Person** is the human record at the center of every deal. The only required field is `name`. `primary_email` is optional but recommended — it powers the automatic link to a Platform user when emails match. `organization` is optional. We will leave `lifecycle_stage` at its default of `lead`.

```bash
curl -X POST https://api.iblai.app/dm/api/crm/persons/ \
  -H "Authorization: Api-Token $IBLAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Alice Chen",
    "primary_email": "alice.chen@acme.example",
    "job_title": "VP Engineering",
    "lifecycle_stage": "lead"
  }'
```

**Response — `201 Created`:**

```json
{
  "id": "8f2a1c4d-9b3e-4a7f-9c2d-1e5b6a7f8c9d",
  "platform": 1,
  "name": "Alice Chen",
  "primary_email": "alice.chen@acme.example",
  "emails": [],
  "contact_numbers": [],
  "job_title": "VP Engineering",
  "organization": null,
  "owner": null,
  "platform_user": null,
  "lifecycle_stage": "lead",
  "unique_id": "",
  "active": true,
  "tags": [],
  "metadata": {},
  "created_at": "2026-06-04T14:22:11.482913Z",
  "updated_at": "2026-06-04T14:22:11.482913Z"
}
```

**Hold on to the `id`** — `"8f2a1c4d-9b3e-4a7f-9c2d-1e5b6a7f8c9d"` — you will reference it when you create the deal in Step 3.

**Field reference:**

| Field            | Type    | Notes                                                                 |
|------------------|---------|-----------------------------------------------------------------------|
| `id`             | UUID    | Server-assigned. Stable across renames and merges.                    |
| `platform`       | integer | Auto-resolved from your token.                                        |
| `primary_email`  | string  | Auto-links to a platform user when emails match (case-insensitive).   |
| `platform_user`  | integer | Read-only. Populated once linked to a platform user.                  |
| `active`         | bool    | Read-only. Flips to `false` on user link or merge.                    |
| `lifecycle_stage`| string  | One of `lead`, `qualified`, `opportunity`, `customer`, `churned`.     |
| `metadata`       | object  | Free-form JSON for org-defined attributes.                       |

---

### Step 2: Find your default pipeline and stages

Before you can open a deal you need a pipeline `id` and a stage `id`. Filter on `is_default=true` to get the seeded pipeline. The response embeds all six stages inline.

```bash
curl -X GET "https://api.iblai.app/dm/api/crm/pipelines/?is_default=true" \
  -H "Authorization: Api-Token $IBLAI_API_KEY"
```

**Response — `200 OK`:**

```json
{
  "count": 1,
  "next_page": null,
  "previous_page": null,
  "results": [
    {
      "id": 17,
      "platform": 1,
      "name": "Default Pipeline",
      "code": "default",
      "is_default": true,
      "rotten_days": 30,
      "stages": [
        {
          "id": 101,
          "code": "new",
          "name": "New",
          "probability": 10,
          "sort_order": 0,
          "is_won": false,
          "is_lost": false
        },
        {
          "id": 102,
          "code": "qualified",
          "name": "Qualified",
          "probability": 25,
          "sort_order": 1,
          "is_won": false,
          "is_lost": false
        },
        {
          "id": 103,
          "code": "proposal",
          "name": "Proposal",
          "probability": 50,
          "sort_order": 2,
          "is_won": false,
          "is_lost": false
        },
        {
          "id": 104,
          "code": "negotiation",
          "name": "Negotiation",
          "probability": 75,
          "sort_order": 3,
          "is_won": false,
          "is_lost": false
        },
        {
          "id": 105,
          "code": "won",
          "name": "Won",
          "probability": 100,
          "sort_order": 4,
          "is_won": true,
          "is_lost": false
        },
        {
          "id": 106,
          "code": "lost",
          "name": "Lost",
          "probability": 0,
          "sort_order": 5,
          "is_won": false,
          "is_lost": true
        }
      ],
      "metadata": {},
      "created_at": "2026-05-01T09:00:00.000000Z",
      "updated_at": "2026-05-01T09:00:00.000000Z"
    }
  ]
}
```

> **Pagination envelope.** Every list endpoint returns `{count, next_page, previous_page, results}` where `next_page` and `previous_page` are integer page numbers (or `null` at the edges). Pass `?page=2` to walk forward.

> **Reference stages by `code`, not `id`.** Stage `id` values differ between environments (dev vs. staging vs. prod); `code` is stable. Save the pipeline `id` (`17`) for the deal payload below; use `code` everywhere else.

---

### Step 3: Open a deal in the "new" stage

A **Deal** ties a person to a pipeline stage and a monetary value. On create, the `stage` must belong to `pipeline`, both must belong to your org, and `status` / `closed_at` are service-managed — the server sets them.

```bash
curl -X POST https://api.iblai.app/dm/api/crm/deals/ \
  -H "Authorization: Api-Token $IBLAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Acme — Platform Rollout 2026",
    "description": "Initial conversation about a 200-seat rollout.",
    "person": "8f2a1c4d-9b3e-4a7f-9c2d-1e5b6a7f8c9d",
    "pipeline": 17,
    "stage": 101,
    "lead_value": 48000,
    "currency": "USD",
    "expected_close_date": "2026-09-30"
  }'
```

**Response — `201 Created`:**

```json
{
  "id": 5821,
  "platform": 1,
  "title": "Acme — Platform Rollout 2026",
  "description": "Initial conversation about a 200-seat rollout.",
  "lead_value": "48000.00",
  "currency": "USD",
  "status": "open",
  "lost_reason": "",
  "expected_close_date": "2026-09-30",
  "closed_at": null,
  "person": "8f2a1c4d-9b3e-4a7f-9c2d-1e5b6a7f8c9d",
  "organization": null,
  "pipeline": 17,
  "stage": 101,
  "source": null,
  "owner": 318,
  "tags": [],
  "metadata": {},
  "created_at": "2026-06-04T14:25:03.117204Z",
  "updated_at": "2026-06-04T14:25:03.117204Z"
}
```

The deal opens with `status: "open"` and `closed_at: null`. `owner` defaults to the calling user (here, user id `318`) when you don't supply one.

---

### Step 4: Move the deal forward

Direct writes to `stage` via `PATCH /deals/{id}/` are allowed for repositioning within a pipeline, but the canonical way to transition is `POST /deals/{id}/move-stage/`. The action accepts either `stage_id` or `stage_code` — prefer `stage_code` so payloads stay portable across environments.

```bash
curl -X POST https://api.iblai.app/dm/api/crm/deals/5821/move-stage/ \
  -H "Authorization: Api-Token $IBLAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"stage_code": "qualified"}'
```

**Response — `200 OK`:**

```json
{
  "id": 5821,
  "platform": 1,
  "title": "Acme — Platform Rollout 2026",
  "description": "Initial conversation about a 200-seat rollout.",
  "lead_value": "48000.00",
  "currency": "USD",
  "status": "open",
  "lost_reason": "",
  "expected_close_date": "2026-09-30",
  "closed_at": null,
  "person": "8f2a1c4d-9b3e-4a7f-9c2d-1e5b6a7f8c9d",
  "organization": null,
  "pipeline": 17,
  "stage": 102,
  "source": null,
  "owner": 318,
  "tags": [],
  "metadata": {},
  "created_at": "2026-06-04T14:25:03.117204Z",
  "updated_at": "2026-06-04T14:31:47.882901Z"
}
```

> **Side effects of `move-stage/`.** This action does more than swap a foreign key:
> - A **system Activity** is written under this deal: `type="note"`, `title="Stage changed"`, `comment="New → Qualified"`. It will appear in the deal's activity timeline (Section 10).
> - A **`CRM_DEAL_STAGE_CHANGED` notification** is queued for the deal's owner. Wire your in-app inbox to this notification type to surface real-time pipeline movement (Section 12).
> - `Deal.status` is recomputed from the destination stage's `is_won` / `is_lost` flags. Since `qualified` is neither, status stays `"open"`.

---

### Step 5: Close the deal as won

Skip the intermediate stages for the quickstart and jump straight to won. The `won/` action picks the first `is_won=True` stage in the pipeline by `sort_order` (here, the seeded `won` stage at id `105`). Pass `stage_code` only if you have multiple won stages and need a specific one.

```bash
curl -X POST https://api.iblai.app/dm/api/crm/deals/5821/won/ \
  -H "Authorization: Api-Token $IBLAI_API_KEY" \
  -H "Content-Type: application/json"
```

**Response — `200 OK`:**

```json
{
  "id": 5821,
  "platform": 1,
  "title": "Acme — Platform Rollout 2026",
  "description": "Initial conversation about a 200-seat rollout.",
  "lead_value": "48000.00",
  "currency": "USD",
  "status": "won",
  "lost_reason": "",
  "expected_close_date": "2026-09-30",
  "closed_at": "2026-06-04T14:36:12.044188Z",
  "person": "8f2a1c4d-9b3e-4a7f-9c2d-1e5b6a7f8c9d",
  "organization": null,
  "pipeline": 17,
  "stage": 105,
  "source": null,
  "owner": 318,
  "tags": [],
  "metadata": {},
  "created_at": "2026-06-04T14:25:03.117204Z",
  "updated_at": "2026-06-04T14:36:12.044188Z"
}
```

The deal is now in the won stage (`105`), `status` is `"won"`, and `closed_at` is stamped to an ISO 8601 datetime. A second system Activity (`Qualified → Won`) is appended to the timeline and a `CRM_DEAL_STAGE_CHANGED` notification fires.

To reopen a deal later, use `move-stage/` to send it back to any non-terminal stage — the server will clear `closed_at` and reset `status` to `"open"` automatically.

---

### What's Next

You have just exercised the spine of the CRM. From here:

- **Section 8 — Person Onboarding (link / invite / merge)**: bind a person to a platform user, send an invitation, or merge duplicate persons.
- **Section 9 — Deal Lifecycle**: pipeline and stage administration, the `move-stage/` / `won/` / `lost/` state machine, and the auto-Activity audit trail.
- **Section 11 — Tagging**: create tags, attach them to persons / organizations / deals, and filter list endpoints by tag.
- **Section 12 — Notifications**: the three CRM notification types, payload shapes, and recipient routing.
- **Section 7 — API Reference**: full endpoint catalog with request / response schemas, filters, and RBAC requirements.

---
