# macOS: grants, signing and the App Store build

Cowork posts clicks and keystrokes into other apps and reads their
windows. macOS allows that only with two grants the user gives in System
Settings › Privacy & Security: **Accessibility** (to act) and **Screen
Recording** (the driver captures each window alongside its accessibility
tree).

## Info.plist and entitlements

- **No Info.plist key is needed.** Neither grant has a usage-description
  string; the OS app's `src-tauri/Info.plist` carries none for them.
- **No entitlement grants them either.** They are runtime grants the user
  gives; the app asks through `tauri-plugin-macos-permissions` and
  `request_cowork_permission`.
- **The App Sandbox must be off.** macOS blocks a sandboxed app from
  driving other apps through Accessibility even when the user grants it.
  The OS ships Cowork in its Developer ID build, whose entitlements set
  `com.apple.security.app-sandbox` to `false`, with the hardened runtime
  on. The `.dmg` that `/iblai-vibe-ops-build`'s macOS workflow signs and
  notarizes has no entitlements file, so it is not sandboxed and Cowork
  works there.

## The Mac App Store build

A Mac App Store build must be sandboxed. The app sees that at runtime
(`APP_SANDBOX_CONTAINER_ID` is set, `opencode_installer::is_sandboxed()`),
and `cua_driver_support` answers `{ supported: false, reason: "sandboxed" }`:
the SDK shows the Cowork pill disabled with the reason, and nothing is
downloaded. Code is unavailable there too. Ship Cowork in the Developer ID
`.dmg`, not the App Store build.

## How the grants reach the driver

The driver is a separate binary, but macOS attributes the grants to the
app that started it. That only holds for a plain child process of the app,
which is why the driver is spawned from Rust and never from the webview,
and never detached: `cua-driver mcp --direct` adopts the app's
attribution, and the Code sessions' daemon runs `--embedded` with
`--host-bundle-id` set to your `tauri.conf.json` `identifier`. A driver
spawned any other way drops every click without an error.

The downloaded driver has the quarantine flag removed and is signed ad hoc
(`codesign --force --sign -`) right after install: Apple silicon kills an
unsigned binary on launch.

## The setup flow the SDK runs

1. Ask for Accessibility (`request_cowork_permission`, kind
   `accessibility`). macOS shows its own alert the first time only; a
   repeat ask passes `openSettings: true` to open the pane.
2. Ask for Screen Recording the same way. The request runs on the main
   thread: on macOS 26 a request from any other thread never reaches the
   system, which then neither asks nor lists the app.
3. `bring_app_to_front` once a grant lands while System Settings is in
   front.
4. **Relaunch** (`relaunch_app`). macOS applies a Screen Recording grant
   only to processes started after it, so Cowork can't read the screen
   until the app restarts. The SDK keeps a "setup pending" mark in
   `localStorage` for ten minutes so the dialog picks up again after the
   relaunch.

## Browser access

The driver runs with `--grant existing-profile`: its browser tools can
attach to the user's real, signed-in Chromium profile, so for the life of
the process the agent can act as the user on every site they are signed
into. The SDK's consent dialog (*Let Cowork Use Your Computer?*) says so;
keep that sentence if you change the dialog.

## When something's off

| Symptom | Cause |
|---|---|
| The pill is disabled: *Cowork isn’t available in the App Store version of the app.* | The App Store build (`reason: "sandboxed"`). |
| Clicks do nothing, no error | The driver was not started by the app (see above), or Accessibility is off. |
| Screen Recording is on but Cowork still can't see | The app has not been relaunched since the grant. |
| The app is missing from the Screen Recording list | It has never asked; `open_privacy_settings` with `screen_recording` asks first, then opens the pane. |
| A dev build keeps asking again | Each dev build is signed ad hoc and may count as a new app; remove the old entry in the pane and grant again. |
