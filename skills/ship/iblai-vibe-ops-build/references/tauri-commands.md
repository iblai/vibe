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
| Add the Tauri shell | Copy [`../assets/tauri/`](../assets/tauri/) into `src-tauri/` (skip if it already exists). Needs a `package.json`. |
| Icons | Generate every size from one image — ImageMagick for the full set (Tauri + MSIX + multi-res `.ico` + macOS `.icns`), or `pnpm exec tauri icon` for the standard set. See [`../../iblai-vibe-iconography/SKILL.md`](../../iblai-vibe-iconography/SKILL.md). |
| CI workflows | Copy the GitHub Actions templates from [`../assets/tauri/workflows/`](../assets/tauri/workflows/) into `.github/workflows/` (desktop, iOS, windows-msix). iOS needs `APPLE_API_KEY_*` secrets. |
| List devices | `xcrun simctl list devices` (iOS) / `adb devices` (Android). |
| App-store screenshots | Write `e2e/screenshots.spec.ts`, a Playwright script that captures the app across device viewports. |

## Windows MSIX

Windows MSIX uses the generated `pnpm tauri:build:msix` script — see
[`../../iblai-vibe-windows-msix/SKILL.md`](../../iblai-vibe-windows-msix/SKILL.md).

## Related

- Owning skill: [`../SKILL.md`](../SKILL.md) (iblai-vibe-ops-build).
- Icon generation: [`../../iblai-vibe-iconography/SKILL.md`](../../iblai-vibe-iconography/SKILL.md).
- MSIX packaging: [`../../iblai-vibe-windows-msix/SKILL.md`](../../iblai-vibe-windows-msix/SKILL.md).
