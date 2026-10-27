# The MCP server catalog

> Complements the parent `/iblai-api-agent-mcp` skill, which has the endpoint
> list. This file covers the catalog in depth: the three kinds of server, the
> ranked list and its filters, the `registry` object, and how to work out what
> a server needs before it can be used.

## Three kinds of server, one list

| Kind | Who provides it | Who can edit it | How to tell |
|---|---|---|---|
| **Organization** | Your org, for all agents or for one agent (`mentor` set) | Your admins | `platform_key == org`, `registry == null` |
| **Featured** | Curated by ibl.ai (GitHub, Slack, Notion, Google Drive, …) | ibl.ai only | `is_featured == true`, `registry.source == "manual"` |
| **Directory** | Published by vendors to the [official MCP Registry](https://registry.modelcontextprotocol.io), verified by ibl.ai | ibl.ai only | `registry.source == "registry"` |

Featured and directory servers belong to `main` and are visible to every org.
Updating or deleting one returns `404`: your org can attach and connect them,
but not change them.

The directory is synced from the MCP Registry periodically. Only `curated`
and `official` entries are published. An entry counts as `official` when the
registry-verified domain also hosts the server. Directory servers are named in
Title Case (`io.acme/weather-mcp` becomes "Weather MCP"), but a publisher's
own casing such as "GitHub" is kept. They carry a re-hosted `image`,
downloaded from the registry icon or the vendor's site.

## Listing

```http
GET …/users/{username}/mcp-servers/?mentor_unique_id={mentor}&include_global=true&page=1&page_size=24
```

Results are ranked: the agent's own servers, then the org's, then featured,
then directory. Group them on the client:

| Section | Condition |
|---|---|
| This agent | `mentor == <agent uuid>` |
| Your organization | `platform_key == org && mentor == null` |
| Featured | `is_featured == true` |
| Directory | `registry?.source == "registry"` |

The list is paginated with the stock DRF envelope (`count`, `next`,
`previous`, `results`); `page_size` defaults to 20 and is capped at 30.

| Query param | Values | Notes |
|---|---|---|
| `search` | string | Matches name and URL. Debounce input (300 ms). |
| `transport` | `streamable_http`, `sse` | |
| `auth_type` | `none`, `token`, `oauth2` | `none` = "no sign-in needed". |
| `auth_scope` | `user`, `mentor`, `platform` | |
| `is_featured`, `is_enabled` | boolean | |
| `registry` | boolean | `true`: directory only. `false`: exclude directory. |
| `trust_tier` | `curated`, `official` | |
| `supports_dcr` | boolean | "Sign-in works out of the box": no admin OAuth setup needed. |
| `mentor_unique_id` | agent UUID | Adds `mentor_auth_scope` and `effective_auth_scope` to each row. |
| `include_global` | boolean | With `mentor_unique_id`: include org, featured and directory servers. |
| `session_id` | chat session UUID | Makes `user_enabled` reflect that conversation's on/off choice. |
| `date_filter` | `today`, `7d`, `30d`, `90d`, `all_time`, `custom` | Creation date. |
| `start_date`, `end_date` | `YYYY-MM-DD` | Explicit creation-date window. |

The directory has thousands of entries: use infinite scroll or numbered pages.

## Server fields worth knowing

| Field | Notes |
|---|---|
| `description` | Card text. (Not the OAuth service's description.) |
| `image` | Icon; when null, fall back to `registry.icon_url`. |
| `user_can_disable` | `false` = mandatory: users can't turn it off. |
| `user_enabled` (read-only) | Whether the server is on for the caller, after their preferences. |
| `oauth_service_data` (read-only) | `{id, oauth_provider, name, display_name, scope}`, the provider and service names a sign-in starts with. |
| `mcp_server_connections` (read-only) | The caller's applicable active connections. Non-empty means connected. |
| `mentor_auth_scope`, `effective_auth_scope` (read-only) | Present only when listing with `mentor_unique_id`. |
| `permissions` (read-only) | `object.write`, `object.delete` and per-field read/write for the caller. Show *Edit*/*Delete* only when true. |

## The `registry` object

Set on featured and directory servers, `null` on organization servers.

```json
{
  "name": "ai.boxcompute/boxcompute",
  "version": "1.1.0",
  "namespace": "ai.boxcompute",
  "source": "registry",
  "trust_tier": "official",
  "status": "active",
  "website_url": "https://boxcompute.ai",
  "icon_url": "https://boxcompute.ai/boxcompute-app-icon-512.png",
  "transport_deprecated": false,
  "auth_kind": "oauth2",
  "supports_dcr": true,
  "setup": "oauth",
  "declared_headers": [
    { "name": "Authorization", "description": "Bearer + a BoxCompute API key.",
      "is_secret": true, "is_required": null, "value": "" }
  ]
}
```

| Field | Meaning |
|---|---|
| `source` | `manual` (featured) or `registry` (directory). |
| `trust_tier` | `curated` (ibl.ai) or `official` (vendor, on its own domain). Badge them. |
| `status` | `active` or `deprecated`. |
| `transport_deprecated` | True when only the legacy `sse` transport is offered. |
| `auth_kind` | `none`, `oauth2`, `api_key`, `unknown`. |
| `supports_dcr` | The provider registers OAuth clients automatically (RFC 7591). |
| `setup` | What must happen before use. See below. |
| `declared_headers` | Headers the server documents. `is_secret` marks credentials; `is_required` is `true`, `false` or `null` (unspecified); a non-empty `value` is sent automatically. |

## What a server needs before it can be used

Derive one state per server and show one primary action:

```ts
type ServerState = "disabled" | "connected" | "ready" | "sign_in" | "needs_oauth_app" | "needs_api_key";

function serverState(s: McpServer): ServerState {
  if (!s.is_enabled) return "disabled";
  if (s.mcp_server_connections.length > 0) return "connected";
  switch (s.registry?.setup ?? fallbackSetup(s)) {
    case "none":         return "ready";
    case "oauth":        return "sign_in";
    case "oauth_client": return "needs_oauth_app";
    case "api_key":      return "needs_api_key";
  }
}

// Organization servers have no registry object.
function fallbackSetup(s: McpServer) {
  if (s.auth_type === "oauth2") return "oauth";
  // A server-level key comes back masked but non-empty.
  if (s.auth_type === "token") return s.credentials ? "none" : "api_key";
  return "none";
}
```

| State | Admin action | Member action |
|---|---|---|
| `ready` | — | — |
| `connected` | *Disconnect* | *Disconnect* |
| `sign_in` | *Sign in* | *Sign in* |
| `needs_oauth_app` | *Set up OAuth* (`credentials/`, or `oauth-find` with a manual client) | "Your administrator needs to finish setting this up." |
| `needs_api_key` | *Add API key*, for everyone (`credentials/`) or for themselves | *Add your API key* when `effective_auth_scope` is `user`; otherwise "Your administrator needs to add a key." |
| `disabled` | *Enable* | hidden |

When `effective_auth_scope` is `mentor` or `platform`, an admin signs in once
on behalf of everyone and members see the server as ready. If starting a
sign-in returns `400`, treat the server as `needs_oauth_app`.

## Card conventions

- Badges: *Official* (`trust_tier: official`), *Curated* (`curated`), *Legacy
  transport* (`transport_deprecated`), *Deprecated* (`status: deprecated`).
- Keep **attachment** (a *Use with this agent* switch, driven by the agent's
  `mcp_servers`) separate from **connection** (*Sign in* / *Add key* /
  *Connected*).
- Accessible names include the server name ("Sign in to BoxCompute").
