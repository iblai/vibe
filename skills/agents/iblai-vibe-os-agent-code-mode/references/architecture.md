# Code mode — architecture

How the OS app's "Code" (Coding Mode) works end to end, so you know what
each shipped file is for before you wire it in.

## Layers

```
┌──────────────────────────── Next.js (webview) ────────────────────────────┐
│  Chat composer                                                           │
│   └─ <CodingModeButton>   Code pill · Approvals (Ask Me / Automatic)     │
│                           workspace picker · phone pairing (mobile)      │
│  Assistant bubble                                                        │
│   ├─ <ReasoningSection>   opencode:reasoning deltas                       │
│   ├─ <ToolCallIndicator>  opencode:tool_call updates                      │
│   └─ <CodePermissionCards> opencode:permission_request → Allow / Deny    │
│  Transport (SDK, @iblai/web-utils useChatV2)                              │
│   └─ streamOpencodeChat() → invoke("opencode_chat_stream")               │
└──────────────────────────────────────┬────────────────────────────────────┘
                                       │ Tauri IPC + events
┌──────────────────────────── src-tauri (Rust) ─────────────────────────────┐
│  opencode_acp.rs        one `opencode acp` child per chat (ACP over stdio) │
│                         sandbox (macOS sandbox-exec / Linux bwrap),       │
│                         permission cards, workspaces, per-agent skills    │
│  opencode_proxy.rs      loopback token-injecting proxy → ibl.ai OpenAI-   │
│                         compatible API; mints IBLAI_API_KEY; AGENTS.md    │
│  opencode_installer.rs  pinned opencode binary download, config, vibe     │
│                         skills sync from the latest GitHub release        │
│  remote_code.rs         desktop: `opencode serve` host for phone pairing  │
│  remote_code_client.rs  mobile: the same opencode_* commands proxied over │
│                         HTTP + SSE to a paired desktop                    │
└──────────────────────────────────────┬────────────────────────────────────┘
                                       │
                 ┌─────────────────────┴──────────────────────┐
                 │ opencode (Bun binary, pinned release)      │
                 │  model provider = 127.0.0.1:<port>/v1      │
                 │  (the proxy) or an on-device Ollama/Foundry │
                 └────────────────────────────────────────────┘
```

## One turn, desktop

1. The SDK's `useChatV2` sees `ibl_coding_mode_enabled === "true"` and a
   Code-capable host (`isTauriCodeHost()`), so it calls
   `streamOpencodeChat()` instead of the hosted chat.
2. That invokes `opencode_chat_stream(session_id, messages, model,
   generation_id, tenant, token, mentor, new_chat_key)`.
3. `opencode_acp.rs` ensures a session: starts the loopback proxy
   (`opencode_proxy::ensure_started`), registers a throwaway per-session
   secret, writes the session's `opencode.json` + `AGENTS.md` under
   `~/.config/iblai/agents/sessions/<key>/`, links the agent's synced
   skills, and spawns `opencode acp` inside the OS sandbox with `XDG_*`
   pointed at the session config. Processes are reused across turns
   (`MAX_SESSIONS` live at once, idle ones reaped after 15 min).
4. ACP `session/update` notifications are translated into Tauri events the
   chat already renders:
   `ollama:token` / `ollama:done` / `ollama:error` (keyed by
   `generation_id`, coalesced to ~5 emits/sec), plus `opencode:reasoning`
   and `opencode:tool_call`.
5. Every operation the agent wants (read, edit, shell, grep, fetch …)
   arrives as an ACP permission request. In `manual` mode it is emitted as
   `opencode:permission_request` and the turn blocks until the UI answers
   with `opencode_permission_respond` (or 180 s pass → denied). In `auto`
   mode it is allowed immediately. Either way `opencode:permission_resolved`
   clears the card.
6. Stop → `opencode_stop` (ACP `session/cancel`, pending prompts denied).
   Chat closed → `opencode_close` kills the child.

## One turn, phone

iOS/Android cannot spawn a downloaded binary, so:

- **Desktop** turns on "phone access": `remote_code_enable` starts the
  managed opencode in `serve` mode on `0.0.0.0:<port>` with a fresh
  `OPENCODE_SERVER_PASSWORD`, and `remote_code_pairing_qr` renders an SVG
  QR with payload `iblcode1:{"urls":[…],"mgmt":[…],"password":"…"}`.
