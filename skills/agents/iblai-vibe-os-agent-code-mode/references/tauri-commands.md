# Tauri commands and events

Every `#[command]` the shipped Rust modules register, with the argument
names the frontend passes (Tauri converts `snake_case` Rust params to
`camelCase` `invoke` keys — `session_id` is `sessionId` from JS), and every
event they emit. The SDK's `opencode-client.ts` (in `@iblai/web-utils`)
already calls the chat trio; the SDK `<Chat>` answers the permission cards;
the rest are called by the host app's `<CodingModeButton>`, the approvals
control and the hooks.

## Desktop — `opencode_acp.rs`

### `opencode_chat_stream`
- **Args**: `sessionId`, `messages: {role, content}[]`, `generationId`,
  `tenant`, `token` (DM token — never reaches the agent, see proxy),
  `model?`, `apiBase?`, `workspace?`, `mentor?` (agent UUID — links that
  agent's synced skills), `newChatKey?` (the ephemeral first-turn key, so
  the mapping migrates onto the real session id), `cowork?` (Cowork is on
  in the chat: the agent also gets the screen tools — see below).
- **`model` picks the agent**: `codex/default` runs Codex, `claude/default`
  runs Claude Code, anything else runs opencode on that model
  (`provider/model`, e.g. `openai/gpt-4o`; `ollama/…` or `foundry/…`
  selects an on-device runtime).
- **Returns**: `Result<(), String>` — resolves when the turn ends, after
  every event of the turn has reached the webview.
- **Emits** (all keyed by `generation_id`):
  - `ollama:token` `{ generation_id, token, full_content }` — coalesced to
    one emit per 200 ms
  - `ollama:done` `{ generation_id, full_content, stop_reason }`
  - `ollama:error` `{ generation_id, error }`
  - `ollama:restart` `{ generation_id }` — the child crashed mid-turn and is
    respawning into the same generation; clear the partial stream
  - `opencode:reasoning` `{ generation_id, delta }`
  - `opencode:tool_call` `{ generation_id, update }` — the raw ACP
    `tool_call` / `tool_call_update` object (`toolCallId`, `title`, `kind`,
    `status`, `content`, …)
  - `opencode:plan` `{ generation_id, update }` — the agent's task list
    (ACP `plan`, `update.entries[]`), rendered by the SDK chat
  - `opencode:permission_request` `{ generation_id, session_id, request_id,
    title, kind, command, allow_option_id, reject_option_id, options,
    tool_call }` — `kind` is the ACP ToolKind (`read` / `edit` / `execute`
    / `fetch` / …)
  - `opencode:permission_resolved` `{ request_id }`
  - `opencode:auth_required` `{ generation_id, backend }` — Codex or Claude
    Code is signed out. Emitted just before the turn's `ollama:error`;
    `useOpencodeAuthRequired()` turns it into one toast.
- **Notes**: `messages` normally only needs the newest user turn (the agent
  keeps its own state), but pass the whole history — when the Rust side
  has to start a fresh agent session it resends it so the agent continues.
- **Cowork**: with `cowork: true` the session gets one ACP `mcpServers`
  entry, `cowork`: the screen driver's stdio proxy to the app's own driver
  daemon. The turn fails before anything is spawned when the driver is not
  installed or the session is unsupported. Needs the Cowork modules (see the
  wiring reference); with the stubs every such turn fails.

### `opencode_stop`
- **Args**: `sessionId` → ACP `session/cancel`; pending permission prompts
  are denied and resolved.

### `opencode_close`
- **Args**: `sessionId` → kills that chat's agent process.

### `opencode_permission_respond`
- **Args**: `requestId`, `optionId?` — pass `allow_option_id` or
  `reject_option_id` from the request; `null` denies. A card left alone for
  180 s is denied.

### `get_opencode_permission_mode` / `set_opencode_permission_mode` / `seed_opencode_permission_mode`
- `get` → `"manual" | "auto"`, never `null`. Nothing saved is `"auto"`
  (Automatic); a file that exists but can't be read is `"manual"`.
