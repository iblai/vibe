---
name: iblai-api-agent-mcp
description: MCP connectors for ibl.ai agents, end to end over REST. Covers the ranked server catalog (your org's, ibl.ai-featured, and MCP Registry directory servers, with the `registry` setup metadata), registering custom servers, OAuth discovery and automatic client registration (`oauth-find`, including a manual OAuth app), the org's OAuth app or API key (`credentials/`), testing (`verify/`), credential scopes (user / agent / org, the per-agent override, mandatory servers), wiring servers onto an agent, the user's sign-in, their own API key, their on/off choices (permanent and per conversation), and the in-chat events (`oauth_required`, `oauth_connection_resolved`, `oauth_authentication_timeout`, `warning`). Use when wiring an agent to external MCP servers, building a connector screen, or debugging MCP auth (401s, missing sign-in prompts, skipped servers). For the agent-settings MCP tab UI, see /iblai-vibe-agent-mcp; for live chat wiring, see /iblai-api-agent-chat.
metadata:
  kind: api
---

# iblai-api-agent-mcp

Configure external MCP tool access for agents. A working integration needs:

1. **An MCP server.** It comes from the catalog: your org's own servers,
   servers **featured** by ibl.ai, or **directory** servers published to the
   official MCP Registry. Or you register a custom one.
2. **A way to authenticate.**
   - None.
   - An **OAuth sign-in**: per user, or one shared account.
   - An **API key**: per user, per agent, or the org's.
3. **Agent wiring.** The agent's settings must have the `mcp` slug in
   `tool_slugs` **and** the server id in `mcp_servers`.

A missing step 3 is the most common failure: everything exists, but the agent
never calls the server. Always finish by re-reading the agent's settings.

## Auth & conventions

- **Base URL:** `https://api.iblai.app/dm`. The **`/dm` prefix is
  required**.
  - MCP endpoints live under `/api/ai-mentor/orgs/{org}/users/{username}/...`.
  - OAuth sign-in endpoints live under `/api/ai-account/...`.
  - Below, `…` abbreviates `https://api.iblai.app/dm/api/ai-mentor/orgs/{org}/users/{username}`
    and `ACCOUNT` abbreviates `https://api.iblai.app/dm/api/ai-account`.
- **Header:** `Authorization: Api-Token $IBLAI_API_KEY` on every request, except
  the OAuth callback, which `state` authenticates.
- **Path vars:** `{org}` = `$IBLAI_ORG`, `{username}` = `$IBLAI_USERNAME`
  (non-admins may only use their own), `{mentor}` = the agent's unique id (UUID).
- **On the wire the agent noun is `mentor`.** The backend also accepts
  `/api/ai-agent/...` and `agent*` body aliases (`agent_unique_id`, …), and
  responses carry an `agent*` copy of each top-level `mentor*` field.
- **Lists** use `page` / `page_size` (default 20, max 30) with the stock DRF
  envelope (`count`, `next`, `previous`, `results`). The connected-services list
  is a plain array.
- **Secrets are never returned.** Keys and client secrets come back masked
  (`"Bearer ****9f"`, `"****89"`); never send a masked value back.
- **DELETE / destructive calls:** confirm with the user first. Never echo
  credentials or tokens into chat or files.
- **Not connected yet?** Run **`/iblai-api-login`** first to populate
  `IBLAI_ORG`, `IBLAI_USERNAME` and `IBLAI_API_KEY`.

## Choosing the auth pattern

`auth_type` is *how* credentials go on the wire (`none | token | oauth2`;
`token` = API key). `auth_scope` is *whose* credentials are used
(`user | mentor | platform`, **default `user`**). An agent can override the
scope without changing the server (`mentor-auth-scope/`), so the scope in force
is `effective_auth_scope = agent override ?? auth_scope`.

| Pattern | Server | Setup | End user prompted? |
|---|---|---|---|
| No auth | `auth_type=none` | nothing | No |
| **Each user signs in** (recommended for OAuth) | `oauth2`, scope `user` | org OAuth client (automatic for DCR providers) | **Yes, in chat** or from a *Sign in* button |
| One shared OAuth account | `oauth2`, scope `mentor` or `platform` | an admin signs in once, then creates a `mentor` / `platform` connection | No |
| Each user brings a key | `token`, scope `user` | each user adds a `user` connection | No (server skipped until they do) |
| Shared key for the org | `token`, scope `platform` | `credentials/` API key, or a `platform` connection | No |
| Key per agent | `token`, scope `mentor` | one `mentor` connection per agent | No |

## Runtime credential resolution (enforced)

| Effective scope | Tried in order (first match wins) | Nothing found |
|---|---|---|
| `user` | the chatting user's own connection | OAuth → in-chat `oauth_required`; API key → server skipped |
| `mentor` | user's own → the agent's | server skipped |
| `platform` | user's own → agent's → org's → key stored on the server → featured global | server skipped |

A shared credential **never** satisfies a `user`-scoped server. OAuth tokens
refresh server-side automatically.

## Endpoint map

| Method | Path | Purpose | Who |
|---|---|---|---|
| GET | `…/mcp-servers/` | Ranked catalog (filters below) | everyone |
| POST | `…/mcp-servers/` | Register a server (JSON, or multipart with `image`) | admin (`MCPServers/action`) |
| GET / PUT / PATCH / DELETE | `…/mcp-servers/{id}/` | Read / edit / delete (featured & directory → `404` on write) | admin, or the agent's owner for its own server |
| POST | `…/mcp-servers/oauth-find/` | Discover OAuth + register the org's client; or store a manual client | admin |
| GET / PUT / DELETE | `…/mcp-servers/{id}/credentials/` | The org's OAuth client or API key (masked) | platform admin |
| POST | `…/mcp-servers/{id}/verify/` | Test sign-in config + list tools; stores nothing | platform admin |
| GET / PUT | `…/mcp-servers/{id}/mentor-auth-scope/` | An agent's credential-scope override | platform admin |
| GET / PUT | `…/mcp-servers/{id}/preference/` | The caller's permanent on/off | the user |
| GET / PUT | `…/mcp-servers/{id}/session-preference/` | The caller's on/off for one conversation | the user |
| GET / POST | `…/mcp-server-connections/` | List / create connections (keys, OAuth links) | user for `scope=user`; admin otherwise |
| GET / PUT / PATCH / DELETE | `…/mcp-server-connections/{id}/` | Manage a connection | owner / admin |
| GET / PUT | `…/mentors/{mentor}/settings/` | `mcp_servers`, `tool_slugs`, `can_use_tools` | agent editors |
| GET | `ACCOUNT/orgs/{org}/oauth-services/` | Enabled OAuth services | everyone |
| GET | `ACCOUNT/connected-services/orgs/{org}/users/{username}/{provider}/{service}/` | Start a sign-in → `{auth_url}` | the user |
| GET | `ACCOUNT/connected-services/callback/?code=&state=` | Finish a sign-in (relayed by your callback page) | `state` |
| GET / DELETE | `ACCOUNT/connected-services/orgs/{org}/users/{username}/[{id}/]` | List / remove the user's sign-ins | the user |

## Reads

- **GET** `…/mcp-servers/?mentor_unique_id={mentor}&include_global=true&page=1&page_size=24`
  — one ranked list: this agent's servers, the org's, featured, then directory.
  Filters: `search`, `transport`, `auth_type`, `auth_scope`, `is_featured`,
  `is_enabled`, `registry` (directory only / exclude), `trust_tier`,
  `supports_dcr` ("sign-in works out of the box"), `session_id` (makes
  `user_enabled` reflect that conversation), `date_filter` /
  `start_date` / `end_date`. Each row carries:
  - `description` and `image`; fall back to `registry.icon_url` when `image`
    is null;
  - `user_can_disable` and `user_enabled`;
  - `oauth_service_data` (`oauth_provider`, `name`), which starts a sign-in;
  - `mcp_server_connections`, the caller's applicable connections (non-empty
    means connected);
  - `mentor_auth_scope` / `effective_auth_scope`, with `mentor_unique_id`;
  - `permissions` (`object.write` / `delete`);
  - `registry`, for featured and directory servers: `source`, `trust_tier`,
    `status`, `transport_deprecated`, `auth_kind`, `supports_dcr`, `setup`
    (`none | oauth | oauth_client | api_key`) and `declared_headers`.

  For grouping, badges and the "what does this server need" state machine, see
  [`references/catalog.md`](references/catalog.md).
