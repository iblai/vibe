# `iblai builds` — Tauri v2 desktop/mobile

A thin wrapper around `@tauri-apps/cli`. A handful of subcommands are
**iblai-managed**; everything else is **passed straight through** to the
`tauri` binary after a prerequisite check.

```bash
iblai builds init                    # add the Tauri shell to this project
iblai builds dev                     # → tauri dev   (builds frontend first)
iblai builds build [--debug]         # → tauri build
iblai builds iconography logo.png    # generate all icon sizes (ImageMagick)
iblai builds ci-workflow --all       # GitHub Actions workflows
iblai builds ios init                # → tauri ios init (then regenerates icons)
```

## Passthrough model

`iblai builds <x>` where `<x>` is **not** an iblai-managed subcommand is
forwarded verbatim to Tauri. The exec prefix is chosen by lockfile:

| Lockfile | Runs as |
|---|---|
| `pnpm-lock.yaml` | `pnpm exec tauri …` |
| `bun.lock(b)` | `bunx tauri …` |
| _(fallback)_ | `npx tauri …` |

It prefers a global `cargo tauri` if present. So `iblai builds dev`,
`build`, `icon`, `ios dev`, `android build`, etc. are all just Tauri.

### Prerequisite checks (before any passthrough)

1. **Rust** — `rustc` + `cargo` must be on `PATH`; otherwise it prints
   rustup.rs instructions and exits.
2. **Tauri CLI** — checks `cargo tauri --version`; if Rust is present but
   `cargo-tauri` isn't, it auto-installs it (via `cargo-binstall` if
   available, else `cargo install tauri-cli --locked`); otherwise falls back
   to `<pm> exec tauri`.

### `dev` special-casing

For `dev`, the frontend is built first **unless** `src-tauri/tauri.conf.json`
has a `devUrl` set (i.e. the frontend is already hosted, e.g. after
`iblai deploy vercel`) — then the local build is skipped. After
`ios init` / `android init`, platform icons are regenerated from
`src-tauri/icons/icon.png`.

## iblai-managed subcommands

| Subcommand | What it does |
|---|---|
| `init` | Adds the Tauri v2 shell (`src-tauri/`) via the builds generator; no-op if `src-tauri/` exists. Needs a `package.json`. |
| `iconography <source>` | Generates every icon size from one image using ImageMagick (`convert`) — Tauri + MSIX + multi-res `.ico` + macOS `.icns`. Falls back to `tauri icon` when ImageMagick is missing. Requires `src-tauri/`. See [`../../iblai-iconography/SKILL.md`](../../iblai-iconography/SKILL.md). |
| `ci-workflow [--desktop] [--ios] [--windows-msix] [--all]` | Writes GitHub Actions build workflows. Defaults to `--desktop` when no flag is given. iOS needs `APPLE_API_KEY_*` secrets. |
| `device` | Lists available iOS simulators, Android emulators, and connected physical devices. |
| `screenshot [--pages …] [--url …] [--output …]` | Generates `e2e/screenshots.spec.ts`, a Playwright script that captures app-store screenshots across 8 device viewports. |

## Common passthrough commands

```bash
iblai builds dev                 # desktop dev mode
iblai builds build               # build for distribution (NSIS/MSI/DMG/AppImage)
iblai builds ios init|dev|build  # iOS (macOS + Xcode)
iblai builds android init|dev|build
```

Windows MSIX uses the generated `pnpm tauri:build:msix` script — see
[`../../iblai-windows-msix/SKILL.md`](../../iblai-windows-msix/SKILL.md).

## Related

- Owning skill: [`../SKILL.md`](../SKILL.md) (iblai-ops-build).
- Icon generation: [`../../iblai-iconography/SKILL.md`](../../iblai-iconography/SKILL.md).
- MSIX packaging: [`../../iblai-windows-msix/SKILL.md`](../../iblai-windows-msix/SKILL.md).
- Implementation internals: [`../../iblai-cli-maintenance/references/iblai-cli-builds.md`](../../iblai-cli-maintenance/references/iblai-cli-builds.md).
