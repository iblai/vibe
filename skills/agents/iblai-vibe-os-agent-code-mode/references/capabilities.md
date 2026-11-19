# Capabilities and permissions

Tauri v2 checks an app command against the capabilities once the app has
a permission file of its own, and from then on **refuses every app command
no capability allows**. Unlike plugin commands, nothing is generated for
you: each needs an explicit `[[permission]]`. The check looks at every
command, so the shell's own commands need allowing too (§2). Three files.

## 1. `src-tauri/permissions/code-mode.toml` (shipped)

Copy [`assets/tauri/src-tauri/permissions/code-mode.toml`](../assets/tauri/src-tauri/permissions/code-mode.toml)
into `src-tauri/permissions/`. It declares one `allow-<command>` permission
per Code command (31, including `allow-log-fe`) and groups them into a
named set, `code-mode`:

```toml
[[set]]
identifier = "code-mode"
permissions = ["allow-log-fe", "allow-opencode-chat-stream", …]

[[permission]]
identifier = "allow-opencode-chat-stream"
description = "…"
[permission.commands]
allow = ["opencode_chat_stream"]
```

It is a `[[set]]`, not `[default]`: an app's `[default]` table is always
the set called `default`, whatever identifier it is given, so a capability
that names `code-mode` would fail the build. Keep it next to the shell's
`shell.toml` (and any `default.toml` of your own): Tauri merges every
`.toml` in the directory.

The set covers the opencode commands, the approval mode (`get` / `set` /
`seed`), Codex and Claude Code (`check_code_agent_status`,
`install_code_agent`, `list_code_agent_models`, `set_code_agent_model`),
phone access, and `ensure_opencode_platform_key`. The OS registers and
calls that last one but never allows it, so its pre-warm is refused there;
this file allows it.

## 2. `src-tauri/capabilities/default.json` (desktop window)

Reference the set plus the plugin permissions the Code button and the SDK
transport use (keep everything the shell template already lists):

```json
"permissions": [
  "code-mode",

  "allow-open-external-url",
  "allow-allow-in-app-purchase",
  "allow-get-locked-tenant",

  "core:event:default",
  "core:event:allow-listen",
  "core:event:allow-unlisten",
  "core:event:allow-emit",
  "core:event:allow-emit-to",
  "core:path:default",
  "os:default",
  "dialog:allow-open",
  "opener:default",
  {
    "identifier": "opener:allow-open-path",
    "allow": [{ "path": "$HOME/**" }]
  }
]
```

The three `allow-*` entries are the shell's own commands, declared in
the shell's `permissions/shell.toml`. A shell from `/iblai-vibe-ops-build`
already has both. In an older one, copy
[`shell.toml`](../../../ship/iblai-vibe-ops-build/assets/tauri/src-tauri/permissions/shell.toml)
into `src-tauri/permissions/` and add the three entries. Without them
`code-mode.toml` turns the check on and the shell's commands are refused:
`open_external_url` (the SDK's plan and credit checkout links),
`allow_in_app_purchase` and `get_locked_tenant`. The build passes and the
SDK falls back quietly, so a refusal shows only as *`<command>` not
allowed* in a dev build's console.

`$HOME/**` covers the default workspaces under
`~/.local/share/iblai/workspaces/`; the OS also allows `/**` so a folder
picked anywhere opens. `shell:allow-open` is not needed.

`remote.urls` must keep the loopback entries the proxy and the phone-access
host answer on — `http://127.0.0.1:*/*` and `http://localhost:*/*` are in
the shell template already.

You may list `"code-mode"` in the desktop capability even though the
`remote_code_*` client commands are registered only on mobile (and the
`opencode_*` desktop ones only on desktop): a permission whose command is
not registered on the current target simply never matches. That is how the
OS ships one capability for both.

## 3. `src-tauri/capabilities/mobile-pairing.json` (shipped)

Copy [`assets/tauri/src-tauri/capabilities/mobile-pairing.json`](../assets/tauri/src-tauri/capabilities/mobile-pairing.json)
next to `default.json`. It is scoped to `"platforms": ["iOS", "android"]`
and grants the camera permissions the phone needs to scan the desktop's
pairing QR: `barcode-scanner:allow-scan`, `-cancel`, `-check-permissions`,
`-request-permissions`, `-open-app-settings`. Its `remote.urls` are the
shell template's; if you add an origin to `default.json`, add it here too.

## Events

The SDK chat listens on `ollama:*` / `opencode:*` (its permission cards on
`opencode:permission_request` / `opencode:permission_resolved`), and the
shipped hooks on `opencode:auth_required`, `model:installation-log` and
`code-agent:changed` — all covered by `core:event:allow-listen`. Nothing
extra to allow for events.
