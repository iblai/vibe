# iblai-api-agent-session

> Talk to a deployed ibl.ai agent directly over REST/SSE (or WebSocket) and manage its chat sessions — POST a prompt to the agent chat endpoint, attach arbitrary metadata (surfaced later as client_context), list/read sessions and per-task history exports, and give the agent client tools that run on the user's machine (client_tools, the client_tool_call frame, chat-tool-results). The direct-transport counterpart to iblai-api-agent-chat's MCP wiring; use when you want raw streamed chat + session records rather than an MCP server.

# iblai-api-agent-session

Drive a deployed agent's **chat transport directly** and read its **sessions**.
Where `/iblai-api-agent-chat` wires a hosted MCP server for conversation, this
skill is the raw REST/SSE (and WebSocket) surface: POST a prompt, stream the
reply, attach `metadata` that resurfaces as `client_context`, and list/inspect
the resulting session records. Get `IBLAI_ORG`/`IBLAI_USERNAME`/`IBLAI_API_KEY`
from `/iblai-api-login`.

## Auth & conventions

- **Header:** `Authorization: Api-Token $IBLAI_API_KEY` on every request.
- **Path vars:** `{org}` = `$IBLAI_ORG`, `{user}` = `$IBLAI_USERNAME`.
- **Two hosts — chat is streaming/ASGI:**
  - Chat turn (SSE / WebSocket) → `https://asgi.data.iblai.app`
  - Session reads/writes → `https://api.iblai.app/dm/api/ai-mentor/orgs/{org}/users/{user}/v1` … i.e. `…/orgs/{org}/users/{user}/sessions/…`
- Not connected yet? Run **`/iblai-api-login`** first.

## Concepts

**Two independent context fields — one soft, one hard.** A chat turn can carry both
`metadata` (soft) and `document_filter` (hard); they do different jobs and don't
substitute for each other:

- **`metadata` (soft)** — steers *how the agent reasons*. It's appended to the prompt and
  persisted; it never restricts which documents RAG can retrieve.
- **`document_filter` (hard)** — steers *which documents RAG may retrieve*. It's a
  document-level allow-list applied in the vector store; it does not touch the prompt.

Passing `metadata` alone narrows nothing in retrieval; passing `document_filter` alone
scopes retrieval without giving the agent any extra prose context. Use both when you want
both effects.

**`metadata` → `client_context` passthrough (soft).** Every chat turn (WS or SSE) may
carry a `metadata` object of arbitrary key/values (`BaseConsumerPayload.metadata`). The
runner folds it into the prompt the agent sees, so the agent can tailor its reply, and the
consumer persists it on the session as `Session.metadata["client_context"]`. It is
**session-level**: each turn's `metadata` overwrites the session's `client_context`, so
it sticks across turns until you send new keys. Use it to tell one deployed agent
*where/why* a message arrives (product, plan tier, page, region) without editing its
prompt. It then echoes back on every read below. The sibling field `page_content` is
also appended to the prompt, but — unlike `metadata` — is stripped before the message is
saved.

**`document_filter` → retrieval scoping (hard).** An optional
`BaseConsumerPayload.document_filter` object (`{key: scalar}`) restricts RAG retrieval to
documents whose ingested `custom_metadata` is compatible with the filter. It is matched
**inclusively per key**: a document is kept if, for **every** filter key, it either
*matches that key's value* **or** *does not carry that key at all*; it is excluded only
when it carries the key with a **different** value. Multiple keys are AND'd. Because a
document that lacks a key is never excluded by it, generic/untagged material always
survives — e.g. `{"stateCode":"CA"}` keeps California docs **and** generic docs that carry
no `stateCode`, while dropping docs tagged for other states. Unlike `metadata`,
`document_filter` is **not** session-sticky — it applies only to the turn that sends it —
and it never appears in the prompt or saved history. It only shrinks the retrieval
candidate set; top-k similarity ranking still runs afterward, so an eligible document is
not guaranteed to be retrieved if higher-scoring eligible documents fill the top-k.

**`client_tools` → tools the client runs.** A turn may also carry `client_tools`:
OpenAI-style function definitions for tools that run on the user's machine (`read_page`,
`click`). When the agent calls one, the stream carries a `client_tool_call` frame; the
client runs the tool and posts the output to `chat-tool-results/`, and the agent continues
on the same turn. The agent must have `enable_client_tools` on, the definitions are sent
on every turn that may use them (nothing is stored on the session), and an unanswered call
fails after at most 300 seconds. Frame shapes, limits and status codes:
[`references/client-tools.md`](references/client-tools.md).

