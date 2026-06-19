---
name: iblai-computer-assistant
description: Use when adding the "Computer Assistant" (let the on-device AI control the Mac — click, type, and operate apps via GhostOS) to a vibe Next.js + Tauri app. Documents the SDK contract (`systemControlProps`, `useGhostOs`, `GHOST_OS_TAURI_*` commands/events, `MACOS_PERMISSIONS_COMMANDS`, the model-size gate `requiredSizeGb`, the Local-Models gate) and the macOS host implementation (Homebrew `ghost` install, the ollama-mcp-bridge that gives a local model MCP tools, the `tauri-plugin-macos-permissions` Accessibility flow, the non-sandboxed Developer ID build). Mention before wiring "system control", "computer use", "GhostOS", or "let the AI use my computer" into a desktop build. macOS-only.
globs:
alwaysApply: false
---

# /iblai-computer-assistant

The **Computer Assistant** lets the user's *local* AI model see the screen and
operate the Mac — click buttons, type, fill forms, open apps — by giving it
[GhostOS](https://github.com/ghostwright/ghost-os) as an MCP tool server. The SDK
surfaces it as a plain-language card in **User Profile → Advanced** (next to
"Local Models"), labelled **"Computer Assistant"**.

It rides entirely on top of [`/iblai-local-llm`](../iblai-local-llm/SKILL.md):
the assistant's "brain" is the local Ollama model, and the tool calls flow
through a local proxy that injects GhostOS's tools. So **Local Models must be on
and a tool-capable model selected** before any of this works.

> Do NOT add custom styles / colors to ibl.ai SDK components. They ship with
> their own styling.
> See [BRAND.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/BRAND.md).

> **Common setup (env, conventions, verification):** see
> [docs/skill-setup.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/docs/skill-setup.md).

This skill does **not** ship a reference implementation — the host commands are
closed-source in the apps that have it (the ghost-os desktop app). It defines
the **contract** and the integration gotchas.

## How the loop works

```
local chat (ollama_chat_stream, tool_support=true)
   │  POST http://localhost:8000/api/chat        ← the MCP bridge, NOT :11434
   ▼
ollama-mcp-bridge  ──(injects GhostOS's MCP tools into the request)──► Ollama
   │                                              (tool-capable model, e.g. phi4-mini)
   │  model emits tool_calls (ghost_click, ghost_type, …)
   ▼
bridge spawns `ghost mcp` (stdio) ──► GhostOS drives the Mac via Accessibility
   │  tool results fed back; bridge loops until the model returns a final answer
   ▼
streamed back to the chat UI
```

Three moving parts the host must provide: **GhostOS installed** (Homebrew), the
**ollama-mcp-bridge running** with a `ghost` server in its config, and the
**macOS Accessibility permission** granted. The card walks the user through them.

## Prerequisites

1. [`/iblai-local-llm`](../iblai-local-llm/SKILL.md) wired up — the Computer
   Assistant's chat runs on the local model and **requires a tool-capable model**
   (phi4-mini, llama3.2, qwen3, mistral, …; *not* phi3:mini). The card is gated
   off until Local Models is enabled.
2. **macOS only.** GhostOS is a native macOS (Swift) MCP server; Accessibility is
   a macOS TCC permission. Every host command no-ops / errors off-macOS.
3. **A non-sandboxed Developer ID build for real control** — the App Sandbox
   blocks an app from controlling *other* apps via Accessibility, even when the
   user grants it. See [Two macOS builds](#two-macos-builds-mas-vs-developer-id).
4. **Homebrew** and **uv** on the host (the installers shell out to them).

## The contract

### 1 — SDK surface: `systemControlProps` + `useGhostOs`

The card lives inside the account/profile **dropdown** (`UserProfileDropdown` /
`UserProfileModal` → Advanced), the same surface that takes `localLLMProps`. It
**self-wires** from the SDK's `useGhostOs()` hook, so the host only passes
`systemControlProps` to configure things (e.g. the size gate). Grep your
installed SDK for the exact shape — it is the ground truth:

```
grep -rn "systemControlProps" node_modules/@iblai/web-containers/dist/**/*.d.ts
```

As of `@iblai/web-containers` 1.10.x:

```ts
systemControlProps?: {
  isAvailable: boolean                 // isTauriApp() && commands registered
  state: GhostOsInstallState           // status/progress/message/logs/lastUpdated
  status: GhostOsStatus | null         // installed/running/installing/version
  requiredSizeGb?: number              // size gate (default 12); see Gates
  ollamaStatus?: OllamaStatus | null   // installed model tags — for "Upgrade"
  systemMemory?: SystemMemory | null   // RAM/VRAM — keeps the capacity warning
  onDownloadModel?: (modelId) => void  // "Upgrade to <model>" — wire to Local Models download
  accessibilityPermission?: boolean | null  // null/undefined hides the step
  onInstall: () => void
  onStop?: () => void
  onCheckStatus: () => void
  onResetState: () => void
  onRequestAccessibilityPermission?: () => void
}
```

**Two ways to supply it:**

- **Config-only (recommended for just the gate).** The dropdown falls back to
  `useGhostOs()` per-field at runtime, so you can pass *only* `requiredSizeGb`.
  But the SDK types the object as fully-required, so cast:
  ```tsx
  systemControlProps={
    { requiredSizeGb: 13 } as unknown as NonNullable<
      ComponentProps<typeof UserProfileDropdown>['systemControlProps']
    >
  }
  ```
- **Full props.** Call `useGhostOs()` yourself and pass every field (mirrors how
  `localLLMProps` is wired). Type-clean, but the dropdown *also* calls
  `useGhostOs` internally, so the hook runs twice (double listeners) — prefer the
  cast unless you need to intercept the handlers.

`useGhostOs()` (exported from `@iblai/iblai-js/web-containers`) returns
`{ isAvailable, state, status, accessibilityPermission, install, stop,
checkStatus, resetState, requestAccessibilityPermission }`. `isAvailable` is
`isTauriApp()`, so the card hides itself in a browser tab.

### 2 — Host commands (Rust)

Three `#[tauri::command]`s, names from `GHOST_OS_TAURI_COMMANDS`:

```
install_ghost_os      -> Result<String, String>      brew install; emits install-progress/log
stop_ghost_os         -> Result<(), String>          best-effort pkill of any live ghost
check_ghost_os_status -> Result<GhostOsStatus, String>
```

```rust
struct GhostOsStatus { installed: bool, running: bool, installing: bool, version: Option<String> }
```

Events (`GHOST_OS_TAURI_EVENTS`), payloads consumed by `useGhostOs`:

```
ghost-os:install-progress   { status: "installing"|"completed"|"error", percentage: f64, message }
ghost-os:installation-log   { timestamp, level, message }       // shown in "technical details"
ghost-os:status             GhostOsStatus
```

Two non-obvious rules baked into the host:

- **`install_ghost_os` = `brew install ghostwright/ghost-os/ghost-os` — and that
  is all.** Do **NOT** run `ghost setup`. `ghost setup` would prompt for
  Accessibility itself; the app owns that flow (step 3) so it can present the
  friendly card instead. (`ghost setup` also wires recipes/vision; the basic
  click/type tools work without it.)
- **`running` == `installed`, not a live process.** GhostOS is an *on-demand*
  stdio MCP server — the bridge spawns `ghost mcp` only while a tool call is in
  flight, so there is no daemon to `pgrep`. If you key "running" on a live
  process the card sits on **"Starting…" forever**. Report `running: installed`.

Register the commands in `generate_handler!` **and** grant them in the capability
ACL (see Field notes — this is the #1 cause of `… not allowed. Command not
found`).

### 3 — Accessibility permission (`tauri-plugin-macos-permissions`)

The SDK invokes the plugin commands directly (`MACOS_PERMISSIONS_COMMANDS`):

```
plugin:macos-permissions|check_accessibility_permission     -> bool   (AXIsProcessTrusted)
plugin:macos-permissions|request_accessibility_permission   -> ()     (prompt / open Settings)
```

Host wiring (macOS only):

```toml
# Cargo.toml — macOS target only (don't break Windows/Linux builds)
[target.'cfg(target_os = "macos")'.dependencies]
tauri-plugin-macos-permissions = "2.3"
```
```rust
#[cfg(target_os = "macos")]
let builder = builder.plugin(tauri_plugin_macos_permissions::init());
```

`check_accessibility_permission` is `AXIsProcessTrusted()` on **the host app's
process** — it reports whether *the app* (not GhostOS) is trusted. GhostOS, spawned
as a descendant of the app, inherits that trust.

### 4 — The MCP bridge (how the local model gets tools)

Ollama itself has no concept of MCP, so chat is proxied through
[`ollama-mcp-bridge`](https://github.com/jonigl/ollama-mcp-bridge) (Python, via
`uv tool install ollama-mcp-bridge`). It exposes an **Ollama-compatible**
`/api/chat` on **:8000**, injects the configured MCP servers' tools, runs the
tool rounds against Ollama, and streams the result back.

- Start it **alongside Ollama** (same lifecycle), bound to loopback:
  `ollama-mcp-bridge --host 127.0.0.1 --config <mcp-config.json> --port 8000`.
- Configure GhostOS as a server in the user-editable `mcp-config.json`
  (`<app_data_dir>/mcp-config.json`), using the **absolute** `ghost` path (the
  GUI app's PATH usually omits `/opt/homebrew/bin`):
  ```json
  { "mcpServers": { "ghost": { "command": "/opt/homebrew/bin/ghost", "args": ["mcp"] } } }
  ```
  Register `ghost` **after** a successful `install_ghost_os` (so the bridge never
  starts a server that can't launch), then restart the bridge to pick it up.

### 5 — Chat routing (`tool_support`)

The SDK passes a `toolSupport` flag (from the selected model's catalog
`tool_support`) to `ollama_chat_stream(messages, model, generationId, toolSupport)`.
The **host owns the routing**:

- `tool_support == true` → POST **`http://localhost:8000/api/chat`** (the bridge,
  with tools). `:8000` is the *only* chat port; `:11434` is for status/pull
  checks only.
- `tool_support == false` → refuse (don't route to `:11434`). A non-tool model +
  injected `tools` makes Ollama **400** (`"<model> does not support tools"`), so
  there's no point.

Streaming gotcha: with tools, the bridge emits **one `done:true` per tool
round** (round 1 = the tool call, round 2 = the answer). Do **not** return on the
first `done` — only a `done` whose chunk carries **no `tool_calls`** is final.
Log a `running tool…` marker on each tool-round boundary.

### 6 — Gates

The card refuses to enable in two cases (both in the SDK `SystemControlTab`):

- **Local Models off.** The assistant runs on a local model, so it's gated until
  `isLocalLLMEnabled()`. Shows *"Turn on Local Models first"*; takes precedence.
- **Model too small.** `modelSupportsSystemControl(modelId, requiredSizeGb)` ⇒
  `sizeBytes > requiredSizeGb · 1024³`. Configure `requiredSizeGb` via the prop
  (default 12). It is a **prop now** — the old module-state setter
  `setSystemControlRequiredSizeGb` was removed; setting it from a provider can't
  cross the SDK's `index`/`next` bundle split, so it never reaches the card.

## Field notes (gotchas from a production integration)

- **Every host command must be granted in the capability ACL**, or the SDK's
  `invoke` fails with `install_ghost_os not allowed. Command not found`. App
  command permissions are **hand-maintained**, not auto-generated:
  1. define each in `src-tauri/permissions/default.toml`
     (`allow-install-ghost-os` → `allow = ["install_ghost_os"]`),
  2. list it in the capability's `permissions`,
  3. the capability must cover the **remote origin** the SDK runs from
     (`remote.urls` incl. your `*.app` host and `http://localhost:*`) — the app
     loads remote web content, and a capability with no `remote` grants to local
     `tauri://` only.
  After changes, **rebuild** — the ACL is compiled into the binary; a stale dev
  binary throws "not allowed" even when the source is correct.

- **`macos-permissions:default` is empty.** Granting `macos-permissions:default`
  authorizes *nothing*. Grant the specific commands:
  `macos-permissions:allow-check-accessibility-permission` and
  `…:allow-request-accessibility-permission`. Scope that capability to macOS with
  `"platforms": ["macOS"]` so non-macOS builds don't fail validation.

- **`app.security.capabilities` is an allowlist.** If it's non-empty, capability
  files not listed are **ignored**. Add your macOS-permissions capability id to it.

- **Accessibility "already granted" in dev is a launch artifact.** TCC attributes
  a process's Accessibility to its *responsible process*; a binary launched from a
  terminal/IDE that already has Accessibility inherits it, so the card shows
  "Allowed" without the user granting the app. A signed build launched from
  Finder is its own responsible process and behaves correctly.

- **Don't run `ghost setup`**, and report **`running == installed`** (see §2).

- **Resolve `ghost`/`brew`/`ollama-mcp-bridge` by absolute path.** A GUI app's
  PATH is minimal (`/usr/bin:/bin:…`, no Homebrew). Probe PATH then
  `/opt/homebrew/bin`, `/usr/local/bin`, `~/.local/bin`.

- **Detect an existing Homebrew Ollama.** If "is Ollama installed" only checks
  `/Applications/Ollama.app`, a `brew install ollama` (CLI, no `.app`) is missed
  and you reinstall a duplicate. Prefer brew, and start the CLI via `ollama serve`
  when there's no `.app`.

## Two macOS builds (MAS vs Developer ID)

System Control and the Mac App Store are mutually exclusive:

| | MAS build | Developer ID build |
|---|---|---|
| App Sandbox | **on** (required for MAS) | **off** |
| Entitlements | `entitlements.mac.plist` | `entitlements.devid.plist` (no sandbox, no `application-identifier`) |
| System Control | ❌ blocked | ✅ works |

A **sandboxed** app cannot control other apps via Accessibility even after the
user grants it — so the MAS build can show the prompt but GhostOS can't drive
anything. Ship a **Developer ID + notarized** (non-sandboxed) build for the
feature to function. Build the variant with a config overlay:
`tauri build --config src-tauri/tauri.devid.conf.json`. Accessibility itself
needs no entitlement — it's a runtime TCC grant.

## Related skills

- [`/iblai-local-llm`](../iblai-local-llm/SKILL.md) — the local-model foundation this rides on (required).
- [`/iblai-agent-mcp`](../iblai-agent-mcp/SKILL.md) — MCP servers/tools for hosted agents (different surface; same MCP concept).
- [`/iblai-account`](../iblai-account/SKILL.md) — the account/profile surface that hosts the card.
- [`/iblai-ops-build`](../iblai-ops-build/SKILL.md) — the Tauri shell + build config the host commands live in.
