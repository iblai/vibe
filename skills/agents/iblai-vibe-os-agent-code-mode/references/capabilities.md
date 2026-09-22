# Capabilities and permissions

Tauri v2 lets a window invoke only the commands its capability allows, and
**app commands need an explicit `[[permission]]` each** (unlike plugin
commands, nothing is generated for you). Three files.

## 1. `src-tauri/permissions/code-mode.toml` (shipped)

Copy [`assets/tauri/src-tauri/permissions/code-mode.toml`](../assets/tauri/src-tauri/permissions/code-mode.toml)
into `src-tauri/permissions/`. It declares one `allow-<command>` permission
per Code command (26, including `allow-log-fe`) and groups them into a
`code-mode` permission set:

```toml
[default]
identifier = "code-mode"
permissions = ["allow-log-fe", "allow-opencode-chat-stream", …]

[[permission]]
identifier = "allow-opencode-chat-stream"
description = "…"
[permission.commands]
allow = ["opencode_chat_stream"]
```

If your app already has a `permissions/default.toml` set of its own, keep
both files — Tauri merges every `.toml` in the directory.

## 2. `src-tauri/capabilities/default.json` (desktop window)

Reference the set plus the plugin permissions the Code button and the SDK
transport use (keep everything the shell template already lists):

```json
"permissions": [
  "code-mode",

  "core:event:default",
  "core:event:allow-listen",
  "core:event:allow-unlisten",
  "core:event:allow-emit",
  "core:event:allow-emit-to",
  "core:path:default",
  "os:default",
  "shell:allow-open",
  "dialog:allow-open",
  "opener:default",
  {
    "identifier": "opener:allow-open-path",
    "allow": [{ "path": "$HOME/**" }]
  }
]
```

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
`-request-permissions`, `-open-app-settings`.

## Events

The SDK chat listens on `ollama:*` / `opencode:*`, and the host's
`<CodePermissionCards>` on `opencode:permission_request` /
`opencode:permission_resolved` — all covered by `core:event:allow-listen`.
Nothing extra to allow for events.
