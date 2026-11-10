---
name: iblai-api-ontology
description: Read and write the records an ibl.ai ontology keeps on the ibl.ai platform headlessly via the Data Manager API — JSON records filed by kind and key for one organization (an on-premise iblai-ontology's connected services, discovered tables, health checks, safety reports, provisioning runs, sync schedules and backend address), and its roles, kept as RBAC roles with one policy each under `/custom/ontology/`. Covers listing with a `where` filter and an `order`, paging, the date window, inserting one or many all-or-nothing, create-or-replace, merge, delete by key or by filter, the five RBAC verbs, how a role's grants map to policy resources, limits and errors. Use when inspecting, repairing or scripting an ontology's registry, sync schedules or roles, or the user mentions ontology records, `ONTOLOGY_DATA_STORE=dm`, or a service registry, sync schedules or ontology roles kept on the platform; for an app's own tables see /iblai-api-database, for the roles and policies API itself see /iblai-api-rbac.
metadata:
  kind: api
---

# iblai-api-ontology

An iblai-ontology (`iblai/ontology`) is the on-premise
knowledge layer that exposes an organization's own systems to agents over MCP.
Run with `ONTOLOGY_DATA_STORE=dm`, it keeps its configuration on the platform
instead of on its own host: its roles as the organization's RBAC roles, each
with one policy under `/custom/ontology/` (see *Roles*), and everything else
as **ontology records**, the family under `/v1/ontology` this skill covers.

A record is a small JSON document filed under a **kind** and a **key**. The
platform stores it, filters and orders by its fields, and returns it; it never
interprets it. The ontology writes these through its own client, so use this
skill to look at what an ontology stored, to script against it, or to repair it
— not as an app's database (`/iblai-api-database` is that).

## The schema is the contract

These endpoints live on the **Data Manager** service and its live OpenAPI schema
is the single source of truth — the URLs and fields below can drift between
releases. Validate before building requests:

- **Schema (raw):** `https://api.iblai.app/dm/api/docs/schema/`
- **Swagger UI:** `https://api.iblai.app/dm/api/docs/`

```bash
curl -sS "https://api.iblai.app/dm/api/docs/schema/" -o /tmp/iblai_schema.yaml
grep -nE "/v1/ontology" /tmp/iblai_schema.yaml
```

A Data Manager that has the feature but has not run its migration answers `503`
`{"error": "Ontology records are not available on this instance yet"}` on
every route; one older than the feature answers `404`.

## Auth & conventions

- **`dm_url`** = `https://api.iblai.app/dm` — Data Manager endpoints behind the
  gateway's `/dm` prefix.
- **`base`** = `{dm_url}/v1/ontology/kinds/{kind}/records` — no trailing slash
  on any route.
- **Header:** `Authorization: Api-Token $IBLAI_API_KEY` (a Platform API Token of
  the organization), or a member's session token,
  `Authorization: Token <dm_token>`. Either way the call is judged by RBAC —
  see *Access*.
- **The organization is the credential's own.** Send `iblai-org: $IBLAI_ORG`
  (the org key) to confirm it if you like; any other key is `403`
  (`{"detail": "iblai-org does not match the token's platform."}`). A
  server-to-server service account must send it.
- **Placeholders:** `{kind}` = the record's type; `{record_key}` = one record's
  key within that kind.
- **Lists** answer `{"count", "next_page", "previous_page", "results"}`; page
  with `page` and `page_size` (50 by default, 500 at most).
- Not connected yet? Run **`/iblai-api-login`** first.
- Deleting records takes an ontology's services or schedules away from it —
  **confirm with the user first**.

## Concepts

- **A kind** is one lowercase word (`^[a-z][a-z0-9_]{0,62}$`, no `__`). An
  ontology uses one kind per thing it stores:

  | `kind` | One record is | `key` |
  |---|---|---|
  | `sync_schedule` | a sync schedule (`cron`, `source`, `tool` or `service` + `table`, `output`, `enabled`) | the schedule's name |
  | `services_service` | a connected service; its connection is ciphertext only the ontology can read | the service's id; `unique_key` is its name |
  | `services_servicetable` | one discovered table of a service (`service_id`, `position`, `payload`) | an id |
  | `services_servicehealth` | one health check (`service_id`, `connected`, `latency_ms`, `checked_at`) | an id |
  | `discovery_safetyreport` | one read-only safety verification (`service_name`, `status`, `details`) | an id |
  | `provisioning_provisioningrun`, `provisioning_provisioningstep` | an approval run and its steps (`service_id`; `run_id`, `position`) | an id |
  | `role` | what a role carries besides its grants (`display_name`, `agents`, `concurrency_limits`); the grants are a policy, see *Roles* | the role's name |
  | `backend` | where the organization's ontology backend is reached (`url`, a public https address), which the hosted Ontology Frontend reads with the signed-in admin's token | `default` |
  | `setup` | a marker that the example roles were written once (`roles`), so deleted ones stay deleted | `roles` |

- **A key** is 1–255 of `A-Z a-z 0-9 _ . : -`, unique within the organization
  and the kind. The same key under another kind, or in another organization, is
  another record.
- **`unique_key`** is optional: a second name unique within the organization
  and the kind (two services cannot share a name). `null` when a kind has none.
- **`data`** is any JSON object. A related record is named by its key inside
  `data` (`"service_id": "<the service's key>"`); the platform does not check
  it, and deleting a record deletes nothing else.
- **A record** comes back as
  `{"key", "unique_key", "data", "created_at", "updated_at"}`.

## Access

Everything is RBAC. Organization admins hold every verb below; anyone else
holds what a policy grants them, and no seeded role carries any. A Platform
API Token acts with its creator's grants, or, in token-policies mode, with the
policies attached to the token itself.

| Operation | RBAC verb (resource `/platforms/{id}/ontology-records/{kind}/`) |
|---|---|
| `GET {base}` | `Ibl.Mentor/OntologyRecords/list` |
| `GET {base}/{record_key}` | `Ibl.Mentor/OntologyRecords/read` |
| `POST {base}` | `Ibl.Mentor/OntologyRecords/action` |
| `PATCH {base}/{record_key}` | `Ibl.Mentor/OntologyRecords/write` |
| `PUT {base}/{record_key}` | `Ibl.Mentor/OntologyRecords/action` + `write` |
| `DELETE {base}`, `DELETE {base}/{record_key}` | `Ibl.Mentor/OntologyRecords/delete` |

- **All kinds:** a policy on `/platforms/{id}/ontology-records/`.
- **One kind only:** a policy on `/platforms/{id}/ontology-records/{kind}/`
  reaches that kind and no other.
- The token an ontology itself uses (`IBLAI_ADMIN_TOKEN`) needs all five verbs
  here. For its roles it also manages roles and policies (`Ibl.Core/Roles/*`,
  `Ibl.Core/Policies/*`) and must itself hold `/custom/`: the platform refuses
  a policy that grants more than its writer holds. Organization admins hold
  `/custom/` through the seeded `Custom RBAC Manager` policy, so use an
  admin's own token: a Platform API Token that acts with its creator's grants
  (not one in token-policies mode), or the admin's session token.

## Roles

An ontology role is one of the organization's own RBAC roles
(`/iblai-api-rbac`) that holds an `Ontology/…` verb. What it reaches is the
resources of **one policy, named `Ontology: <role name>`**, bound to that role
with no users or groups, under the namespace the platform reserves for a
client's own verbs, `/custom/`. The platform enforces none of it: the ontology
reads the policy and applies it on its own gateway.

| The role may | Policy resource | Verb the role must hold |
|---|---|---|
| use toolset `T` / every toolset | `/custom/ontology/toolsets/T/` / `/custom/ontology/toolsets/` | `Ontology/Toolsets/action` |
| query cache table `X` / every table | `/custom/ontology/tables/X/` / `/custom/ontology/tables/` | `Ontology/Tables/read` |
| read the memory folder `/ontology/a/b/**` / all of memory | `/custom/ontology/memory/a/b/` / `/custom/ontology/memory/` | `Ontology/Memory/read` |
| read one memory file, `/ontology/a/_index.md` | `/custom/ontology/memory/a/_index*/` | `Ontology/Memory/read` |
| open the ontology console | `/custom/ontology/console/` | `Ontology/Console/action` |
| read any subject's records, not only the caller's own | `/custom/ontology/subjects/` | `Ontology/Subjects/read` |

- A role the ontology creates holds `actions: ["Ontology/*"]`, so its policy
  alone says what it reaches. A role made by hand with fewer verbs is read as
  it stands: a resource counts only when the role holds its verb, and the
  ontology never changes a role's verbs.
- A resource cannot spell a dot, `$` or braces. A trailing `*` on a file's last
  segment stands for its `.md`; the segment `USER_EMPLID` stands for the
  caller's own id (`${USER_EMPLID}` in the ontology).
- A resource on a parent (`/custom/ontology/`, `/custom/`) grants everything
  beneath it. Any other shape — a `*` elsewhere, a path deeper than its kind —
  is skipped, never widened.
- Without `/custom/ontology/subjects/` a role is self-service: it may read the
  caller's own subject only.
- **Only that one policy is read.** Another policy bound to the same role
  changes nothing for the ontology, and stops its console from deleting the
  role (the platform would delete that policy with it).
- Who holds a role is not here: an agent's MCP connection names it
  (`X-Iblai-Role`), or a user's Entra token does.
- The ontology reads its roles at most once a minute, so a change made here
  shows within that. A name must be free: it will not adopt a role that holds
  no `Ontology/…` verb.

A role's policy, and one more toolset granted by sending the list back longer:

```bash
dm_url="https://api.iblai.app/dm"
auth="Authorization: Api-Token $IBLAI_API_KEY"   # a token an admin created
policy=$(curl -s -G "$dm_url/api/core/rbac/policies/" -H "$auth" \
  --data-urlencode "platform_key=$IBLAI_ORG" --data-urlencode "name=Ontology: Executive" \
  | jq '.results[] | select(.name == "Ontology: Executive")')
echo "$policy" | jq '.resources'

echo "$policy" | jq --arg org "$IBLAI_ORG" \
  '{platform_key: $org, resources: (.resources + ["/custom/ontology/toolsets/enrollment-tools/"])}' \
  | curl -s -X PATCH "$dm_url/api/core/rbac/policies/$(echo "$policy" | jq '.id')/" \
      -H "$auth" -H "Content-Type: application/json" -d @-
```

## Reads

- **GET** `https://api.iblai.app/dm/v1/ontology/kinds/{kind}/records` — the
  organization's records of one kind: the list envelope, each result a record.
  A kind nothing was stored under is an empty list. Query parameters:
  - `where` — a JSON object on fields of `data`, every condition must hold. A
    string, number or boolean means equals (`{"status": "active"}`); a list
    means one of (`{"service_id": ["a1", "b2"]}`); `null` means the field is
    null or absent (`{"completed_at": null}`). A number is not the string that
    spells it. URL-encode the JSON.
  - `order` — fields of `data`, comma separated, `-` before one for descending
    (`order=-checked_at`). Numbers order as numbers, text as text; a record
    without the field comes last either way. Ties, and a list with no `order`,
    go by key.
  - `page`, `page_size`.
  - A window on `created_at`, applied only when sent: `date_filter` (`today`,
    `7d`, `30d`, `90d`, `all_time`, `custom`) or `start_date` + `end_date`
    (`YYYY-MM-DD`).

  A field name in `where` or `order` follows the kind's rule (lowercase, no
  `__`); anything else, a nested value or `where` that is not an object is
  `400`.