## Reads

- **GET** `…/dm/api/ai-mentor/orgs/{org}/users/{user}/sessions/` — list the user's
  chat sessions.
- **GET** `…/orgs/{org}/users/{user}/sessions/{session_id}/` — the session's paginated
  chat messages (`MessageView`); the response also carries `client_context`, read from
  the session's `metadata["client_context"]`.
- **GET** `…/orgs/{org}/users/{user}/sessions/{session_id}/tasks/{task_id}/` — the
  chat-history export (`DownloadableChatHistory`); every item carries a `client_context`
  field. Add `?to_csv=true` for a CSV whose columns are exactly
  `type,content,timestamp,client_context`. Kicking off (POST) and polling that export
  task is owned by **`/iblai-api-agent-history`**.
- **Analytics echo:** the same value comes back at `summary.client_context` from
  **GET** `…/dm/api/analytics/messages/details/?platform_key={org}&session_id={session_id}`
  — documented under **`/iblai-api-analytics`**.

## Writes

- **POST** `https://asgi.data.iblai.app/api/agent/chat/?platform_key={org}&session_id={session_id}`
  — send a chat turn; response is Server-Sent Events. Body (`BaseConsumerPayload`):
  ```json
  {
    "session_id": "…",
    "prompt": "Hello",
    "flow": { "name": "<agent unique_id>", "tenant": "<org key>" },
    "page_content": "optional text appended to the prompt, stripped before saving",
    "metadata": { "any": "soft client context keys" },
    "document_filter": { "stateCode": "CA" },
    "client_tools": [
      { "type": "function", "function": { "name": "read_page", "description": "…", "parameters": { "type": "object", "properties": {} } } }
    ]
  }
  ```
  `session_id` (a UUID4) and `flow` are **required**; `flow.name` selects the agent (its
  `unique_id`, or a slug/name) and `flow.tenant` is the org key. `prompt` and
  `page_content` default to empty, `metadata` and `document_filter` to null. `metadata` is
  soft passthrough — stored on the session as `client_context` (see Concepts) and echoed in
  the reads above. `document_filter` is the hard retrieval scope — an inclusive per-key
  allow-list over documents' ingested `custom_metadata`, applied only to this turn and never
  persisted (see Concepts and Schema). `client_tools` is optional and defaults to null;
  the turn is refused with a `400` error frame when the agent's `enable_client_tools` is
  off. The **same payload** works over WebSocket at `wss://asgi.data.iblai.app/ws/chat/`.
- **POST** `…/dm/api/ai-mentor/orgs/{org}/users/{user}/chat-tool-results/` — return the
  output of a client tool the agent called. Body:
  ```json
  {
    "generation_id": "from the client_tool_call frame",
    "tool_call_id": "the frame's id",
    "output": "text, at most 256 KB",
    "is_error": false
  }
  ```
  `200 {"detail": "Accepted"}`; `404` when no call of yours is waiting under that id
  (timed out, finished, or not yours); `409` when it was already answered. Post with the
  credential that started the turn.
