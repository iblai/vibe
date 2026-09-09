# The two MCP servers

Two Model Context Protocol servers exist around this toolkit, and they do
different jobs.

## `@iblai/mcp` — SDK documentation for your coding assistant (local)

Gives the assistant the `@iblai/iblai-js` SDK's components, hooks, RTK Query
endpoints, provider setup, and page templates while it writes your app:
`get_component_info`, `get_hook_info`, `get_api_query_info`,
`get_provider_setup`, `create_page_template`, `get_playwright_helper_info`.

`.mcp.json` at the project root (vibe-starter ships it; the Claude Code plugin
declares the same server):

```json
{
  "mcpServers": {
    "iblai": { "command": "pnpm", "args": ["dlx", "@iblai/mcp"] }
  }
}
```

`npx -y @iblai/mcp` in npm projects. Nothing here talks to your organization —
it is documentation.

## `iblai-agent-chat` — talk to a deployed agent (hosted)

The one runtime capability that is not a REST call: holding a live
conversation with one of your agents (streamed responses, tool use, RAG) from
Claude Code, Claude Desktop, Cursor, or any MCP client. Hosted by ibl.ai; no
install. Authenticates with your Platform API Token and names the agent:

```bash
claude mcp add iblai-agent-chat --transport http https://asgi.data.iblai.app/mcp/agent-chat/ \
  --header "Authorization: Api-Token YOUR_API_TOKEN" --header "X-Mentor-Unique-Id: YOUR_AGENT_UUID"
```

`/iblai-api-agent-chat` writes this configuration for you from `.env`;
[`mcp/iblai-agent-chat/README.md`](../mcp/iblai-agent-chat/README.md) has the
Claude Desktop / Cursor JSON and the tool list. Rule: if a skill covers it,
there is no server for it — everything else is REST via the `iblai-api-*`
skills. (`X-Mentor-Unique-Id` is the header's wire name; the value is the
agent's UUID.)
