# iblai-api-agent-safety

> Configure an ibl.ai agent's moderation and safety systems via the platform API — enable flags, system prompts and responses (saved through the agent settings endpoint) — and review or delete flagged-prompt moderation logs. Use when setting guardrails or auditing flagged content.

# iblai-api-agent-safety

Configure an agent's moderation and safety systems via the API: the moderation
and safety enable flags, system prompts, and responses (all saved through the
single `settings/` endpoint), plus reviewing and deleting flagged-prompt
moderation logs. Use when setting guardrails or auditing flagged content. The UI
twin is [`/iblai-vibe-agent-safety`](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-vibe-agent-safety/SKILL.md).

## Auth & conventions

- **Base URL:** `https://api.iblai.app`
- **Header:** `Authorization: Api-Token $IBLAI_API_KEY` on every request.
- **Path vars:** `{org}` = `$IBLAI_ORG`, `{username}` = `$IBLAI_USERNAME`,
  `{mentor}` = the agent's unique id (e.g. `d17dc729-60fd-4363-81a0-f67d9318b03e`).
- **Settings writes** go through one endpoint —
  **PUT** `…/users/{username}/mentors/{mentor}/settings/` (JSON,
  `multipart/form-data` or form-encoded) — sending **only the changed
  field(s)**.
- Not connected yet? Run **`/iblai-api-login`** first to populate `IBLAI_ORG`,
  `IBLAI_USERNAME`, and `IBLAI_API_KEY`.

## Reads

- **GET** `https://api.iblai.app/dm/api/ai-mentor/orgs/{org}/users/{username}/mentors/{mentor}/settings/` — load moderation/safety prompts, responses, and enable flags.
- **GET** `https://api.iblai.app/dm/api/ai-mentor/orgs/{org}/users/{username}/moderation-logs/?mentor={mentor}&page={n}&page_size={n}&search={q}&target_system={Moderation System|Safety System}&start_time={iso}&end_time={iso}&ordering={field}` — list flagged prompts. Rows carry `id`, `prompt`, `reason` (why it was flagged), `target_system`, `date_created` and `mentor` (the agent's numeric id). `username={u}` filters to the user who was flagged, not the caller. Each row names who was flagged with `username`, `email` and `user_full_name`; the last two are `null` for a row whose user has since been deleted, which a log row is expected to outlive. The `safety-logs/` twin (same path, `…/safety-logs/`) returns the same shape.

## Writes

- **PUT** `…/users/{username}/mentors/{mentor}/settings/` — update moderation/safety fields (send only changed keys):
  ```json
  {
    "enable_moderation": "boolean",
    "enable_safety_system": "boolean",
    "moderation_system_prompt": "string",
    "moderation_response": "string",
    "safety_system_prompt": "string",
    "safety_response": "string"
  }
  ```
- **DELETE** `https://api.iblai.app/dm/api/ai-mentor/orgs/{org}/users/{username}/moderation-logs/{id}/` — delete a flagged log (no body). Destructive — confirm with the user first.

## Example

Enable the moderation system and set its system prompt and response (only the
changed fields are sent):

```bash
curl -X PUT \
  "https://api.iblai.app/dm/api/ai-mentor/orgs/$IBLAI_ORG/users/$IBLAI_USERNAME/mentors/$MENTOR/settings/" \
  -H "Authorization: Api-Token $IBLAI_API_KEY" \
  -F "enable_moderation=true" \
  -F "moderation_system_prompt=Flag any request for medical, legal, or financial advice." \
  -F "moderation_response=I can't help with that. Please consult a licensed professional."
```

## Notes

- A field left out of the PUT is left unchanged — never resend the whole object.
- Safety and moderation prompts/responses/flags all persist through the same
  `settings/` endpoint as the rest of the agent's configuration.
- `target_system` filters flagged prompts by which system tripped — either
  `Moderation System` or `Safety System`; combine with `search`, `start_time`,
  and `end_time` to narrow an audit.
- Deleting a moderation log only removes the audit record — it does not change
  the agent's safety configuration.
- The moderation check runs on the user's message before the agent sees it;
  the safety check runs on the agent's reply. A message caught by moderation
  is logged here and answered with `moderation_response`.
- Verified against the live schema (4.411.0) and a live flagged prompt
  (raised from chat, read, deleted) on 2026-10-02.