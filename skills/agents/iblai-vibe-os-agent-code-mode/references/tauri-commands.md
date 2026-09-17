# Tauri commands and events

Every `#[command]` the shipped Rust modules register, with the argument
names the frontend passes (Tauri converts `snake_case` Rust params to
`camelCase` `invoke` keys — `session_id` is `sessionId` from JS), and every
event they emit. The SDK's `opencode-client.ts` (in `@iblai/web-utils`)
already calls the chat trio; the rest are called by the host app's
`<CodingModeButton>` and hooks.

## Desktop — `opencode_acp.rs`

### `opencode_chat_stream`
- **Args**: `sessionId`, `messages: {role, content}[]`, `generationId`,
  `tenant`, `token` (DM token — never reaches the agent, see proxy),
  `model?` (`provider/model`, e.g. `openai/gpt-4o`; `ollama/…` or
  `foundry/…` selects an on-device runtime), `apiBase?`, `workspace?`,
  `mentor?` (agent UUID — links that agent's synced skills), `newChatKey?`
  (the ephemeral first-turn key, so the mapping migrates onto the real
  session id).
- **Returns**: `Result<(), String>` — resolves when the turn ends.
- **Emits** (all keyed by `generation_id`):
  - `ollama:token` `{ generation_id, token, full_content }` — coalesced ≤ 5/s
  - `ollama:done` `{ generation_id, full_content }`
  - `ollama:error` `{ generation_id, error }`
  - `ollama:restart` `{ generation_id }` — the child crashed mid-turn and is
    respawning into the same generation; clear the partial stream
  - `opencode:reasoning` `{ generation_id, delta }`
  - `opencode:tool_call` `{ generation_id, update }` — the raw ACP
    `tool_call` / `tool_call_update` object (`toolCallId`, `title`, `kind`,
    `status`, `content`, …)
  - `opencode:permission_request` `{ generation_id, session_id, request_id,
    title, kind, command, allow_option_id, reject_option_id }` — `kind` is
    the ACP ToolKind (`read` / `edit` / `execute` / `fetch` / …)
  - `opencode:permission_resolved` `{ request_id }`
- **Notes**: `messages` normally only needs the newest user turn (opencode
  keeps its own state), but pass the whole history — when the Rust side
  has to start a fresh agent session it resends it so the agent continues.

### `opencode_stop`
- **Args**: `sessionId` → ACP `session/cancel`; pending permission prompts
  are denied and resolved.

### `opencode_close`
- **Args**: `sessionId` → kills that chat's `opencode acp` child.

### `opencode_permission_respond`
- **Args**: `requestId`, `optionId?` — pass `allow_option_id` or
  `reject_option_id` from the request; `null` denies.

### `get_opencode_permission_mode` / `set_opencode_permission_mode`
- `get` → `"manual" | "auto" | null` (never chosen → `null`; raise the
  first-run dialog). `set(mode)` persists to `settings.json` and takes
  effect on the next prompt.

### `get_opencode_workspace` / `set_opencode_workspace` / `new_opencode_workspace`
- **Args**: `sessionId`, `tenant?`, `mentor?` (+ `path` for `set`).
- **Returns**: the absolute workspace path. `new` creates a fresh
  git-backed folder under `~/.local/share/iblai/workspaces/`; the map is
  keyed per chat (and per agent when `mentor` is given).

### `set_opencode_skills`
- **Args**: `mentorUniqueId`, `skills?: SkillPayload[]` — each
  `{ slug, name, instruction, resources: [{filename, content}] }` from the
  Agent Skills API. Writes `~/.local/share/iblai/skills/<mentor>/…` and
  returns the directory. `null`/absent clears the agent's dir.
- `begin_opencode_skills_sync(mentorUniqueId)` marks a sync in flight so a
  spawn waits for it instead of starting with stale skills.

### `check_code_local_model`
- **Args**: `model` (`ollama/<id>`, `foundry/<id>`, or a bare id).
- **Returns** `{ endpoint, running, tools_supported, reason }` — whether the
  on-device runtime is up and the model supports tool calls. Needs the
  local-LLM modules (`model_manager`, `foundry_manager`) — see the wiring
  reference.

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
- Downloads the pinned release into `~/.local/share/iblai/bin/`, writes
  the config, ensures the default workspace. Progress lines go out as
  `model:installation-log` `{ message, source: "opencode" }` (the same
  channel the local-LLM installer uses). **Errors on Windows** ("Code
  isn't available on Windows.").

### `check_opencode_status`
- **Returns** `{ installed, version, config_ready, sandboxed }`.

### `ensure_vibe_skills`
- Resolves `github.com/iblai/vibe/releases/latest` and syncs the release's
  `skills/` into `~/.local/share/iblai/skills/vibe/` when the tag moved.
  **Returns** `{ present, refreshed }`. Called at launch and on Code enable;
  the button shows an amber note while it is absent.

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
the host.

- `remote_code_set_host(url, password, mgmt?, urls?)` — pair (from the QR
  or manual entry); probes the server and returns `{ configured, connected,
  url, directory }`.
- `remote_code_get_host()` → the same shape, or
  `{ configured: false, connected: false }`.
- `remote_code_clear_host()` — unpair.
- `remote_code_list_workspaces()` → the desktop's workspace list via the
  management URL (errors when the pairing predates `mgmt` — re-pair by QR).
- `opencode_chat_stream` / `opencode_stop` / `opencode_close` /
  `opencode_permission_respond` / `get|set_opencode_permission_mode` /
  `get|set|new_opencode_workspace` — same names, args, and emitted events
  as the desktop versions, proxied over HTTP + SSE. `"auto"` mode
  short-circuits permission events locally, exactly like the desktop.

Every background emit on mobile goes through `crate::emit_on_main` — see
the wiring reference for why.
