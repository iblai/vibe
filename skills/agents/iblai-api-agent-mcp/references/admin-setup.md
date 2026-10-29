# Admin setup: OAuth apps, organization keys, testing, agent scope

> Complements the parent `/iblai-api-agent-mcp` skill. This file has the full
> request and response shapes for the administrator endpoints:
> - `oauth-find`
> - `credentials/`
> - `verify/`
> - `mentor-auth-scope/`
> - mandatory servers
>
> `…` = `https://api.iblai.app/dm/api/ai-mentor/orgs/{org}/users/{username}`.

## Discover OAuth and register a client: `POST …/mcp-servers/oauth-find/`

Run this before creating an `oauth2` server; pass the returned `id` as the
server's `oauth_service`. It does three things:
1. reuses an existing service for the URL;
2. otherwise discovers the server's OAuth setup (RFC 9728 protected resource
   metadata, then RFC 8414 / OIDC authorization server metadata);
3. registers your org's own client by dynamic client registration (RFC 7591).

Permission: `Ibl.Mentor/MCPServers/action`, the same as creating a server.

| Field | Type | Notes |
|---|---|---|
| `url` | URL, required | The MCP server URL. |
| `name` | string | Display name for the provider. The server's own published name wins. |
| `mentor` | agent UUID | The agent the server will belong to. The permission is then checked on that agent. |
| `callback_url` | https URL | The redirect URI to register: your app's OAuth callback page. Defaults to the org's `MCP_OAUTH_REDIRECT_URI`, which is `https://{SPA_DOMAIN}/google-oauth-callback/` unless staff changed it. |

**200** → the OAuth service. Use its `id` as `oauth_service`:

```json
{ "id": 57, "oauth_provider": "mcp_mcpacmecom", "oauth_provider_id": 31, "name": "acme_docs",
  "display_name": "Acme Docs", "description": "", "scope": "read write", "image": null }
```

**400** → automatic registration didn't work. The body is
`{ error, diagnostic }`:

```json
{
  "error": "OAuth service not found for this MCP server and dynamic client registration is not supported or failed. Please configure OAuth credentials manually.",
  "diagnostic": {
    "succeeded": false,
    "failed_step": "client_registration",
    "hint": "The authorization server does not offer dynamic client registration.",
    "timed_out": false,
    "discovered": {
      "authorization_endpoint": "https://github.com/login/oauth/authorize",
      "token_endpoint": "https://github.com/login/oauth/access_token",
      "scopes_supported": ["repo", "read:org"],
      "token_endpoint_auth_methods_supported": ["client_secret_post"]
    },
    "attempts": [ { "step": "unauthenticated_probe", "url": "https://…", "status_code": 401, "outcome": "challenge", "detail": null } ]
  }
}
```

| `failed_step` | Meaning / message to show |
|---|---|
| `mcp_server_url` | The URL is not allowed, or the server didn't accept a connection within 5s ("Couldn't connect to the MCP server"). Check the URL. |
| `authorization_server_metadata` | The server publishes no OAuth configuration. A manual client **with** endpoints is needed. |
| `client_registration` | The provider has no automatic registration (GitHub, Slack, …). A manual client (ID and secret) is needed. |
| `manual_client` | The manual client fields were rejected; `hint` says why. |
| `provider_name_conflict` | A provider with that name exists; choose another `name`. |
| `tenant_client_configured` | Your org already has a client for this provider; edit it through `credentials/`. |
| `internal_error` | Something went wrong; retry. |

`diagnostic.timed_out: true` means discovery stopped after 15s because the
server answered too slowly; retry later. Discovery is bounded so the call
always answers well within a proxy's limit.

### Manual OAuth client in the same call

When registration is impossible, send the client created in the vendor's
console with the same request. `callback_url` is then **required** and must
match the redirect URI registered with the vendor.

| Field | Notes |
|---|---|
| `client_id` | Turns on manual setup. Every field below is accepted only with it. |
| `client_secret` | Required with `client_id`; `""` for a public client (auth method becomes `none`). |
| `authorization_url`, `token_url` | https; send both or neither. **Only** for a server that publishes no OAuth metadata (`failed_step: authorization_server_metadata`). Refused when the server publishes its own. |
| `token_endpoint_auth_method` | `client_secret_post` \| `client_secret_basic` \| `none`. |
| `scopes` | List (≤ 50); pre-fill from `diagnostic.discovered.scopes_supported`. |

| First call failed at | Retry with |
|---|---|
| `client_registration` (e.g. GitHub) | `client_id` + `client_secret` only. |
| `authorization_server_metadata` | `client_id` + `client_secret` + `authorization_url` + `token_url`. |
| anything else | A client can't help. |

A successful manual setup returns **200** with the OAuth service. Your typed
endpoints are stored on **your org's** client only, never on the shared
provider. They must be https and are checked against private addresses each
time a sign-in, callback or refresh uses them. Nothing is stored for an
unreachable server or a run that timed out.

```json
{ "url": "https://mcp.osi.example.com/mcp", "name": "OSI",
  "callback_url": "https://app.example.com/google-oauth-callback/",
  "client_id": "abc123", "client_secret": "s3cret",
  "authorization_url": "https://auth.osi.example.com/oauth/authorize",
  "token_url": "https://auth.osi.example.com/oauth/token", "scopes": ["read"] }
```

## The org's own OAuth client or API key: `…/mcp-servers/{id}/credentials/`

