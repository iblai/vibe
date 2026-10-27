# In-chat MCP events — frame reference

> Complements the parent `/iblai-api-agent-mcp` skill's In-chat section. When
> an agent loads its MCP tools at the start of a turn, the chat connection
> (WebSocket or SSE) may carry the frames below. Each is a JSON object; switch
> on `type`, and detect the turn-ending error frame by its top-level `error`
> key. Voice calls deliver the same frames on the LiveKit data channel topic
> `"tool"` — subscribe to it, or OAuth-gated servers never prompt.

## Event frames

| `type` | Fields | Sent when | Client action |
|---|---|---|---|
| `oauth_required` | `server_id` (int), `server_name`, `auth_url`, `message` | a server's effective scope is `user`, it uses OAuth, and this user has no connection; **the turn pauses** for up to 300s while the backend polls every 10s | inline card *Sign in to {server_name}* with a countdown; open `auth_url` in a popup/new tab; offer *Skip in this conversation* (hidden for mandatory servers) |
| `oauth_connection_resolved` | `server_id`, `server_name`, `message` | polling found the user's new connection | replace the card with "Connected to {server_name}"; the reply follows |
| `oauth_authentication_timeout` | `message`, `status_code: 401` | no sign-in within 300s; **the turn ends** | "Sign-in to {server} timed out. Sign in, then send your message again." with *Sign in* / *Retry* — use your own wording, not `message` |
| `mcp_tools_retrieved` | `session_id`, `mentor_id` | the turn's MCP tools were loaded | optional: clear a "Connecting to tools…" indicator |
| `warning` | `message`, `code: 503`, `developer_error` (optional) | a server couldn't be reached, authorized or list its tools within 15s — it is **skipped alone** and named in `message` (`Couldn't load tools from Acme Docs. Continuing without them.`); the other servers' tools still load. The variant with `developer_error` ("MCP tools temporarily unavailable…") means MCP failed unexpectedly as a whole | dismissible notice from `message`; log `developer_error` when present, never show it |
| *(error frame)* | `error`, `status_code: 400` | a `ChatValidationError` ends the turn | show `error` (user-safe); offer the action below |

### The turn-ending `error` cases

- **`Could not build OAuth URL for MCP server '…'.`** — the org has no OAuth
  client for a `user`-scoped OAuth server. Show "{server} isn't set up yet.
  Ask your administrator, or turn it off for this conversation" with a *Turn
  off for this conversation* action (`session-preference/`, `is_enabled:
  false`), then resend.
- **`MCP connection for server '…' is configured for OAuth2 but has no
  connected service.`** — a broken connection record; reconnect the account.

## Client-handling essentials

- **Dispatch on `type`, not on message text.** A handler that drops
  `oauth_required` leaves the user staring at a 5-minute hang ending in a
  timeout with no prompt ever shown.
- **Key prompt cards by `server_id`.** If `oauth_required` repeats for a
  server, replace the card and use the new `auth_url`.
- **The client never creates the connection in chat.** The popup completes
  the sign-in (start → provider → callback page → `connected-services/callback/`);
  the backend creates the `MCPServerConnection` and emits
  `oauth_connection_resolved` on the same socket — do not close or refresh it.
- **Late sign-in self-heals.** A grant completed after the timeout is still
  saved, so the user's **next message** works. Offer Retry.
- **"Skip in this conversation"** = `PUT …/mcp-servers/{id}/session-preference/`
  `{"session_id": "<session>", "is_enabled": false}`, then ask the user to
  resend.
- **`warning` ≠ error frame.** `warning` (503) degrades gracefully — the reply
  still arrives, minus the skipped servers' tools. Only the error frame and
  `oauth_authentication_timeout` end the turn; on WebSocket transports the
  socket then closes.
- **Announce** sign-in progress and results in a live region.

## Timing

| Constant | Value |
|---|---|
| `MCP_OAUTH_MAX_WAIT_SECONDS` | 300 |
| `MCP_OAUTH_POLL_INTERVAL_SECONDS` | 10 |
| Tool listing per server (`MCP_LIST_TOOLS_TIMEOUT_SECONDS`) | 15 — a quick failure is retried once, a timeout is not |
