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

Names live in `assets/nextjs/types/tauri.ts`. The two enums you'll
import everywhere:

```ts
export const TAURI_COMMANDS = {
  INSTALL_OLLAMA:        'install_ollama',
  CHECK_OLLAMA_STATUS:   'check_ollama_status',
  CHECK_DISK_SPACE:      'check_disk_space_for_model',
  DOWNLOAD_MODEL:        'download_phi3_model',
  CANCEL_DOWNLOAD:       'cancel_model_download',
  CHECK_NETWORK_STATUS:  'check_network_status',
  GET_OS_TYPE:           'get_os_type',
  OLLAMA_CHAT:           'ollama_chat',
  OLLAMA_CHAT_STREAM:    'ollama_chat_stream',
  // Foundry (registered only when you wire the foundry_* modules):
  CHECK_FOUNDRY_STATUS:           'check_foundry_status',
  LOAD_FOUNDRY_MODEL:             'load_foundry_model',
  SAVE_SELECTED_FOUNDRY_MODEL:    'save_selected_foundry_model',
  GET_SELECTED_FOUNDRY_MODEL:     'get_selected_foundry_model',
  INSTALL_FOUNDRY:                'install_foundry',
  DOWNLOAD_FOUNDRY_MODEL:         'download_foundry_model_cmd',
  GET_RECOMMENDED_FOUNDRY_MODELS: 'get_recommended_foundry_models',
} as const;

export const TAURI_EVENTS = {
  DOWNLOAD_PROGRESS: 'model:download-progress',
  INSTALLATION_LOG:  'model:installation-log',
  DISK_SPACE_ERROR:  'model:disk-space-error',
  OLLAMA_STATUS:     'model:ollama-status',
} as const;
```
