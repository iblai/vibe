# iblai-api-agent-tool

> Enable or disable an ibl.ai agent's tools via the platform API — list toggleable tools, read currently enabled tool slugs, and write the enabled set (saved through the agent settings endpoint). Use when controlling which tools an agent can use.

# iblai-api-agent-tool

Enable or disable an agent's tools via the API: list the tools an agent can
toggle, read which tool slugs are currently enabled, and write the enabled set
back through the agent `settings/` endpoint. Use when controlling which tools an
agent can use.

## Auth & conventions

- **Base URL:** `https://api.iblai.app`
- **Header:** `Authorization: Api-Token $IBLAI_API_KEY` on every request.
- **Path vars:** `{org}` = `$IBLAI_ORG`, `{username}` = `$IBLAI_USERNAME`,
  `{mentor}` = the agent's unique id (e.g. `d17dc729-60fd-4363-81a0-f67d9318b03e`).
- **Tool writes** go through the agent settings endpoint —
  **PUT** `…/users/{username}/mentors/{mentor}/settings/` — sending the tool slug set.
- Not connected yet? Run **`/iblai-api-login`** first to populate `IBLAI_ORG`,
  `IBLAI_USERNAME`, and `IBLAI_API_KEY`.

## Reads

- **GET** `https://api.iblai.app/dm/api/ai-mentor/orgs/{org}/users/{username}/mentors/{mentor}/available-tools/` — toggleable tools. Each row has `slug` (the value `tool_slugs` takes), `display_name`, `description`, `category`, and `is_allowed`.
- **GET** `https://api.iblai.app/dm/api/ai-mentor/orgs/{org}/users/{username}/mentors/{mentor}/settings/` — currently enabled tools, as `mentor_tools[]` (read each `slug`).

## Writes

- **PUT** `https://api.iblai.app/dm/api/ai-mentor/orgs/{org}/users/{username}/mentors/{mentor}/settings/` — enable/disable tools:
  ```json
  {
    "tool_slugs": "string[]",
    "can_use_tools": "boolean"
  }
  ```

## Example

Enable web search and the code interpreter for an agent:

```bash
curl -X PUT \
  "https://api.iblai.app/dm/api/ai-mentor/orgs/$IBLAI_ORG/users/$IBLAI_USERNAME/mentors/$MENTOR/settings/" \
  -H "Authorization: Api-Token $IBLAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"tool_slugs": ["web-search", "code-interpreter"], "can_use_tools": true}'
```

## Notes

- `tool_slugs` is the full enabled set — slugs left out of the array are disabled.
- Pull valid slugs from the `available-tools/` endpoint before writing (live
  examples: `web-search`, `code-interpreter`, `deep-research`, `mcp`,
  `screen-share`).
- Set `can_use_tools` to `false` to turn tools off entirely without clearing the
  slug set.
- Verified against the live schema (4.411.0) on 2026-10-02.