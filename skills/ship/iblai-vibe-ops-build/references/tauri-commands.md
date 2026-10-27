# Tauri build commands

All builds run `@tauri-apps/cli` directly. Choose the exec prefix by
lockfile:

| Lockfile | Runs as |
|---|---|
| `pnpm-lock.yaml` | `pnpm exec tauri …` |
| `bun.lock(b)` | `bunx tauri …` |
| _(fallback)_ | `npx tauri …` |

A global `cargo tauri` works too, if installed.

## Prerequisite checks (before any build)

1. **Rust** — `rustc` + `cargo` must be on `PATH`; if missing, install via
   [rustup.rs](https://rustup.rs).
2. **Tauri CLI** — checks `cargo tauri --version`; if Rust is present but
   `cargo-tauri` isn't, install it (via `cargo-binstall` if available, else
   `cargo install tauri-cli --locked`) — or fall back to `<pm> exec tauri`.

## Common commands

```bash
pnpm exec tauri dev                    # desktop dev mode
pnpm exec tauri build                  # build for distribution (NSIS/MSI/DMG/AppImage)
pnpm exec tauri ios init|dev|build     # iOS (macOS + Xcode)
pnpm exec tauri android init|dev|build
```

For `dev`, build the frontend first **unless** `src-tauri/tauri.conf.json`
has a `devUrl` set (i.e. the frontend is already hosted, e.g. after
deploying with `/iblai-vibe-ops-deploy`) — then the local build is skipped.
After `ios init` / `android init`, regenerate platform icons from
`src-tauri/icons/icon.png`.

## Manual steps

| Task | How |
|---|---|
| Add the Tauri shell | Copy [`../assets/tauri/src-tauri/`](../assets/tauri/src-tauri/) into `src-tauri/` (skip if it already exists), set the names the owning skill lists, add the scripts below. Needs a `package.json`. |
| Icons | Generate every size from one image — ImageMagick for the full set (Tauri + MSIX + multi-res `.ico` + macOS `.icns`), or `pnpm exec tauri icon` for the standard set. See [`../../iblai-vibe-iconography/SKILL.md`](../../iblai-vibe-iconography/SKILL.md). |
| CI workflows | Copy the GitHub Actions templates from [`../assets/tauri/workflows/`](../assets/tauri/workflows/) into `.github/workflows/` (desktop, iOS, windows-msix). iOS needs `APPLE_API_KEY_*` secrets. |
| List devices | `xcrun simctl list devices` (iOS) / `adb devices` (Android). |
| App-store screenshots | Write `e2e/screenshots.spec.ts`, a Playwright script that captures the app across device viewports. |

## Package scripts and Next config

Add to `package.json` (`@tauri-apps/cli` as a devDependency):

```json
"scripts": {
  "tauri": "tauri",
  "tauri:dev": "tauri dev",
  "tauri:build": "tauri build",
  "tauri:build:debug": "next build && tauri build --debug",
  "tauri:dev:android": "tauri android dev --host",
  "tauri:build:android": "tauri android build",
  "tauri:dev:ios": "tauri ios dev",
  "tauri:build:ios": "tauri ios build",
  "tauri:build:msix": "powershell -ExecutionPolicy Bypass -File src-tauri/build-msix.ps1",
  "tauri:build:msix:arm64": "powershell -ExecutionPolicy Bypass -File src-tauri/build-msix.ps1 -Architecture arm64",
  "tauri:setup:cert": "powershell -ExecutionPolicy Bypass -File src-tauri/setup-test-cert.ps1"
},
"devDependencies": { "@tauri-apps/cli": "^2.5.0" }
```

An app with no server routes can ship the frontend inside the binary — in
`next.config.ts`:

```ts
output: "export",
images: { unoptimized: true, remotePatterns: [{ protocol: "https", hostname: "**" }] },
allowedDevOrigins: ["tauri://localhost", "https://login.iblai.app"],
```

vibe-starter keeps its server routes and points `devUrl` at the deployed
app instead (see "Common commands").

## Windows MSIX

Windows MSIX uses the generated `pnpm tauri:build:msix` script — see
[`../../iblai-vibe-windows-msix/SKILL.md`](../../iblai-vibe-windows-msix/SKILL.md).

## Related

- Owning skill: [`../SKILL.md`](../SKILL.md) (iblai-vibe-ops-build).
- Icon generation: [`../../iblai-vibe-iconography/SKILL.md`](../../iblai-vibe-iconography/SKILL.md).
- MSIX packaging: [`../../iblai-vibe-windows-msix/SKILL.md`](../../iblai-vibe-windows-msix/SKILL.md).
