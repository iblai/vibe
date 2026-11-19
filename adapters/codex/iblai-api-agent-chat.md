# iblai-api-agent-chat

> Set up live chat with a deployed ibl.ai agent by wiring the hosted iblai-api-agent-chat MCP server into the project (.mcp.json / claude mcp add) using the .env Api-Token and a chosen agent's unique id, or by signing in from claude.ai, ChatGPT or Claude Desktop with only the URL. Use to enable runtime conversations with an agent, and to list or disconnect the apps a user has connected. The actual chatting then happens through the MCP server's tools.

# iblai-api-agent-chat

Enable **live chat** with a deployed agent. Unlike the other `iblai-*` skills
(which call the REST API directly), runtime chat (the agent's tools, RAG and
memory) is served by the hosted **`iblai-api-agent-chat` MCP server**. This
skill does the one-time wiring so your assistant can talk to an agent; the conversation
itself then runs through that server's MCP tools.

## When to use

- You want to *converse with* an agent (not configure it). For configuring agents
  use the other `/iblai-api-agent-*` skills; to *find* an agent's `unique_id` use
  `/iblai-api-search`.

## What you need

- **`IBLAI_API_KEY`** — your Platform API Token (from `.env`; run `/iblai-api-login`
  if it is not set).
- **An agent's `unique_id`** — the agent to chat with. Get one from
  `/iblai-api-search` (each result's `unique_id`), then confirm the choice
  with the user.

## Setup

The agent's `unique_id` goes in the URL, and the server authenticates with one
header, `Authorization: Api-Token <key>`:

```
https://asgi.data.iblai.app/mcp/agent-chat/<unique_id>
```

No agent header is needed. (The older `X-Mentor-Unique-Id` / `X-Agent-Unique-Id`
header still works for existing configs; a URL id and a header naming different
agents are refused.)

### Claude Code

```bash
claude mcp add iblai-api-agent-chat \
  --transport http "https://asgi.data.iblai.app/mcp/agent-chat/$MENTOR" \
  --header "Authorization: Api-Token $IBLAI_API_KEY"
```

### .mcp.json / Claude Desktop / Cursor

Add to the project's `.mcp.json` (or the client's MCP config). Substitute the real
token and `unique_id` - do not commit secrets:

```json
{
  "mcpServers": {
    "iblai-agent-chat": {
      "transport": "streamable-http",
      "url": "https://asgi.data.iblai.app/mcp/agent-chat/YOUR_AGENT_UNIQUE_ID",
      "headers": {
        "Authorization": "Api-Token YOUR_API_TOKEN"
      }
    }
  }
}
```

After adding it, the assistant gains the server's
`get_mentor_response(prompt, session_id?)` tool. Each call is one chat turn:
the agent replies as it does in the chat screen, with its own instructions,
tools and trained documents. The tool returns the full reply text, ending with
a `session_id: <id>` line (also in the result's structured content).

## Sign in instead of a key (claude.ai, ChatGPT, Claude Desktop)

App stores and connector dialogs give the user no box for a key. On
platforms where OAuth sign-in is on (hosted `iblai.app` included), the same
URL works with **no header at all**: the app discovers the sign-in from the
server's `401`, registers itself, and opens an ibl.ai page in the browser.

1. Give the app only the URL, `https://asgi.data.iblai.app/mcp/agent-chat/<unique_id>`,
   and keep its default sign-in (claude.ai: Settings > Connectors > Add
   custom connector, Authentication left as OAuth; ChatGPT: chatgpt.com/plugins
   > Add custom MCP server, Authentication OAuth; Claude Desktop: the same
   connector dialog).
2. The browser lands on the organization's sign-in (the auth SPA for the
   agent's organization, so its SSO options show), then on a consent page
   that names the agent and the app: **Connect** or **Cancel**. The page
   shows the signed-in email, **Switch account** (signs the SPA out and
   starts again) and **Contact support** (the organization's support address).
3. Back in the app, `get_mentor_response` works as with a key. The user must
   be an active member of the agent's organization; for a `main` agent shared
   with every organization the connection is on the user's organization, picked
   on the page when they are on several.

What the token can do: chat with the agent in its URL, and nothing else. It
is refused by the other MCP servers and by the REST API. The access token
lasts an hour and the app refreshes it silently for up to 30 days of
inactivity, so the user signs in again only after a month unused or after
disconnecting. The turn is attributed to the signed-in user and billed to
the connection's organization, exactly as a key's would be.

Registration takes public clients only (`token_endpoint_auth_method` `none`,
PKCE S256, https redirect URIs or http on localhost): claude.ai and ChatGPT
both register that way. A client that asks for a secret gets
`invalid_client_metadata`.

## The user's connected apps

Apps a user connected this way are listed and disconnected with the user's
own session token (`Authorization: Token <dm_token>`, the browser SDK's
token), never a Platform API Token: each user sees only their own.

```bash
# List: app, host, agent, organization, connected and last-used dates, expired flag.
# Standard page envelope (count, next_page, previous_page, results); page_size=,
# and date_filter= / start_date= / end_date= on the connected date.
curl -s "https://api.iblai.app/dm/v1/mcp/connected-apps" \
  -H "Authorization: Token $DM_TOKEN"

# Disconnect one: its tokens stop at once; the app must be connected again.
curl -s -X DELETE "https://api.iblai.app/dm/v1/mcp/connected-apps/<id>" \
  -H "Authorization: Token $DM_TOKEN"     # 204, or 404 when it is not theirs
```

`POST /dm/api/core/session/logout/` ("invalidate all tokens") disconnects
them all and reports the count as `tokens_deleted.mcp`. Disconnecting the app
on the claude.ai or ChatGPT side revokes the token too.

## Notes

- **One agent per connection** - the agent is fixed by the URL of each server
  entry. To chat with several agents, add multiple named entries (e.g.
  `iblai-api-agent-chat-tutor`, `iblai-api-agent-chat-advisor`), each with its
  own `unique_id` in the URL.
- **Follow-up questions** - pass the `session_id` from the previous reply to
  continue the conversation; the agent sees the earlier turns. Omit it to start
  a new conversation. A session belongs to the token's owner and its agent; a
  session id of another user, organization or agent is refused.
- **Owner-mode tokens only** (when a key is used) - the turn is attributed to
  the token's owner and billed to the token's organization like a turn in the
  chat screen (credits, spend caps and moderation apply). A refused turn (out of credits, a
  non-owner-mode token, no access to the agent) comes back as a tool error with
  the reason.
- **Which agents** - your organization's agents, plus `main` agents shared with
  every organization (visibility "viewable by anyone"). Those are chattable with
  any organization's token, and the turn is billed to the caller's organization.
- The token lives in client config / `.env` - never commit it; `.env` and local
  MCP config should stay gitignored.
- This is the only runtime surface among the `iblai-api-*` skills; everything else (configure,
  search, recommend, profile, analytics, admin) is a direct-REST skill.