# iblai-api-spend-caps

> Manage an ibl.ai organization's LLM spend caps via the platform API — admin-imposed maximum LLM cost at three scopes (organization-wide, one agent, or one user on one agent), each with a rolling interval (day/week/month/year), a hard-block or alert-only enforcement mode, and near-limit alert thresholds. Read the current fill/zone for a user's applicable caps (safe to show end users, dollars hidden). Use when setting a budget ceiling on an org/agent/user, listing configured caps, checking how close a user is to their limit, or removing a cap. Spend counters are reconciled from ClickHouse and are read-only.

# iblai-api-spend-caps

Configure and read **LLM spend caps** for an organization. A spend cap is an
admin-imposed maximum LLM cost enforced at one of three scopes:

- `tenant` — the whole org (one cap per organization).
- **agent** — one agent (one cap per agent).
- **user_agent** — one user on one agent (an explicit per-user cap).

Each cap has a rolling **interval** (`day`/`week`/`month`/`year`, calendar
aligned), a dollar limit (`max_cost_usd`), an **enforcement** mode
(`block` refuses further chats once exceeded; `alert_only` only notifies), and
**alert thresholds** (fractions of the limit that fire a near-limit alert). When
a chat is blocked, the request is refused with **HTTP 429** and a body naming the
interval that was hit (dollar amounts are deliberately omitted). Spend counters
are reconciled from ClickHouse on a schedule and surfaced **read-only** so a UI
can render a progress bar.

## Auth & conventions

- **Base URL:** `https://api.iblai.app/dm` — these are Data Manager (DM)
  endpoints, so the **`/dm` prefix is required**; the `/api/ai-mentor/...` paths
  below are appended to it (e.g.
  `https://api.iblai.app/dm/api/ai-mentor/orgs/$IBLAI_ORG/spend-caps/tenant/`).
  Omitting `/dm` will not resolve.
- **Header:** `Authorization: Api-Token $IBLAI_API_KEY` on every request.
- **Path vars:** `{org}` = `$IBLAI_ORG` (the org key). `{mentor}` = an agent's
  `unique_id` (a UUID). `{user_id}` / `{username}` = the target user.
- **Endpoint prefix twin:** every path under `api/ai-mentor/` also resolves
  under `api/ai-agent/` (alias); either works, pick one and be consistent.
- **Permission tiers:** all cap **configuration** endpoints (organization / agent /
  user-agent read+write) require a **platform admin** (RBAC action prefix
  `Ibl.Mentor/SpendCaps/*`). The **status** endpoint is safe to show end users: any
  authenticated member may read **their own** status, and admins may read any
  user's — it returns only a coarse zone + percent, never raw dollars.
- **PUT is upsert:** writing a cap that doesn't exist yet returns **201
  Created**; writing over an existing one returns **200 OK**.
- DELETE and PUT (destructive / budget-changing) calls say "Confirm with the
  user first."
- Not connected yet? Run **`/iblai-api-login`** first to populate `IBLAI_ORG`,
  `IBLAI_USERNAME`, and `IBLAI_API_KEY`.

## Concepts

- **scope** — `tenant` | `agent` | `user_agent`. Set by the endpoint you call,
  never sent in the body. Narrower scopes carry `mentor_unique_id` (agent,
  user_agent) and `username` (user_agent).
- **interval_type** — `day` | `week` | `month` | `year`. The rolling window is
  calendar aligned (day = midnight, week = Monday, month = 1st, year = Jan 1).
- **enforcement** — `block` (default): once `current_spend_usd >= max_cost_usd`
  the next chat is refused with 429. `alert_only`: never blocks; only drives
  near-limit alerts.
- **alert_thresholds** — a list of fractions in `(0, 1]` (default `[0.8, 0.95]`
  = 80% and 95%). Each fires an admin alert once per period.
- **Read-only counters** — `current_spend_usd`, `remaining_usd`, `is_exceeded`,
  `period_started_at`, `last_reconciled_at` are reconciled from ClickHouse and
  ignored if sent in a write body.