Admins only: `Ibl.Mentor/MCPServers/credentials/read|write` **and** platform
admin. These verbs are seeded to nobody; anyone else gets `403 "MCP server
credentials are limited to platform admins."`. Works for org, featured and
directory servers. Secrets are always masked.

**GET** (OAuth server):

```json
{ "auth_type": "oauth2", "configured": true, "shared_client_allowed": false, "source": "manual",
  "client_id": "Iv1.abc123", "client_secret": "****89",
  "redirect_uri": "https://app.example.com/google-oauth-callback/",
  "scopes": ["repo"], "token_endpoint_auth_method": "client_secret_post",
  "authorization_params": {"prompt": "consent"}, "token_params": {},
  "authorization_url": "", "token_url": "", "client_secret_expires_at": null, "updated_at": "…" }
```

- With nothing configured: `{"auth_type": "oauth2", "configured": false, "shared_client_allowed": <bool>}`.
- `shared_client_allowed: true` means users can already sign in through a
  client shared by ibl.ai (featured servers only, never directory servers).
- `source` is one of:
  - `dcr` — registered automatically;
  - `manual` — set by an admin;
  - `legacy_backfill` — migrated from an earlier configuration.

**PUT** (OAuth server): `client_id` (required), `client_secret` (required on
the first save; omit to keep it, `""` for a public client), `redirect_uri`
(required, must match the vendor console), plus optional:
- `scopes`;
- `token_endpoint_auth_method`;
- `authorization_params` / `token_params`, as extra request parameters such as
  `{"prompt": "consent", "access_type": "offline"}`. Protocol parameters like
  `client_id`, `redirect_uri` and `state` are rejected;
- `authorization_url` / `token_url` (omit to keep them, `""` to clear).

A manual client is never replaced by automatic registration.

**GET / PUT** (API-key server):

```json
{ "api_key": "sk-live-...", "authorization_scheme": "Bearer", "header_name": "" }
```

`api_key` is required on the first save (omit it to keep the stored key);
`header_name` blank means `Authorization`. The response reads back
`{"auth_type": "token", "configured": true, "api_key": "****9f",
"authorization_scheme": "Bearer", "header_name": "Authorization"}`. An org key
is used only when the effective scope is `platform`.

**DELETE** → `204`. Removing an OAuth client signs every user out of that
provider. Confirm with the user first.

## Test a server: `POST …/mcp-servers/{id}/verify/`

Stores nothing (it may refresh the caller's own expired token, as chat would).
Admins only, with the same permission as `credentials/`.

```json
{
  "auth_type": "oauth2",
  "client_source": "tenant",
  "authorize_url": "https://mcp.example.com/oauth/authorize?client_id=...&state=<state>&code_challenge=<code_challenge>",
  "diagnostic": { "succeeded": true, "failed_step": null, "timed_out": false, "…": "…" },
  "tools": ["file_read", "file_write"],
  "tools_error": null
}
```

- `client_source`: `tenant`, `legacy` (shared client) or null. OAuth servers
  only.
- `authorize_url` is informational: it contains placeholders, so never open it.
- `tools` lists tools using the headers a chat by the caller would use.
- `tools_error` explains a `null` list:
  - "Skipped: connect your account to this server to list tools." Offer
    *Sign in*, then test again.
  - "Timed out after 15s listing tools."
  - The server's own error.

## Whose credentials an agent uses: `…/mcp-servers/{id}/mentor-auth-scope/`

Admins only (`Ibl.Mentor/MCPServers/MentorAuthScope/read|write` and platform
admin). The server must be attached to the agent, else `404 "This mentor does
not use this MCP server."`.

- **GET** `?mentor={uuid}` returns
  `{"server": 379, "mentor": "…", "auth_scope": null, "server_auth_scope": "user", "effective_auth_scope": "user"}`.
- **PUT** `{"mentor": "<uuid>", "auth_scope": "platform"}`; `null` restores
  the server's default.

When switching an OAuth server to `mentor` or `platform`, have the admin
connect the shared account right away: a sign-in, then a connection with
`scope: "mentor"` (plus `mentor`) or `scope: "platform"`. Shared accounts let
everyone chatting with the agent act as that account. Use them for service
accounts only.

## Make a server mandatory

`PATCH …/mcp-servers/{id}/` with `{"user_can_disable": false}`. Mandatory
servers are always used when attached and enabled. Users' opt-outs are
ignored, and turning one off returns `400 "This MCP server is required by your
organization and cannot be turned off."`. It's a server setting, so to make a
server mandatory for one agent, create it for that agent (`mentor` set).
Featured and directory servers can't be edited.

## Error reference (admin endpoints)

| Endpoint | Status | Body |
|---|---|---|
| `mcp-servers/` create | 400 | `{"oauth_service": ["This field is required if the MCP Server is an Oauth MCP server."]}`: run `oauth-find` first |
| `mcp-servers/{id}/` update/delete | 404 | featured and directory servers can't be modified |
| `credentials/` | 400 | `{"error": "This MCP server does not use credentials."}` |
| `credentials/` | 400 | `{"error": "This OAuth MCP server has no OAuth service configured."}` |
| `credentials/` | 400 | `{"error": "authorization_url is not allowed."}` (private or blocked address) |
| `credentials/` | 403 | `{"detail": "MCP server credentials are limited to platform admins."}` |
| `mentor-auth-scope/` | 403 | `{"detail": "A mentor's MCP connection mode is set by platform admins."}` |
| `mentor-auth-scope/` | 404 | `{"error": "This mentor does not use this MCP server."}` |
