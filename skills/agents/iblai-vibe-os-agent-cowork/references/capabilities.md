# Capabilities and permissions

Tauri v2 checks an app command against the capabilities once the app has
a permission file of its own, and from then on **refuses every app command
no capability allows**. Each needs an explicit `[[permission]]`. The
deployed page counts as local (it sits under `build.frontendDist`), so
`"local": true` is what lets it in. The check covers the shell's own
commands too (§2). Three files.

## 1. `src-tauri/permissions/cowork.toml` (shipped)

Copy [`assets/tauri/src-tauri/permissions/cowork.toml`](../assets/tauri/src-tauri/permissions/cowork.toml)
into `src-tauri/permissions/`, next to Code mode's `code-mode.toml`. It
declares one `allow-<command>` permission per Cowork command and groups
them into a named set, `cowork`:

| Permission | Command |
|---|---|
| `allow-install-cua-driver` | `install_cua_driver` |
| `allow-check-cua-driver-status` | `check_cua_driver_status` |
| `allow-cua-driver-support` | `cua_driver_support` |
| `allow-cua-driver-start` | `cua_driver_start` |
| `allow-cua-driver-send` | `cua_driver_send` |
| `allow-cua-driver-stop` | `cua_driver_stop` |
| `allow-request-cowork-permission` | `request_cowork_permission` |
| `allow-open-privacy-settings` | `open_privacy_settings` |
| `allow-relaunch-app` | `relaunch_app` |
| `allow-bring-app-to-front` | `bring_app_to_front` |
| `allow-local-llm-openai-stream` | `local_llm_openai_stream` |
| `allow-local-llm-openai-stream-cancel` | `local_llm_openai_stream_cancel` |

It is a `[[set]]`, not `[default]`: an app's `[default]` table is always
the set called `default`, whatever identifier it is given.

## 2. `src-tauri/capabilities/default.json`

Add the set next to Code mode's, and keep the shell's own three:

```json
"permissions": [
  "code-mode",
  "cowork",
  "allow-open-external-url",
  "allow-allow-in-app-purchase",
  "allow-get-locked-tenant",
  …
]
```

Those three are declared in the shell's `permissions/shell.toml`, which a
shell from `/iblai-vibe-ops-build` already has. An older shell needs
[`shell.toml`](../../../ship/iblai-vibe-ops-build/assets/tauri/src-tauri/permissions/shell.toml)
copied in. Without it the SDK's checkout links (`open_external_url`),
in-app purchase and the organization lock are refused. The build still
passes.

The `local_llm_openai_stream` channel needs nothing more: Tauri lets every
page read the channels it opened.

## 3. `src-tauri/capabilities/macos-permissions.json` (shipped)

Copy [`assets/tauri/src-tauri/capabilities/macos-permissions.json`](../assets/tauri/src-tauri/capabilities/macos-permissions.json)
next to `default.json`. It is scoped to `"platforms": ["macOS"]` — the
plugin is registered on macOS only, so its permissions would fail the build
anywhere else — and grants the four plugin commands the SDK calls:

```
macos-permissions:allow-check-accessibility-permission
macos-permissions:allow-request-accessibility-permission
macos-permissions:allow-check-screen-recording-permission
macos-permissions:allow-request-screen-recording-permission
```

The plugin's own `default` set is empty, so each is listed. Its
`remote.urls` are the shell template's; if you add an origin to
`default.json`, add it here too.

## Events

The SDK listens on `cua-driver:message`, `cua-driver:closed`,
`cua-driver:install-progress` and `cua-driver:installation-log`, all
covered by the `core:event:allow-listen` your `default.json` already has.
