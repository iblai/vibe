# MCP & OAuth — concepts and backend model

> Complements the parent `/iblai-api-agent-mcp` skill. The endpoints, the
> `auth_type` × `auth_scope` matrix, the resolution order, the OAuth flow, and
> the in-chat events all live in `SKILL.md`. This file adds only what SKILL.md
> doesn't: the backend data model, the design "why", and the security and
> extensibility rules — for engineers operating or extending the subsystem.

## Backend data model

Five Django models back the three wire objects (server / connection / agent
wiring). An **org is a `Platform`** in the backend — the `org` / `platform_key`
you send resolves to a `Platform` row.

| Model | Role |
|---|---|
| `OauthProvider` | a vendor (`google`, `dropbox`); holds `auth_url`, `token_url`, `is_enabled` |
| `OauthService` | one surface of a provider (`drive`, `calendar`); carries the requested `scope` |
| `ConnectedService` | a user's persisted token grant for one service; unique on `(user, provider, platform, service)` |
| `MCPServer` | registered on a `Platform`; the `auth_type` × `auth_scope` metadata |
| `MCPServerConnection` | credential binding; optionally references a `ConnectedService`, optionally scoped to an agent |

`OauthProvider` → many `OauthService` → many `ConnectedService` (per user, per
org). `MCPServer` → many `MCPServerConnection`; an `oauth2` connection points at
exactly one `ConnectedService`. The unique constraint is what enforces "one
grant per surface" — re-running OAuth updates that row in place instead of
duplicating it.

### Modules

| Concern | Where |
|---|---|
| MCP server / connection CRUD | `MCPServerViewSet`, `MCPServerConnectionViewSet` |
| OAuth discovery + flow | account views; `get_cred`, connected-services utils |
| In-chat handshake | chat consumer + `MCPOAuthCoordinator` |
| Runtime resolution (LangChain tool layer) | `MCPServer.resolve_connection` (async `aresolve_connection`, `.afirst()`) → `render_headers()` |

## Runtime resolution

SKILL.md lists the first-match order (user → mentor → platform → featured →
401/in-chat-OAuth). Implementation: `resolve_connection(platform, user, agent)`
runs it; the async twin (`aresolve_connection` + `.afirst()`) keeps the event
loop unblocked; `render_headers()` builds the outbound headers, merging
`extra_headers` and letting explicit `credentials` win. For `oauth2` it ensures
a fresh access token — refreshing via the provider adapter — before returning.

## OAuth model — the "why"

The connector flow exists so a user (or admin) grants the platform permission
to act on their behalf against a vendor, without the platform ever holding the
user's vendor password. The endpoint flow (discover → start → callback →
list/delete) is in SKILL.md; the design points that explain its constraints:

- **State is a checked round-trip.** `start` stores a UUID hash in the cache and
  returns `state = org:provider:service:username:hash`. The callback splits it
  apart and verifies the hash against the cache before exchanging the code —
  that is why `state` must be relayed byte-for-byte and why the flow dies after
  the **1-hour** cache TTL (the replay window).
- **Tokens are stored raw, server-side only.** `access_token`, `refresh_token`,
  and `token_type` are persisted as returned (provider/service ids lowercased
  for schema consistency) and refreshed on demand — clients never see or handle
  tokens.
- **Fail-fast.** A missing org credential fails the start call (`404`/`400`;
  SKILL.md: `400 No credentials found`); more than one service per connection
  raises `ValueError` early. Credentials come from one source, `get_cred("auth_{provider}", <org>)`,
  with a global `main` default an org can override.

## Validation & access control

SKILL.md enumerates the per-field connection rules. The reasons behind two:
`platform` and `user` are **read-only on write** because the backend derives
them from the request context (org from the token, user from the caller), so
sending them can only conflict; the featured exception lets a `platform`
connection target a server owned by another org **only if** that server is
`is_featured`.

Access control:

- OAuth connector endpoints allow only `GET` / `DELETE` — a `ConnectedService`
  is **never** created directly; only the managed callback creates one.
- MCP server / connection create-update-delete require **org-admin** privileges.

## Extensibility

- **New provider or service:** seed `OauthProvider` + `OauthService` (management
  command) and install the `auth_{provider}` credential. Discovery is
  data-driven — no endpoint changes needed to surface it.
- **New auth type:** add the `MCPServer.AuthType` enum member, extend connection
  validation, and teach `render_headers()` the new header shape.
- **Cross-org sharing:** `is_featured=true` lets other orgs create their own
  connections while the owning org keeps control of the server metadata.
