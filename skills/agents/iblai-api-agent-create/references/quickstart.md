# Python Quickstart

> **Preserved developer doc**, complementing **`/iblai-api-agent-create`**. Outlines the
> [`iblai/quickstarts`](https://github.com/iblai/quickstarts) Python client. Its code uses the
> upstream name `tenant` (= the **org key**; on the wire also `org` / `platform_key`) and hits the
> Manager host `base.manager.iblai.app` directly. The same create-agent call is exposed through the
> gateway at `https://api.iblai.app/dm/...` with `Authorization: Api-Token $IBLAI_API_KEY` — see the
> skill's **Writes**; the session + chat transport are in `/iblai-api-agent-session`. The full
> runnable client is preserved verbatim under [`assets/`](../assets/) (`quickstart.py` + `api.py`).

The client creates an agent, opens a chat session, and streams a reply over WebSocket from one
script — or connects to an existing agent/session. Python 3.10+, `pip install requests websockets`.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `IBL_TENANT` | yes | org key (the code calls it `tenant`) |
| `IBL_USERNAME` | yes | platform username |
| `IBL_PLATFORM_API_KEY` | yes | platform API key (sent as `Api-Token`) |
| `IBL_MENTOR_ID` | no | existing agent `unique_id` — skips creation |
| `IBL_SESSION_ID` | no | existing session id (requires `IBL_MENTOR_ID`) — continues it |
| `IBL_MANAGER_URL` | no | Manager host (default `https://base.manager.iblai.app`) |
| `IBL_ASGI_URL` | no | WebSocket host (default `wss://asgi.data.iblai.app`) |

## Flow

1. **Create the agent** (skipped when `IBL_MENTOR_ID` is set) —
   `POST {MANAGER_URL}/api/ai-agent/orgs/{tenant}/users/{username}/agent-with-settings/`
   with `{new_mentor_name, template_name, display_name, description, system_prompt}`; the
   response's `unique_id` identifies the agent.
2. **Open a session** (skipped when `IBL_SESSION_ID` is set) —
   `POST {MANAGER_URL}/api/ai-agent/orgs/{tenant}/users/{username}/sessions/`
   with `{"agent": "<unique_id>"}`; the response's `session_id` identifies the session.
3. **Chat over WebSocket** — connect to `{ASGI_URL}/ws/langflow/` and send one JSON frame:
   ```json
   {"flow": {"name": "<agent>", "tenant": "<org>", "username": "<user>", "pathway": "<agent>"},
    "session_id": "<session>", "token": "<api-key>", "prompt": "<text>"}
   ```
   then read frames: print each `data` chunk, stop on `eos: true`, bail on `error`.

## Run

```bash
export IBL_TENANT=my-org IBL_USERNAME=me IBL_PLATFORM_API_KEY=key
python quickstart.py "Explain quantum computing"                       # new agent + session
IBL_MENTOR_ID=<agent> python quickstart.py "..."                       # existing agent, new session
IBL_MENTOR_ID=<agent> IBL_SESSION_ID=<sess> python quickstart.py "..." # continue a session
```

## Sample code

Preserved verbatim from the developer doc (upstream: [`iblai/quickstarts`](https://github.com/iblai/quickstarts)):

- [`../assets/quickstart.py`](../assets/quickstart.py) — entry point: creates an agent (or reuses `IBL_MENTOR_ID`), opens a session (or reuses `IBL_SESSION_ID`), and sends a prompt.
- [`../assets/api.py`](../assets/api.py) — client module: agent creation, session management, and the WebSocket chat loop (print each `data` chunk, stop on `eos`, bail on `error`, 10s recv timeout).
