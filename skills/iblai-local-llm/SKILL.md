---
name: iblai-local-llm
description: Use when adding on-device LLM inference (Ollama backend) to a vibe Next.js + Tauri app. Documents the contract a vibe app must implement so the SDK can route chat through a local model via `localLLMProps` — the Tauri command names, event names, and the React hook shape. Mention before wiring "offline AI", "local model", "on-device LLM", or "Ollama" support into a desktop build.
globs:
alwaysApply: false
---

# /iblai-local-llm

A vibe Next.js + Tauri app can serve chat from a model running on the
user's machine instead of the hosted backend. The SDK turns this on
automatically when you pass a `localLLMProps` object whose
`isAvailable` is `true` and whose `ollamaStatus.model_installed` (or
`foundryStatus.has_models`) reports a ready model.

This skill defines the **contract** your app must implement to feed
that prop:

- the Tauri `#[command]` names the React layer calls,
- the Tauri event names the React layer listens on,
- the shape the React hook must return,

and points to references describing the install-flow, the on-disk
layout, and the failure modes you'll hit.

It does **not** ship a reference implementation — local-LLM support
is closed-source in the apps that have it today.

> Do NOT add custom styles / colors to ibl.ai SDK components. They
> ship with their own styling.
> See [BRAND.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/BRAND.md)
> for the brand palette.

> **Common setup (env, conventions, verification):** see
> [docs/skill-setup.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/docs/skill-setup.md).

## Prerequisites

1. Tauri shell wired up via [`/iblai-ops-build`](../iblai-ops-build/SKILL.md)
   (`iblai add builds` + `pnpm install`). The skill assumes
   `src-tauri/` already exists.
2. Rust toolchain via [rustup](https://rustup.rs).
3. ibl.ai providers in place (`/iblai-auth`) — the SDK looks for
   `localLLMProps` on its Account / Chat / Profile surfaces.

## The contract

### 1 — Tauri command + event names

Drop [`assets/nextjs/types/tauri.ts`](assets/nextjs/types/tauri.ts) into
your project at `types/tauri.ts`. It exports:

- `TAURI_COMMANDS` — every `#[tauri::command]` name your Rust side
  must register (`install_ollama`, `download_phi3_model`,
  `ollama_chat_stream`, …)
- `TAURI_EVENTS` — every `app.emit(...)` name your Rust side must
  use (`model:download-progress`, `model:installation-log`, …)
- `OllamaStatus`, `DownloadProgress`, `InstallationLog`,
  `DiskSpaceError`, `FoundryStatus` — the payload types each
  command / event must conform to
- `isTauriApp()` — synchronous check for `__TAURI_INTERNALS__` on
  `window`

These are the only assets the skill ships — they're public-API
constants and TypeScript interfaces, not implementation.

### 2 — Rust commands to implement

Your `src-tauri/src/` needs `#[tauri::command]` async functions
matching the names in `TAURI_COMMANDS` and the signatures in
[`references/tauri-commands.md`](references/tauri-commands.md). At
minimum (Ollama path):

```
install_ollama                  -> Result<String, String>
check_ollama_status             -> Result<OllamaStatus, String>
check_disk_space_for_model      -> Result<bool, String>      (emits disk-space-error)
download_phi3_model             -> Result<(), String>        (emits download-progress)
cancel_model_download           -> Result<(), String>
check_network_status            -> Result<bool, String>
get_os_type                     -> String
ollama_chat                     -> Result<String, String>
ollama_chat_stream              -> Result<(), String>        (emits ollama:chunk/done/error)
```

Wire them into `.invoke_handler(tauri::generate_handler![...])`. Add
the Cargo deps listed in
[`references/cargo-deps.toml`](references/cargo-deps.toml).

### 3 — React hook shape

The SDK's `<Account>` / `<Chat>` reads a `localLLMProps` object whose
fields mirror the state machine in
[`references/architecture.md`](references/architecture.md). Your hook
must return at least:

```ts
{
  isAvailable: boolean              // isTauriApp() && commands registered
  isUsingFoundry: boolean           // optional: true on Windows NPU path
  foundryStatus: FoundryStatus | null
  ollamaStatus: OllamaStatus | null
  state: { status: 'idle'|'checking'|'downloading'|'completed'|'cancelled'|'error',
           progress: number, message: string, logs: InstallationLog[] }
  startDownload: () => Promise<void>
  cancelDownload: () => Promise<void>
}
```

Internally the hook should:
- `invoke(TAURI_COMMANDS.CHECK_OLLAMA_STATUS)` on mount,
- `listen(TAURI_EVENTS.DOWNLOAD_PROGRESS, ...)` to update `state.progress`,
- persist `state` to `localStorage.model_download_state` so progress
  survives reload.

`startDownload` calls `install_ollama` (if not installed) then
`download_phi3_model`. `cancelDownload` calls `cancel_model_download`.

## Use it

Once your hook is in place, pass its output straight to the SDK:

```tsx
"use client";
import { useLocalLLM } from "@/hooks/use-local-llm";
import { Account } from "@iblai/iblai-js/web-containers/next";

export function AccountWithLocalLLM(props) {
  const localLLMProps = useLocalLLM();
  return <Account {...props} localLLMProps={localLLMProps} />;
}
```

When `isAvailable` is `false` (running in a normal browser, not
Tauri), the props degrade to no-ops and the SDK falls back to the
hosted backend automatically.

When `isAvailable && (ollamaStatus.model_installed ||
foundryStatus.has_models)`, the SDK routes chat through the local
model by invoking `ollama_chat_stream` and listening on
`ollama:chunk` / `ollama:done` / `ollama:error`.

## Backend choice

| Backend | Recommended for | Default model |
|---|---|---|
| **Ollama** | Cross-platform default — macOS, Linux, Windows x64 | Phi-3 Mini (~2 GB) |
| **Foundry Local** | Windows ARM / Copilot+ PCs with NPU | qwen2.5-0.5b (~1 GB) |

The hook should call `check_foundry_status` first and fall back to
Ollama when it rejects or returns `is_supported: false`. See
[`references/foundry-status.md`](references/foundry-status.md) for
the Foundry-specific command names and lifecycle.

## References

- [`references/architecture.md`](references/architecture.md) — layer
  diagram, lifecycle, on-disk model paths.
- [`references/tauri-commands.md`](references/tauri-commands.md) —
  full signatures + event payloads for every command in the contract.
- [`references/foundry-status.md`](references/foundry-status.md) —
  Windows NPU path command surface.
- [`references/cargo-deps.toml`](references/cargo-deps.toml) — Cargo
  `[dependencies]` your Rust side needs.
- [`references/troubleshooting.md`](references/troubleshooting.md) —
  common install / runtime failures with root causes.

## Related skills

- [`/iblai-ops-build`](../iblai-ops-build/SKILL.md) — adds the Tauri shell this skill depends on.
- [`/iblai-account`](../iblai-account/SKILL.md) — Account / settings surface that consumes `localLLMProps`.
- [`/iblai-agent-chat`](../iblai-agent-chat/SKILL.md) — chat surface that routes through the local model.
- [`/iblai-agent-llm`](../iblai-agent-llm/SKILL.md) — the per-agent LLM-provider Settings tab.
