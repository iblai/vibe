# iblai-api-hosting

> Deploy and manage ibl.ai-hosted web apps headlessly via the Data Manager API — upload a build as a zip, poll the deployment until it is live, read the deployed URL, attach and verify custom domains, and delete projects. Covers the deployment lifecycle, the DNS records a domain needs, the public project-to-organization lookup a hosted app calls at boot, and the admin-only access rule. Use when deploying an app, checking a deploy's status, wiring a custom domain, or debugging a failed push; see /iblai-vibe-ops-deploy for the guided runbook.

# iblai-api-hosting

> **With a runbook:** `/iblai-vibe-ops-deploy` walks a human through building and
> shipping an app step by step — this skill is the headless twin (same endpoints,
> no narrative). That runbook writes its URLs with the older `ai-mentor` prefix;
> both prefixes resolve to the same views.

Deploy a built web app to ibl.ai hosting and manage it entirely over HTTP. One
family under `providers/vercel/hosting/` covers the whole lifecycle:

- **Deploy** — POST a zip of the build, get `202 Accepted`, poll until live.
- **Read** — list an owner's projects, or poll one project for build state, the
  live URL, attached domains and (on failure) the tail of the build log.
- **Domains** — attach a custom domain, read the DNS records it needs, poll until
  verified, detach it.
- **Boot lookup** — a public, unauthenticated endpoint a hosted app calls once at
  start-up to learn which organization it fronts.

## The schema is the contract

These endpoints live on the **Data Manager** service and its live OpenAPI schema
is the single source of truth — the URLs and fields below exist for orientation
and **can drift between releases**. Validate before building requests:

- **Schema (raw):** `https://api.iblai.app/dm/api/docs/schema/`
- **Swagger UI:** `https://api.iblai.app/dm/api/docs/`

```bash
curl -sS "https://api.iblai.app/dm/api/docs/schema/" -o /tmp/iblai_schema.yaml
grep -nE "vercel/hosting" /tmp/iblai_schema.yaml
```

Treat any mismatch between this skill and the schema as a bug in the skill — the
deployed schema wins.

## Auth & conventions

- **`dm_url`** = `https://api.iblai.app/dm` — these are **Data Manager** endpoints
  reached through the gateway's `/dm` prefix.
- **`base`** = `{dm_url}/api/ai-agent/orgs/{org}/users/{username}/providers/vercel/hosting`
  for every endpoint except the public boot lookup.
- **Header:** `Authorization: Api-Token $IBLAI_API_KEY` on every request except the
  public boot lookup, which takes none.
- **Placeholders:**
  - `{org}` = your organization key = `$IBLAI_ORG`. On the wire it is the `orgs/{org}`
    path segment and the `platform_key` response field — same value.
  - `{username}` = the **owner** of the project, not necessarily the caller. An
    organization admin acts on a member's path.
  - `{pk}` = the integer project id, i.e. the `id` field from a list or deploy response.
- **`provider`** — every endpoint below accepts an optional `provider` query param.
  It defaults to `vercel` and `vercel` is the only accepted value; anything else is
  a `400`. You can safely omit it.
- **Prefix twin:** `{dm_url}/api/ai-mentor/...` resolves to exactly the same views.
  The `ai-agent` spelling used here is canonical; `ai-mentor` is marked deprecated in
  the generated schema but still works.
- **Admin only.** See *Access* below — this is not a member-reachable family, and
  granting the RBAC verbs does not make it one.
- Not connected yet? Run **`/iblai-api-login`** first.

## Access

Every endpoint under `base` requires the caller to be an **organization admin** of
`{org}`, an organization-scoped Platform API Token for `{org}`, or a server-to-server
service account. A member is refused even when a custom role grants the verbs — the
admin rule is checked independently of the grant, because hosting can draw on an
ibl-supplied hosting account and the deploy is billed to the organization.

The RBAC verbs, for building a role, are under `Ibl.Mentor/HostingProjects/` at
resource `/platforms/{id}/hosting-projects/`:

| Operation | Verb |
|---|---|
| `GET deployment/` | `Ibl.Mentor/HostingProjects/list` |
| `POST deployment/` | `Ibl.Mentor/HostingProjects/action` |
| `GET deployment/{pk}/` | `Ibl.Mentor/HostingProjects/read` |
| `DELETE deployment/{pk}/` | `Ibl.Mentor/HostingProjects/delete` |
| `GET dns/` | `Ibl.Mentor/HostingProjects/read` |
| `POST dns/` | `Ibl.Mentor/HostingProjects/write` |
| `DELETE dns/` | `Ibl.Mentor/HostingProjects/write` |

Note `DELETE dns/` enforces `write`, not `delete`, despite what the `delete` verb's
registered description suggests. The table is what the server does.

## Reads

### Projects

