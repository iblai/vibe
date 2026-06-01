# Tauri commands

Every `#[command]` this skill ships, what it does, and its payload
shape. Names match the `TAURI_COMMANDS` enum in
`assets/nextjs/types/tauri.ts` exactly.

## Status + capability checks

### `check_ollama_status`
- **Signature**: `async (AppHandle) -> Result<OllamaStatus, String>`
- **Returns**:
  ```ts
  { installed: boolean; running: boolean; model_installed: boolean }
  ```
- **Notes**: doesn't fail when Ollama is missing — returns `installed:
  false` so the UI can offer the install CTA without dealing with
  errors.

### `check_disk_space_for_model`
- **Signature**: `async (AppHandle) -> Result<bool, String>`
- **Returns**: `true` when the disk holding `~/.ollama` (or the user
  home on first install) has at least `REQUIRED_FREE_SPACE_GB` free.
- **Emits**: `model:disk-space-error` on `false` with
  `{ required_gb, available_gb, message }`.

### `check_network_status`
- **Signature**: `async () -> Result<bool, String>`
- **Returns**: `true` when `https://www.google.com` (or a fallback)
  responds. Used to gate Ollama install + model download attempts.

### `get_os_type`
- **Signature**: `fn () -> String`
- **Returns**: `"windows" | "macos" | "linux" | "unknown"`. Drives
  platform-specific install copy in the UI.

## Install

### `install_ollama`
- **Signature**: `async () -> Result<String, String>`
- **Side effects**: downloads the platform-appropriate Ollama installer
  (DMG on macOS, MSI on Windows, sh on Linux), runs it, then starts the
  daemon. Returns a short success message; the caller refreshes via
  `check_ollama_status` after.
- **Emits**: `model:installation-log` for every stage.

## Model download

### `download_phi3_model`
- **Signature**: `async (AppHandle) -> Result<(), String>`
- **What it does**: shells out to `ollama pull phi3:mini` and streams
  the progress to the UI.
- **Emits**:
  - `model:download-progress` `{ status, completed, total, percentage, digest, message }`
  - `model:installation-log` for each non-progress log line

### `cancel_model_download`
- **Signature**: `async (AppHandle) -> Result<(), String>`
- **What it does**: kills the active `ollama pull` subprocess and
  emits a `cancelled` `model:download-progress` event.

## Inference

### `ollama_chat`
- **Signature**:
  ```rust
  async (messages: Vec<serde_json::Value>, model: Option<String>) -> Result<String, String>
  ```
- **Behavior**: single-shot request to
  `http://127.0.0.1:11434/api/chat`. Returns the assistant's full
  reply as a string. Use this only for short prompts where streaming
  isn't worth the wiring.

### `ollama_chat_stream`
- **Signature**:
  ```rust
  async (
      app: AppHandle,
      generation_id: String,
      messages: Vec<serde_json::Value>,
      model: Option<String>,
  ) -> Result<(), String>
  ```
- **Behavior**: streams the response back via Tauri events keyed by
  `generation_id` so multiple concurrent generations don't get
  cross-wired.
- **Emits** (per generation):
  - `ollama:chunk` `{ generation_id, content }` — every delta
  - `ollama:done`  `{ generation_id, full_content }` — terminator
  - `ollama:error` `{ generation_id, error }` — fatal

## Front-end constants

**`assets/nextjs/types/tauri.ts` is the single source of truth** for
`TAURI_COMMANDS` / `TAURI_EVENTS` — copy it verbatim into your project
and import from there; don't retype the names. Earlier inline copies in
this doc drifted from the asset, especially the Foundry commands. The
asset's Foundry names are the canonical `*_foundry_local_*` form, e.g.:

```ts
CHECK_FOUNDRY_STATUS:       'check_foundry_local_status',   // not 'check_foundry_status'
START_FOUNDRY_SERVICE:      'start_foundry_local_service',
LOAD_FOUNDRY_MODEL:         'load_foundry_local_model',     // not 'load_foundry_model'
SET_SELECTED_FOUNDRY_MODEL: 'set_selected_foundry_model',   // not 'save_…'
```

The Ollama-path command names (`install_ollama`, `check_ollama_status`,
`check_disk_space_for_model`, `download_phi3_model`,
`cancel_model_download`, `check_network_status`, `get_os_type`,
`ollama_chat`, `ollama_chat_stream`) and the `model:*` events are stable.

The **inference stream events are separate** from `TAURI_EVENTS` and are
keyed by `generation_id`: `ollama:chunk` / `ollama:done` /
`ollama:error`. The SDK subscribes to these itself when it routes chat
locally — you only emit them from `ollama_chat_stream`.

## Download via the daemon API (recommended)

`download_phi3_model` is cleaner implemented against the daemon's HTTP
`/api/pull` than by scraping the CLI: `POST 127.0.0.1:11434/api/pull`
with `{"model":"phi3:mini","stream":true}` returns NDJSON lines
(`{status, completed, total, digest}`) that map directly onto the
`model:download-progress` payload. Cancel by checking a shared
`AtomicBool` each chunk and breaking the loop (the
`cancel_model_download` command flips it) — no child process to kill.
