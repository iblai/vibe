# iblai-api-agent-privacy

> Configure an ibl.ai agent's Privacy Router via the platform API — enable PII detection, choose redact/mask/block action, select entity types (PERSON, EMAIL_ADDRESS, US_SSN, …), set the privacy response, and toggle output filtering (saved through the agent settings endpoint). Use when controlling how the agent handles personal data.

# iblai-api-agent-privacy

Configure an agent's Privacy Router via the API: enable PII detection, pick the
redact / mask / block action and the entity types to watch, set the response
returned when PII is caught, and toggle output filtering — all saved through the
single `settings/` endpoint. Use when controlling how the agent handles personal
data.

## Auth & conventions

- **Base URL:** `https://api.iblai.app`
- **Header:** `Authorization: Api-Token $IBLAI_API_KEY` on every request.
- **Path vars:** `{org}` = `$IBLAI_ORG`, `{username}` = `$IBLAI_USERNAME`,
  `{mentor}` = the agent's unique id (e.g. `d17dc729-60fd-4363-81a0-f67d9318b03e`).
- **Settings writes** go through one endpoint —
  **PUT** `…/users/{username}/mentors/{mentor}/settings/` with
  `multipart/form-data` — sending **only the changed field(s)**.
- Not connected yet? Run **`/iblai-api-login`** first to populate `IBLAI_ORG`,
  `IBLAI_USERNAME`, and `IBLAI_API_KEY`.

## Reads

- **GET** `https://api.iblai.app/dm/api/ai-mentor/orgs/{org}/users/{username}/mentors/{mentor}/settings/` — load the current privacy fields.
- **GET** `https://api.iblai.app/dm/api/ai-mentor/orgs/{org}/users/{username}/mentors/{mentor}/public-settings/` — privacy-router state for anonymous (unauthenticated) requests.

## Writes

- **PUT** `…/mentors/{mentor}/settings/` — update privacy fields (`multipart/form-data`, send only changed keys):
  ```json
  {
    "enable_privacy_router": "boolean",
    "privacy_action": "redact|mask|block",
    "privacy_entities": "string[] (PERSON, EMAIL_ADDRESS, US_SSN, …)",
    "privacy_response": "string",
    "enable_privacy_output_filter": "boolean"
  }
  ```

## Example

Enable the Privacy Router to redact names, emails, and SSNs, with a custom
response and output filtering on (only the changed fields are sent):

```bash
curl -X PUT \
  "https://api.iblai.app/dm/api/ai-mentor/orgs/$IBLAI_ORG/users/$IBLAI_USERNAME/mentors/$MENTOR/settings/" \
  -H "Authorization: Api-Token $IBLAI_API_KEY" \
  -F "enable_privacy_router=true" \
  -F "privacy_action=redact" \
  -F "privacy_entities=PERSON" \
  -F "privacy_entities=EMAIL_ADDRESS" \
  -F "privacy_entities=US_SSN" \
  -F "privacy_response=I can't process personal information. Please remove it and try again." \
  -F "enable_privacy_output_filter=true"
```

## Notes

- A field left out of the PUT is left unchanged — never resend the whole object.
- `privacy_action` is one of `redact`, `mask`, or `block`; `block` stops the turn
  and returns `privacy_response`, while `redact`/`mask` rewrite the detected PII.
- `privacy_entities` is a list of detector names (`PERSON`, `EMAIL_ADDRESS`,
  `US_SSN`, …) — repeat the `-F` key per entity in `multipart/form-data`.
- `enable_privacy_output_filter` applies the same detection to the agent's
  output, not just the user's input.
- Use the `public-settings/` read to confirm the state applied to anonymous
  (unauthenticated) requests.