- **GET** `{base}/deployment/` — list every hosting project owned by `{username}`,
  newest first. No pagination or filtering. Returns
  `{"projects": [...], "stale": false, "upstream_error": null}`.
  Each project carries `id`, `name`, `url`, `vercel_alias`, `last_ready_state`,
  `push_state`, `deployment_hash`, `created_at`, and a `latest_deployment` object
  (`uid`, `state`, `created`, `url`) — or `null` for any project the hosting
  provider did not return.
  **This endpoint answers `200` even when the provider is unreachable**: you get the
  last-known snapshot with `stale: true` and `upstream_error` filled. Treat that as
  "this data is old", never as a failed request. An owner with no projects gets an
  immediate empty list that is never stale.

- **GET** `{base}/deployment/{pk}/` — poll one project. Returns every list field
  **except** `latest_deployment`, plus `stale`, `upstream_error`, `extras_error`,
  and a `deployment` object. Once the push has landed and the build has finished it
  also carries `project` (framework, node version, production URL), `domains[]`,
  `recent_deployments[]` (up to 5) and — only when the build failed —
  `build_log_tail` (the last 20 log lines).
  `deployment` is `null` until a deploy has been recorded, `{"id", "ready_state":
  "NOT_FOUND", "aliases": []}` if the project was removed outside ibl.ai, and
  otherwise `{"id", "url", "ready_state", "target", "inspector_url", "created_at",
  "building_at", "ready_at", "alias_assigned", "aliases": [...], "error_code",
  "error_message"}`. `aliases` is sorted shortest-first, so `aliases[0]` is the
  stable production host.
  → Full field tables and every response shape: [`references/fields.md`](references/fields.md).

### Domains

- **GET** `{base}/dns/?project={pk}` — list the custom domains attached to a project.
  Returns `{"domains": [{"name", "apex_name", "verified", "created_at"}]}`.
- **GET** `{base}/dns/?project={pk}&domain={fqdn}` — inspect one domain. Returns
  `name`, `apex_name`, `verified`, `misconfigured`, `configured_by`, the provider's
  raw `verification[]` array, and `required_records[]` — the exact DNS records to
  create at the registrar, each `{type, name, value, reason}`.
  **This read has a side effect:** an unverified domain is re-checked against the
  live DNS on every call, so it is the poll target after you create the records, not
  a cheap lookup. `domain` must be lowercase, ≤253 chars, with an alphabetic TLD;
  Unicode domains are not accepted.

### Boot lookup (public)

- **GET** `{dm_url}/api/ai-agent/providers/vercel/hosting/projects/{vercel_project_id}/`
  — map a hosting project id to the organization it serves. Returns exactly
  `{"platform_key": "acme"}`, or `404` for an unknown or malformed id.
  **No authentication, no token, no rate limit.** A hosted app calls this once per
  server instance at boot, with its own provider-injected project id, because it has
  no credential yet and a read-only filesystem. It returns only the organization key.
  Answers are cached for about 60 seconds; a miss is never cached, so an app that
  asks a moment too early gets the right answer on its next try. Being unthrottled is
  deliberate — serverless egress IPs are shared across customers, so a per-IP bucket
  would lock out every hosted app at once. Do not poll it.

## Writes

### Deploy

- **POST** `{base}/deployment/` — upload a build and start a deploy.
  **`multipart/form-data` only** — a JSON body is rejected with `415`.

  | Field | Type | Required | Notes |
  |---|---|---|---|
  | `file` | binary | **yes** | The build as a zip, ≤50 MB compressed |
  | `project` | string | **yes** | `^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$`, ≤64 chars |
  | `framework` | enum | no | `static` (default) or `nextjs` |
  | `deployment_hash` | string | no | 64 lowercase hex chars, or blank |

  Returns **`202 Accepted`** with the project object (`push_state: "pending"`,
  `url: null`) — nothing has reached the hosting provider yet. Poll
  `GET {base}/deployment/{pk}/` from here.

  The archive is checked synchronously. `.git/`, `node_modules/`, `__MACOSX/` and
  `.next/` trees are stripped, as are `.DS_Store` and `iblai.env` files, before any
  limit is applied; what survives must be ≥1 file, ≤2000 files and ≤200 MB
  uncompressed, with no absolute, `..`-relative or Windows-drive member paths.
  **`.next/` being stripped is load-bearing for `framework=nextjs`**: ship source and
  let the provider build it, because a bundled build output is discarded.
  Corruption *inside* a member is not caught here — it surfaces later as
  `push_state: "failed"`.

  Re-posting the same `project` slug redeploys in place: same `id`, same row.
  `deployment_hash` is recorded on success **including when blank**, so a push
  without one clears a previously recorded hash — "compare hashes to decide whether
  to redeploy" is only safe if every client sends one.

- **DELETE** `{base}/deployment/{pk}/` — **Confirm with the user first.** Deletes the
  hosting project and every custom domain attached to it, and retires the local
  record. `204`, empty body. Deleting a project already removed upstream succeeds.
  The `id` is not reusable; the `project` slug is.

### Domains

