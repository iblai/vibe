# Architecture

The contract this skill documents, in layers.

## Layers

```
┌─────────────────────────────────────────────┐
│  React UI                                   │
│  ├─ useLocalLLM()  ← entry point            │
│  └─ <Account localLLMProps={…}/>            │
│      <Chat   localLLMProps={…}/>            │
└──────────────┬──────────────────────────────┘
               │ tauri::invoke / event::listen
               ▼
┌─────────────────────────────────────────────┐
│  Tauri commands                             │
│  ├─ install_ollama / stop_ollama            │
│  ├─ check_ollama_status                      │
│  ├─ check_disk_space_for_model              │
│  ├─ get_system_memory  (RAM/VRAM probe)     │
│  ├─ download_model(id) / cancel_*           │
│  ├─ ollama_chat / ollama_chat_stream        │
│  └─ get_os_type / check_network_status      │
└──────────────┬──────────────────────────────┘
               │ shell-out / HTTP
               ▼
        Ollama daemon (http://127.0.0.1:11434)
```

## Lifecycle

### Cold launch

1. App boots. `useLocalLLM()` mounts in whatever surface holds the
   Account modal.
2. The hook calls `check_foundry_status` first (preferred on Windows
   NPU). If the command isn't registered or returns
   `is_supported=false`, it falls through to Ollama.
3. `check_ollama_status` returns
   `{ installed, running, model_installed }`.
4. UI renders the right state:
   - **not installed** → show "Download local model" CTA → triggers
     `install_ollama`.
   - **installed but model missing** → CTA triggers
     `download_model(modelId)` for the catalog entry the user picked.
   - **ready** → `state.status === 'completed'`, SDK routes chat
     through `ollama_chat_stream`.
5. In parallel the hook calls `get_system_memory` once and stashes
   `{ ram_total, vram_total }` so a Download click can be pre-flighted
   against the machine's capacity before the pull starts.

### Download

1. The user picks a model from the catalog; its Ollama tag is passed as
   `download_model(modelId)`. Before pulling, the tab compares the
   model's catalog size against `max(ram_total, vram_total)` and, if it
   exceeds the threshold, shows a "may not run on your system" confirm
   dialog (see SKILL.md "Field notes").
2. `download_model` gets progress for the pull. Two ways:
   - **Recommended:** `POST 127.0.0.1:11434/api/pull`
     `{"model": modelId, "stream":true}` and read the NDJSON stream —
     each line is `{status, completed, total, digest}`, which maps
     straight onto the event payload, and you cancel by breaking the
     stream loop on a shared `AtomicBool`.
   - Or shell out to `ollama pull <modelId>` and tail stdout (more
     fragile to parse; cancel by killing the child).
3. Each line is re-emitted as a Tauri event `model:download-progress`
   with shape `{ status, completed, total, percentage, digest, message }`.
4. The React hook subscribes via `listen()` and writes the events
   into its own state, persisted to `localStorage` so the progress
   bar survives app restarts.

### Inference

1. The SDK builds the OpenAI-style
   `messages: Array<{role, content}>` payload and calls
   `ollama_chat_stream` (streaming) or `ollama_chat` (single shot).
2. `ollama_chat_stream` POSTs to
   `http://127.0.0.1:11434/api/chat`, reads the NDJSON stream
   chunk by chunk, and emits three event types per generation:
   - `ollama:chunk` `{ generation_id, content }`
   - `ollama:done`  `{ generation_id, full_content }`
   - `ollama:error` `{ generation_id, error }`
3. The SDK's local-LLM branch listens for events keyed by the
   `generation_id` it passed in.

## Events the hook subscribes to

| Event | When it fires | Payload |
|---|---|---|
| `model:download-progress` | every progress tick of `ollama pull` | `DownloadProgress` |
| `model:installation-log`  | each log line during install / download | `InstallationLog` |
| `model:disk-space-error`  | `check_disk_space` finds < required free space | `DiskSpaceError` |
| `model:ollama-status`     | status changes (started, stopped, model ready) | `OllamaStatus` |

Names live in `assets/nextjs/types/tauri.ts` under the `TAURI_EVENTS`
const. Your Rust side must mirror these names 1:1 when emitting.

## State persistence

Recommended `localStorage` keys (the SDK does not enforce these — pick
names that don't collide with other parts of your app):

- `model_download_state` — full hook state including progress
  percentage and the last 100 log lines, so progress visualization
  survives a hot reload or a quit-relaunch mid-download.
- `model_download_prompt_dismissed` — set when the user closes the
  first-launch prompt; prevents nag.
- `selected_foundry_model` (Foundry path only) — the Foundry model
  the user picked, restored on next launch.

## Where models live on disk

- **Ollama**: managed by the Ollama daemon itself —
  `~/.ollama/models` (macOS / Linux) or
  `%USERPROFILE%\.ollama\models` (Windows).
- **Foundry Local**: `%USERPROFILE%\.foundry\models`.