- **GET** `…/mcp-server-connections/` — filters `server`, `scope`, `auth_type`,
  `user`, `mentor`, `is_active`, `search`. Returns scope, `is_active`,
  `server_name`, masked `credentials` / `extra_headers`, and
  `connected_service_summary` (`{id, provider, service, user, platform_key}`).
  The owner's `user`, `user_email` and `user_full_name` are read-only.
- **GET** `…/mentors/{mentor}/settings/` — the agent's `mentor_tools`
  (slugs), `mcp_servers` (serialized) and `can_use_tools`.
  `GET …/mentors/{mentor}/available-tools/` lists the tools the agent may use,
  including `mcp`.
- **GET** `ACCOUNT/orgs/{org}/oauth-services/` and
  `…/oauth-services/{service_name}/scopes/` — enabled OAuth services and their
  scopes.

## Writes

### MCP servers

**POST** `…/mcp-servers/`:

```json
{
  "name": "Acme Docs",
  "url": "https://mcp.acme.com/mcp",
  "description": "Search Acme's knowledge base.",
  "transport": "streamable_http",
  "auth_type": "oauth2",
  "oauth_service": 57,
  "auth_scope": "user",
  "mentor": null,
  "user_can_disable": true,
  "is_enabled": true
}
```

- `name` and `url` are required.
- `transport` is `streamable_http` (default) or `sse` (legacy). `websocket` is
  rejected.
