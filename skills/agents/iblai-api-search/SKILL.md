---
name: iblai-api-search
description: Discover agents and learning content in an ibl.ai organization via the platform API — faceted, paginated search over agents and the catalog (courses, programs, pathways, skills), personalized (RAG) recommendations, global/personalized agent search, and seller-facing sellable-items search; plus admin management of the recommendation prompts. Use to find, browse, or get recommended agents/content (mostly read-only; recommendation-prompt endpoints write).
metadata:
  kind: api
---

# iblai-api-search

Discover agents and learning content from the API in three ways: **agent**
search (faceted, full-text search over agents), **content** search
(faceted search over the catalog of courses, programs, pathways, and skills),
and **recommendations** (personalized, RAG-ranked results for the signed-in
user) — plus a newer `/api/ai-search/...` family (global + personalized agent
search, sellable-items search, and admin recommendation-prompt management).
Discovery is read-only; only the recommendation-prompt endpoints write. To
*edit* an agent use the `/iblai-api-agent-*` skills.

## Auth & conventions

- **Base URL:** `https://api.iblai.app/dm` — these are Data Manager (DM)
  endpoints, so the **`/dm` prefix is required**; the paths below are appended
  to it (e.g. `https://api.iblai.app/dm/api/search/catalog/`).
- **Header:** `Authorization: Api-Token $IBLAI_API_KEY` on every request.
- **Path vars:** `{org}` = `$IBLAI_ORG`, `{username}` = `$IBLAI_USERNAME` (agent
  search only; the `/api/ai-search/...` v2 endpoints and content search are
  **not** org-pathed — the org/user come from the token or query params).
- Not connected yet? Run **`/iblai-api-login`** first to populate `IBLAI_ORG`,
  `IBLAI_USERNAME`, and `IBLAI_API_KEY`.

## Reads

### Agent search

- **GET** `https://api.iblai.app/dm/api/search/orgs/{org}/users/{username}/mentors/` — search/browse agents. Query params:
  - `query` — full-text over name/description (e.g. `calculus`).
  - `category` — numeric category id (from `facets.Category`).
  - `created_by` — author username (from `facets["Created By"]`).
  - `limit`, `page` — pagination.

**Envelope:** `{ results[], count, next, previous, current_page, total_pages, facets }`.
Each result has `unique_id`, `name`, `description`, `llm_provider`, `llm_name`,
`categories`, `created_by`, `is_featured`, `mentor_visibility`, `slug`,
`profile_image`, `settings`. `facets` keys: Category, Created By, Featured, LLM
Provider, Subject, Audience, Promotion, Recently Accessed.

### Content search

- **GET** `https://api.iblai.app/dm/api/search/catalog/` — search/browse the catalog. Query params:
  - `query` — full-text (e.g. `manufacturing`).
  - `limit`, `page` — pagination.
  - Filter params mirror the response `facets`: content
    **type** (course / program / pathway / skill), **language**, **level**,
    **subject**, **format**, **price**, **certificate**.

**Envelope:** `{ results[], count, next, previous, current_page, total_pages, facets }`,
where each result is `{ "type": "course|program|pathway|skill", "data": { } }`.

### Recommendations

Personalized, RAG-ranked results for the signed-in user. Unlike the two
searches above, there is **no query**: results are computed server-side and are
**user-dependent** (personalized to whoever the token resolves to). The org and
user are derived from the token; this endpoint is not org-pathed.

- **GET** `https://api.iblai.app/dm/api/ai-search/recommendations/` — RAG recommendations. Query params:
  - `recommendation_type` — `mentors` | `courses` | `programs` | `resources` | `pathways`.
  - `limit` — maximum number of recommendations.

Returns a ranked list of the requested type. Call once per type for a mixed set.

A newer `/api/ai-search/...` family (no org/user in the path — context comes from
the token or query params). The `recommendations/` endpoint above is part of it.

### Global agent search

- **GET** `https://api.iblai.app/dm/api/ai-search/mentors/` — global agent search
  across the platform. Works **anonymously**; if a token is sent, results
  are personalized to that user (pass `platform_key` for RBAC). Query params:
  `query`, `platform_key`, facet filters mirroring the response, and
  `limit`/`offset` pagination. Distinct from the org-pathed agent search above
  (that one is organization-scoped; this one is global).

### Personalized agents

- **GET** `https://api.iblai.app/dm/api/ai-search/personalized-mentors/` —
  personalized, agent-focused results for the signed-in user (authentication
  required). Pass `platform_key` (or `tenant`) and, where applicable, `username`.

### Sellable items

- **GET** `https://api.iblai.app/dm/api/ai-search/sellable-items/` — seller-facing
  search over items that can be sold (for paywall/pricing setup). Requires an
  authenticated user **with the `CanSellItems` RBAC permission**. Query params:
  `platform_key`, `query`, item `type`, and pagination.

### Recommendation prompts (admin)

Manage the LLM prompt(s) that drive recommendations. **Platform-admin only.**

- **GET** `https://api.iblai.app/dm/api/ai-search/recommendation/prompts/`
  (preferred alias of `…/prompts/`) — list prompts. Params: `platform_key`,
  `recommendation_type`, `active_only`, `prompt_id`.

## Writes

### Recommendation prompts

Manage the LLM prompt(s) that drive recommendations. **Platform-admin only.**

- **POST** `https://api.iblai.app/dm/api/ai-search/prompts/` — create a prompt. Confirm with the user first.
- **PUT** `https://api.iblai.app/dm/api/ai-search/prompts/` — update a prompt (by `prompt_id`). Confirm with the user first.
- **DELETE** `https://api.iblai.app/dm/api/ai-search/prompts/` — delete a prompt (by `prompt_id`). Confirm with the user first.

## Example

Find calculus agents, then manufacturing courses:

```bash
curl -s "https://api.iblai.app/dm/api/search/orgs/$IBLAI_ORG/users/$IBLAI_USERNAME/mentors/?query=calculus&limit=10" \
  -H "Authorization: Api-Token $IBLAI_API_KEY"

curl -s "https://api.iblai.app/dm/api/search/catalog/?query=manufacturing&limit=10" \
  -H "Authorization: Api-Token $IBLAI_API_KEY"
```

## Notes

- Discovery (agent/content/recommendations/global-agent/sellable-items search) is
  read-only; the only writes are the admin **recommendation-prompt** endpoints
  (`POST`/`PUT`/`DELETE …/ai-search/prompts/`).
- The `facets` block in each response enumerates the available filter dimensions
  and counts; use its keys to drive additional filter params.
- An agent result's `unique_id` is the `{mentor}` you pass to the
  `/iblai-api-agent-*` skills; a content result's `data` shape depends on its
  `type`.
- **Search vs recommendations:** search takes an explicit `query` + filters and
  is the same for any caller; recommendations take no query and are personalized
  per user (token-dependent).
