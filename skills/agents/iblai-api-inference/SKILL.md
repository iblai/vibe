---
name: iblai-api-inference
description: Run inference against an ibl.ai deployment through its OpenAI-compatible API — same request/response shape as OpenAI's /v1/chat/completions, routed to any configured provider/model (e.g. openai/gpt-5). List models, then POST OpenAI-format messages for a single completion or a streamed SSE response, with Api-Token auth. Use to generate completions or tool calls directly, without the agent-chat MCP server or agent wiring.
metadata:
  kind: api
---

# iblai-api-inference

Call ibl.ai's **OpenAI-compatible** chat endpoint: identical request/response shape
to OpenAI's `/v1/chat/completions`, but served by your deployment and routed to
whichever `provider/model` you name. Use it for raw completions, streamed tokens,
or tool calls directly — no MCP server, no agent needed. To _configure_ which model
an agent runs on use `/iblai-api-agent-llm`; to _converse with a deployed agent_
(RAG, memory, history) use `/iblai-api-agent-chat`.

## Auth & conventions

- **Header:** `Authorization: Api-Token $IBLAI_API_KEY` on every request.
- **Path var:** `{org}` = `$IBLAI_ORG` (no username in the path).
- **Model:** always `provider/model` form, e.g. `openai/gpt-5`,
  `anthropic/claude-sonnet-4`. A bare name is rejected `400 invalid_request`.
- **Two hosts — every completion is ASGI-only:**
  - Chat completions, streaming **and** non-streaming →
    `https://asgi.data.iblai.app/api/ai-mentor/orgs/{org}/v1/chat/completions`
  - Model list →
    `https://api.iblai.app/dm/api/ai-mentor/orgs/{org}/v1/models`

  The sync WSGI gateway (`api.iblai.app`) can't drive the inference generator at
  all, so **no** completion — streamed or not — goes through it; it serves the
  model list only.

- Not connected yet? Run **`/iblai-api-login`** first to populate `IBLAI_ORG` and
  `IBLAI_API_KEY`.

## Reads

- **GET** `https://api.iblai.app/dm/api/ai-mentor/orgs/{org}/v1/models` — OpenAI-style model list for the deployment;
  each `id` is a `provider/model` you can pass as `model`. A model is listed only
  when some gateway can serve it for the org (its own key, or ibl.ai's key if the
  org may borrow it); `iblai-pro` / `iblai-fast` appear only where servable. When
  ibl.ai's key pays, the org's model allow-list also hides models.

## Writes

- **POST** `https://asgi.data.iblai.app/api/ai-mentor/orgs/{org}/v1/chat/completions` — run a completion (an inference
  call, not a state mutation; `POST` per the OpenAI wire format). Standard OpenAI
  chat body:
  ```json
  {
    "model": "openai/gpt-5",
    "messages": [{ "role": "user", "content": "Hello" }],
    "stream": false,
    "tools": [],
    "stream_options": { "include_usage": true }
  }
  ```
  `stream:true` returns Server-Sent Events (`data: {chunk}` … `data: [DONE]`);
  omit it (or `false`) for one JSON completion.

## Examples

Non-streaming completion:

```bash
curl -X POST \
  "https://asgi.data.iblai.app/api/ai-mentor/orgs/$IBLAI_ORG/v1/chat/completions" \
  -H "Authorization: Api-Token $IBLAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"openai/gpt-5","messages":[{"role":"user","content":"Say hi"}]}'
```

Streaming (SSE):

```bash
curl -N -X POST \
  "https://asgi.data.iblai.app/api/ai-mentor/orgs/$IBLAI_ORG/v1/chat/completions" \
  -H "Authorization: Api-Token $IBLAI_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{"model":"openai/gpt-5","stream":true,"stream_options":{"include_usage":true},"messages":[{"role":"user","content":"Stream a haiku"}]}'
```

List available models:

```bash
curl "https://api.iblai.app/dm/api/ai-mentor/orgs/$IBLAI_ORG/v1/models" \
  -H "Authorization: Api-Token $IBLAI_API_KEY"
```

## Notes

- **Drop-in for OpenAI SDKs:** point `base_url` at
  `https://asgi.data.iblai.app/api/ai-mentor/orgs/{org}/v1`. Auth is
  `Api-Token` (not `Bearer`), so pass it via the SDK's default headers
  (`{"Authorization": "Api-Token <key>"}`), not the plain `api_key` field.
  That base URL serves completions only — `client.models.list()` will not
  resolve against it; fetch
  `https://api.iblai.app/dm/api/ai-mentor/orgs/{org}/v1/models` directly.
- **Every chat completion goes to the ASGI host** (`asgi.data.iblai.app`),
  streaming or not — the WSGI gateway can't run inference in either mode.
  `api.iblai.app` serves only
  `https://api.iblai.app/dm/api/ai-mentor/orgs/{org}/v1/models`.
- `model` must be `provider/model` and resolve to a provider the deployment has
  configured — list it via
  `https://api.iblai.app/dm/api/ai-mentor/orgs/{org}/v1/models`; unknown/bad
  model → `400 invalid_request`. A model the org's allow-list refuses →
  `403` with an OpenAI-style `{"error": {"type": "permission_error", …}}`.
- **Gateways:** of the gateways that serve the model, the org's own key is used
  first, then ibl.ai's key if the org may borrow it. Credential names per gateway:
  `openrouter` -> `iblai`, `vertex` -> `google` (service account),
  `azure_foundry` -> `gateway_azure_foundry`, `bedrock` -> `bedrock`,
  `openai` -> `openai`, `google_genai` -> `gemini_google_api_key`,
  `anthropic` -> `anthropic`; `groq`, `xai`, `deepseek`, `perplexity`, `nvidia`
  use their own name.
- **Tool calling** is supported (OpenAI `tools` / `tool_calls`); streamed
  tool-call deltas carry dense, 0-based `index` values, matching the OpenAI wire
  format that clients index directly.
