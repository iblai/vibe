# Tauri commands and events

Every `#[command]` the shipped Cowork modules register, with the argument
names the frontend passes (Tauri converts `snake_case` Rust params to
`camelCase` `invoke` keys), and every event they emit. All of them are
called by the SDK: the Cowork pill and its setup dialog
(`useCuaDriver`, `CUA_DRIVER_TAURI_COMMANDS` in `@iblai/web-containers`),
the Cowork transport (`cowork-mcp.ts`) and the on-device model route
(`remote-ai-client.ts`) in `@iblai/web-utils`. Desktop only.

## The driver — `cua_driver_installer.rs`

### `install_cua_driver`
- Downloads the pinned driver (`0.17.0`, override `IBL_CUA_DRIVER_VERSION`)
  from the `trycua/cua` GitHub release `cua-driver-rs-v<version>`, checks
  it against the release's `checksums.txt` (SHA-256), and installs it at
  `~/.local/share/iblai/bin/cua-driver`. On macOS it clears the quarantine
  flag and signs the binary ad hoc. One install at a time; a driver already
  on `PATH` wins and nothing is downloaded.
- **Returns** the installed version. Refuses on an unsupported session.
- **Emits** `cua-driver:install-progress` `{ status, percentage, message }`
  and `cua-driver:installation-log` `{ timestamp, level, message }`.

### `check_cua_driver_status`
- **Returns** `{ installed, version, supported, reason }` (`reason` only
  when not supported).

## The driver process — `cua_driver_mcp.rs`

### `cua_driver_support`
- **Returns** `{ supported, reason }`. `reason` is a code, never shown raw:
  `sandboxed` (the Mac App Store build), `unsupported_os`, `kde_unproven`,
  `gnome_helper_missing` (GNOME without the WinRects extension),
  `unknown_session`. Windows, macOS, Linux/X11 and Sway are supported.

### `cua_driver_start`
- Starts (or reuses) the one `cua-driver mcp --direct --grant
  existing-profile` child for the webview's Cowork loop. It first closes
  every Code session that had the screen tools and stops their daemon: one
  driver owns the screen.
- **Emits** `cua-driver:message` (one JSON-RPC line, as a string) for each
  line the driver writes, and `cua-driver:closed` once when it exits.
  Image parts are stripped from results and the driver's structured
  results are folded into text before the line is emitted.

### `cua_driver_send`
- **Args**: `line` — one JSON-RPC message for the driver's stdin.
  `include_screenshot` is forced off on every tool that takes it.

### `cua_driver_stop`
- Stops the webview's driver, every Code session with the screen tools,
  and their daemon. The SDK calls it when Cowork is switched off.

### `request_cowork_permission`
- **Args**: `kind` (`"accessibility"` | `"screen_recording"`),
  `openSettings` (bool).
- Asks macOS for the grant and **returns** whether it is held now. macOS
  shows its own alert only the first time; pass `openSettings: true` on a
  repeat ask to open the System Settings pane as well. Screen Recording is
  asked on the main thread (`CGRequestScreenCaptureAccess`): off it, the
  request never reaches macOS 26. Off macOS it returns `true`.

### `open_privacy_settings`
- **Args**: `pane` (`"accessibility"` | `"screen_recording"`). Opens that
  Privacy & Security pane. For Screen Recording it asks first, because
  macOS lists an app in that pane only once it has asked. A no-op off macOS.

### `relaunch_app`
- Restarts the app. macOS applies a new Screen Recording grant only to
  processes started after it.

### `bring_app_to_front`
- Unminimizes, shows and focuses the `main` window once a grant lands while
  System Settings is in front.

## The on-device model — `local_llm_openai.rs`

The page cannot call `http://localhost` from the app's `https` origin, so
the desktop makes the request for the webview's Cowork loop when Local
Models is in use.

### `local_llm_openai_stream`
- **Args**: `requestId`, `body` (the OpenAI-style request the AI SDK would
  send), `onEvent` (a `Channel`).
- Starts Ollama if it is down, points the request at the model's copy sized
  to 32,768 tokens (`model_manager::sized_local_model`), refuses a model
  that can't hold 8,192, and posts to Ollama's
  `/v1/chat/completions`. The URL is fixed; nothing in `body` can change it.
- **Channel events**: `{ kind: "head", status, content_type }`, then
  `{ kind: "chunk", data }` (whole lines), then `{ kind: "end" }`.

### `local_llm_openai_stream_cancel`
- **Args**: `requestId`. Aborts the upstream request (the page's Stop).

## Plugin commands

`tauri-plugin-macos-permissions` (registered on macOS only) exposes the
checks the setup dialog polls:
`plugin:macos-permissions|check_accessibility_permission`,
`…|request_accessibility_permission`,
`…|check_screen_recording_permission`,
`…|request_screen_recording_permission`. They are granted by the shipped
`capabilities/macos-permissions.json`.

## Code + Cowork

A Code turn with Cowork on (`opencode_chat_stream` with `cowork: true`,
see the Code mode skill) does not use the commands above. `opencode_acp.rs`
starts `cua-driver serve --embedded --socket <data>/cua-driver.sock
--parent-liveness-stdio --host-bundle-id <tauri.conf.json identifier>
--no-overlay --grant existing-profile` as the app's own daemon, and hands
the agent `cua-driver mcp --embedded --socket <relay>` as its one ACP
`mcpServers` entry. Not on Windows.
