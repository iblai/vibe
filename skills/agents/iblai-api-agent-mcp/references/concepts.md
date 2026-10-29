# MCP & OAuth: concepts and backend model

> Complements the parent `/iblai-api-agent-mcp` skill. `SKILL.md` has the
> endpoints, the scope matrix and the chat events. This file covers the
> backend data model, the design reasons behind it, and the security and
> runtime rules. It's for engineers who operate or extend the subsystem.

## Backend data model

An **org is a `Platform`** in the backend: the `org` / `platform_key` you send
resolves to a `Platform` row.

| Model | Role |
|---|---|
| `MCPServer` | A registered endpoint: URL, transport, `auth_type`, default `auth_scope`, `user_can_disable`, optional `mentor` (agent-only server), `oauth_service`. Featured and directory servers live on `main`. |
| `MCPServerConnection` | A credential binding at `user`, `mentor` or `platform` scope: an API key / headers, or a link to a `ConnectedService`. |
| `MentorMCPServer` | Attaches a server to an agent (`Mentor.mcp_servers`). Its `auth_scope_override` is the agent's credential scope. |
| `UserMCPServerPreference` / `SessionMCPServerToggle` | A user's permanent and per-conversation on/off choices. |
| `OauthProvider` / `OauthService` | A vendor and one of its surfaces. MCP providers are discovered and named `mcp_<host>`. Their auth and token URLs come from discovery only. |
| `TenantOAuthClient` | An org's own OAuth client for a provider: `source` `dcr` / `manual` / `legacy_backfill`, an encrypted secret, `redirect_uri`, scopes, request params, and optional per-org `authorization_url` / `token_url`. One per (org, provider). |
| `ConnectedService` | A user's token grant for one service: encrypted tokens, refreshed on demand, plus the client that issued it. |
| `MCPRegistryEntry` / `MCPRegistryOverride` / `MCPRegistryPublisher` / `MCPRegistrySyncRun` | The directory, synced from the MCP Registry, together with staff curation (feature, block, override URL or title) and the sync audit log. |

All secrets use encrypted fields and are masked on every read. The Django
admin shows them as write-only inputs: blank keeps the stored value, a new
value replaces it, and *Clear* removes it.

## Credential resolution (scopes are enforced)

`effective_auth_scope = agent's override ?? server.auth_scope`. In chat, the
first match wins:

| Effective scope | Tried, in order | When nothing matches |
|---|---|---|
| `user` | the chatting user's own connection | OAuth: the in-chat `oauth_required` prompt. API key: the server is skipped. |
| `mentor` | the user's own, then the agent's | the server is skipped |
| `platform` | the user's own, the agent's, the org's, then a key stored on the server, then the featured server's global connection | the server is skipped |

A shared credential **never** satisfies a `user`-scoped server. `verify/`
follows the same rule.

## Which OAuth client signs a user in

Every OAuth call goes through one resolver: the authorize URL, the callback
code exchange, both refresh paths, and the Google tools. It picks, in order:

1. the connection's own issuing client (a connection keeps refreshing with the
   client that created it);
2. the org's `TenantOAuthClient`;
3. the client shared by ibl.ai. Featured servers only, when
   `allow_global_client_fallback` is set; directory servers never use it.

For a directory server that supports DCR, the org's client is registered on
its **first sign-in**. A DCR client the provider rejects (`invalid_client`) is
re-registered on the next sign-in. A manual client is never replaced by DCR.

The callback exchanges the code with the same client the authorize URL was
built with. That client is pinned in the cache next to the `state`.

## The OAuth round trip: why it's built this way

- **State is a checked round trip.** `start` caches a hash and returns
  `state`. The callback verifies it before exchanging the code, so `state`
  must be relayed byte for byte, and the flow dies after the **1-hour** cache
  TTL.
- **PKCE (S256) and RFC 8707 `resource`** are sent for clients registered by
  discovery. The verifier is single-use and cached under its own key.
- **Redirect URI.** By default it's the app's frontend callback page,
  configured by the `MCP_OAUTH_REDIRECT_URI` setting (default
  `https://{SPA_DOMAIN}/google-oauth-callback/`, overridable per org by
  staff). The backend callback route returns JSON and is never registered as a
  redirect URI.
- **Tokens are server-side only.** Clients never see or handle tokens. Refresh
  sends the same `resource` as the exchange, and public clients send no
  secret.

## Discovery (oauth-find, verify, first sign-in)

The steps follow the MCP auth spec:
1. an unauthenticated `initialize`, read from the 401 challenge;
2. the RFC 9728 protected-resource metadata, which must **cover** the server
   URL (same origin, at or above its path), so tokens can't be minted for
   another audience;
3. RFC 8414 / OIDC metadata, with path insertion;
4. RFC 7591 registration.

Scopes come from the challenge, else the resource's `scopes_supported`, else
none.

Every URL passes the SSRF guard. Discovery is also **bounded in time**:
- 5s to connect and 10s to read;
- an origin that refuses a connection isn't tried again;
- a 15s budget per run.

An unreachable server fails at `mcp_server_url` in about 5s, and
`diagnostic.timed_out` marks a run cut short. Token exchange and refresh are
bounded too: 5s to connect, 20s to read.

## Runtime (chat) behavior

- **Isolation:**
  - each server lists its tools in parallel, within 15s;
  - a quick failure is retried once;
  - a failing server is skipped **alone**, with one `warning` naming it.
- **Elicitation:** server-initiated input requests are declined, so a remote
  server can't stall a turn.
- **Sanitization:**
  - every MCP tool result is wrapped in `[BEGIN/END MCP CONTENT]` markers;
  - HTML is stripped unless the server's admin-only `clean_output` is off.
- **Transports:** `streamable_http` and `sse` only. The `websocket` transport
  was removed, and existing rows were moved to `streamable_http`.

## Access control

- A `ConnectedService` is created only by the managed callback, never directly.
- Creating an org server and running `oauth-find` need
  `Ibl.Mentor/MCPServers/action`. On a specific agent, that permission is
  checked on the agent.
- `credentials/`, `verify/` and `mentor-auth-scope/` need their verbs **and**
  platform admin. Those verbs are seeded to nobody.
- Members hold `Ibl.Mentor/MCPServers/UserPreference/*`,
  `Ibl.Mentor/GetRedirectUrl/action`, their own connected services, and
  user-scoped connections.
- Featured and directory servers can't be modified by orgs (`404`).
