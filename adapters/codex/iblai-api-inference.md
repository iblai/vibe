# iblai-api-inference

> Run inference against an ibl.ai deployment through its OpenAI-compatible API — same request/response shape as OpenAI's /v1/chat/completions, routed to any configured provider/model (e.g. openai/gpt-5). List models, then POST OpenAI-format messages for a single completion or a streamed SSE response, with Api-Token auth. Use to generate completions or tool calls directly, without the agent-chat MCP server or agent wiring.

# iblai-api-inference

Call ibl.ai's **OpenAI-compatible** chat endpoint: identical request/response shape
to OpenAI's `/v1/chat/completions`, but served by your deployment and routed to
whichever `provider/model` you name. Use it for raw completions, streamed tokens,
or tool calls directly — no MCP server, no agent needed. To *configure* which model
an agent runs on use `/iblai-api-agent-llm`; to *converse with a deployed agent*
(RAG, memory, history) use `/iblai-api-agent-chat`.

## Auth & conventions

- **Header:** `Authorization: Api-Token $IBLAI_API_KEY` on every request.
- **Path var:** `{org}` = `$IBLAI_ORG` (no username in the path).
- **Model:** always `provider/model` form, e.g. `openai/gpt-5`,
  `anthropic/claude-sonnet-4`. A bare name is rejected `400 invalid_request`.
- **Two hosts — streaming is async/ASGI-only:**
  - Non-streaming → `https://api.iblai.app/dm/api/ai-mentor/orgs/{org}/v1`
  - Streaming (`stream: true`) → `https://asgi.data.iblai.app/api/ai-mentor/orgs/{org}/v1`

  The sync WSGI gateway can't drive the async SSE generator, so `stream:true`
  must hit the ASGI host.
- Not connected yet? Run **`/iblai-api-login`** first to populate `IBLAI_ORG` and
  `IBLAI_API_KEY`.

## Reads

- **GET** `…/orgs/{org}/v1/models` — OpenAI-style model list for the deployment;
  each `id` is a `provider/model` you can pass as `model`.

## Writes

- **POST** `…/orgs/{org}/v1/chat/completions` — run a completion (an inference
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
  "https://api.iblai.app/dm/api/ai-mentor/orgs/$IBLAI_ORG/v1/chat/completions" \
  -H "Authorization: Api-Token $IBLAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"openai/gpt-5","messages":[{"role":"user","content":"Say hi"}]}'
```

Streaming (ASGI host, SSE):

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

- **Drop-in for OpenAI SDKs:** point `base_url` at `…/orgs/{org}/v1`. Auth is
  `Api-Token` (not `Bearer`), so pass it via the SDK's default headers
  (`{"Authorization": "Api-Token <key>"}`), not the plain `api_key` field.
- **Streaming must use the ASGI host** (`asgi.data.iblai.app`); the WSGI gateway
  (`api.iblai.app`) is fine for non-streaming only.
- `model` must be `provider/model` and resolve to a provider the deployment has
  configured — list it via `…/v1/models`; unknown/bad model → `400 invalid_request`.
- **Tool calling** is supported (OpenAI `tools` / `tool_calls`); streamed
  tool-call deltas carry dense, 0-based `index` values, matching the OpenAI wire
  format that clients index directly.