- **Applicability** — for a given chat, the organization cap always applies; the agent
  cap applies when an agent is in play; the user's own per-agent cap applies when
  both agent and user are known. When several hard-block caps are exceeded, the
  **most specific** one (user > agent > organization) is reported.

## Reads

### Organization cap

- **GET** `/api/ai-mentor/orgs/{org}/spend-caps/tenant/` — the org-wide cap, or
  `404` if none is set. Returns the full cap object (see Schema).

### Agent caps

- **GET** `/api/ai-mentor/orgs/{org}/spend-caps/agents/[?mentor={mentor}]` — list
  agent-scoped caps for the org; pass `mentor` to filter to one agent. Returns a
  list of cap objects.
- **GET** `/api/ai-mentor/orgs/{org}/mentors/{mentor}/spend-cap/` — the single
  cap for one agent, or `404` if none. The agent is resolved org-scoped, so
  an agent from another org returns `404`.

### User-per-agent caps

- **GET** `/api/ai-mentor/orgs/{org}/mentors/{mentor}/spend-caps/users/[?username=&email=]`
  — list explicit per-user caps on one agent; optional `username` / `email`
  filters.
- **GET** `/api/ai-mentor/orgs/{org}/mentors/{mentor}/spend-caps/users/{username}/`
  — the one cap for a specific user on that agent, or `404`.

### User spend status (safe to show end users)

