---
name: iblai-api-integration
description: Manage an organization's account-level integrations via the platform API — third-party LLM provider keys, Data Source credentials, and Platform API tokens. Use when connecting an ibl.ai organization to external model providers, data sources, or issuing API keys.
metadata:
  kind: api
---

# iblai-api-integration

Manage an organization's account-level integrations via the API: connect the
organization to external LLM providers, configure data source credentials, and
issue Platform API tokens. Use when wiring an ibl.ai organization up to model
providers or data sources, or issuing API keys.

## Auth & conventions

- **Base URL:** `https://api.iblai.app`
- **Header:** `Authorization: Api-Token $IBLAI_API_KEY` on every request.
- **Path vars:** `{org}` = `$IBLAI_ORG`, `{username}` = `$IBLAI_USERNAME`.
- Not connected yet? Run **`/iblai-api-login`** first to populate `IBLAI_ORG`,
  `IBLAI_USERNAME`, and `IBLAI_API_KEY`.

## Reads

### LLMs

Third-party model provider keys. DM base: `/api/ai-account/…`.

- **GET** `https://api.iblai.app/dm/api/ai-account/orgs/{org}/masked-llm-credential/` — list configured providers (masked).
- **GET** `https://api.iblai.app/dm/api/ai-account/orgs/{org}/credential/schema/` — provider field schema.
- **GET** `https://api.iblai.app/dm/api/ai-mentor/orgs/{org}/users/{username}/mentor/llms/` — available provider list.

### Data Sources

Data source provider credentials. DM base: `/api/ai-account/…`.

- **GET** `https://api.iblai.app/dm/api/ai-account/orgs/{org}/masked-integration-credential/` — list configured data sources (masked).
- **GET** `https://api.iblai.app/dm/api/ai-account/orgs/{org}/integration-credential/schema/v2/[?name=]` — provider field schema.

### APIs

Platform API keys. Same endpoints used to mint tokens elsewhere — see
**`/iblai-api-token`** for the full reference.

- **GET** `https://api.iblai.app/dm/api/core/platform/api-tokens/?platform_key={org}` — list tokens.

## Writes

### LLMs

Third-party model provider keys. DM base: `/api/ai-account/…`.

- **POST** `https://api.iblai.app/dm/api/ai-account/orgs/{org}/credential/` — add an LLM provider:
  ```json
  {
    "name": "provider, e.g. azure_openai (required)",
    "value": "object — provider fields (required)",
    "platform": "{org} (required)"
  }
  ```
- **DELETE** `https://api.iblai.app/dm/api/ai-account/orgs/{org}/credential/` — remove an LLM provider. Destructive — confirm with the user first.
  ```json
  {
    "name": "string (required)",
    "platform": "string (required)",
    "model_name": "string (optional, single Azure model)"
  }
  ```

### Data Sources

Data source provider credentials. DM base: `/api/ai-account/…`.

- **POST** `https://api.iblai.app/dm/api/ai-account/orgs/{org}/integration-credential/` — add a data source:
  ```json
  {
    "name": "provider (required)",
    "value": "object (required)",
    "platform": "{org} (required)"
  }
  ```
- **DELETE** `https://api.iblai.app/dm/api/ai-account/orgs/{org}/integration-credential/` — remove a data source. Destructive — confirm with the user first.
  ```json
  {
    "platform": "string (required)",
    "name": "string (required)"
  }
  ```

### APIs

Platform API keys. Same endpoints used to mint tokens elsewhere — see
**`/iblai-api-token`** for the full reference.

- **POST** `https://api.iblai.app/dm/api/core/platform/api-tokens/` — create a token:
  ```json
  {
    "username": "string",
    "name": "string",
    "key": "",
    "platform_key": "string",
    "created": "string",
    "expires": "string",
    "expires_in": "string"
  }
  ```
- **DELETE** `https://api.iblai.app/dm/api/core/platform/api-tokens/{name}?platform_key={org}` — revoke a token. Destructive — confirm with the user first.

## Example

Connect an Azure OpenAI provider to the organization:

```bash
curl -X POST \
  "https://api.iblai.app/dm/api/ai-account/orgs/$IBLAI_ORG/credential/" \
  -H "Authorization: Api-Token $IBLAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "azure_openai",
    "value": {
      "api_key": "sk-...",
      "api_base": "https://my-resource.openai.azure.com",
      "api_version": "2024-02-15-preview"
    },
    "platform": "'"$IBLAI_ORG"'"
  }'
```

## Notes

- LLMs and Data Sources are account-level — they apply to the whole organization, not a
  single agent.
- List endpoints return **masked** credentials; fetch the matching `schema`
  endpoint to learn which fields a provider expects before POSTing.
- The API-token endpoints are shared with `/iblai-api-token`; tokens
  created via either skill are the same Platform API tokens.