- `auth_type` defaults to `none`; `auth_scope` defaults to `user`.
- `oauth_service` is **required for `oauth2`**: get it from `oauth-find`.
- An API key on the server goes either in `credentials`, as the **full**
  `Authorization` value (`"Bearer sk-…"`), or in `extra_headers`
  (`{"X-API-Key": "…"}`). It's only used when the effective scope is
  `platform`.
- `mentor` set → the server belongs to that agent only. It is **not**
  attached automatically, so add it to `mcp_servers` in the same save.
- `user_can_disable: false` makes the server mandatory: users can't turn it
  off.
- `is_enabled: false` is a hard off switch.
- Capture the returned `id`.

**PATCH | PUT** `…/mcp-servers/{id}/` edits a server; **DELETE** deletes it
(confirm first). Featured and directory servers can't be edited or deleted by
an org (`404`). Your org attaches and connects them instead.

### OAuth setup for a new server — `oauth-find`

**POST** `…/mcp-servers/oauth-find/` with
`{"url", "name", "callback_url", "mentor"}`. It reuses an existing service for
the URL, or discovers the server's OAuth setup and registers your org's own
client automatically (DCR). **200** returns the OAuth service; use its `id` as
`oauth_service`.

- `callback_url` is the redirect URI to register: your app's OAuth callback
  page. It defaults to the org's `MCP_OAUTH_REDIRECT_URI`, which is
  `https://{SPA_DOMAIN}/google-oauth-callback/` unless staff changed it.
- **400** → `{error, diagnostic}`. The diagnostic has `failed_step`, `hint`,
  `timed_out`, `discovered` (the endpoints and scopes found) and `attempts`.
  It is bounded: an unreachable server fails at `mcp_server_url` in about 5s,
  and a slow one stops after 15s with `timed_out: true`.