- **POST** `{base}/dns/` — attach a custom domain. Body `{"project": {pk}, "domain":
  "app.example.com"}`. Returns `201` with the same shape as the domain detail read,
  including `required_records[]`.
  The domain is reserved across **all** ibl.ai app domains, not just hosting ones, so
  a clash with another app's domain fails here without touching the provider. A
  provider-side failure rolls the reservation back, so a failed attach leaves nothing
  behind and is safe to retry.
  Attaching does not make the domain live — create `required_records` at the
  registrar, then poll the domain detail read until `verified: true` and
  `misconfigured: false`. Propagation is the registrar's clock.

- **DELETE** `{base}/dns/?project={pk}&domain={fqdn}` — **Confirm with the user
  first.** Detach a custom domain. `204`, empty body. Both query params are required.
  Detaching a domain the provider no longer knows about succeeds.

## Example

Deploy a build, poll until it is live, then read the URL:

```bash
dm_url="https://api.iblai.app/dm"
base="$dm_url/api/ai-agent/orgs/$IBLAI_ORG/users/$IBLAI_USERNAME/providers/vercel/hosting"

# 1. deploy — 202, returns the project id
pk=$(curl -s -X POST "$base/deployment/" \
  -H "Authorization: Api-Token $IBLAI_API_KEY" \
  -F "file=@dist.zip" -F "project=my-app" -F "framework=static" \
  | jq -r '.id')

# 2. poll until terminal
while :; do
  body=$(curl -s "$base/deployment/$pk/" -H "Authorization: Api-Token $IBLAI_API_KEY")
  push=$(jq -r '.push_state' <<<"$body")
  state=$(jq -r '.deployment.ready_state // ""' <<<"$body")
  echo "push=$push ready=$state"
  [ "$push" = "failed" ] && { jq -r '.push_error' <<<"$body"; break; }
  case "$state" in READY|ERROR|CANCELED) break ;; esac
  sleep 3
done

# 3. the live URL (null until READY)
jq -r '.url' <<<"$body"

# 4. attach a custom domain and read the records to create
curl -s -X POST "$base/dns/" -H "Authorization: Api-Token $IBLAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"project\": $pk, \"domain\": \"app.example.com\"}" \
  | jq '.required_records'
```

## Notes

- **`url` is `null` until the build is `READY`** — and it blanks again while a
  redeploy is in flight. This is deliberate: the hosts named for an unfinished build
  are revised when it goes live, so an early URL would 404 and then move.
  `last_ready_state` always travels in the same response, so the body never
  contradicts itself.
- **Terminal states are `READY`, `ERROR`, `CANCELED`.** Stop polling at any of them.
- **Poll cost is not flat.** While a deploy is in flight the poll is one upstream
  call; once the push has landed and the build is terminal it becomes three to five.
  Poll every 2–5 s while in flight, then stop. Hammering a finished project is what
  trips the provider's rate limit.
- **Four strings, two of them addressable.** `name` is your slug;
  `vercel_project_name` is a derived identifier that is **not a hostname** and may be
  truncated; `vercel_alias` is the confirmed host without a scheme; `url` is
  `https://` + that alias while the latest build is READY. Never rebuild a URL from
  `vercel_project_name` — read `url`, `vercel_alias`, or `deployment.aliases[0]`.
- **The deployed host is also the Stripe redirect allowlist.** A Stripe address the
  platform sends a browser back to — the app paywall's Connect with Stripe
  `return_url`, a hosted checkout's `success_url`/`cancel_url` — is accepted only for
  a confirmed hosting alias or an attached custom domain of the same organization
  (plus localhost). A URL reconstructed from the project name gets rejected. See
  `/iblai-vibe-monetization-app-paywall`.
- **`409` on deploy means a push is already in flight** for that project. Poll until
  terminal and retry; a stuck push clears itself after about 15 minutes, after which
  it reads as `failed` and a new deploy is accepted.
- **`extras_error` is not `stale`.** `extras_error` set with `stale: false` means the
  build status is live and only the extra sections (domains, recent deployments)
  failed to load. `stale: true` means the whole body is a stored snapshot.
- **Two different `429`s.** `{"detail": ...}` is ibl.ai throttling you — slow down.
  `{"error": ..., "code": ...}` is the hosting provider's own limit relayed through;
  honour `Retry-After` when present, and treat its absence as "still rate limited",
  not "outage".
- **Timestamps are mixed.** `created_at`/`updated_at` on the project are ISO-8601;
  provider-sourced values inside `deployment`, `project`, `latest_deployment`,
  `recent_deployments` and the domain list are **epoch milliseconds**.
- **`push_error` is provider text, not an enum.** Display it; never branch on it.
- **There are no server-side retries** anywhere in this family. Every retry is yours.
- **`404` from a project endpoint does not mean "no such project"** for an
  unauthorized caller — authorization is checked before the lookup, so a non-admin
  always gets `403` and can never enumerate ids.
- For the list of an organization's custom domains across every app type, see
  `/iblai-api-org`.

## Reference material

The endpoints above are the primary; these carry the exhaustive lookup material.

- [`references/fields.md`](references/fields.md) — every field of the project, deployment, extras and domain objects, with types, and the four shapes `deployment` can take.
- [`references/errors.md`](references/errors.md) — the full error surface: every status, the condition that produces it, what the caller should do, and how upstream provider failures are translated.