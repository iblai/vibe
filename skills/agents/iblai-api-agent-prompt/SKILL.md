---
name: iblai-api-agent-prompt
description: Manage an ibl.ai agent's prompts via the platform API — built-in system/proactive/study/guided prompts and greeting settings (saved through the agent settings endpoint), plus full CRUD on suggested prompts. Use when editing what an agent says and suggests.
metadata:
  kind: api
---

# iblai-api-agent-prompt

Manage an agent's prompts via the API: the built-in system / proactive / study /
guided prompts and greeting settings (all saved through the single `settings/`
endpoint), plus full create/update/delete on the agent's suggested prompts. Use
when editing what an agent says and suggests.

## Auth & conventions

- **Base URL:** `https://api.iblai.app`
- **Header:** `Authorization: Api-Token $IBLAI_API_KEY` on every request.
- **Path vars:** `{org}` = `$IBLAI_ORG`, `{username}` = `$IBLAI_USERNAME`,
  `{mentor}` = the agent's unique id (e.g. `d17dc729-60fd-4363-81a0-f67d9318b03e`).
- **Settings writes** go through one endpoint —
  **PUT** `…/users/{username}/mentors/{mentor}/settings/` — sending **only the
  changed field(s)**.
- Not connected yet? Run **`/iblai-api-login`** first to populate `IBLAI_ORG`,
  `IBLAI_USERNAME`, and `IBLAI_API_KEY`.

## Reads

- **GET** `…/users/{username}/mentors/{mentor}/settings/` — system / proactive / study / guided prompt text, `greeting_method`, `enable_guided_prompts`.
- **GET** `https://api.iblai.app/dm/api/search/orgs/{org}/users/{username}/prompts/?mentor={mentor}&limit=6&offset={n}&order_direction=asc` — list suggested prompts.
- **GET** `https://api.iblai.app/dm/api/ai-prompt/orgs/{org}/users/{username}/prompts/category/` — prompt categories.

## Writes

- **PUT** `…/mentors/{mentor}/settings/` — update a built-in prompt (send one key):
  ```json
  {
    "system_prompt": "string",
    "proactive_prompt": "string",
    "study_mode_prompt": "string",
    "guided_prompt_instructions": "string"
  }
  ```
- **PUT** `…/mentors/{mentor}/settings/` — update greeting/guided settings:
  ```json
  { "greeting_method": "PROACTIVE_PROMPT|PROACTIVE_RESPONSE" }
  ```
  ```json
  { "enable_guided_prompts": "boolean" }
  ```
- **POST** `https://api.iblai.app/dm/api/ai-prompt/orgs/{org}/users/{username}/prompt/` — create a suggested prompt:
  ```json
  {
    "prompt": "string (required)",
    "category": "string",
    "is_system": false,
    "mentor": "uuid",
    "platform": "string",
    "prompt_visibility": "enum"
  }
  ```
- **PUT** `…/ai-prompt/orgs/{org}/users/{username}/prompt/{id}/` — update a suggested prompt:
  ```json
  {
    "prompt": "string",
    "category": "string",
    "is_system": false,
    "prompt_visibility": "enum|null"
  }
  ```
- **DELETE** `…/ai-prompt/orgs/{org}/users/{username}/prompt/{id}/` — delete a suggested prompt (no body).

## Example

Set the agent's system prompt (only the changed key is sent):

```bash
curl -X PUT \
  "https://api.iblai.app/dm/api/ai-mentor/orgs/$IBLAI_ORG/users/$IBLAI_USERNAME/mentors/$MENTOR/settings/" \
  -H "Authorization: Api-Token $IBLAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"system_prompt": "You are a friendly study coach. Keep answers concise."}'
```

## Notes

- Built-in prompts and greeting toggles save through `settings/` — send only the
  changed key, never the whole object.
- Suggested prompts are their own resource under `ai-prompt/…/prompt/`; create
  with **POST**, edit by `{id}` with **PUT**, remove by `{id}` with **DELETE**.
- The suggested-prompt list endpoint is paginated — page with `limit` and
  `offset`.