- **Manual OAuth app.** When registration is impossible, resend the request
  with `client_id`, `client_secret` (`""` for a public client), and optionally
  `scopes` and `token_endpoint_auth_method`. `callback_url` is then required.
  - After `failed_step: client_registration` (GitHub-style), that's all.
  - After `authorization_server_metadata` (the server publishes nothing), also
    send `authorization_url` + `token_url` (https).

Full request/response shapes, the `failed_step` table, and the errors are in
[`references/admin-setup.md`](references/admin-setup.md).

### The org's OAuth app / API key, testing, agent scope

These are platform admin only. Full shapes are in
[`references/admin-setup.md`](references/admin-setup.md).

- **`credentials/`** handles the org's OAuth client or API key.
  - **GET** returns `configured`, `source` (`dcr | manual | legacy_backfill`),
    `shared_client_allowed`, the masked secret, `redirect_uri`, scopes and
    endpoint overrides.
  - **PUT** for an OAuth server takes `client_id`, `client_secret` (omit to
    keep), `redirect_uri`, `scopes`, `token_endpoint_auth_method`,
    `authorization_params` / `token_params`, and `authorization_url` /
    `token_url`.
  - **PUT** for an API-key server takes `api_key`, `authorization_scheme` and
    `header_name`.
  - **DELETE** signs everyone out of that provider.
- **`verify/`** stores nothing. It returns `client_source`, an informational
  `authorize_url`, `diagnostic`, and `tools`, or `tools_error` (for example
  "Skipped: connect your account…" or "Timed out after 15s listing tools.").
- **`mentor-auth-scope/`**: `GET ?mentor={uuid}`, or
  `PUT {"mentor": "<uuid>", "auth_scope": "user|mentor|platform|null"}`. The
  server must be attached to the agent.

### MCP server connections

**POST** `…/mcp-server-connections/` creates a connection. Fields: `server`
(required), `scope` (`user` default, `mentor`, `platform`), `auth_type`,
`credentials`, `authorization_scheme`, `extra_headers`, `connected_service`,
`mentor`.

```json
{ "server": 9, "scope": "platform", "auth_type": "token",
  "credentials": "super-secret-api-key", "authorization_scheme": "Bearer" }
```
```json
{ "server": 379, "scope": "user", "auth_type": "oauth2", "connected_service": 73 }
```

Validation rules (per-field 400s):
- The org and the owning `user` come from the request context. Never send
  them.
- The server must be visible to your org: your own, featured, or a listed
  directory server. Otherwise: `"Selected MCP server is not available to the
  current tenant."`.
- `scope=mentor` requires `mentor` (an agent of this org).
- `scope=user`, `scope=platform`: `mentor` is forbidden.
- `auth_type=oauth2` always requires `connected_service`, from the same org.
  For `scope=user` it must be the caller's own (`"A user scoped connection can
  only use its own user's connected service."`).
