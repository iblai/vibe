# Building a connection UI (front-end / integration notes)

> Complements the parent `/iblai-api-agent-mcp` skill. SKILL.md is the endpoint
> reference (method / URL / body) and deliberately omits UI. This file preserves
> the developer docs' client-integration guidance for anyone building a screen
> that registers servers, creates connections, or runs the OAuth handshake over
> REST. For the live-chat socket handling (the `oauth_required` /
> `oauth_connection_resolved` frames), see
> [`in-chat-events.md`](in-chat-events.md); this file covers the REST-driven
> setup screens.

## Order of operations

- **OAuth servers: `oauth-find` first.** Run it before enabling **Save** on an
  OAuth server and pass the returned `id` as `oauth_service`. On `400`, render
  the `diagnostic` (message per `failed_step`) and, for `client_registration` /
  `authorization_server_metadata`, show the manual-client form inline and
  resubmit (see [`admin-setup.md`](admin-setup.md)).
- **Server first, then connection.** The connection endpoints require a valid
  server `id`, so create the `MCPServer` record before offering a connection
  form.
- **Then wire the agent.** A server created for one agent is not attached
  automatically: add its id to `mcp_servers` (and `mcp` to `tool_slugs`) in
  the same save — a server with no agent wiring is never called in chat (the
  most common "nothing happens" cause).

## Drive the connection form off the server's `auth_type`

Read the server's `auth_type` and render only the fields that apply:

| `auth_type` | Fields to show |
|---|---|
| `none` | no credential fields |
| `token` | `authorization_scheme`, `credentials`, and optional `extra_headers` key/value pairs |
| `oauth2` | a connected-service picker (no raw credential input) |

- **Scope-aware fields.** Show the `mentor` (agent) input only for
  `scope="mentor"`, and the `user` input only for `scope="user"`. `platform` and
  `user` are derived server-side — never send them (see SKILL.md validation
  rules).
- **OAuth2 picker source.** Populate the picker from
  `GET …/connected-services/orgs/{org}/users/{username}/`, filtered by the
  server's provider + service. Do **not** offer a "Connect" action for an
  `oauth2` server until a connected service exists — creating the connection
  without one returns `400 OAuth2 connections require a connected service.`
- **Masked credentials.** `credentials` and `extra_headers` come back masked
  (e.g. `sup****key`). Track whether the operator actually edited the field and
  send `credentials` only on a real rotation; never write the masked value back.

## Render validation errors inline

The connection create/update endpoint returns DRF-style per-field errors — an
object keyed by field name, each value an array of messages. Render each next to
its offending input rather than as one banner:

```json
{
  "agent": ["Agent scoped connections require an agent."],
  "connected_service": ["OAuth2 connections require a connected service."]
}
```

(SKILL.md lists the individual messages under the connection validation rules.)

## OAuth start / callback from a browser

- **Open `auth_url` in a new tab or popup, never an iframe** — providers block
  framing; a full redirect works too.
- **If you use a modal or popup**, capture the provider's redirect in that
  context and forward its query params to the callback endpoint unchanged. Relay
  `state` byte-for-byte — the backend hashes and verifies it (SKILL.md).
- **The redirect lands on your callback page** (`/google-oauth-callback/` by
  default). It must relay `code` and `state` to
  `GET /api/ai-account/connected-services/callback/` for **every** provider,
  then `postMessage` the opener and close.
- **Handle `400` on start** ("Could not build OAuth authorization URL…") as
  "this connector isn't set up yet" — for admins, link to the OAuth app form
  (`credentials/`) — rather than a generic error. Don't reload or retry.
- **After a grant, re-list** `connected-services` to pick up refreshed
  `expires_at` values — the platform refreshes tokens server-side; the client
  only needs to re-read, never to handle tokens itself.
