# Hosting response fields

Every field returned by the hosting endpoints, with its type. Responses are
**snake_case** throughout — the Data Manager re-keys the hosting provider's
camelCase before returning it.

Four blocks are exceptions and pass the provider's own key names straight through:
`latest_deployment`, `recent_deployments[]`, `domains[].verification[]` and
`deployment.aliases`. They happen to be lowercase single words, but treat them as
"whatever the provider returned", not as a stable ibl.ai contract.

## The project object

Returned by `GET deployment/` (inside `projects[]`), `POST deployment/` and
`GET deployment/{pk}/`.

| Field | Type | Notes |
|---|---|---|
| `id` | integer | The `{pk}` for the detail routes. Stable across redeploys. |
| `name` | string | The slug you sent as `project`. |
| `vercel_project_name` | string | Derived identifier, `{org}-{username}-{project}-{digest}`, truncated to one DNS label. **Not a hostname** — never build a URL from it. |
| `url` | string \| null | `https://` + the confirmed alias. **`null` unless the latest build is `READY`.** |
| `vercel_alias` | string | The confirmed production host, no scheme. `""` until confirmed. |
| `vercel_project_id` | string | The hosting provider's project id. `""` until the first successful push. This is the value a hosted app passes to the boot lookup. |
| `last_deployment_id` | string | `""` if never deployed. |
| `last_deployment_url` | string | Host, no scheme. |
| `last_ready_state` | string | `""` \| `QUEUED` \| `INITIALIZING` \| `BUILDING` \| `READY` \| `ERROR` \| `CANCELED` |
| `deployment_hash` | string | The 64-hex value from the last push, or `""`. |
| `push_state` | string | `""` \| `pending` \| `uploading` \| `pushed` \| `failed` |
| `push_error` | string | Provider-supplied text when `push_state` is `failed`. Display, never branch on it. |
| `username` | string | The owner. |
| `user_email` | string \| null | |
| `user_full_name` | string \| null | |
| `created_at` | string | ISO-8601. |
| `updated_at` | string | ISO-8601. |

`push_state` is computed when you read it. A `pending` or `uploading` project that
has not been touched for about 15 minutes reports `failed`, and a new deploy is
accepted from then on. Nothing is written to make that happen — the value simply
changes on read.

## `latest_deployment` — list responses only

Present on `GET deployment/` only, and `null` for any project the provider did not
return (including every project when `stale` is `true`). Provider key names:

| Field | Type |
|---|---|
| `uid` | string |
| `state` | string |
| `created` | integer — **epoch milliseconds** |
| `url` | string — host, no scheme |

`latest_deployment` (list) and `deployment` (detail) are different names with
different shapes. Do not model them as one type.

## `deployment` — detail responses only

Present on `GET deployment/{pk}/`. Four shapes:

**1. Live** — the normal case.

| Field | Type |
|---|---|
| `id` | string |
| `url` | string |
| `ready_state` | string — `QUEUED` \| `INITIALIZING` \| `BUILDING` \| `READY` \| `ERROR` \| `CANCELED` |
| `target` | string \| null |
| `inspector_url` | string \| null |
| `created_at` | integer — epoch milliseconds |
| `building_at` | integer \| null — epoch milliseconds |
| `ready_at` | integer \| null — epoch milliseconds |
| `alias_assigned` | boolean \| null |
| `aliases` | array of strings, **sorted shortest-first** |
| `error_code` | string \| null |
| `error_message` | string \| null |

`aliases[0]` is the stable production host and is exactly what the server records
as `vercel_alias`.

**2. Removed upstream** — `{"id", "ready_state": "NOT_FOUND", "aliases": []}`. The
project was deleted outside ibl.ai. Not an error, and note there is no `url`.

**3. Stored snapshot** — `{"id", "url", "ready_state", "aliases"}`, served alongside
`stale: true` when the provider could not be reached.

**4. `null`** — no deploy has been recorded yet. The endpoint returns early without
calling the provider, so `stale` is `false` and `upstream_error` is `null`. This is
what a freshly-accepted deploy looks like while it waits in the queue.

`aliases` is present in every non-null shape. That is deliberate — you can always
read it without a guard.

