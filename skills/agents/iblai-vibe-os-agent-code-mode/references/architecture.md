# Code mode — architecture

How the OS app's "Code" (Coding Mode) works end to end, so you know what
each shipped file is for before you wire it in.

## Layers

```
┌──────────────────────────── Next.js (webview) ────────────────────────────┐
│  SDK <Chat> (@iblai/iblai-js/web-containers/next)                        │
│   ├─ slots.composerExtraControls   <CodingModeButton>  (shipped)        │
│   │     Code pill · Agent (ibl.ai / Codex / Claude Code) · workspace ·   │
│   │     phone access · the approval-mode pick (this machine + profile)    │
│   ├─ slots.composerActionControls  <CodeApprovalsButton> (shipped)      │
│   ├─ assistant bubble (SDK): reasoning, tool steps, the plan list,       │
│   │     permission cards (opencode:permission_request → Allow / Deny)    │
│   └─ transport (SDK useChat): streamOpencodeChat()                       │
│         → invoke("opencode_chat_stream")                                 │
│  Hooks near the root: useOpencodeLearner, useOpencodeAuthRequired,       │
│  useOpencodeSkillSync, useCodeShownHere (all shipped)                    │
└──────────────────────────────────────┬────────────────────────────────────┘
                                       │ Tauri IPC + events
┌──────────────────────────── src-tauri (Rust) ─────────────────────────────┐
│  opencode_acp.rs        one ACP agent child per chat (stdio), for all    │
│                         three agents; sandbox (macOS sandbox-exec /      │
│                         Linux bwrap), permission cards, approval mode,   │
│                         workspaces, per-agent skills, Code + Cowork      │
│  opencode_proxy.rs      loopback token-injecting proxy → ibl.ai OpenAI-   │
│                         compatible API; mints IBLAI_API_KEY; AGENTS.md    │
│  opencode_installer.rs  pinned opencode binary download, config, vibe     │
│                         skills sync from the latest GitHub release        │
│  code_agent_installer.rs  pinned Node + the Codex / Claude Code ACP       │
│                         adapters; install and sign-in status             │
│  code_agent_models.rs   the models Codex / Claude Code offer; the pick    │
│  remote_code.rs         desktop: `opencode serve` host for phone pairing  │
│  remote_code_client.rs  mobile: the same opencode_* commands proxied over │
│                         HTTP + SSE to a paired desktop                    │
└──────────────────────────────────────┬────────────────────────────────────┘
                                       │
   ┌───────────────────────────────────┼────────────────────────────────┐
   │ ibl.ai: opencode (pinned 1.19.0)  │ Codex: codex-acp 2.0.0          │
   │  model = 127.0.0.1:<port>/v1      │ Claude Code: claude-agent-acp   │
   │  (the proxy), or on-device        │  0.83.0 — both on a pinned      │
   │  Ollama / Foundry                 │  Node v24.21.0, the user's plan │
   └───────────────────────────────────┴────────────────────────────────┘
```

The SDK `<Chat>` (2.83.0) renders the reasoning, the tool steps, the plan
and the permission cards itself. The OS no longer mounts its own copies of
those pieces, and neither should you. If you build your own chat surface
instead, you must render `opencode:permission_request` yourself; the SDK
exports only the card store (`useCodePermissionRequests`), not the card.

## The three agents

