# Client tools

Companion to `/iblai-api-agent-session`. A chat client can give the agent tools
that run **on the client** — `read_page`, `click`, `keyboard` in a browser
extension or desktop app. The agent decides when to call one; the client runs it
and returns the result; the agent continues. Auth is unchanged:
`Authorization: Api-Token $IBLAI_API_KEY`, `{org}` = `$IBLAI_ORG`, `{user}` =
`$IBLAI_USERNAME`.

> **Availability.** Client tools need a platform release that has the
> `enable_client_tools` agent setting. On an earlier release the `client_tools`
> field is ignored and the result endpoint answers `404`.

## The round trip

1. **Turn the agent's flag on** (once, an admin):
   `PUT …/users/{user}/mentors/{mentor}/settings/` with `enable_client_tools=true`
   (`/iblai-api-agent-setting`). It is off by default.
2. **Send the tool definitions with the chat turn**, as `client_tools` on the
   same payload `/api/agent/chat/` and `/ws/chat/` already take.
3. **Watch the stream for `client_tool_call`.** The agent is now waiting.
4. **Run the tool and post its output** to `chat-tool-results/`.
5. **Keep reading the stream.** The agent's reply continues on the same turn.

The result goes over HTTP, not back up the socket: the server does not read the
chat connection while a turn is running.

## `client_tools` on the chat turn

```json
{
  "session_id": "…",
  "prompt": "What is on my page?",
  "flow": { "name": "<agent unique_id>", "tenant": "<org key>" },
  "client_tools": [
    {
      "type": "function",
      "function": {
        "name": "read_page",
        "description": "Return the visible text of the user's current tab.",
        "parameters": {
          "type": "object",
          "properties": { "selector": { "type": "string" } },
          "required": []
        }
      }
    }
  ]
}
```

- The shape is the OpenAI function-tool definition. `description` and
  `parameters` are optional; `parameters` defaults to an object with no
  properties.
- **Per turn, not per session.** Send `client_tools` on every turn that may use
  them; nothing is stored on the session. A turn without the field behaves
  exactly as it always has.
- **Limits:** at most 32 tools; `name` matches `^[A-Za-z0-9_-]{1,64}$` and is
  unique in the list; `description` ≤ 1024 characters; `parameters` is valid
  JSON Schema with top-level `"type": "object"`, ≤ 16 KB serialized, without
  `$ref`, and with no parameter named `config` or `run_manager`.

## The `client_tool_call` frame

```json
{
  "type": "client_tool_call",
  "value": {
    "id": "call_abc123",
    "name": "read_page",
    "arguments": { "selector": "main" },
    "generation_id": "5f0c…",
    "timeout_seconds": 300
  }
}
```

- `id` and `generation_id` are what you post back. `arguments` is already an
  object, not a JSON string.
- The usual `tool_call` / `tool_call.end` display frames are still sent for the
  same call, and `id` matches theirs. A call made by the agent's subagent
  carries an id that matches no display frame — do not depend on the match.
- The agent may call several tools at once; each arrives as its own frame and
  is answered independently, in any order.

## Returning the result

**POST** `https://api.iblai.app/dm/api/ai-mentor/orgs/{org}/users/{user}/chat-tool-results/`

```json
{
  "generation_id": "5f0c…",
  "tool_call_id": "call_abc123",
  "output": "Welcome to the dashboard …",
  "is_error": false
}
```

- `output` is text, at most 256 KB (262,144 characters). Serialize structured
  output as JSON. When the tool failed, set `is_error` to `true` and describe
  the failure in `output`; the agent sees it and can try something else.
- Post with **the same credential that started the turn**: only the user whose
  turn made the call can answer it, and `{user}` must be that user.
- This is REST on the `api.iblai.app/dm` gateway, not the ASGI host.

| Status | Meaning |
|---|---|
| `200` `{"detail": "Accepted"}` | Delivered; the agent continues. |
| `400` | Missing field, or `output` over the limit. |
| `403` | `{org}` or `{user}` is not the caller's, or the caller lacks `Ibl.Mentor/ChatToolResults/action` (granted to every member by the platform's seeded Student policy). |
| `404` | No call of yours is waiting under that id: it timed out, already finished, or is not yours. Treat all three the same. |
| `409` | The call was already answered. The first result stands. |

## Timeouts and stop

- A call not answered within `timeout_seconds` (300 at most; a deployment may
  set less) fails on the agent's side. The agent is told the tool did not
  respond and carries on; a late post gets `404`.
- Nothing is written to the stream while a call waits. Keep the connection open
  for the full `timeout_seconds`, and make sure any proxy in front of your
  client allows an idle stream that long.
- **Stop:** stopping the generation
  (**POST** `…/dm/api/ai-mentor/orgs/{org}/users/{user}/stop-generation/` with the
  `generation_id`) ends a waiting call. The stream ends with the usual
  `{"detail": "Generation stopped", "eos": true}` frame; abandon any tool call
  still running on the client.

## When the turn is refused

A turn that sends `client_tools` is refused with an error frame
(`status_code: 400`) and does not run when:

- the agent's `enable_client_tools` is off;
- the caller is anonymous or on a shareable link (results are matched to a
  signed-in user);
- the agent's model cannot call tools, or the agent does not run on the
  standard chat runtime (for example a workflow or Claw agent);
- a tool name is one the agent already uses: one of its own tools, or the
  built-ins `write_todos`, `ls`, `read_file`, `write_file`, `edit_file`, `glob`,
  `grep`, `execute`, `task`;
- a definition breaks a limit above. The error names the entry, e.g.
  `client_tools.1.function.name`.

## Security notes

- Tool output is content from the user's page or machine. If the organization
  has tool-output sanitization on, it is applied to client tool output too.
- A client tool can do whatever your client lets it. Decide in the client which
  actions need the user's confirmation; the platform does not ask.
