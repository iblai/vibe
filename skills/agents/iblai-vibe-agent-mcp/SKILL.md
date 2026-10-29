---
name: iblai-vibe-agent-mcp
description: Add the agent MCP tab (Model Context Protocol connector management with featured connectors, custom connectors, OAuth, and add/edit dialogs) to your Next.js app, or build a custom connector screen on the MCP REST API. Use when the user mentions MCP, connectors, MCP servers, signing in to a connector, or OAuth for an agent's tools. For the exact endpoints and chat events see /iblai-api-agent-mcp; for the tools tab see /iblai-vibe-agent-tool.
globs:
alwaysApply: false
metadata:
  kind: ui
---

# /iblai-vibe-agent-mcp

Add the agent **MCP tab** -- Model Context Protocol connector management
with a Featured Connectors gallery, a custom Connectors section with
add/edit/delete, OAuth connection flow, token-based auth, per-connector
scope (organization or this-agent), transport selection (Streamable HTTP / SSE),
and search/date/transport filters. This is one tab in
the wider agent-settings family. All tabs share the same
`AgentSettingsProvider` wrapper.

![MCP Tab — Featured Connectors](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-vibe-agent-mcp/iblai-vibe-agent-mcp-featured.png)

![MCP Tab — Custom Connectors](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-vibe-agent-mcp/iblai-vibe-agent-mcp-connectors.png)

![Add MCP Connector Dialog](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-vibe-agent-mcp/iblai-vibe-agent-mcp-add.png)

![Edit MCP Connector Dialog](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-vibe-agent-mcp/iblai-vibe-agent-mcp-edit.png)

> **Common setup (brand, conventions, env files, verification):** see [docs/skill-setup.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/docs/skill-setup.md).

## Prerequisites

- Auth must be set up first (`/iblai-vibe-auth`)
- MCP server + skills configured (`@iblai/mcp` in `.mcp.json`)
- `AgentSettingsProvider` must wrap the route (see `/iblai-vibe-agent-setting`
  Step 2 if not already set up)
- Ask the user for a real `mentorId` (agent UUID). Do NOT invent one.

## Step 1: Check Environment

Before proceeding, check for an `iblai.env` in the project root. Look for
`PLATFORM`, `DOMAIN`, and `TOKEN` variables. If the file does not exist or
is missing these variables, tell the user:
"You need an `iblai.env` with your platform configuration. Download the
template and fill in your values:
`curl -o iblai.env https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/iblai.env`"

## Step 2: Mount `McpTab`

```tsx
// app/(app)/agents/[mentorId]/mcp/page.tsx
"use client";

import { McpTab } from "@iblai/iblai-js/web-containers/next";

export default function AgentMCPPage() {
  return (
    <div className="flex h-full flex-col bg-white">
      <McpTab />
    </div>
  );
}
```

`McpTab` reads `tenantKey`, `mentorId`, `username`, and `rbacPermissions`
from `AgentSettingsProvider`. No props are required for the standard
mount.

### With a select handler (e.g. picker mode)