- `auth_type=token` requires `credentials`.
- A directory server's required secret headers must be present: `{"extra_headers":
  ["This server needs these headers: X-Workspace-Key."]}`.
- `authorization_scheme` becomes the header prefix. `extra_headers` merge into
  every request, and explicit credentials win on a clash.

**PATCH** `…/{id}/` updates a connection; prefer `{"is_active": false}` over
DELETE if it may return. Send `credentials` only when rotating them.

### Agent wiring

**PUT** `…/mentors/{mentor}/settings/`:

```json
{ "mcp_servers": [182, 379], "can_use_tools": true, "tool_slugs": ["web-search", "mcp"] }
```

**These lists are replaced, not merged.** `[]` clears everything, and omitting
a field leaves it alone (`null` is a 400). Read the settings, merge locally
(keep the existing `mentor_tools` slugs and add `mcp`; keep `mcp_servers` and
append the id), then write back the full lists. `can_use_tools` must be
`true` when you send `tool_slugs`.

### User on/off choices

Non-mandatory servers can be switched off by the user. Mandatory ones
(`user_can_disable: false`) return `400 "…required by your organization…"`.

- **Permanently:** `PUT …/mcp-servers/{id}/preference/` `{"is_enabled": false}`.
- **One conversation:** `PUT …/mcp-servers/{id}/session-preference/`
  `{"session_id": "<uuid>", "is_enabled": false}`.
- **GET** on either returns `effective_is_enabled`. The catalog with
  `session_id` returns `user_enabled` for every row in one request.

Shapes and the conversation-menu recipe are in
[`references/user-controls.md`](references/user-controls.md).

## OAuth sign-in (connected services)

A **connected service** is a user's token grant for one provider surface. One
grant can back several servers from the same provider.

1. **Start:** `GET ACCOUNT/connected-services/orgs/{org}/users/{username}/{oauth_provider}/{service}/?login_hint=`.
   The names come from the server's `oauth_service_data`. It returns
   `{"auth_url"}`; the `state` expires after 1 hour.
   - For a directory server with `supports_dcr`, the org's client is
     registered on its first sign-in.
   - `400 "Could not build OAuth authorization URL…"` means no OAuth client is
     available to the org: the server isn't set up.
2. **Open** `auth_url` in a popup or new tab, never an iframe.
3. **Callback page:** the provider redirects to your callback page
   (`/google-oauth-callback/` by default). It relays `code` and `state`
   **unchanged** to `GET ACCOUNT/connected-services/callback/?code=&state=`,
   which returns the connected service (`id`, `provider`, `service`,
   `expires_at`, `scope_names`, …). Then `postMessage` the opener and close
   the popup.
4. **Outside chat**, link it to the server:
   `POST …/mcp-server-connections/`
   `{"server", "scope": "user", "auth_type": "oauth2", "connected_service": <id>}`.
   During a chat this happens automatically.

Callback errors:
- `404 Invalid state`: expired or already used.
- `400 Failed to retrieve token…` / `Could not exchange auth token…`: the
  provider rejected the code; check the redirect URI matches.
- `400 "The provider didn't respond in time. Try signing in again."`: the
  token endpoint timed out.

**DELETE** `ACCOUNT/connected-services/orgs/{org}/users/{username}/{id}/`
removes a sign-in and signs the user out of every server on that provider.
Confirm first.

## In-chat events

For a server whose effective scope is `user` with `auth_type: oauth2`, the
platform asks the user to sign in **inside the chat stream** the first time
the agent needs the tool. Frames arrive as JSON on the **existing** chat
WebSocket / SSE connection; never close or refresh it while waiting. Voice
calls deliver the same frames on the data-channel topic `"tool"`.

| `type` | Key fields | Client action |
|---|---|---|
| `oauth_required` | `server_id`, `server_name`, `auth_url`, `message` | The turn **pauses** (up to 300s; polled every 10s). Show a card keyed by `server_id`: *Sign in* opens `auth_url` (the backend creates the connection itself), and *Skip in this conversation* (not for mandatory servers) sets the session preference off. |
| `oauth_connection_resolved` | `server_id`, `server_name`, `message` | Dismiss the card; the reply follows. |
| `oauth_authentication_timeout` | `message`, `status_code: 401` | The turn ends. Offer *Sign in* and *Retry*; a late sign-in works on the next message. |
| `mcp_tools_retrieved` | `session_id`, `mentor_id` | Informational: the tools loaded. |
| `warning` | `message`, `code: 503`, optional `developer_error` | One server failed to connect, authorize or list its tools within 15s. It is **skipped alone**, and `message` names it; the others still work. Show `message`, and only log `developer_error`. |
| *(no `type`)* `{error, status_code: 400}` | | The turn ends. `Could not build OAuth URL…` means the server isn't set up (offer *turn off for this conversation*). A connection with no connected service means reconnect. |

The full frame reference and handling notes are in
[`references/in-chat-events.md`](references/in-chat-events.md).

## Example

Register an OAuth server, attach it to an agent, then let users sign in
(settings read-merge-write elided):

```bash
BASE="https://api.iblai.app/dm/api/ai-mentor/orgs/$IBLAI_ORG/users/$IBLAI_USERNAME"
AUTH="Authorization: Api-Token $IBLAI_API_KEY"

