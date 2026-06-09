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
   (adds `src-tauri/` + `pnpm install`). The skill assumes
   `src-tauri/` already exists. **Heads-up:** on an app that already has
   a non-trivial `next.config.mjs`, adding the Tauri shell can mis-merge its
   `output: 'export'` / `images` / `allowedDevOrigins` injection (it has
   landed those *inside the wrong object*, e.g. an SSR polyfill, leaving
   them as dead code). `git diff next.config.mjs` right after running it.
2. Rust toolchain via [rustup](https://rustup.rs), **plus the Tauri
   system libraries** for your OS (Linux: `libwebkit2gtk-4.1-dev`,
   `libdbus-1-dev`, `libsoup-3.0-dev`, …). These build *before* your
   crate, so a missing one (e.g. `libdbus-sys` panicking) masks your own
   compile errors entirely.
3. ibl.ai providers in place (`/iblai-auth`) — the SDK looks for
   `localLLMProps` on its account/profile **dropdown** surfaces
   (`UserProfileDropdown` / `UserProfileModal`), not on `Account`/`Chat`.

## The contract

### 1 — Tauri command + event names

Drop [`assets/nextjs/types/tauri.ts`](assets/nextjs/types/tauri.ts) into
your project at `types/tauri.ts`. It exports:

- `TAURI_COMMANDS` — every `#[tauri::command]` name your Rust side
  must register (`install_ollama`, `get_system_memory`, `download_model`,
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
stop_ollama                     -> Result<(), String>        (onStopManager / toggle off)
check_ollama_status             -> Result<OllamaStatus, String>
check_disk_space_for_model      -> Result<bool, String>      (emits disk-space-error)
get_system_memory               -> SystemMemory              (sync; RAM via sysinfo, VRAM via nvidia-smi)
download_model(model_id)        -> Result<(), String>        (emits download-progress)
cancel_model_download           -> Result<(), String>
check_network_status            -> Result<bool, String>
get_os_type                     -> String
ollama_chat                     -> Result<String, String>
ollama_chat_stream              -> Result<(), String>        (emits ollama:chunk/done/error)
```

`download_model` takes the Ollama tag as an argument (the SDK's Local-LLM
tab owns the catalog and passes the chosen id) — it is **not** the old
hardcoded `download_phi3_model`. `get_system_memory` is a synchronous
probe used to warn before pulling a model too big for the host.

Wire them into `.invoke_handler(tauri::generate_handler![...])`. Add
the Cargo deps listed in
[`references/cargo-deps.toml`](references/cargo-deps.toml).

### 3 — React hook shape

`localLLMProps` is read by the SDK's account/profile **dropdown**
surfaces (see "Use it"). **Grep your installed `@iblai/web-containers`
`.d.ts` for `localLLMProps` and match its exact shape** — it is the
ground truth, and it differs from earlier drafts of this skill. As of
`@iblai/web-containers` 1.8.x the shape is:

```ts
{
  isAvailable: boolean              // isTauriApp() && commands registered
  state: ModelDownloadState         // status/progress/message/logs/lastUpdated
  ollamaStatus: OllamaStatus | null
  systemMemory?: SystemMemory | null  // { ram_total, vram_total } from get_system_memory
  isUsingFoundry?: boolean          // Windows NPU path
  foundryStatus?: FoundryStatus | null
  foundryModels?: FoundryModel[]
  selectedFoundryModel?: string | null
  onStartDownload: (modelId?: string) => void  // install (if needed) + pull that tag
  onCancelDownload: () => void
  onInstallOllama: () => void
  onStopManager?: () => void        // stop_ollama — fired when the toggle goes off
  onInstallFoundry?: () => void
  onCheckStatus: () => void
  onResetState: () => void
  onSelectFoundryModel?: (modelId: string) => void
}
```

Note the callbacks are **`on*`-prefixed and return `void`** (they fire
the `invoke` internally — don't return the promise). `onStartDownload`
now takes an optional `modelId` — the tab passes the catalog entry the
user picked, and the SDK forwards it to `download_model`.

**The SDK ships the hook.** `@iblai/web-containers` exports
`useModelDownload()`, which already does the work below and returns
`{ isAvailable, state, ollamaStatus, systemMemory, startDownload(modelId?),
cancelDownload, installOllama, stopManager, checkStatus, resetState, … }`.
Wire its output into `localLLMProps` (renaming to the `on*` callbacks)
rather than re-implementing — that's how the shipped desktop app does it.
If you do hand-roll the hook, it must:
- `invoke(TAURI_COMMANDS.CHECK_OLLAMA_STATUS)` on mount, after an
  opportunistic `CHECK_FOUNDRY_STATUS` that silently falls back when the
  Foundry commands aren't registered (the `invoke` just rejects),
- `invoke(TAURI_COMMANDS.GET_SYSTEM_MEMORY)` once on mount and keep
  `systemMemory` so a Download click can be pre-flighted against host
  capacity (see "Field notes"),
- `listen` on every `model:*` event to drive `state`,
- persist `state` to `localStorage.model_download_state` so progress
  survives reload — **hydrate it in an effect, not the initial
  `useState`**, or you'll get an SSR hydration mismatch.

`onStartDownload(modelId)` calls `install_ollama` (if not installed) then
`download_model(modelId)`; `onCancelDownload` calls
`cancel_model_download`; `onStopManager` calls `stop_ollama`.

## Use it

Pass the hook output to whichever surface accepts `localLLMProps` in
**your installed SDK**. As of `@iblai/web-containers` 1.7.x that is
`UserProfileDropdown` / `UserProfileModal` (the "Local LLM" account tab)
— **not** `Account` or `Chat`. Confirm with
`grep -rn localLLMProps node_modules/@iblai/web-containers/dist/**/*.d.ts`
before wiring; the earlier `<Account localLLMProps>` example was wrong
for shipped SDKs.

```tsx
"use client";
import { useLocalLLM } from "@/hooks/use-local-llm";
import { UserProfileDropdown } from "@iblai/iblai-js/web-containers/next";

export function AccountMenu(props) {
  const localLLMProps = useLocalLLM();
  return <UserProfileDropdown {...props} localLLMProps={localLLMProps} />;
}
```

When `isAvailable` is `false` (a normal browser tab), the props degrade
to no-ops and the SDK uses the hosted backend.

**Chat routing is automatic — `<Chat>` does not take `localLLMProps`.**
Once `isAvailable && (ollamaStatus.model_installed ||
foundryStatus.has_models)`, the SDK invokes the registered
`ollama_chat_stream` command and listens on `ollama:chunk` /
`ollama:done` / `ollama:error` on its own. Your only job for chat is to
register the Tauri commands with the exact names/events from
`types/tauri.ts` — no per-surface wiring.

## Backend choice

| Backend | Recommended for | Default model |
|---|---|---|
| **Ollama** | Cross-platform default — macOS, Linux, Windows x64 | Phi-3 Mini (~2 GB) |
| **Foundry Local** | Windows ARM / Copilot+ PCs with NPU | qwen2.5-0.5b (~1 GB) |

The hook should call `check_foundry_status` first and fall back to
Ollama when it rejects or returns `is_supported: false`. See
[`references/foundry-status.md`](references/foundry-status.md) for
the Foundry-specific command names and lifecycle.

## Field notes (from a production integration)

- **Warn before downloading a model too big for the machine.** Call
  `get_system_memory` → `{ ram_total, vram_total }` (bytes) and size the
  model against `usable = max(ram_total, vram_total)`. `vram_total` comes
  from `nvidia-smi` and is **`0`** on integrated graphics, Apple unified
  memory, and AMD/Intel GPUs — so thresholding on VRAM alone wrongly
  flags every Mac; always fall back to RAM via the `max`. Parse the
  catalog's human size (`"2.2 GB"` → bytes) and, when it exceeds
  `usable * FRACTION`, show a confirm dialog instead of pulling:

  ```ts
  const usableMemoryBytes = (m?: SystemMemory | null) =>
    m ? Math.max(m.ram_total, m.vram_total) : 0;          // VRAM 0 ⇒ use RAM
  const modelExceedsCapacity = (model, m) => {
    const bytes = parseModelSizeBytes(model.size);         // "2.2 GB" → number
    if (bytes == null) return false;                       // unknown size ⇒ don't warn
    return bytes > usableMemoryBytes(m) * MODEL_SIZE_WARN_FRACTION;
  };
  ```

  `MODEL_SIZE_WARN_FRACTION` is the share of usable memory a model may
  occupy before the warning trips (a realistic ceiling is ~0.5–0.8; the
  shipped tab ships a deliberately tiny test value so the dialog is easy
  to trigger — set it sanely before release). **Gotcha:** read memory
  *before* any catalog-lookup / early-return guard, or the `invoke`
  silently never fires — see [troubleshooting](references/troubleshooting.md)
  "A command never runs".

- **Server-rendered apps can't use the default static export.** The
  Tauri shell defaults to `frontendDist: "../out"` (a `next build`
  static export). An app with runtime-dynamic routes (e.g.
  `/x/[id]/[[...slug]]`) and no `generateStaticParams` **cannot** be
  exported — `output: 'export'` hard-errors with "missing
  generateStaticParams()". Keep `output: 'standalone'` and point Tauri
  **dev** at the live Next server instead, in `tauri.conf.json`:
  ```json
  "build": {
    "beforeDevCommand": "pnpm dev",
    "devUrl": "http://localhost:3000",
    "beforeBuildCommand": "pnpm build",
    "frontendDist": "../out"
  }
  ```
  `tauri dev` then loads `localhost:3000`; no `out/` needed. (Production
  bundles for such apps point `frontendDist`/`devUrl` at a hosted URL
  rather than shipping a static export.)

- **Download via the daemon HTTP API, not the CLI.** Implementing
  `download_model(modelId)` as `POST 127.0.0.1:11434/api/pull
  {"model": modelId, "stream":true}` and reading the NDJSON stream
  (`{status,completed,total,digest}`) is cleaner than scraping
  `ollama pull` stdout — it maps straight onto the `DownloadProgress`
  fields and cancels by breaking the stream loop on a shared
  `AtomicBool` (no child-process to kill). Same pattern for chat:
  stream `POST /api/chat`.

- **`install_ollama` needs root on Linux.** The official `install.sh`
  writes `/usr/local/bin/ollama` and creates an `ollama` systemd
  service + user via `sudo`. A non-root Tauri app spawning
  `curl … | sh` non-interactively can't elevate, so the install fails
  silently. Prefer a rootless install (drop the static `ollama` binary
  in `~/.local/bin`, run `ollama serve`) or detect-and-guide instead of
  auto-installing.

- **Minimal Cargo deps** for the HTTP-API approach:
  `reqwest { json, stream, rustls-tls }`, `tokio { full }`,
  `futures-util`, `sysinfo`, `chrono`. `blocking` / `sha2` / `hex` /
  `http` are only needed if you verify installer checksums. `sysinfo`
  also backs `get_system_memory`'s RAM figure (`System::total_memory()`);
  VRAM is read by shelling out to `nvidia-smi`, so it needs **no extra
  crate** — and contributes `0` wherever that binary is absent.

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