- **GET** `/api/ai-mentor/orgs/{org}/spend-caps/status/{user_id}/[?mentor={mentor}]`
  — the coarse status across every cap that applies to `{user_id}` (organization cap
  always; agent + that user's own per-agent cap when `mentor` is given). Any
  member may read their own; admins may read anyone's. Returns **only** a zone
  and percentage — never raw spend/limit dollars — so it is safe to surface to
  end users. Returns `400` if `mentor` is not a valid UUID.

  ```json
  {
    "status": "warning",
    "blocked": false,
    "caps": [
      {
        "scope": "tenant",
        "interval_type": "month",
        "enforcement": "block",
        "status": "warning",
        "percent_used": 82.5,
        "warning_threshold": 0.8,
        "mentor_unique_id": null,
        "username": null
      }
    ]
  }
  ```

  `status` is the worst zone across the applicable caps (`ok` → `warning` →
  `exceeded`); `blocked` is `true` when a hard-block cap is already exceeded (the
  next chat would be refused).

## Writes (platform admin — confirm with the user first)

All writes accept the same body fields: `max_cost_usd` (**required** on create,
> 0), `interval_type` (**required**), `enforcement` (default `block`),
`alert_thresholds` (default `[0.8, 0.95]`), `enabled` (default `true`). `scope`,
the agent, and the user are inferred from the URL — never the body. Counter
fields sent in the body are ignored.

### Organization cap

- **PUT** `/api/ai-mentor/orgs/{org}/spend-caps/tenant/` — create (201) or update
  (200) the org-wide cap.
- **DELETE** `/api/ai-mentor/orgs/{org}/spend-caps/tenant/` — remove it (`204`).

### Agent cap

- **PUT** `/api/ai-mentor/orgs/{org}/mentors/{mentor}/spend-cap/` — create/update
  the cap for one agent.
- **DELETE** `/api/ai-mentor/orgs/{org}/mentors/{mentor}/spend-cap/` — remove it.

### User-per-agent cap

- **PUT** `/api/ai-mentor/orgs/{org}/mentors/{mentor}/spend-caps/users/{username}/`
  — create/update the cap for one user on one agent (username comes from the URL,
  not the body).
- **DELETE** `/api/ai-mentor/orgs/{org}/mentors/{mentor}/spend-caps/users/{username}/`
  — remove it.

## Example

```bash
dm=https://api.iblai.app/dm
auth="Authorization: Api-Token $IBLAI_API_KEY"

# Set a $200/month hard-block tenant cap that alerts at 75% and 90%.
curl -X PUT "$dm/api/ai-mentor/orgs/$IBLAI_ORG/spend-caps/tenant/" \
  -H "$auth" -H 'Content-Type: application/json' \
  -d '{"max_cost_usd": "200.00", "interval_type": "month",
       "enforcement": "block", "alert_thresholds": [0.75, 0.9]}'

# Cap one agent at $50/week, alert-only (never blocks chats).
curl -X PUT "$dm/api/ai-mentor/orgs/$IBLAI_ORG/mentors/$MENTOR/spend-cap/" \
  -H "$auth" -H 'Content-Type: application/json' \
  -d '{"max_cost_usd": "50.00", "interval_type": "week", "enforcement": "alert_only"}'

# How close is a user to their limits? (learner-safe, dollars hidden)
curl "$dm/api/ai-mentor/orgs/$IBLAI_ORG/spend-caps/status/$IBLAI_USERNAME/?mentor=$MENTOR" \
  -H "$auth"

# Remove the tenant cap.
curl -X DELETE "$dm/api/ai-mentor/orgs/$IBLAI_ORG/spend-caps/tenant/" -H "$auth"
```

## Notes

- **Blocking is 429, not 402.** A spend cap that blocks a chat returns HTTP
  **429** with `{"error_code": "spend_cap_exceeded", ...}`; this is distinct from
  the **402** returned when a user runs out of purchased *credits* (see
  `iblai-api-billing`). A cap ceilings admin-set LLM cost; credits are a per-user
  prepaid balance.
- **Counters are eventually consistent.** `current_spend_usd` is refreshed by a
  scheduled reconcile task from ClickHouse, so it can lag real-time spend
  slightly. Enforcement reads the cached value to stay off the hot path.
- **Status hides dollars by design.** The status endpoint only exposes
  `percent_used` and a zone so a non-admin cannot read org- or agent-wide spend
  totals; use the admin read endpoints for the dollar figures.
- **One cap per (scope, agent, user).** Unique constraints allow a single organization
  cap, one cap per agent, and one cap per (agent, user); PUT upserts that single
  row.
- **Disable vs delete.** Set `enabled: false` to pause a cap without losing its
  configuration; DELETE removes it entirely.

## Schema

Cap object (read; write accepts the non-read-only fields):

| Field | Type | Notes |
|---|---|---|
| `id` | int | read-only |
| `scope` | str | `tenant` \| `agent` \| `user_agent`; read-only (from URL) |
| `platform_key` | str | read-only |
| `mentor_unique_id` | str \| null | read-only; set for agent/user_agent |
| `mentor_name` | str \| null | read-only |
| `username` | str \| null | read-only; set for user_agent |
| `email` | str \| null | read-only; set for user_agent |
| `interval_type` | str | **write**, required: `day`\|`week`\|`month`\|`year` |
| `max_cost_usd` | decimal string | **write**, required on create, > 0 |
| `enforcement` | str | **write**: `block` (default) \| `alert_only` |
| `alert_thresholds` | list[float] | **write**: fractions in `(0, 1]`; default `[0.8, 0.95]` |
| `enabled` | bool | **write**: default `true` |
| `period_started_at` | datetime \| null | read-only (reconciled) |
| `current_spend_usd` | decimal string | read-only (reconciled) |
| `remaining_usd` | decimal string | read-only (`max_cost_usd - current_spend_usd`, floored at 0) |
| `is_exceeded` | bool | read-only (`current_spend_usd >= max_cost_usd`) |
| `last_reconciled_at` | datetime \| null | read-only |
| `created_at` / `updated_at` | datetime | read-only |

Status summary (from the status endpoint):

| Field | Type | Notes |
|---|---|---|
| `status` | str | worst zone: `ok` \| `warning` \| `exceeded` |
| `blocked` | bool | a hard-block cap is already exceeded |
| `caps[]` | list | one entry per applicable cap |
| `caps[].scope` | str | `tenant` \| `agent` \| `user_agent` |
| `caps[].interval_type` | str | `day` \| `week` \| `month` \| `year` |
| `caps[].enforcement` | str | `block` \| `alert_only` |
| `caps[].status` | str | `ok` \| `warning` \| `exceeded` |
| `caps[].percent_used` | float | 0–100+, one decimal |
| `caps[].warning_threshold` | float \| null | lowest configured alert threshold |
| `caps[].mentor_unique_id` | str \| null | set for agent/user_agent caps |
| `caps[].username` | str \| null | set for user_agent caps |