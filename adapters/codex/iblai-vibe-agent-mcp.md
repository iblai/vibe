# iblai-vibe-agent-mcp

> Add the agent MCP tab (outside services the agent can use in chats — Featured and Directory connectors, each switched on or off per agent, custom connectors with OAuth, API key or no auth, per-agent sign-in scope, "Allow Users to Turn Off", the organization's own OAuth app when a service can't register one, and the chat composer's MCP panel where users switch connectors per chat) to your Next.js app. Use when the user mentions MCP, connectors, connecting GitHub / Google Drive / Linear to an agent, OAuth client id and secret for a connector, letting users turn a connector off, or MCP in the chat box. For the Tools switch see /iblai-vibe-agent-tool; for the chat itself see /iblai-vibe-agent-chat; for the REST contract see /iblai-api-agent-mcp.

# /iblai-vibe-agent-mcp

Add the agent **MCP tab** -- the outside services (Model Context Protocol
servers) an agent can use in chats. **Featured** connectors are curated by
the platform, **Directory** lists the MCP directory plus the organization's
own connectors, and every card has one switch: on or off **for this agent**.
Configure (the gear) sets how a connector signs in for the agent, whether
users may turn it off, and the organization's own OAuth app. The same
connectors reach the chat: the composer's `+` menu gets an **MCP** row with
a per-chat switch per connector, which every user can use. This is one tab
in the agent-settings family; all tabs share `AgentSettingsProvider`.

![MCP tab — Featured](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-vibe-agent-mcp/iblai-vibe-agent-mcp-featured.png)

![MCP tab — Directory](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-vibe-agent-mcp/iblai-vibe-agent-mcp-connectors.png)

![Add MCP Connector](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-vibe-agent-mcp/iblai-vibe-agent-mcp-add.png)

![Configure MCP Connector — sign-in scope and connection](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-vibe-agent-mcp/iblai-vibe-agent-mcp-edit.png)

![Configure — App Credentials](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-vibe-agent-mcp/iblai-vibe-agent-mcp-configure-credentials.png)

![Configure — Advanced app settings](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-vibe-agent-mcp/iblai-vibe-agent-mcp-configure-advanced.png)

![Chat composer — the MCP row](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-vibe-agent-mcp/iblai-vibe-agent-mcp-chat-menu.png)

![Chat composer — the MCP panel](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-vibe-agent-mcp/iblai-vibe-agent-mcp-chat-panel.png)

> **Common setup (brand, conventions, env files, verification):** see [docs/skill-setup.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/docs/skill-setup.md).

## Prerequisites

- Auth must be set up first (`/iblai-vibe-auth`)
- MCP server + skills configured (`@iblai/mcp` in `.mcp.json`)
- `AgentSettingsProvider` must wrap the route (see `/iblai-vibe-agent-setting`
  Step 2 if not already set up)
- `@iblai/iblai-js` ^2.58.1 (resolves `@iblai/web-containers` 1.58.1): the
  Featured / Directory tabs, per-agent sign-in scope, "Allow Users to Turn
  Off", App Credentials and the chat's MCP panel are not in earlier releases
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

`McpTab` reads `tenantKey`, `mentorId`, `username`, `enableRBAC` and
`rbacPermissions` from `AgentSettingsProvider`. No props are required for
the standard mount.

### With a select handler (picker mode)

Inside a picker (the workflow editor's MCP step uses this) pass `onSelect`.
The card gets a **Select** button; picking a connector that is off turns it
on for the agent first (and opens its shared sign-in when one is needed),
then calls the handler.

```tsx
import { McpTab } from "@iblai/iblai-js/web-containers/next";

<McpTab
  onSelect={(server) => {
    console.log("connector selected", server.id, server.name);
  }}
/>;
```

## Step 3: Add the sign-in return page

A **Connect** opens the service's sign-in in a new tab and names
`${window.location.origin}/google-oauth-callback/` as the return address
(the path is fixed by the SDK, whatever the provider). vibe-starter does
not ship that page, so add it; without it every OAuth sign-in ends on a 404
and the tab keeps waiting. The page finishes the handshake through the
SDK's callback query and tells the opener two ways, as the SDK listens for
both: a `postMessage` and a `localStorage` key.

```tsx
// app/google-oauth-callback/page.tsx
"use client";

import { Suspense, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useLazyConnectedServicesCallbackQuery } from "@iblai/iblai-js/data-layer";

export default function OAuthCallbackPage() {
  // useSearchParams() needs a Suspense boundary in the App Router.
  return (
    <Suspense fallback={null}>
      <OAuthCallback />
    </Suspense>
  );
}

function OAuthCallback() {
  const searchParams = useSearchParams();
  const [finishSignIn] = useLazyConnectedServicesCallbackQuery();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    // Relay the provider's query string as is (never alter `state`).
    const params: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      params[key] = value;
    });
    params.redirect_uri = `${window.location.origin}/google-oauth-callback/`;

    finishSignIn(params)
      .unwrap()
      .then((result) => {
        const done = {
          connectedServiceId: result?.id as number | undefined,
          provider: result?.provider as string | undefined,
          serviceName: result?.service as string | undefined,
          serverId: readPendingServer()?.serverId,
          timestamp: Date.now(),
        };
        window.opener?.postMessage(
          { type: "GOOGLE_AUTH_SUCCESS", ...done },
          window.location.origin,
        );
        try {
          localStorage.setItem("oauth_connection_complete", JSON.stringify(done));
        } catch {
          // Private mode: the postMessage above still reaches the opener.
        }
      })
      .catch(() => {
        // The opener keeps polling and gives up after its own timeout.
      })
      .finally(() => setTimeout(() => window.close(), 1000));
  }, [searchParams, finishSignIn]);

  return <p className="p-6 text-sm text-gray-600">Finishing sign-in…</p>;
}

// The SDK stores the connector a sign-in was started for.
function readPendingServer(): { serverId?: number } | null {
  try {
    return JSON.parse(localStorage.getItem("oauth_pending_server") ?? "null");
  } catch {
    return null;
  }
}
```

The user is already signed in to your app, so the query carries their
session token. For a connector that signs in through the organization's own
OAuth app, `https://<your host>/google-oauth-callback/` is the **Redirect
URI** to register with the service (the Configure dialog shows and copies
it).

## Step 4: Use MCP Tools for Customization

```
get_component_info("McpTab")
get_component_info("McpServersMenu")
get_component_info("AgentSettingsProvider")
get_api_query_info("useGetMCPServersQuery")
```

## `<McpTab>` Props

Import from `@iblai/iblai-js/web-containers/next`.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `onSelect` | `(server: MCPServer) => void` | No | Adds a **Select** button to every card. Without it the tab is the agent's manager view. |

## What the tab renders

- **Header** -- "MCP" and "Outside services your agent can use in chats.
  Turn each one on or off for this agent."
- **Filters bar** -- search by name, a date-range picker (by `created_at`),
  and a transport filter (All / SSE / WebSocket / Streamable HTTP).
- **Featured / Directory** sub-tabs, shown as soon as the organization has
  featured connectors. **Featured** is the platform-curated set
  (`is_featured`), **Directory** is everything else the agent may use: the
  MCP directory (`registry.source === "registry"`) and the organization's
  own connectors (`include_global`, agent-bound ones included). 12 cards a
  page, with a pager per list.
- **A card** -- logo, name, a **scope pill** for sign-in connectors
  (**User**, **Agent** or **Organization**: whose account the agent uses;
  hover explains), a transport chip (Directory only), the description, and
  the actions:
  - the **switch** -- "On for this agent" / "Off for this agent". On adds
    the connector to the agent's `mcp_servers` and, the first time, the
    `mcp` tool with `can_use_tools`; off removes it, and the last one off
    drops the `mcp` tool again. A connector that signs in once for everyone
    (scope Agent or Organization) with no such sign-in yet also opens that
    sign-in when switched on.
  - the **gear** -- Configure (below).
  - the **trash** -- Directory only, the organization's own connectors
    only, with the delete permission. Featured and directory connectors
    cannot be edited or deleted by an organization.
- **Add Connector** -- needs the `/mcpservers/#create` permission.

### Add MCP Connector

| Field | Notes |
|---|---|
| Connector image | Optional file upload (image/*, under 2 MB). |
| Connector Name | Required -- the name people see in the chat and in agent settings. |
| Connector Server | Required -- the MCP server's address (`https://…`). |
| Description | Optional -- shows on the card. |
| Connector Scope | **All Agents** (`mentor: null`) or **This Agent** (`mentor: <uuid>`) -- which agents in the organization may use it. |
| Allow Users to Turn Off | On (default): people can switch it off in their own chats. Off: it stays on in every chat and nobody can switch it off (`user_can_disable: false`). |
| Transport | Streamable Http (default), SSE or Websocket. |
| Authentication Method | **No Authentication**, **API Key** or **OAuth**. |
| Token Type / Token | API Key only: Bearer or a custom scheme, and the key (hidden after save; leave it to keep the stored one). |
| Authentication Scope | OAuth only: **User** (each person signs in with their own account from the chat), **Agent** (one shared account for everyone who chats with this agent) or **Organization** (one shared account for every agent). |

**Connect** saves the connector and turns it on for the agent. For OAuth it
first asks the platform to find the service's sign-in settings
(`oauth-find`), then opens the sign-in. When the service cannot register an
app by itself, publishes no sign-in settings, or the organization already
has an app for it, the dialog stays open and shows **App Credentials**: the
Redirect URI to register with the service (copy button), **Client ID**,
**Client Secret** (blank for a public app), and under **Advanced** the
Permissions (scopes, pre-filled from what was discovered), **How the Secret
Is Sent** (in the request, HTTP Basic, or none), **Extra Sign-In / Token
Settings** (`name=value` lines), and the **Authorization URL / Token URL**
when the service publishes none. Save, and the sign-in opens through that
app. A server that did not answer, a blocked address or a timeout shows one
sentence under the address instead.

### Configure MCP Connector

The gear opens the same form on an existing connector. For the
organization's own connector everything is editable (changing the server
address of an OAuth connector restarts the sign-in). For a **featured or
directory** connector the fields are read-only; only two settings, both
**for this agent**, and the organization's App Credentials can change:

- **Authentication Scope** -- stored as the agent's override of the
  connector's own scope; the card's pill follows it. Choosing Agent or
  Organization while the agent has no such sign-in turns the connector off
  until it is switched on again (which opens the sign-in).
- **Allow Users to Turn Off** -- the platform may refuse it for a featured
  or directory connector ("Your organization can't change this setting").

Under Authentication Scope, **Connection** shows Connected / Not Connected
with **Connect** or **Disconnect** for the saved scope: the admin's own
sign-in for User scope, the shared account otherwise. Disconnecting a
shared sign-in also turns the connector off for the agent. **App
Credentials** shows the organization's app for an OAuth connector (secret
masked, "Saved. Enter a new one to replace it."), with **Remove
Credentials**; everyone who signed in through it must sign in again.

### The chat's MCP panel (for every user)

`Chat` (`/iblai-vibe-agent-chat`) adds an **MCP** row to the composer's `+`
menu by itself when the user is signed in, the chat is not embedded, and
the agent has at least one connector on. Its badge counts the connectors
that are on for this chat and signed in. The panel lists the agent's
connectors (name, logo, description) with one switch each:

- **On / Off for this chat** -- saved as the user's choice for this
  conversation and applied from their next message. A new chat starts on
  (or from the user's lasting choice, which only the API sets).
- a **lock** -- "Required by your organization": the connector was saved
  with Allow Users to Turn Off off, so the switch cannot move.
- a **User**-scope OAuth connector the person has not signed in to shows
  off; turning it on opens their own sign-in (an explainer dialog says so
  once per user; pop-ups must be allowed) and the agent uses it from the
  next message. Shared sign-ins are never done from the chat.

No grant beyond chatting is needed: a student can use the panel. Embedded
chats (`embed`) never show the row.

## Who sees what

| Control | Needs |
|---|---|
| The tab's cards and switches | an agent editor with read access to the agent's `mcp_servers` field; the switch needs write access |
| Add Connector, App Credentials | `/mcpservers/#create` |
| Delete | the connector's object delete permission (own connectors only) |
| Configure on a featured / directory connector | write access to `mcp_servers` |
| The chat's MCP panel | signing in and chatting |

With `enableRBAC` off on the provider, everything is shown.

## The four switches, side by side

| Setting | Where | Wire | Who it affects |
|---|---|---|---|
| Connector Scope | Add / Configure | `mentor` on the server (`null` = all agents) | which agents may list it |
| On / Off for this agent | the card | the agent's `mcp_servers` + the `mcp` tool slug | this agent's chats |
| Authentication Scope | Configure | `auth_scope` (`user` / `mentor` / `platform`) and the agent's override, read back as `effective_auth_scope` | whose account the agent signs in with |
| Allow Users to Turn Off | Add / Configure | `user_can_disable` | whether the chat's switch (and the user's lasting choice) can move |
| On / Off for this chat | the chat's MCP panel | the user's session preference; read back as `user_enabled` when the list is fetched with the conversation's `session_id` | one conversation of one user |

## Custom composer: `McpServersMenu`

The chat's panel is also exported on its own, from
`@iblai/iblai-js/web-containers`, for a composer of your own.

| Prop | Type | Required | Description |
|---|---|---|---|
| `tenantKey` | `string` | Yes | Organization key. |
| `username` | `string` | Yes | The signed-in user. |
| `mentorId` | `string` | Yes | The agent's unique id (UUID). |
| `sessionId` | `string` | No | The open conversation. With it every row gets the per-chat switch; without it a switch is shown only to sign in. |
| `onClose` | `() => void` | Yes | The panel's close button. |
| `onConnectingChange` | `(connecting: boolean) => void` | No | True while a sign-in is in flight: keep the panel mounted until it settles, or the sign-in is lost. |

## Step 5: Verify

Run `/iblai-vibe-ops-test` before telling the user the work is ready:

1. `pnpm build` -- must pass with zero errors
2. `pnpm test` -- vitest must pass
3. Touch test `/agents/<id>/mcp` in the browser as `/iblai-vibe-ops-test`
   says: switch a Directory connector on and off, open Configure on a
   featured one, add a connector with No Authentication, then open the home
   chat and check the `+` menu's MCP row and its switch; read the console,
   check the phone width.

## Important Notes

- **Redux store**: Must include `mentorReducer` and `mentorMiddleware`
  (the MCP endpoints are part of them).
- **`initializeDataLayer()`**: 5 args (v1.2+)
- **`@reduxjs/toolkit`**: Deduplicated via webpack aliases in `next.config.ts`
- **Peer deps**: `sonner` and `@iblai/iblai-web-mentor` must be installed
  (`pnpm add sonner @iblai/iblai-web-mentor`)
- **Shared provider**: `AgentSettingsProvider` must wrap the route at a
  layout level. See `/iblai-vibe-agent-setting` Step 2 for the full snippet.
- **The return page** (Step 3) is part of this skill, not optional: the
  sign-in tab only ever comes back to `/google-oauth-callback/`. Its origin
  must be one the service accepts -- the shared ibl.ai app is set up for
  the platform's hosts; for your own app at your own host, register the
  Redirect URI the Configure dialog shows.
- **Sign-in from the chat** needs the agent's connector to be User scope;
  Agent and Organization sign-ins are made from this tab by someone who
  manages the agent, as the shared account everyone will use.
- **A connector off for the organization** (`is_enabled: false`, set
  through the API) is never used, whatever the agent or the user chose, and
  does not appear in the chat's panel.
- **Tools tab**: the `mcp` tool slug is added and removed by the switch
  here; `/iblai-vibe-agent-tool` shows the same switch among the other
  tools.
- **Brand guidelines**: [BRAND.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/BRAND.md)

## Related Exports

From `@iblai/iblai-js/web-containers/next`: `McpTab`, `McpTabProps`.

From `@iblai/iblai-js/web-containers`: `McpServersMenu`, `McpServersMenuProps`.

From `@iblai/iblai-js/data-layer` -- the hooks the tab and the panel use,
for custom UI: `useGetMCPServersQuery` (`mentorUniqueId`, `includeGlobal`,
`isFeatured`, `isEnabled`, `sessionId`, `search`, `transport`, `pageSize`),
`useCreateMCPServerMutation`, `usePartialUpdateMCPServerMutation`,
`useDeleteMCPServerMutation`, `useOauthFindMutation`,
`useLazyStartOAuthFlowQuery`, `useLazyConnectedServicesCallbackQuery`,
`useGetConnectedServicesQuery`, `useDisconnectServiceMutation`,
`useGetMCPServerConnectionsQuery`, `useCreateMCPServerConnectionMutation`,
`useGetMCPServerMentorAuthScopeQuery` / `useSetMCPServerMentorAuthScopeMutation`,
`useGetMCPServerPreferenceQuery` / `useSetMCPServerPreferenceMutation`,
`useGetMCPServerSessionPreferenceQuery` / `useSetMCPServerSessionPreferenceMutation`,
`useGetMCPServerCredentialsQuery` / `useSetMCPServerCredentialsMutation` /
`useDeleteMCPServerCredentialsMutation`; types `MCPServer`,
`MCPServerConnection`, `ConnectedService`, `MCPAuthScope`,
`MCPServerOAuthCredentials`, `OAuthFindDiagnostic`.

## REST behind the tab

Everything is under `${dmUrl}/api/ai-mentor/orgs/{org}/users/{user_id}/`
where `dmUrl` is `${NEXT_PUBLIC_API_BASE_URL}/dm` (`config.dmUrl()` in the
starter); the sign-in services are under `${dmUrl}/api/ai-account/`.
Bodies, validation rules and errors: `/iblai-api-agent-mcp`.

| What the UI does | Call |
|---|---|
| List a tab | `GET mcp-servers/?mentor_unique_id=&include_global=true&is_featured=…&page_size=12` |
| Add / edit / delete a connector | `POST` / `PATCH` / `DELETE mcp-servers/[{id}/]` (multipart with `image`; `user_can_disable`, `mentor`, `auth_scope`, `oauth_service`) |
| Find a service's sign-in settings | `POST mcp-servers/oauth-find/` (`url`, `name`, `callback_url`; with the organization's own app: `client_id`, `client_secret`, `scopes`, `token_endpoint_auth_method`, `authorization_url`, `token_url`) |
| The organization's app for a connector | `GET` / `PUT` / `DELETE mcp-servers/{id}/credentials/` (secrets come back masked) |
| How a connector signs in for this agent | `GET` / `PUT mcp-servers/{id}/mentor-auth-scope/` (`mentor`, `auth_scope`; `null` restores the connector's own) |
| Switch on / off for the agent | `PUT mentors/{mentor}/settings/` with `mcp_servers`, `tool_slugs`, `can_use_tools` |
| Start a sign-in | `GET …/ai-account/connected-services/orgs/{org}/users/{user_id}/{provider}/{service}/` → `auth_url` |
| Finish it | `GET …/ai-account/connected-services/callback/?code=…&state=…&redirect_uri=…` (the Step 3 page) |
| Bind the sign-in | `POST mcp-server-connections/` (`server`, `scope`, `auth_type: "oauth2"`, `connected_service`, `mentor` for Agent scope) |
| Disconnect | `DELETE …/ai-account/connected-services/orgs/{org}/users/{user_id}/{id}/` |
| The chat's switch | `GET` / `PUT mcp-servers/{id}/session-preference/` (`session_id`, `is_enabled`); the lasting choice is `preference/` |