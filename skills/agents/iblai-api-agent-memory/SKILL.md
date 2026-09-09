---
name: iblai-api-agent-memory
description: Manage an ibl.ai agent's memories via the platform API — list and filter agent memories (by category, user, email, date), curate global (cross-agent) memories, curate shared agent knowledge injected into every user's chat, add/edit/delete memories, manage memory categories, and toggle capture/recall settings. Use when inspecting or curating what an agent remembers.
metadata:
  kind: api
---

# iblai-api-agent-memory

Manage an agent's memories through the API: browse and filter what an agent has
remembered, curate global (cross-agent) memories, add / edit / delete individual
memories, manage the categories memories are filed under, and control capture /
recall settings. Use when inspecting or curating what an agent remembers.

## Auth & conventions

- **Base URL:** `https://api.iblai.app`
- **Header:** `Authorization: Api-Token $IBLAI_API_KEY` on every request.
- **Path vars:** `{org}` = `$IBLAI_ORG`, `{username}` = `$IBLAI_USERNAME`,
  `{mentor}` = the agent's unique id (e.g. `d17dc729-60fd-4363-81a0-f67d9318b03e`).
- **Prefix / two spellings:** endpoints live under the `ai-mentor` base
  `https://api.iblai.app/dm/api/ai-mentor/orgs/{org}` (the leading `…` below). A twin
  `ai-agent` base mirrors every route with the `mentor` path token swapped for `agent`
  (`…/mentors/{mentor}/mentor-memories/` ↔ `…/agents/{agent}/agent-memories/`); either works.
- **Two path bases:** user-scoped routes hang off `…/orgs/{org}/users/{username}` (written
  `{u}` below); memory **categories** hang off `…/orgs/{org}/mentors/{mentor}` directly (no
  user segment).
- Not connected yet? Run **`/iblai-api-login`** first to populate `IBLAI_ORG`,
  `IBLAI_USERNAME`, and `IBLAI_API_KEY`.

## Concepts

Two PGVector-backed memory stores ("memsearch") sit behind these endpoints:

- **Global memories** (`UserGlobalMemory`) — scoped to a user + org, shared across every
  agent; facts any agent should know about the user.
- **Agent memories** (`UserMentorMemory`) — scoped to a user + one agent + a
  **category**; what a single agent remembers about the user.
- **Agent knowledge** (`MentorMemory`) — scoped to one agent (org + agent), **not** any
  user and **not** categorized. Manually curated (never auto-extracted), it is injected into
  **every** user's chat with that agent as an `## Agent Knowledge` block, gated by the agent's
  `enable_memory_component` and each user's `use_memory_in_responses`. This is shared "how the
  agent should behave / what it should always know" content, distinct from the per-user stores
  above.