## Detail extras

These appear on `GET deployment/{pk}/` **only** once the push has landed and the
build has reached a terminal state, and only if the extra lookups succeeded. When
they fail, they are absent and `extras_error` is set — while the build status
itself stays live.

`project`:

| Field | Type |
|---|---|
| `framework` | string \| null |
| `node_version` | string \| null |
| `live` | boolean \| null |
| `production_url` | string \| null |
| `production_alias` | string — `""` if none |
| `created_at` | integer — epoch milliseconds |
| `updated_at` | integer — epoch milliseconds |

`domains` — array of `{"name": string, "verified": boolean}`.

`recent_deployments` — up to 5 entries, provider key names:
`{"uid": string, "state": string, "created": integer (epoch ms)}`.

`build_log_tail` — array of strings, the last 20 log lines. Present **only** when
`ready_state` is `ERROR`.

## Envelope fields

| Field | On | Type | Meaning |
|---|---|---|---|
| `stale` | list, detail | boolean | `true` means the whole body is a stored snapshot; the provider could not be reached. |
| `upstream_error` | list, detail | `{code, message}` \| null | Why the live read failed. Set together with `stale`. |
| `extras_error` | detail | `{code, message}` \| null | Only the extra sections failed. **The build status is still live.** Do not treat this as stale. |

## Domain objects

`GET dns/?project={pk}` returns `{"domains": [...]}` where each entry is:

| Field | Type |
|---|---|
| `name` | string |
| `apex_name` | string |
| `verified` | boolean |
| `created_at` | integer — epoch milliseconds |

`GET dns/?project={pk}&domain={fqdn}` and `POST dns/` return the detail shape:

| Field | Type | Notes |
|---|---|---|
| `name` | string | |
| `apex_name` | string \| null | |
| `verified` | boolean \| null | Ownership confirmed. |
| `verification` | array | **Raw provider passthrough.** Entries carry `type`, `domain`, `value`, `reason`. |
| `misconfigured` | boolean \| null | `true` means DNS is not yet pointing correctly. |
| `configured_by` | string \| null | e.g. `CNAME`. |
| `required_records` | array | The records to create at the registrar. |

Each `required_records` entry is `{"type", "name", "value", "reason"}`. The array is
composed as: one row per outstanding ownership challenge from `verification`, then
**either** one `A` row per provider IPv4 with `name: "@"` (when the domain is an
apex) **or** a single `CNAME` row whose `name` is the label(s) left of the apex
(when it is a subdomain). Never both.

## Deploy request fields

`POST deployment/`, `multipart/form-data` only.

| Field | Type | Required | Default | Validation |
|---|---|---|---|---|
| `file` | binary | **yes** | — | A zip, ≤50 MB compressed |
| `project` | string | **yes** | — | `^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$`, ≤64 chars |
| `framework` | enum | no | `static` | `static` \| `nextjs` |
| `deployment_hash` | string | no | `""` | `^[0-9a-f]{64}$` or blank |

Archive rules, all enforced before the `202`:

- Stripped before any limit is counted: any path segment under `.git/`,
  `node_modules/`, `__MACOSX/` or `.next/`; any file named `.DS_Store` or `iblai.env`.
- At least 1 file must survive.
- At most 2000 files.
- At most 200 MB uncompressed, from the archive's declared sizes.
- No member path may contain a backslash, start with a Windows drive prefix, start
  with `/`, or contain a `..` segment.

Corruption inside a member is not detected here. Only the background worker reads
member bytes, so a corrupt file surfaces later as `push_state: "failed"` on the poll
endpoint, never as a `400`.

## Domain query and body fields

| Field | Where | Type | Required | Validation |
|---|---|---|---|---|
| `project` | query (`GET`/`DELETE dns/`), body (`POST dns/`) | integer | **yes** | ≥1 |
| `domain` | query (`GET`/`DELETE dns/`), body (`POST dns/`) | string | optional on the list read, **required** everywhere else | `^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$` |

`domain` must be lowercase, carry at least one dot, end in an alphabetic TLD of two
or more characters, have no trailing dot, and contain no Unicode — internationalized
domains must be punycode-encoded before you send them.