- `set(mode)` saves to `settings.json` and applies at once: a switch to
  Automatic answers every open card with Allow, and live Codex sessions are
  repinned.
- `seed(mode)` saves the mode the user chose on the platform, only on a
  machine with none saved, and never saves `"auto"`. Returns the mode in
  force. The button calls it once with the profile's
  `code_mode.permission_mode`.

### `get_opencode_workspace` / `set_opencode_workspace` / `new_opencode_workspace`
- **Args**: `sessionId`, `tenant?`, `mentor?` (+ `path` for `set`).
- **Returns**: the absolute workspace path. `new` creates a fresh
  git-backed folder under `~/.local/share/iblai/workspaces/`; the map is
  kept per agent (`<tenant>/<mentor>`) when `mentor` is given, else per chat.

### `set_opencode_skills`
- **Args**: `mentorUniqueId`, `skills?: SkillPayload[]` — each
  `{ slug, description, instruction, resources: [{filename, content}] }`
  from the Agent Skills API. Writes
  `~/.local/share/iblai/skills/mentors/<key>/…` and returns the directory.
  `null`/absent clears the agent's dir.
- `begin_opencode_skills_sync(mentorUniqueId)` marks a sync in flight so a
  spawn waits for it instead of starting with stale skills.

### `check_code_local_model`
- **Args**: `model` (`ollama/<id>`, `foundry/<id>`, or a bare id).
- **Returns** `{ runtime, spec, model, endpoint, running, tools_supported,
  reason }` — whether the on-device runtime is up and the model supports
  tool calls. Needs the local-LLM modules (`model_manager`,
  `foundry_manager`) — see the wiring reference.

### `set_opencode_learner`
- **Args**: `username`, `email?`, `dmBase?`, `platformDomain?`, `authUrl?`.
  Tells the proxy who is signed in: it appends `learner_id=<username>` to
  every forwarded model call and surfaces the identity to the agent.
  Called by `useOpencodeLearner()` on sign-in.

### `ensure_opencode_platform_key`
- **Args**: `tenant`, `token`. Mints (or reuses) the week-long platform API
  key handed to the agent as `IBLAI_API_KEY`. Returns `true` when one is
  available, `false` for non-admins.

## Desktop — `opencode_installer.rs`

### `install_opencode`
- Downloads the pinned opencode release (`1.19.0`, override
  `IBL_OPENCODE_VERSION`) into `~/.local/share/iblai/bin/`, writes the
  config, ensures the default workspace. Progress lines go out as
  `model:installation-log` `{ message, source: "opencode" }` (the same
  channel the local-LLM installer uses). **Errors on Windows** ("Code
  isn't available on Windows.").

### `check_opencode_status`
- **Returns** `{ installed, version, config_ready, sandboxed, supported,
  sandbox_ready, file_manager }`. `supported` is false on Windows (the pill
  hides); `sandbox_ready` is false on Linux without bubblewrap (the pill is
  disabled with a hint); `file_manager` names the Linux folder app for the
  "Open in …" button.

### `ensure_vibe_skills`
- Resolves `github.com/iblai/vibe/releases/latest` and syncs the release's
  `skills/` into `~/.local/share/iblai/skills/vibe/` when the tag moved.
  **Returns** `{ present, refreshed }`. Called at launch and on Code enable;
  the button shows an amber note while it is absent.

## Desktop — `code_agent_installer.rs` (Codex, Claude Code)

`backend` is `"codex"` or `"claude"` (opencode has its own commands above).

### `check_code_agent_status`
- **Args**: `backend`.
- **Returns** `{ supported, installed, node_version, adapter_version,
  signed_in, account, reason, installing, error }`. `supported` is false on
  Windows, in the Mac App Store build, and on macOS before 13.5 (the pinned
  Node needs it). `signed_in: null` means the probe couldn't tell.

### `install_code_agent`
- **Args**: `backend`. Installs (or repairs) the managed Node (`v24.21.0`)
  and the agent's ACP adapter (`@agentclientprotocol/codex-acp@2.0.0` or
  `@agentclientprotocol/claude-agent-acp@0.83.0`) under
  `~/.local/share/iblai/{node,acp/<agent>}`. The app runs the same install
  in the background at every launch; this is the retry. Progress goes out
  on `model:installation-log` `{ message, source: "code-agent", backend }`,
  and `code-agent:changed` `{ backend }` fires when an install ends.
  Overrides: `IBL_NODE_VERSION`, `IBL_CODEX_ACP_VERSION`,
  `IBL_CLAUDE_AGENT_ACP_VERSION`.