curl -s -X POST "$BASE/mcp-servers/oauth-find/" -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"url":"https://mcp.acme.com/mcp","name":"Acme Docs",
       "callback_url":"https://app.example.com/google-oauth-callback/"}'
# 200 → {"id": 57, ...}  |  400 → read diagnostic.failed_step (manual client? see references)

curl -s -X POST "$BASE/mcp-servers/" -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"name":"Acme Docs","url":"https://mcp.acme.com/mcp","auth_type":"oauth2",
       "oauth_service":57,"auth_scope":"user"}'
# → capture "id": 405, then PUT mentors/{mentor}/settings/ with 405 in mcp_servers and "mcp" in tool_slugs
```

## Troubleshooting

- **The agent never calls the server.** `mcp` is missing from `tool_slugs`,
  or the id is missing from `mcp_servers`. These lists are replaced, not
  merged, so a careless settings write may have stripped them.
- **No sign-in prompt in chat.** Check four things:
  - the effective scope must be `user` and `auth_type` must be `oauth2`;
  - the server must link an `oauth_service`;
  - the chat user must be signed in;
  - the user may have turned the server off.
- **A server is silently missing in chat.** A `warning` named it: it was
  unreachable, slow (>15s) or its credentials failed. Or it's an API-key
  server with `user` scope and the user added no key.
- **`oauth-find` 400 `mcp_server_url`.** Wrong URL, or the server is down. A
  502 or a hang from it before was the same root cause.
- **`oauth-find` 400 `client_registration`.** The provider needs an OAuth app.
  Resend with `client_id` and `client_secret`.
- **`oauth-find` 400 `tenant_client_configured`.** Your org already has a
  client. Edit it through `credentials/`.
- **Start sign-in 400 "Could not build OAuth authorization URL".** No client
  for your org. Configure `credentials/` or run `oauth-find`.
- **Prompt every message even after signing in.** The connected service
  belongs to another user or org, or the connection is `is_active: false`.
- **The sign-in popup shows JSON.** The provider redirected to the backend
  callback instead of your callback page. Fix the redirect URI registered
  with the vendor.
- **`404` editing a server.** It's a featured or directory server; orgs can't
  modify those.
- **Scope enum** is `platform | mentor | user` on servers and connections.
  There is no `agent` or `tenant` value on the wire.

## Reference material

- [`references/catalog.md`](references/catalog.md) — the three kinds of
  server, ranking and filters, the `registry` object, the per-server state
  machine, and card conventions.
- [`references/admin-setup.md`](references/admin-setup.md) — `oauth-find`
  (including the manual client and the `failed_step` table), `credentials/`,
  `verify/`, `mentor-auth-scope/`, mandatory servers, and admin errors.
- [`references/user-controls.md`](references/user-controls.md) — sign-in step
  by step, a personal API key from `declared_headers`, permanent and
  per-conversation on/off, and disconnecting.
- [`references/in-chat-events.md`](references/in-chat-events.md) — every chat
  frame, the turn-ending errors, and handling notes.
- [`references/concepts.md`](references/concepts.md) — the backend models,
  credential and OAuth-client resolution, discovery and time limits, runtime
  isolation and sanitization, and access control.
- [`references/integration.md`](references/integration.md) — building the
  setup screens: form fields driven by `auth_type`, inline errors, and the
  browser OAuth flow.
- ibl.ai's own MCP servers (`@iblai/mcp`, the hosted `iblai-agent-chat`) are
  not ones this skill wires: [docs/mcp-servers.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/docs/mcp-servers.md).
