# iblai-api-integration

> Manage an organization's account-level integrations via the platform API — third-party LLM provider keys, service credentials (Stripe, Google Drive, Dropbox, …), and Platform API tokens. Use when connecting an ibl.ai organization to external model providers or services, or issuing API keys.

# iblai-api-integration

Manage an organization's account-level integrations via the API: connect the
organization to external LLM providers, store the keys of services it uses
(integration credentials: Stripe, Google Drive, Dropbox, Vercel, …), and issue
Platform API tokens. Use when wiring an ibl.ai organization up to model
providers or services, or issuing API keys.

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
- **GET** `https://api.iblai.app/dm/api/ai-account/orgs/{org}/users/{username}/default-llm-key-usage` — whether the organization may borrow ibl.ai’s LLM keys: `{"use_main_llm_key": true}` (or `false`) once the switch is stored, `{"use_main_credentials": false}` when it never was. It reports the stored switch only, which ibl.ai sets; a free trial or the deployment default can still let the organization borrow.

### Services

Integration credentials: the keys of other services the organization uses.
DM base: `/api/ai-account/…`.

- **GET** `https://api.iblai.app/dm/api/ai-account/orgs/{org}/integration-credential/[?name=]` — list credentials as `[{ id, name, value, platform }]`. An admin gets every credential with its sensitive fields masked; `?unmask_sensitive_fields=true` returns them in full to an admin of `{org}`, for the organization's own credentials only (see `/iblai-vibe-credential` for the token grant). Anyone else gets only the non-sensitive fields.
- **GET** `https://api.iblai.app/dm/api/ai-account/orgs/{org}/masked-integration-credential/` — list configured services (masked).
- **GET** `https://api.iblai.app/dm/api/ai-account/orgs/{org}/integration-credential/schema/v2/[?name=]` — each service's fields with `is_sensitive` (and `required: false` on an optional one).

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
- **PATCH** `https://api.iblai.app/dm/api/ai-account/orgs/{org}/credential/` — replace a provider's key, same body as the POST. For every provider but `azure_openai` the new `value` replaces the stored one, so send every field; `azure_openai` deep-merges the models you send into the stored ones.
- **DELETE** `https://api.iblai.app/dm/api/ai-account/orgs/{org}/credential/` — remove an LLM provider. Destructive — confirm with the user first.
  ```json
  {
    "name": "string (required)",
    "platform": "string (required)",
    "model_name": "string (optional, single Azure model)"
  }
  ```

### Services

Integration credentials. DM base: `/api/ai-account/…`.

- **POST** `https://api.iblai.app/dm/api/ai-account/orgs/{org}/integration-credential/` — add a service's key, with every field of its schema (an optional one left blank as `""`):
  ```json
  {
    "name": "provider (required)",
    "value": "object (required)",
    "platform": "{org} (required)"
  }
  ```
- **PATCH** `https://api.iblai.app/dm/api/ai-account/orgs/{org}/integration-credential/` — change a service's key, `{ "name", "platform", "value" }` with the fields to change in `value` (the SDK sends only those).
- **DELETE** `https://api.iblai.app/dm/api/ai-account/orgs/{org}/integration-credential/` — remove a service's key. Destructive — confirm with the user first; a VM environment variable that reads it stops working.
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

- LLMs and services are account-level — they apply to the whole organization, not a
  single agent.
- Adding a provider the organization already holds is a `400` with
  `non_field_errors`; replace its key with the PATCH instead. `azure_openai` is the
  exception: a POST adds its models to the stored ones.
- A service's key can also be used by an agent's virtual machine: create a
  `virtual-machine-secret/` with `source_credential_id` (the credential's `id`) and
  `source_field` (its one sensitive field, `key` for Stripe), and the VM reads the
  key without ever seeing it. A service signed in with `client_id` /
  `client_secret` has no such field; only ibl.ai uses its key.
- List endpoints return **masked** credentials; fetch the matching `schema`
  endpoint to learn which fields a provider expects before POSTing.
- The API-token endpoints are shared with `/iblai-api-token`; tokens
  created via either skill are the same Platform API tokens.
- LLM credential `name`s and what each holds: `openai` (OpenAI key),
  `anthropic` (Anthropic key), `gemini_google_api_key` (Gemini API key),
  `google` (Google Cloud service account, Vertex AI), `bedrock` (AWS Bedrock),
  `gateway_azure_foundry` (Azure AI Foundry), `iblai` (ibl.ai’s built-in access); `groq`,
  `xai`, `deepseek`, `perplexity` and `nvidia` hold that provider’s key. A model
  uses the organization’s own key first, then ibl.ai’s if the organization may
  borrow it (`default-llm-key-usage` above).
- Service `drive` (Google Drive) holds `client_id` and `developer_key`.
  `client_id` must be the full Google OAuth client id,
  `<project-number>-<x>.apps.googleusercontent.com`, with the `drive.file`
  scope: the leading number is sent to Google as the picker's `appId`.