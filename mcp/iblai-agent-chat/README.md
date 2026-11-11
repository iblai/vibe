# iblai-agent-chat

MCP (Model Context Protocol) server for ibl.ai agent chat interactions, enabling AI assistants to communicate with configured AI agents.

**Base URL:** `https://asgi.data.iblai.app` (or your ibl.ai deployment)

**Type:** Hosted (no local installation required)

## Overview

The iblai-agent-chat server provides a bridge between MCP-compatible AI assistants (like Claude) and ibl.ai's agent system. This allows users to interact with specialized AI agents configured for specific domains, courses, or purposes through their preferred AI assistant interface.

## Configuration

### Authentication

The agent is named in the URL, and the server authenticates with one header. You need:
1. A Platform API Key (owner mode) from your ibl.ai admin panel
2. The agent's unique ID, placed in the URL: `https://asgi.data.iblai.app/mcp/agent-chat/<UNIQUE_AGENT_ID>`

### Required Headers

| Header | Description | Required |
|--------|-------------|----------|
| `Authorization` | `Api-Token <key>` | Yes |

No agent header is needed. The older `X-Mentor-Unique-Id` (or `X-Agent-Unique-Id`) header with `https://asgi.data.iblai.app/mcp/agent-chat/` still works for existing configs; a URL id and a header naming different agents are refused. The URL works with or without a trailing slash.

## Usage

### Connect from Claude Desktop / Cursor

Add this to your configuration file:

- **Claude Desktop (macOS)**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Claude Desktop (Windows)**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Cursor**: Settings > Features > MCP Servers

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

### Connect from Claude Code

```bash
claude mcp add iblai-agent-chat --transport http https://asgi.data.iblai.app/mcp/agent-chat/YOUR_AGENT_UNIQUE_ID --header "Authorization: Api-Token YOUR_API_TOKEN"
```

## Available Tools

### `get_mentor_response`

Send a prompt to the configured agent and receive its reply. The tool keeps the conversation: pass the `session_id` from a reply to ask a follow-up, and the agent sees the earlier turns.

**Parameters:**
- `prompt`: The message or question to send to the agent (required)
- `session_id`: The session id from a previous reply, to continue that conversation (optional; omit it to start a new conversation)

**Returns:** The agent's reply as text, ending with a `session_id: <id>` line. The result also carries structured content `{"reply": "...", "session_id": "..."}`.

**Example Usage:**

```
User: "What are the key concepts in machine learning?"
Tool Call: get_mentor_response(prompt="What are the key concepts in machine learning?")
Response: "Machine learning encompasses several key concepts...

session_id: SESSION_ID"

User: "Which of those matters most for a beginner?"
Tool Call: get_mentor_response(prompt="Which of those matters most for a beginner?", session_id="SESSION_ID")
Response: "For a beginner, start with supervised learning...

session_id: SESSION_ID"
```

A session belongs to the token's owner and the agent it was started with; a session id of another user, organization or agent is refused.

---

## How It Works

1. **Authentication**: The server validates the `Api-Token` against ibl.ai's authentication system
2. **Agent Resolution**: The agent ID in the URL path (`/mcp/agent-chat/<UNIQUE_AGENT_ID>`) identifies which agent to route the conversation to. It can be one of your organization's agents, or a `main` agent shared with every organization (visibility "viewable by anyone")
3. **Chat turn**: The prompt runs as a chat turn on the same path as the chat screen, with the agent's system prompt, tools, trained documents and memory. The turn is attributed to the token's owner and billed to the token's organization; credits, spend caps and moderation apply
4. **Response**: The agent's full reply is returned as the tool result, with the session id to continue the conversation

## Agent Configuration

Agents in ibl.ai can be configured with:
- **System prompts**: Define the agent's personality and behavior
- **Knowledge bases**: Connect documents, courses, or custom data
- **LLM models**: Choose the underlying language model
- **Guardrails**: Set content policies and response filters
- **Tools**: Enable specific capabilities like code execution or web search

## Use Cases

### Educational Assistance

Connect to a course-specific agent for tutoring:

> "Can you explain the concept of recursion with a simple example?"

### Customer Support

Route queries to a product knowledge agent:

> "How do I configure the integration settings?"

### Domain Expertise

Interact with specialized agents:

> "What are the compliance requirements for GDPR?"

### Multi-Agent Workflows

Configure multiple agent connections for different tasks:

```json
{
  "mcpServers": {
    "python-tutor": {
      "transport": "streamable-http",
      "url": "https://asgi.data.iblai.app/mcp/agent-chat/PYTHON_AGENT_ID",
      "headers": {
        "Authorization": "Api-Token YOUR_API_TOKEN"
      }
    },
    "data-science-expert": {
      "transport": "streamable-http",
      "url": "https://asgi.data.iblai.app/mcp/agent-chat/DS_AGENT_ID",
      "headers": {
        "Authorization": "Api-Token YOUR_API_TOKEN"
      }
    }
  }
}
```

## Finding Your Agent ID

To find an agent's unique ID:

1. **Via ibl.ai Dashboard**: Navigate to Agents → Select Agent → Copy the Unique ID from settings
2. **Via API**: Use the agent list endpoint: `GET /api/ai-mentor/orgs/{org}/users/{user_id}/mentors/`
3. **Via iblai-search**: Use the agent search tools to discover agents and their IDs

## Error Handling

| Error | Description | Resolution |
|-------|-------------|------------|
| Tool error "Could not authenticate the agent named by the URL or X-Agent-Unique-Id" | Missing or unknown agent ID, or an agent your organization cannot reach | Verify the agent ID in the URL; another organization's agent is reachable only if it is a `main` agent shared with every organization |
| Tool error "Only owner-mode API tokens are supported for chat" | The token runs in a non-owner mode | Use an owner-mode Platform API Key |
| Tool error with the chat's message (for example, out of credits) | The chat refused the turn | Act on the message (top up credits, raise the spend cap, check access) |
| 401 Unauthorized | Missing or invalid `Api-Token` | Use a valid Platform API Key |
| 500 Server Error | Internal processing error | Contact support |

## Best Practices

1. **Use Specific Agents**: Configure separate agent connections for different use cases
2. **Handle Errors Gracefully**: Implement fallback logic for authentication failures
3. **Monitor Usage**: Track agent interactions via the analytics MCP
4. **Secure Credentials**: Store API tokens securely

## Rate Limiting

The agent chat service may be subject to rate limiting based on:
- User tier
- Organization quotas
- LLM provider limits

Check with your ibl.ai administrator for specific limits.

## Related skills

`iblai-agent-chat` is the only MCP server in this repo. For the rest of the
platform, use the `iblai-api-*` skills, which call the same REST API directly:

| Skill | Description |
|--------|-------------|
| [`/iblai-api-analytics`](../../skills/analytics/iblai-api-analytics/SKILL.md) | Monitor agent usage and costs |
| [`/iblai-api-search`](../../skills/agents/iblai-api-search/SKILL.md) | Discover available agents |
| [`/iblai-api-agent-create`](../../skills/agents/iblai-api-agent-create/SKILL.md) | Create and manage AI agents |

## License

MIT — ibl.ai