**Categories** (`MentorMemoryCategory`, per agent) file agent memories and steer capture:
each has a `slug`, an `extraction_prompt` (LLM hint for what to pull into that category),
and `is_active` (whether it's used during extraction).

**Capture & injection** are controlled per user via `memsearch-settings`:
- `auto_capture_enabled` — agents auto-extract memories from conversations. Auto-extracted
  rows carry `is_auto_generated: true`; memories you add via the API are `false`.
- `use_memory_in_responses` — stored memories are injected into agent responses.

An org-wide `enable_memsearch` flag gates the whole feature (see `memsearch-status`).

## Reads

### Agent memories

- **GET** `…/users/{username}/mentors/{mentor}/mentor-memories-list/?page={n}&page_size={n}&category={slug}&my_memory={bool}&user_id={id}&email={e}&start_date={yyyy-MM-dd}&end_date={yyyy-MM-dd}` — paged flat list for one agent.
- **GET** `…/users/{username}/mentors/{mentor}/mentor-memories/?my_memory={bool}&user_id={id}&email={e}&start_date=&end_date=` — the same memories grouped by category.
- **GET** `{u}/mentor-memories/?mentor={agent}&user_id={id}&email={e}&start_date=&end_date=` — the user's agent memories across **all** agents; add `?mentor=` to scope to one. Twin spelling: `{u}/agent-memories/`.

### Categories

- **GET** `…/orgs/{org}/mentors/{mentor}/memory-categories/` — category list for one agent.

### Agent knowledge (shared)

- **GET** `…/orgs/{org}/mentors/{mentor}/agent-memories/?page={n}&page_size={n}` — paged list of the agent's shared knowledge entries (DRF page envelope; `page_size` default 20, max 100). This path has **no** `users/{username}` segment — do not confuse it with the user-scoped `{u}/agent-memories/` twin spelling above, which lists one user's per-agent memories.

### Global (cross-agent) memories

- **GET** `{u}/global-memories/?user_id={id}&email={e}&session_id={uuid}&content={substr}&start_date={yyyy-MM-dd}&end_date={yyyy-MM-dd}` — user-level memories shared across every agent. Filters: `session_id` (the source session), `content` (case-insensitive substring), and the `start_date` / `end_date` created-at range.

### Settings

- **GET** `{u}/memsearch-settings/` — the user's capture / recall settings. Organization admins may read another user's settings by putting that user's username in the `{username}` path segment; non-admins are restricted to their own (any other `{username}` resolves back to the caller).
- **GET** `{u}/memsearch-status/` — whether memsearch (`enable_memsearch`) is enabled for the org.

## Writes

### Agent memories

- **POST** `…/users/{username}/mentors/{mentor}/mentor-memories/` — add a memory:
  ```json
  {
    "category_slug": "string (required, must match an existing category slug)",
    "content": "string (required, ≥10 chars)"
  }
  ```
- **PATCH** `…/users/{username}/mentors/{mentor}/mentor-memories/{memoryId}/` — edit a memory (send at least one field):
  ```json
  {
    "category_slug": "string",
    "content": "string (≥10 chars)"
  }
  ```
- **DELETE** `…/users/{username}/mentors/{mentor}/mentor-memories/{memoryId}/` — delete one memory (no body). Destructive — confirm with the user first. Bulk delete = one call per memory.

### Categories

- **POST** `…/orgs/{org}/mentors/{mentor}/memory-categories/` — add a category:
  ```json
  {
    "name": "string (required)",
    "slug": "string (required, unique per agent)",
    "description": "string",
    "extraction_prompt": "string",
    "is_active": "boolean (default true)"
  }
  ```
- **PATCH** `…/orgs/{org}/mentors/{mentor}/memory-categories/{categoryId}/` — edit a category (any subset of the create fields).
- **DELETE** `…/orgs/{org}/mentors/{mentor}/memory-categories/{categoryId}/` — delete a category (no body). Destructive — confirm with the user first.

### Agent knowledge (shared)

- **POST** `…/orgs/{org}/mentors/{mentor}/agent-memories/` — add a shared knowledge entry:
  ```json
  { "content": "string (required, ≥10 chars)" }
  ```
  Dedups on a content hash: an identical entry returns `409` (`{"error": "Memory already exists"}`) rather than a duplicate; a new one returns `201` with the created object.
- **PATCH** `…/orgs/{org}/mentors/{mentor}/agent-memories/{memoryId}/` — replace an entry's content:
  ```json
  { "content": "string (required, ≥10 chars)" }
  ```
  If the new content collides with another of the agent's entries, returns `409`.
- **DELETE** `…/orgs/{org}/mentors/{mentor}/agent-memories/{memoryId}/` — delete one entry (no body, `204`). Destructive — confirm with the user first.

### Global (cross-agent) memories

- **POST** `{u}/global-memories/` — add a user-level memory: `{ "content": "string (required, ≥10 chars)" }`.
- **DELETE** `{u}/global-memories/{memoryId}/` — delete one (no body). Destructive — confirm with the user first.

### Settings

- **PUT** `{u}/memsearch-settings/` — update the user's capture / recall settings (send at least one field). Organization admins may update another user's settings by putting that user's username in the `{username}` path segment; non-admins are restricted to their own (any other `{username}` resolves back to the caller):
  ```json
  {
    "auto_capture_enabled": "boolean",
    "use_memory_in_responses": "boolean"
  }
  ```

## Example

List the first page of one agent's memories filed under the `preferences` category since the start of the year:

```bash
curl -s \
  "https://api.iblai.app/dm/api/ai-mentor/orgs/$IBLAI_ORG/users/$IBLAI_USERNAME/mentors/$MENTOR/mentor-memories-list/?page=1&page_size=20&category=preferences&start_date=2026-01-01" \
  -H "Authorization: Api-Token $IBLAI_API_KEY"
```

## Notes

- Memories are filed under categories; `category_slug` on an agent memory must match an
  existing category's `slug` from the `memory-categories/` endpoint.
- The `mentor-memories-list/` filters stack — combine `category`, `user_id`, `email`, and
  the date range to narrow results; `my_memory=true` scopes the list to the caller's own memories.
- **Global memories** filter by `user_id` / `email` plus `session_id`, `content` (substring),
  and a `start_date` / `end_date` range — but **not** `category` or `my_memory`, which are
  agent-memory-only (global memories aren't categorized).
- Categories are org- + agent-scoped (`…/orgs/{org}/mentors/{mentor}/…`), not user-scoped
  like the memory endpoints.
- **Two things share the `agent-memories` name.** The user-scoped `{u}/agent-memories/` (under
  `…/users/{username}`) is the twin spelling of one user's per-agent memories; the org+agent-scoped
  `…/orgs/{org}/mentors/{mentor}/agent-memories/` (no user segment) is the **shared agent knowledge**
  store. Different data, different path — pick by whether a `users/{username}` segment is present.
- There is no bulk-delete endpoint: to clear several memories, issue one DELETE per id.
- Flat list reads (global memories, agent memories, categories) return a DRF page
  envelope — `{ "count": n, "results": [...] }`; iterate `results`. The grouped
  `mentor-memories/` read instead buckets memories by category (see Reads). DELETEs return `204`.

## Schema

**Memory object** (every memory read returns this; `UserMentorMemory` / `UserGlobalMemory`):

| field | mode | notes |
| --- | --- | --- |
| `id` | ro | integer |
| `content` | req (write) | the memory text; ≥10 chars |
| `username`, `email` | ro | resolved from the user |
| `mentor_id` | ro | agent memories only |
| `platform` | ro | global memories only (org key) |
| `category` | ro | agent memories only; nested category object |
| `source_session_id` | ro | session the memory was extracted from, or null |
| `is_auto_generated` | ro | `true` = LLM-extracted, `false` = added via API |
| `created_at`, `updated_at` | ro | ISO 8601 |

**Agent-knowledge object** (`MentorMemory`; returned by the shared `agent-memories` endpoints):

| field | mode | notes |
| --- | --- | --- |
| `id` | ro | integer |
| `mentor_id` | ro | the agent's unique id |
| `mentor_name` | ro | the agent's name |
| `content` | req (write) | the knowledge text; ≥10 chars |
| `created_by` | ro | username of the curator, or `null` (service/API-key callers) |
| `created_at`, `updated_at` | ro | ISO 8601 |

No `category`, `is_auto_generated`, or user fields — agent knowledge is shared and manually curated.

**Category object** (`MentorMemoryCategory`): `id` (ro), `name`, `slug` (unique per agent),
`description`, `extraction_prompt`, `is_active` (default `true`), `created_at` (ro).

**Settings** (`memsearch-settings`): `auto_capture_enabled`, `use_memory_in_responses`
(both boolean, default `true`), `updated_at` (ro).

## Reference material

Background that complements the endpoints above (not required to call the API):

- [`references/concepts.md`](references/concepts.md) — how extraction and injection actually behave (background capture, single-LLM-call, 3-layer dedup, top-5 semantic recall), the default categories, the org → agent → user enablement cascade, embedding/dedup specs, and a symptom→fix table.