The **Agent** row writes `ibl_coding_mode_agent` (`opencode` | `codex` |
`claude`, per machine, never synced) and the model key the transport sends:
`codex/default` and `claude/default` pick those agents, anything else is an
ibl.ai model for opencode. Codex and Claude Code bring their own model
access: they sign in with the user's own ChatGPT or Claude account (the
ChatGPT app or `codex`, and `claude` in a terminal) and never see the
proxy. Their models are picked with `list_code_agent_models` /
`set_code_agent_model` (the OS's top-left picker). The app installs both in
the background at every launch (`ensure_agents_current`); `supported` is
false on Windows, in the Mac App Store build, and before macOS 13.5.

## One turn, desktop

1. The SDK's `useChat` sees `ibl_coding_mode_enabled === "true"` and a
   Code-capable host (`isTauriCodeHost()`), so it calls
   `streamOpencodeChat()` instead of the hosted chat.
2. That invokes `opencode_chat_stream(session_id, messages, model,
   generation_id, tenant, token, mentor, new_chat_key, cowork)`.
3. `opencode_acp.rs` ensures a session for the chat. For opencode it starts
   the loopback proxy (`opencode_proxy::ensure_started`), registers a
   throwaway per-session secret and writes the session's `opencode.json` +
   `AGENTS.md` under `~/.config/iblai/agents/sessions/<key>/`. Every agent
   gets the ibl.ai guidance (Codex as developer instructions, Claude Code as
   a system-prompt append) and the synced skills, and runs inside the OS
   sandbox. Processes are reused across turns (5 live at once, idle ones
   reaped after 15 min); a change of model or of Cowork respawns, and the
   conversation survives through `session/load`.
4. ACP `session/update` notifications become the Tauri events the chat
   already renders: `ollama:token` / `ollama:done` / `ollama:error` (keyed
   by `generation_id`, coalesced to one emit per 200 ms), plus
   `opencode:reasoning`, `opencode:tool_call` and `opencode:plan`.
5. Every operation the agent wants (read, edit, shell, grep, fetch …)
   arrives as an ACP permission request. In `manual` (Ask Me) it is emitted
   as `opencode:permission_request` and the turn blocks until the UI answers
   with `opencode_permission_respond` (or 180 s pass → denied). In `auto`
   (Automatic) it is allowed at once. Either way
   `opencode:permission_resolved` clears the card. Codex carries the mode
   itself: Ask Me pins it `read-only`, so each write or network command
   becomes a request; Automatic pins `agent-full-access`.
6. A signed-out Codex or Claude Code emits `opencode:auth_required` before
   the turn's `ollama:error`; `useOpencodeAuthRequired()` shows one toast
   naming where to sign in.
7. Stop → `opencode_stop` (ACP `session/cancel`, pending prompts denied).
   Chat closed → `opencode_close` kills the child.

## Code + Cowork

With Cowork also on, the SDK sends `cowork: true`. The session then gets
one ACP `mcpServers` entry named `cowork`: the screen driver's stdio proxy
(`cua-driver mcp --embedded --socket …`) to the app's own driver daemon,
which `cua_driver_mcp::ensure_driver_daemon` starts as a direct child of
the app so it keeps the app's Accessibility and Screen Recording grants
(a driver the agent spawned would sit inside its sandbox). A relay in
between strips screenshots and folds the driver's structured results into
text. The agent sees the tools as `cowork_<tool>`, each behind the same
approval mode, and the guidance gains the screen rules. One driver owns the
screen: a new Cowork session closes the others and stops the webview's own
driver. Every agent qualifies; Windows does not. The driver modules come
from `/iblai-vibe-os-agent-cowork`; with the stubs, such a turn fails
before anything is spawned.

## On-device models

`ollama/<id>` and `foundry/<id>` run opencode against the local runtime
directly, without the proxy. Ollama loads a model with a 4,096-token window
unless told otherwise and silently cuts a longer prompt, so the first turn
makes a copy of the model sized to 32,768 tokens (`<model>-ibl-32k`, via
`model_manager::sized_local_model`) and runs that. A model that can't reach
16,384 tokens is refused in plain words. After each turn the sized models
are kept loaded for 15 minutes. An on-device session also gets a smaller
tool set and extra guidance for small models.

## One turn, phone

The OS phone apps **hide the Code pill for now** (`useCodeShownHere`): the
phone path is not ready to ship, and a phone that paired earlier has
`ibl_remote_code_ready` cleared so its turns stop going to the desktop. The
mechanism stays in the modules:

- **Desktop** turns on "phone access": `remote_code_enable` starts the
  managed opencode in `serve` mode on `0.0.0.0:<port>` with a fresh
  `OPENCODE_SERVER_PASSWORD`, and `remote_code_pairing_qr` renders an SVG
  QR with payload `iblcode1:{"urls":[…],"mgmt":[…],"password":"…"}`.
- **Phone** scans it (`@tauri-apps/plugin-barcode-scanner`) and calls
  `remote_code_set_host`. From then on the phone's `opencode_chat_stream`
  (`remote_code_client.rs`) creates a server session per chat, subscribes
  the server's SSE stream, POSTs the prompt, and re-emits the **exact same
  Tauri events** as the desktop. Coming back to the foreground
  (`app_resumed`) reconnects a streaming turn; a turn a killed app left
  running is stopped at the next launch (`abort_abandoned_turns`).
- The desktop's `RunEvent::Exit` hook (`remote_code::shutdown_sync`) kills
  the server with the app; an orphan with a dead password would poison
  opencode's machine-global coordination for every later one.

## Security model (read this before shipping)

- **The approval mode defaults to Automatic.** `get_opencode_permission_mode()`
  returns `"auto"` when nothing is saved, and never `null`; there is no
  first-run question any more unless your UI asks. A settings file that
  exists but can't be read counts as Ask Me, so damage can only make Code
  ask more. The user's choice is saved per machine in `settings.json` and
  mirrored to platform user metadata (`code_mode.permission_mode`); a
  machine with none saved takes an Ask Me from the profile
  (`seed_opencode_permission_mode`) but never an Automatic.
- **In Automatic the OS sandbox is the boundary; in Ask Me the cards are.**
  The agent runs at the user's own privilege; the sandbox hides secrets and
  confines writes. `permission: "ask"` is rewritten into opencode's config
  on every spawn (`enforce_permission_policy`), so editing `opencode.json`
  on disk cannot loosen it; the mode is applied by how the app answers.
- **The real DM token never reaches the agent.** opencode is pointed at
  `http://127.0.0.1:<ephemeral>/v1` with a per-session secret; the proxy
  swaps in `Authorization: Token <dm_token>` and forwards only the
  OpenAI-compatible paths. Residual risk: the agent can burn model quota
  for the life of the session, not steal a portable credential. A 402 from
  upstream also reaches the app as `opencode:payment-required`.
- **One credential is handed over on purpose:** a scoped, week-long,
  revocable **platform API key** minted by `ensure_opencode_platform_key`
  and exported as `IBLAI_API_KEY`, so the synced `iblai-*` skills can act
  on the platform without asking the user for a token. `None` for
  non-admin users — turns continue without it.
- **Sandbox:** macOS `sandbox-exec` with an SBPL profile (deny all writes,
  re-allow workspace + toolchain caches, deny credential paths outright)
  plus a decoy `$HOME`; Linux `bwrap` (bubblewrap must be on PATH —
  `sandbox_ready()`); **Windows: Code is not available** —
  `install_opencode` returns an error and the button hides. The Mac App
  Store build (`APP_SANDBOX_CONTAINER_ID` set) can't run Code or the
  subscription agents.

## On-disk layout (desktop)

| Path | What |
|---|---|
| `~/.local/share/iblai/bin/opencode` | the managed opencode binary (pinned `OPENCODE_VERSION` 1.19.0, override `IBL_OPENCODE_VERSION`) |
| `~/.local/share/iblai/node/` | the managed Node for Codex and Claude Code (`v24.21.0`, override `IBL_NODE_VERSION`) |
| `~/.local/share/iblai/acp/<codex\|claude>/` | each adapter's npm prefix and its `.installed-version` marker |
| `~/.config/iblai/agents/opencode/opencode.json` | the base ibl.ai config template |
| `~/.config/iblai/agents/sessions/<key>/` | per-session config + `AGENTS.md` (`XDG_CONFIG_HOME` at spawn), deleted on close |
| `~/.local/share/iblai/workspaces/<name>` | git-backed workspaces the agent edits in (default per agent; pickable) |
| `~/.local/share/iblai/skills/vibe/` | the latest `iblai/vibe` release, synced at launch and on Code enable |
| `~/.local/share/iblai/skills/mentors/<key>/` | that agent's Agent Skills + resources, written by `set_opencode_skills` |
| `~/.local/share/iblai/settings.json` | approval mode, per-agent workspaces, Codex / Claude model picks, minted platform key |
| `~/.local/share/iblai/workspaces.json` | per-chat workspace map |
| `~/.local/share/opencode/` | opencode's own session store (conversation state survives respawns) |
| `~/.codex`, `~/.claude` | the user's own Codex and Claude Code sign-ins; the agents use them, the app never edits them |

Mobile keeps the pairing (`url`, `password`, `mgmt`, per-chat session map,
turns in flight) under the app data dir (`remote_code_client::init`).

## What the agent gets in its environment

Set at every spawn: `IBLAI_USERNAME`, `IBLAI_PLATFORM_KEY`, and for admins
`IBLAI_API_KEY` (the minted platform key) with `IBLAI_API_KEY_EXPIRES_AT`
(Unix seconds); `PATH` with the managed `bin` (and the managed Node's)
first; a decoy `HOME` on macOS. opencode also gets `XDG_CONFIG_HOME` (the
session's config dir); Codex gets the guidance as `CODEX_CONFIG`
`developer_instructions` and its mode as `INITIAL_AGENT_MODE`. The
platform domain and sign-in URL reach the agent inside the guidance. The
build prompt (`opencode_build_prompt.txt`) is written into the session's
`opencode.json` as the `build` agent's prompt. Before a spawn the app
strips anything that would redirect an agent: every `ANTHROPIC_*`,
`CLAUDE_*`, `OPENAI_*` and `CODEX_*` variable, `CLAUDECODE`, and npm's
`npm_config_*`. `IBL_AUTH_HEADER` is **never** set any more — see the
proxy.
