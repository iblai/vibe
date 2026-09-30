# iblai-api-agent-llm

> Set an ibl.ai agent's LLM provider and model via the platform API — list available provider/model cards and write the selection through the agent settings endpoint. Use when changing which model an agent runs on.

# iblai-api-agent-llm

Set an agent's LLM provider and model: list the available provider/model cards
and write the chosen provider + model through the same `settings/` endpoint that
backs the rest of the agent configuration. Use when changing which model an agent
runs on.

## Auth & conventions

- **Base URL:** `https://api.iblai.app`
- **Header:** `Authorization: Api-Token $IBLAI_API_KEY` on every request.
- **Path vars:** `{org}` = `$IBLAI_ORG`, `{username}` = `$IBLAI_USERNAME`,
  `{mentor}` = the agent's unique id (e.g. `d17dc729-60fd-4363-81a0-f67d9318b03e`).
- **Provider/model selection** saves through the same `settings/` endpoint —
  **PUT** `…/users/{username}/mentors/{mentor}/settings/`.
- Not connected yet? Run **`/iblai-api-login`** first to populate `IBLAI_ORG`,
  `IBLAI_USERNAME`, and `IBLAI_API_KEY`.

## Reads

- **GET** `https://api.iblai.app/dm/api/ai-mentor/orgs/{org}/users/{username}/mentors/{mentor}/settings/` — current provider/model.
- **GET** `https://api.iblai.app/dm/api/ai-mentor/orgs/{org}/users/{username}/mentor-llms/?mentor_id={mentor}` — provider/model cards.

## Writes

- **PUT** `…/users/{username}/mentors/{mentor}/settings/` — set provider/model:
  ```json
  {
    "llm_provider": "string (required)",
    "llm_name": "string (required)"
  }
  ```

## Example

Switch an agent to OpenAI's GPT-4o:

```bash
curl -X PUT \
  "https://api.iblai.app/dm/api/ai-mentor/orgs/$IBLAI_ORG/users/$IBLAI_USERNAME/mentors/$MENTOR/settings/" \
  -H "Authorization: Api-Token $IBLAI_API_KEY" \
  -F "llm_provider=openai" \
  -F "llm_name=gpt-4o"
```

## Notes

- Pull the provider/model cards first, then send exactly one `llm_provider` +
  `llm_name` pair that appears in that list — values must match a real card.
- Each card carries an `availability` status: `byok_configured` (the org's own
  key pays), `byok_main_fallback` (ibl.ai's key pays), `gateway_credits` (served
  under another host), `byok_missing` (add a key first). The status comes from
  the same gateway resolver chat uses, so the picker and runtime agree;
  `gateway_only` is no longer returned. The org's model allow-list hides models
  only when a key ibl.ai lends would pay, never when the org's own key does.
  Response shape is unchanged.
- Gateway rule: of the gateways that serve the model, the org's own key first,
  then ibl.ai's key if the org may borrow it. Credential names are in
  `/iblai-api-integration`.
- Selection persists through the shared `settings/` endpoint, so it sits
  alongside the other configuration fields on the same agent.