- **POST** `…/dm/api/ai-mentor/orgs/{org}/users/{user}/sessions/` — create/retrieve a
  session (`ChatSessionView`; the body's `mentor` field picks the agent). Or let the
  first chat turn create one by passing a new `session_id`.

## Example

```bash
# Stream a chat turn with attached client context (SSE). MENTOR = the agent's unique_id.
curl -N -X POST \
  "https://asgi.data.iblai.app/api/agent/chat/?platform_key=$IBLAI_ORG&session_id=$SESSION" \
  -H "Authorization: Api-Token $IBLAI_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{"session_id":"'"$SESSION"'","prompt":"Summarize my notes","flow":{"name":"'"$MENTOR"'","tenant":"'"$IBLAI_ORG"'"},"metadata":{"source":"docs","tab":"notes"}}'

# Read the session's messages back (client_context is the metadata you sent)
curl "https://api.iblai.app/dm/api/ai-mentor/orgs/$IBLAI_ORG/users/$IBLAI_USERNAME/sessions/$SESSION/" \
  -H "Authorization: Api-Token $IBLAI_API_KEY"

# Download the history export as CSV (client_context is a column)
curl "https://api.iblai.app/dm/api/ai-mentor/orgs/$IBLAI_ORG/users/$IBLAI_USERNAME/sessions/$SESSION/tasks/$TASK/?to_csv=true" \
  -H "Authorization: Api-Token $IBLAI_API_KEY"
```

## Notes

- **Streaming runs on ASGI** — the chat turn (`/api/agent/chat/`, `/ws/chat/`) is on
  `asgi.data.iblai.app`; session reads are ordinary REST on the `api.iblai.app/dm`
  gateway. `session_id` and `flow` are required on every turn, and `flow.name` must
  resolve to a deployed agent (its `unique_id`, slug, or name).
- For **OpenAI-format** inference against a provider/model (no agent RAG/memory), use
  `/iblai-api-inference`; to chat via an **MCP server** instead of raw SSE, use
  `/iblai-api-agent-chat`; the history-export task (kick off + poll) is
  `/iblai-api-agent-history`; the `summary.client_context` analytics read is
  `/iblai-api-analytics`.

## Schema

**`metadata` / `client_context`** (soft) — an arbitrary JSON object (`dict[str, Any] |
null`, `BaseConsumerPayload.metadata`). No fixed keys; use whatever your app needs, e.g.
`product`, `planTier`, `userRole`, `region`. Sent as `metadata` on a chat turn, it is
persisted at `Session.metadata["client_context"]` and read back as `client_context` in
the session-messages response, the history export (a `client_context` field per item, or
CSV column via `?to_csv=true`), and analytics `summary.client_context`. It is appended to
the prompt but never restricts retrieval.

**`document_filter`** (hard) — an optional JSON object (`dict[str, str|int|float|bool] |
null`, `BaseConsumerPayload.document_filter`) that scopes RAG retrieval to documents whose
ingested `custom_metadata` is compatible with the filter. It never touches the prompt and
is **not** persisted on the session (per-turn only). The keys/values here match the
`custom_metadata` you attach when adding documents — see `/iblai-api-agent-dataset` for
tagging documents at ingestion (the `custom_metadata` field on `documents/train/`).

- **Keys** must be flat and alphanumeric/underscore (`^\w+$`) — no `__`, no ORM-style
  lookup suffixes (`__icontains`, etc.). **Values** must be scalars (string, number, or
  boolean); lists/objects/null are rejected. A malformed filter fails the turn with a
  validation error rather than being silently ignored.
- **Inclusive per key:** a document is kept if, for **every** filter key, it *matches the
  value* **or** *does not carry that key*; it is excluded only when it carries the key with
  a **different** value. Multiple keys are AND'd.
- **Matching is exact** — value comparison is case- and type-sensitive (`"CA"` ≠ `"ca"`;
  the integer `2026` ≠ the string `"2026"`), and keys are matched exactly (`"stateCode"` ≠
  `"statecode"`); a key no document carries acts as a no-op for that key.
- **State + generic pattern:** ingest generic/shared documents with **no** state key and
  state-specific documents with `stateCode = <state>`; then `{"stateCode":"CA"}` retrieves
  California **and** generic documents while excluding other states — no per-state agent or
  two-stage retrieval needed. To search everything, send **no** `document_filter` (an empty
  or fully non-matching filter can yield an empty candidate set, and the agent may then
  answer without any retrieved context).
- **Eligibility ≠ retrieval:** the filter only shrinks the candidate set; top-k similarity
  ranking still runs, so an eligible document is not guaranteed to surface if higher-scoring
  eligible documents fill the top-k. Raise the agent's retrieval `k` if broad generic
  material is being crowded out.

## Reference material

- [`references/client-tools.md`](references/client-tools.md) — tools the client runs:
  the `client_tools` definition and its limits, the `client_tool_call` frame, the
  `chat-tool-results/` endpoint and its status codes, timeouts and stop, and every reason
  a turn that sends `client_tools` is refused.
- [`references/metadata-passthrough.md`](references/metadata-passthrough.md) — the
  `metadata` pass-through companion: the `<CONTEXT METADATA>` prompt-injection format,
  per-transport wire notes (SSE/WebSocket + the embedded-iframe `postMessage` channel),
  session caching (send-once, replace-not-merge, ~2h TTL), the
  one-agent-many-contexts pattern, the storage/pipeline map (session
  `client_context` vs. the per-message snapshot), and the **soft `metadata` vs. hard
  `document_filter`** comparison with the state-specific + generic retrieval pattern.