- **GET** `https://api.iblai.app/dm/v1/ontology/kinds/{kind}/records/{record_key}`
  — one record. `404` when the organization has none of that kind and key.

## Writes

- **POST** `https://api.iblai.app/dm/v1/ontology/kinds/{kind}/records` —
  insert one record or a list of them.

  ```json
  [
    {"key": "nightly-students", "data": {"cron": "0 2 * * *", "source": "sis-source", "tool": "get-students"}},
    {"key": "crm-people", "unique_key": null, "data": {"cron": "0 */6 * * *", "service": "crm", "table": "public.people"}}
  ]
  ```

  `201` `{"created": 2}`. All or nothing: a key or unique key already taken,
  or repeated inside the request, is `409` and inserts none of them. `400` for
  a record without `key` or `data`, a key outside the allowed characters, or
  `data` that is not an object.
- **PUT** `https://api.iblai.app/dm/v1/ontology/kinds/{kind}/records/{record_key}`
  — create the record, or replace it whole: `{"data": {...}, "unique_key":
  "..."}`. A `unique_key` left out is none. `201` with the record when created,
  `200` when replaced; `409` when another record has that unique key.
- **PATCH** `https://api.iblai.app/dm/v1/ontology/kinds/{kind}/records/{record_key}`
  — merge into the record: each key of the `data` sent replaces the stored
  one, every other key is kept (one level deep: a nested object is replaced,
  not merged). `unique_key` is kept when left out and cleared by `null`. `200`
  with the record; `404` when there is none; `409` on a taken unique key.