- **Phone** scans it (`@tauri-apps/plugin-barcode-scanner`) and calls
  `remote_code_set_host`. From then on the phone's `opencode_chat_stream`
  (`remote_code_client.rs`) creates a server session per chat, subscribes
  the server's SSE stream, POSTs the prompt, and re-emits the **exact same
  Tauri events** as the desktop — the SDK cannot tell the difference. The
  phone mirrors `ibl_remote_code_ready=true` into localStorage so
  `isTauriCodeHost()` passes.
- The desktop's `RunEvent::Exit` hook (`remote_code::shutdown_sync`) kills
  the server with the app; an orphan with a dead password would poison
  opencode's machine-global coordination for every later one.

## Security model (read this before shipping)

- **Permission prompts are the boundary.** The agent runs at the user's
  own privilege; the OS sandbox only hides secrets and denies writes
  outside the workspace + toolchain paths. `permission: "ask"` is
  rewritten into the config on every spawn (`enforce_permission_policy`),
  so editing `opencode.json` on disk cannot loosen it. The UI must render
  `opencode:permission_request` — an app that ignores it leaves every
  manual-mode turn hanging until the 180 s deny.
- **No default approval mode.** `get_opencode_permission_mode()` is `null`
  until the user chooses; the Code button raises a first-run dialog. Do not
  pick `auto` on the user's behalf.
- **The real DM token never reaches the agent.** opencode is pointed at
  `http://127.0.0.1:<ephemeral>/v1` with a per-session secret; the proxy
  swaps in `Authorization: Token <dm_token>` and forwards only the
  OpenAI-compatible paths. Residual risk: the agent can burn model quota
  for the life of the session, not steal a portable credential.
- **One credential is handed over on purpose:** a scoped, week-long,
  revocable **platform API key** minted by `ensure_opencode_platform_key`
  and exported as `IBLAI_API_KEY`, so the synced `iblai-*` skills can act
  on the platform without asking the user for a token. `None` for
  non-admin users — turns continue without it.
- **Sandbox:** macOS `sandbox-exec` with an SBPL profile (deny all writes,
  re-allow workspace + toolchain caches, deny credential paths outright)
  plus a decoy `$HOME`; Linux `bwrap` (bubblewrap must be on PATH —
  `sandbox_ready()`); **Windows: Code is not available** —
  `install_opencode` returns an error and the button hides.

## On-disk layout (desktop)

| Path | What |
|---|---|
| `~/.local/share/iblai/bin/opencode` | the managed opencode binary (pinned `OPENCODE_VERSION`, override `IBL_OPENCODE_VERSION`) |
| `~/.config/iblai/agents/opencode/opencode.json` | the base ibl.ai config template |
| `~/.config/iblai/agents/sessions/<key>/opencode/` | per-session `opencode.json` + `AGENTS.md` (`XDG_CONFIG_HOME` at spawn) |
| `~/.local/share/iblai/workspaces/<name>` | git-backed workspaces the agent edits in (default per chat; pickable) |
| `~/.local/share/iblai/skills/vibe/` | the latest `iblai/vibe` release, synced at launch and on Code enable |
| `~/.local/share/iblai/skills/<mentor_unique_id>/` | that agent's Agent Skills + resources, written by `set_opencode_skills` |
| `~/.local/share/iblai/settings.json` | permission mode, workspace map, minted platform key |
| `~/.local/share/opencode/` | opencode's own session store (conversation state survives respawns) |

Mobile keeps the pairing (`url`, `password`, `mgmt`, per-chat session map)
under the app data dir (`remote_code_client::init`).

## What the agent gets in its environment

`IBLAI_API_KEY` (minted platform key), `IBLAI_PLATFORM_KEY`,
`IBLAI_PLATFORM_DOMAIN`, `IBLAI_USERNAME`, `IBLAI_AUTH_URL`,
`IBLAI_INSTRUCTIONS` (the guidance also written to `AGENTS.md`),
`OPENCODE_BUILD_PROMPT` (from `opencode_build_prompt.txt`), `XDG_CONFIG_HOME`
/ `XDG_DATA_HOME` (session-scoped), `OPENCODE_DISABLE_AUTOUPDATE`,
`OPENCODE_DISABLE_MODELS_FETCH`, `OPENCODE_DISABLE_PROJECT_CONFIG`,
`OPENCODE_PURE`. `IBL_AUTH_HEADER` is **never** set any more — see the proxy.