When the tab is used inside a picker (e.g. "choose a connector for this
workflow") rather than as a standalone page, pass `onSelect`. The handler
fires after the chosen connector is auto-activated.

```tsx
import { McpTab } from "@iblai/iblai-js/web-containers/next";

<McpTab
  onSelect={(server) => {
    console.log("connector selected", server);
  }}
/>;
```

## Step 3: Use MCP Tools for Customization

```
get_component_info("McpTab")
get_component_info("AgentSettingsProvider")
```

## `<McpTab>` Props

Import from `@iblai/iblai-js/web-containers/next`.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `onSelect` | `(server: MCPServer) => void` | No | Called with the chosen connector when the user clicks **Select**. Without it the Select button is hidden and the tab behaves as a manager-only view. |

## What the tab renders

- **Header** — "MCP" title and description.
- **Filters bar** — search by name, date-range picker, transport
  multiselect. The backend accepts only `streamable_http` and `sse`
  (`websocket` was removed): `?transport=websocket` returns 400, so hide that choice.
- **Featured Connectors** — global, platform-curated MCP servers
  (Ahrefs, Asana, Atlassian, GitHub, Google Drive, …). Each card shows
  the logo, name, connection state, auth-type chip (`OAuth` / `Token`),
  scope chip (`User` / `Mentor` / `Tenant`), provider tag, and a
  **Connect** / **Disconnect** button.
- **Connectors** — custom servers registered by the organization. Each card
  has a Connect/Disconnect button (when OAuth) plus **Edit** and
  **Delete**. The **Add Connector** button opens the add dialog.
- **Pagination** — separate pagers for Featured and Connectors when
  results overflow the page size (12).

### Add MCP Connector dialog

Opened from the **Add Connector** button. Collects:

| Field | Notes |
|---|---|
| Connector image | Optional file upload (max 2 MB, image/*). |
| Connector Name | Required. |
| Connector Server | Required. Must be a valid URL. |
| Description | Optional. |
| Connector Scope | `All Agents` (organization) or `This Agent` (agent-bound). |
| Transport | `Streamable Http` (default) / `SSE`. The backend rejects `websocket`. |
| Authentication Method | `No Authentication` / `API Key` / `OAuth`. |
| Authentication Scope | OAuth-only: `Tenant` / `Mentor` / `User` (wire values `platform` / `mentor` / `user`; the backend default is `user`). |
| Token Type + Token | API-Key only: `Bearer` / `Basic` / `API-Key` / `API-Token` / `Token` / `Other` (custom alphanumeric+hyphen, ≤50 chars). |

For OAuth, submitting the form opens the provider's consent screen in a
new tab and the dialog tracks completion via `storage`, `message`, and
`focus` events plus a 5 s polling fallback.

### Edit MCP Connector dialog

Same shape as Add. The token field is masked
(`••••••••••••••••••••`) — leave it untouched to keep the existing
secret, or type a new value to rotate. Changing the OAuth `Connector
Server` URL restarts the OAuth handshake.

## How the OAuth flow works

1. User clicks **Connect** on an OAuth card.
2. UI calls `POST .../oauth-flow/start` and opens the returned
   `auth_url` in a new tab.
3. After the user grants consent, the provider redirects back to the
   app's `/google-oauth-callback/` page (or equivalent), which posts a
   `GOOGLE_AUTH_SUCCESS` `message` and writes
   `oauth_connection_complete` to `localStorage`.
4. The MCP tab observes either signal and creates a
   `MCPServerConnection` record bound to the configured scope (`user`,
   `mentor`, or `platform` on the wire — the UI's *Tenant*).
5. Refetches Featured / Custom / ConnectedServices /
   MCPServerConnections / agent settings — the card flips to
   **Disconnect**.

A 5-minute safety timeout cleans up listeners if the user abandons the
flow. Closing the popup early triggers a 10 s grace cleanup so a
late-arriving callback can still complete.

## Related Exports

From `@iblai/iblai-js/web-containers/next`:

- `McpTabProps` — type for the `onSelect` handler.

From `@iblai/data-layer`:

- `MCPServer`, `MCPServerConnection`, `ConnectedService` — payload
  types for custom UI built on top of the same RTK Query hooks the tab
  uses (`useGetMCPServersQuery`,
  `useGetMCPServerConnectionsQuery`,
  `useCreateMCPServerConnectionMutation`,
  `useDisconnectServiceMutation`, `useLazyStartOAuthFlowQuery`).

## Step 4: Verify

Run `/iblai-vibe-ops-test` before telling the user the work is ready:

1. `pnpm build` -- must pass with zero errors
2. `pnpm test` -- vitest must pass
3. Touch test `/agents/<id>/mcp` in the browser as `/iblai-vibe-ops-test` says: open it,
   use every control this skill added, read the console, check the phone width.

## Important Notes

- **Redux store**: Must include `mentorReducer` and `mentorMiddleware`
- **`initializeDataLayer()`**: 5 args (v1.2+)
- **`@reduxjs/toolkit`**: Deduplicated via webpack aliases in `next.config.ts`
- **Peer deps**: `sonner` and `@iblai/iblai-web-mentor` must be installed
  (`pnpm add sonner @iblai/iblai-web-mentor`)
- **Shared provider**: `AgentSettingsProvider` must wrap the route at a
  layout level. See `/iblai-vibe-agent-setting` Step 2 for the full snippet.
- **OAuth callback page**: For OAuth-backed connectors, the consuming
  app must host a callback route (e.g.
  `app/google-oauth-callback/page.tsx`) that posts
  `GOOGLE_AUTH_SUCCESS` via `window.opener.postMessage` and writes
  `oauth_connection_complete` to `localStorage` so the parent window
  can resolve the flow.
- **Tools toggle**: Activating a connector for the first time
  auto-adds `mcp` to the agent's `tool_slugs` and sets
  `can_use_tools=true`. Deactivating the last connector removes `mcp`
  from `tool_slugs` again — see `/iblai-vibe-agent-tool` for the broader
  tools tab.
- **Brand guidelines**: [BRAND.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/BRAND.md)

## Building a custom MCP UI (REST)

For custom UI beyond `<McpTab>`. Endpoints are under
`${dmUrl}/api/ai-mentor/orgs/{org}/users/{user_id}/` (`…`) and
`${dmUrl}/api/ai-account/` (`ACCOUNT`), where `dmUrl` is
`NEXT_PUBLIC_API_BASE_URL`. The exact request/response shapes, permissions
and errors live in **`/iblai-api-agent-mcp`** (and its `references/`); this
section is the UI-builder's map.

### What to build, and the endpoint behind each control

| Control | Endpoint |
|---|---|
| Catalog (one ranked list: this agent → org → featured → directory) | `GET …/mcp-servers/?mentor_unique_id={id}&include_global=true&page_size=24` — filters `search` (debounce 300 ms), `transport`, `auth_type`, `supports_dcr`, `registry`, `trust_tier`, `is_featured` |
| Card text / icon / badges | `description`; `image ?? registry.icon_url`; *Official* / *Curated* (`registry.trust_tier`), *Legacy transport* (`transport_deprecated`), *Deprecated* (`status`) |
| Card primary action | derived from `mcp_server_connections` + `registry.setup` (`none` / `oauth` / `oauth_client` / `api_key`) — see the state table in `/iblai-api-agent-mcp` `references/catalog.md` |
| *Use with this agent* switch | `PUT …/mentors/{id}/settings/` — full `mcp_servers` list, plus `mcp` in `tool_slugs` (lists are replaced, not merged) |
| Add MCP server form | `POST …/mcp-servers/` — `transport` `streamable_http` (default) / `sse`; `auth_scope` default **`user`** (*Each user signs in*); `user_can_disable`; `mentor` for *This agent only* (attach it in the same save) |
| OAuth discovery before saving an OAuth server | `POST …/mcp-servers/oauth-find/` with `callback_url` = your callback page; on `400` show `diagnostic` (message per `failed_step`; `timed_out`) and, for `client_registration` / `authorization_server_metadata`, an inline OAuth-app form (client ID/secret; endpoints only for the latter) |
| OAuth app / org API key form (admin) | `GET`/`PUT`/`DELETE …/mcp-servers/{id}/credentials/` — copyable redirect URI; confirm before `DELETE` (signs everyone out) |
| *Test connection* (admin) | `POST …/mcp-servers/{id}/verify/` — show `diagnostic`, `tools`, `tools_error` |
| *Whose account is used* per agent (admin) | `GET`/`PUT …/mcp-servers/{id}/mentor-auth-scope/` (`user` / `mentor` / `platform` / `null`) |
| Mandatory server | `PATCH …/mcp-servers/{id}/` `{"user_can_disable": false}` — locked switch "Required by your organization" |
| *Sign in* | `GET ACCOUNT/connected-services/orgs/{org}/users/{user}/{oauth_service_data.oauth_provider}/{oauth_service_data.name}/` → open `auth_url` in a popup; the callback page relays `code`/`state` to `ACCOUNT/connected-services/callback/`; then `POST …/mcp-server-connections/` `{server, scope: "user", auth_type: "oauth2", connected_service}` |
| *Add your API key* | `POST …/mcp-server-connections/` `scope: "user"`, form built from `registry.declared_headers` |
| On/off (permanent / this conversation) | `PUT …/mcp-servers/{id}/preference/` / `…/session-preference/`; render the chat composer's menu from the catalog with `session_id` (`user_enabled`) |
| Connections page | `GET`/`DELETE ACCOUNT/connected-services/orgs/{org}/users/{user}/[{id}/]` |

Show *Edit*/*Delete* only for your org's servers and only when
`permissions.object.write` / `delete` are true — featured and directory
servers return `404` on write.

### OAuth callback page

The default redirect URI registered for every automatically registered OAuth
app is `https://{SPA_DOMAIN}/google-oauth-callback/` (configurable by staff
as `MCP_OAUTH_REDIRECT_URI`). That page must relay `code` and `state`
unchanged to `GET ${dmUrl}/api/ai-account/connected-services/callback/` for
**every** provider, then notify the opener (`postMessage`) and close. A `400
"The provider didn't respond in time…"` from the callback means the vendor
timed out — offer *Sign in again*.

### In-chat events

The chat stream carries `oauth_required` (turn pauses ≤ 5 min — show a
*Sign in* card keyed by `server_id`, plus *Skip in this conversation*),
`oauth_connection_resolved`, `oauth_authentication_timeout` (turn ends —
*Sign in* + *Retry*), `mcp_tools_retrieved`, and `warning` (one server was
skipped and is named in `message`; the rest still work). Full frame
reference: `/iblai-api-agent-mcp` `references/in-chat-events.md`.

### Common errors

- `oauth-find` `400` with `diagnostic.failed_step = "mcp_server_url"` — the
  server didn't answer within 5s; check the URL.
- Start sign-in `400 "Could not build OAuth authorization URL…"` — no OAuth
  client for the org; show "This connector isn't set up yet" (admins: the
  OAuth app form). Don't retry.
- Callback `400 "The provider didn't respond in time. Try signing in again."`.
- `400 OAuth2 connections require a connected service.` — finish the sign-in
  first and pass `connected_service`.
- `400 Selected MCP server is not available to the current tenant.` — the
  server isn't your org's, featured, or a listed directory server.
- `400 "This MCP server is required by your organization and cannot be turned off."`.