- **DELETE** `https://api.iblai.app/dm/v1/ontology/kinds/{kind}/records/{record_key}`
  — **Confirm with the user first.** Deletes one record: `204`, or `404`.
- **DELETE** `https://api.iblai.app/dm/v1/ontology/kinds/{kind}/records` —
  **Confirm with the user first.** Deletes every record of the kind that
  matches `where`, sent in the body: `{"where": {"service_id": ["a1"]}}`.
  `where` is required and follows the list's rules; `{"where": {}}` deletes
  every record of the kind. `200` `{"deleted": 3}`.

A request body is JSON of at most 2 MiB — larger is `413`, and a chunked body
without a `Content-Length` is `411`, both before anything is read. Split a
large insert into several requests.

## Example

List an ontology's sync schedules, pause one, and count the tables it
discovered for a service:

```bash
dm_url="https://api.iblai.app/dm"
kinds="$dm_url/v1/ontology/kinds"
auth="Authorization: Api-Token $IBLAI_API_KEY"   # a token an admin created
json="Content-Type: application/json"

# 1. the schedules, by name
curl -s "$kinds/sync_schedule/records?page_size=100" -H "$auth" | jq -r '.results[] | "\(.key)\t\(.data.cron)"'

# 2. pause one: only `enabled` changes, the rest of the schedule is kept
curl -s -X PATCH "$kinds/sync_schedule/records/nightly-students" -H "$auth" -H "$json" \
  -d '{"data": {"enabled": false}}'

# 3. the service called "crm", then how many tables were discovered for it
service=$(curl -s -G "$kinds/services_service/records" -H "$auth" \
  --data-urlencode 'where={"name": "crm"}' | jq -r '.results[0].key')
curl -s -G "$kinds/services_servicetable/records" -H "$auth" \
  --data-urlencode "where={\"service_id\": \"$service\"}" --data-urlencode 'page_size=1' | jq '.count'
```

