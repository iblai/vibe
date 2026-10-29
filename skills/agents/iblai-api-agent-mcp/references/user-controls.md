# User controls: sign in, add a key, turn servers on and off, disconnect

> Complements the parent `/iblai-api-agent-mcp` skill. These are the end-user
> flows (any member, on their own account): connect an OAuth server, add a
> personal API key, switch servers off permanently or for one conversation,
> and remove sign-ins.
>
> `…` = `https://api.iblai.app/dm/api/ai-mentor/orgs/{org}/users/{username}`;
> `ACCOUNT` = `https://api.iblai.app/dm/api/ai-account`.

## Connect an account (OAuth sign-in)

Use the same flow for:
- a *Sign in* button;
- the in-chat `oauth_required` prompt;
- an admin connecting a shared account.

```
Your app                     Data Manager                    Provider
1. GET start  ─────────────▶ build authorization URL
              ◀───────────── { auth_url }
2. open auth_url in a popup ────────────────────────────────▶ user signs in
3. callback page ◀────────────────────────────────────────── ?code&state
   GET callback ────────────▶ exchange code, store tokens
              ◀───────────── connected service
4. POST connection (outside chat only)
```

**1. Start.** The provider and service names come from the server's
`oauth_service_data` (`oauth_provider`, `name`):

```http
GET {ACCOUNT}/connected-services/orgs/{org}/users/{username}/{oauth_provider}/{service_name}/?login_hint={email}
```

→ `{"auth_url": "https://…/authorize?client_id=…&redirect_uri=…&state=…&code_challenge=…&code_challenge_method=S256&resource=…"}`.
`login_hint` is optional. For a directory server with `supports_dcr`, your
org's first sign-in registers the client, so it may take a few seconds.
`400 "Could not build OAuth authorization URL…"` means no OAuth client is
available to your org. Show "This connector isn't set up yet" and don't retry
automatically.

**2. Open** `auth_url` in a popup (about 600×700) or a new tab, never an iframe:
providers block framing. Keep a keyboard-reachable fallback link.

**3. Finish.** The provider redirects to the registered redirect URI, which by
default is the app's frontend callback page `/google-oauth-callback/`. That page
relays `code` and `state` **unchanged** to:

```http
GET {ACCOUNT}/connected-services/callback/?code={code}&state={state}
```

No `Authorization` header is needed, because `state` identifies the request.
The response is the connected service (`id`, `provider`, `service`,
`expires_at`, `scope`, `scope_names`, `token_type`, `username`, …). Then notify
the opener and close the popup:

```js
window.opener?.postMessage({ type: "mcp-oauth-complete", ok: true, connectedServiceId: 73 }, window.location.origin);
window.close();
```

| Callback error | Meaning | Show |
|---|---|---|
| `404 Invalid state` | Expired (1 hour) or already used | "This sign-in link has expired. Try again." |
| `400 {"error": "Failed to retrieve token …"}` | The provider rejected the code | "Sign-in failed. Try again." |
| `400 {"error": "Could not exchange auth token with provided code"}` | | "Sign-in failed. Try again." |
| `400 {"error": "The provider didn't respond in time. Try signing in again."}` | The vendor's token endpoint timed out (5s connect, 20s read) | the message, plus *Sign in again* |

PKCE (S256) and the RFC 8707 `resource` are handled by the platform for
clients registered by discovery; the client never sees them.

**4. Link the sign-in to the server.** Do this outside chat only; during a
chat it happens automatically.

```http
POST …/mcp-server-connections/
```

```json
{ "server": 379, "scope": "user", "auth_type": "oauth2", "connected_service": 73 }
```

A `user`-scoped connection must use the caller's own connected service. An
admin connecting a shared account sends `"scope": "mentor", "mentor": "<uuid>"`
or `"scope": "platform"`. Then refresh the catalog: the server shows as
connected.

## Add a personal API key

For servers in the `needs_api_key` state whose `effective_auth_scope` is
`user`. Build the form from `registry.declared_headers`:

| Declared header | Field |
|---|---|
| `is_secret: true` | Password input labelled with `description` (or `name`); required when `is_required` is `true` |
| non-secret with a `value` | hidden; sent automatically |
| none declared | one *API key* input |

`Authorization` goes to `credentials`; every other header goes to
`extra_headers`:

```json
{ "server": 185, "scope": "user", "auth_type": "token",
  "credentials": "sk-live-...", "authorization_scheme": "Bearer",
  "extra_headers": { "X-Workspace-Key": "..." } }
```

A missing required header returns
`400 {"extra_headers": ["This server needs these headers: X-Workspace-Key."]}`.
Show it next to that input. Update with `PATCH …/mcp-server-connections/{id}/`.
Never send a masked value back.

## Turn servers on and off

Users can switch off a **non-mandatory** server permanently or for one
conversation, effective from the next message. Both endpoints act on the caller
only: the path user must be the caller, else `403`. They need
`Ibl.Mentor/MCPServers/UserPreference/read|write`, which members hold.

**Permanently**: `…/mcp-servers/{id}/preference/`

```http
GET  → { "server": 379, "is_enabled": null, "user_can_disable": true, "effective_is_enabled": true }
PUT  { "is_enabled": false }
```

**One conversation**: `…/mcp-servers/{id}/session-preference/`

```http
GET ?session_id={uuid} → { "server": 379, "session_id": "…", "is_enabled": null,
                           "user_is_enabled": false, "user_can_disable": true, "effective_is_enabled": false }
PUT { "session_id": "<uuid>", "is_enabled": true }
```

- `is_enabled` is the stored choice at that level (`null` = none).
- `user_is_enabled` is the user's permanent choice.
- `effective_is_enabled` is what chat will do.
- The session must be the caller's and its agent must use the server, else
  `404 "Chat session not found for this MCP server."`.
- A mandatory server returns `400 "This MCP server is required by your
  organization and cannot be turned off."`. Render it as a locked switch,
  "Required by your organization".

A server is used in a conversation when it is attached to the agent and
`is_enabled`, **and** it is mandatory, or the conversation choice is not off,
or, with no conversation choice, the permanent choice is not off.

**Render the conversation's connector menu in one request:**

```http
GET …/mcp-servers/?mentor_unique_id={uuid}&include_global=true&session_id={session_uuid}&is_enabled=true
```

Each row's `user_enabled` already reflects both choices. Show only the
servers attached to the agent (from its settings) and lock those with
`user_can_disable: false`.

## Disconnect and remove

| Action | Request | Effect |
|---|---|---|
| List the user's sign-ins | `GET {ACCOUNT}/connected-services/orgs/{org}/users/{username}/` (`?provider=`, `?service=`) | plain array |
| Remove a sign-in | `DELETE {ACCOUNT}/connected-services/orgs/{org}/users/{username}/{id}/` | signs the user out of every server using that provider |
| Remove a connection | `DELETE …/mcp-server-connections/{id}/` | prefer `PATCH {"is_active": false}` if it may return |
| Remove the org's OAuth client | `DELETE …/mcp-servers/{id}/credentials/` | everyone must sign in again (admin) |
| Detach from an agent | settings `PUT` with the id removed from `mcp_servers` | |
| Delete an org server | `DELETE …/mcp-servers/{id}/` | featured and directory servers can't be deleted |

All return `204`. Confirm destructive actions with the user first.
