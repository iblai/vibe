# In-chat MCP events (reference)

> Complements the parent `/iblai-api-agent-mcp` skill. SKILL.md has the trigger
> conditions, the admin setup checklist, the constants (300s wait / 10s poll /
> 3 retries at 1s·2s·4s), and a compact event table. This file is the fuller
> per-frame reference: exact field types, the three `error` variants, and the
> client-handling gotchas SKILL.md doesn't spell out.

All frames arrive as JSON strings on the **existing** chat WebSocket/SSE
socket. `JSON.parse` and switch on `type` — except the error frame, which has
no `type` (detect it by the top-level `error` key). Never close or refresh the
socket while waiting; resolution arrives on the same one.

## Event frames

| `type` | Fields (type) | Sent when | Client action |
|---|---|---|---|
| `oauth_required` | `server_name` (str), `server_id` (int), `auth_url` (str), `message` (str) | about to call an MCP server with no connection for this user; before polling starts | open `auth_url` in a new tab/popup (providers block framing), name the server, show a waiting indicator |
| `oauth_connection_resolved` | `server_name` (str), `server_id` (int), `message` (str) | polling found a valid connection for the user | dismiss the prompt; the reply follows shortly |
| `mcp_tools_retrieved` | `session_id` (str, uuid), `mentor_id` (str) | an initial tool fetch failed but a retry succeeded | none — log or ignore |
| `warning` | `message` (str), `developer_error` (str), `code` (int = 503) | tools failed to load for a **non-OAuth** reason; chat continues without MCP tools | non-blocking banner from `message`; log `developer_error` (never show it to users) |
| *(error frame)* | `error` (str), `status_code` (int = 400) | a `ChatValidationError` ends the turn | show `error` (it is user-safe); offer Retry |

### The three `error` cases

All carry `status_code: 400`; tell them apart by the message text:

- **OAuth timeout** — `Timed out waiting for OAuth authentication for MCP server '…' after 300s. Retry message after completing the OAuth flow.` The user ran past the wait window.
- **URL build failure** — `Could not build OAuth URL for MCP server '…'.` Usually a missing `auth_{provider}` credential.
- **Missing connected service** — `MCP connection for server '…' is configured for OAuth2 but has no connected service.`

## Client-handling essentials

- **Dispatch on `type`, not on message content.** The most common bug is a
  handler that only reads chat text and silently drops `oauth_required` — the
  user then sees a 5-minute hang and a timeout with no prompt ever shown.
- **The client never touches the callback.** The backend callback exchanges the
  code and creates the `ConnectedService` + `MCPServerConnection`; the client
  only listens for `oauth_connection_resolved`. If `auth_url` opened a popup,
  the main chat tab gets the event whether or not the popup is closed —
  auto-closing it is cosmetic.
- **Late OAuth self-heals.** After a timeout `error`, the grant the user
  eventually completes is still saved, so their **next message** resolves
  automatically. Offer Retry rather than forcing a fresh setup.
- **`warning` ≠ error frame.** `warning` (503) degrades gracefully — the reply
  still arrives, minus MCP tools; keep the chat open. Only the error frame (400)
  ends the turn, and on WebSocket transports the socket then closes.