## Desktop — `code_agent_models.rs`

The OS calls these from its top-left model picker
(`app/platform/[tenantKey]/[mentorId]/_components/nav-bar/agent-model-selector.tsx`,
not shipped here).

### `list_code_agent_models`
- **Args**: `backend`, `refresh?`.
- **Returns** `{ models: [{id, name, description}], default, selected }`.
  Codex's list comes from `codex debug models` on every call; Claude's from
  a cache, else (or on `refresh`) from a short probe session, which needs
  the agent installed and signed in.

### `set_code_agent_model`
- **Args**: `backend`, `model?` (`null` = the agent's own default). Applies
  the pick to every live session of that agent first; a refusal is
  returned and nothing is saved. Saved per machine under
  `code_agent_models` in `settings.json`.

## Desktop — `remote_code.rs` (phone-access host)

### `remote_code_status`
- **Returns** `RemoteCodeStatus { running, port, password, urls, mgmt_urls,
  auto_enable }`. `auto_enable` is true when phone access was on before
  this launch and should be restored.

### `remote_code_enable`
- **Args**: `tenant`, `token`, `apiBase?`. Idempotent — returns the running
  host, restarting only when the org changed. Starts `opencode serve` on
  `0.0.0.0` with a fresh `OPENCODE_SERVER_PASSWORD`.

### `remote_code_pairing_qr`
- **Returns** an SVG string; payload
  `iblcode1:{"urls":[…],"mgmt":[…],"password":"…"}`.

### `remote_code_disable`
- Kills the host. Also reaped from `RunEvent::Exit` via
  `remote_code::shutdown_sync()`.

## Mobile — `remote_code_client.rs`

Registered **only** on iOS/Android; compiled everywhere so its tests run on
the host. The OS phone apps hide the Code pill for now
(`useCodeShownHere`), so nothing calls these there today.

- `remote_code_set_host(url, password, mgmt?, urls?)` — pair (from the QR
  or manual entry); tries every address the desktop advertised and returns
  `{ configured, connected, url, directory }`.
- `remote_code_get_host()` → the same shape, or
  `{ configured: false, connected: false }`.
- `remote_code_clear_host()` — unpair.
- `remote_code_list_workspaces()` → the desktop's workspace list via the
  management URL (errors when the pairing predates `mgmt` — re-pair by QR).
- `opencode_chat_stream` / `opencode_stop` / `opencode_close` /
  `opencode_permission_respond` / `get|set|seed_opencode_permission_mode` /
  `get|set|new_opencode_workspace` — same names, args, and emitted events
  as the desktop versions, proxied over HTTP + SSE. `"auto"` mode
  short-circuits permission events locally, exactly like the desktop.

The button's phone path also calls `local_network_status` and
`open_app_settings` (iOS Local Network access). They live in the OS's
`local_network.rs`, which is not shipped here; while the pill is hidden on
phones nothing reaches them.

Every background emit on mobile goes through `crate::emit_on_main` — see
the wiring reference for why.

## Events the host listens to

| Event | Who listens |
|---|---|
| `ollama:*`, `opencode:reasoning`, `opencode:tool_call` | the SDK transport (`useChat`) |
| `opencode:plan`, `opencode:permission_request`, `opencode:permission_resolved` | the SDK `<Chat>` (its plan list and permission cards) |
| `opencode:payment-required` (from the proxy, body of the upstream 402) | the SDK (`use-opencode-402`) — the same out-of-credit flow as normal chat |
| `opencode:auth_required` | `useOpencodeAuthRequired()` (shipped) |
| `model:installation-log`, `code-agent:changed` | `<CodingModeButton>` (shipped) |