The ontology's sync scheduler reads its schedules when it starts: restart it
after step 2 for the pause to take effect.

## Notes

- **The ontology is the writer.** Its own models decide what a kind's `data`
  holds, and a field it adds needs nothing here. Change records by hand only
  to repair or script something the ontology's own commands and screens do not
  cover; a record it cannot read back makes it fail loudly, not quietly.
- **No cascade.** Deleting a `services_service` record leaves its tables,
  health checks and runs behind. The ontology deletes those first, by
  `service_id`, then the service; do the same.
- **Not secret, but not readable either.** A service's
  `connection_config_encrypted` is ciphertext under a key that never leaves the
  ontology's host; the platform cannot decrypt it and neither can you.
- **`403`** is `{"error": "Permission denied"}` when the verb is missing, or
  `{"detail": "iblai-org does not match the token's platform."}`. **`400`**
  names the field at fault. **`409`** changed nothing.
- **Audit.** Every write lands in the organization's audit log with who made
  it, the kind, and the key or the number of records — never the data.
- **Deleting the organization** deletes its ontology records.
- **Not metered.** These calls run on the instance's default request throttles
  and spend no credits.
- **Not covered:** the roles and policies API itself (`/iblai-api-rbac`), the
  ontology's sync runs and audit log (they stay on its host), and the data it
  syncs (never on the platform).
