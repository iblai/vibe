# Capabilities and permissions

Tauri v2 lets a window invoke only the commands its capability allows, and
**app commands need an explicit `[[permission]]` each**. The app's page is
a remote origin (`build.frontendDist` is its deployed URL), and Tauri never
lets a remote origin reach an app command without one. Three files.

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

Add the set next to Code mode's:

```json
"permissions": [
  "code-mode",
  "cowork",
  …
]
```

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
`remote.urls` are the OS's; set them to the same list as your
`default.json`, or the deployed page can't reach the plugin.

## Events

The SDK listens on `cua-driver:message`, `cua-driver:closed`,
`cua-driver:install-progress` and `cua-driver:installation-log`, all
covered by the `core:event:allow-listen` your `default.json` already has.
