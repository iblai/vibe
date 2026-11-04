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
bash scripts/mobile-init.sh            # once per OS: the iOS (macOS) or Android (Linux) project, committed
pnpm exec tauri ios dev|build          # iOS (macOS + Xcode)
pnpm exec tauri android dev|build
```

`dev` loads `devUrl` — the live app, like every build; to work on the web app
inside the shell: `-c '{"build":{"devUrl":"http://localhost:3000","beforeDevCommand":"pnpm dev"}}'`.
After generating a mobile project, `scripts/mobile-init.sh` regenerates the icons
from `src-tauri/icons/icon-source-1024.png`.

## Manual steps

| Task | How |
|---|---|
| Add the Tauri shell | Copy [`../assets/tauri/src-tauri/`](../assets/tauri/src-tauri/) into `src-tauri/` (skip if it already exists), set the names the owning skill lists, add the scripts below. Needs a `package.json`. |
| Mobile projects | Copy [`../assets/tauri/scripts/mobile-init.sh`](../assets/tauri/scripts/mobile-init.sh) into `scripts/`; run it on a Mac (iOS) and on Linux (Android), build once, commit `src-tauri/gen/` — [`mobile-projects.md`](mobile-projects.md). |
| Icons | `pnpm exec tauri icon src-tauri/icons/icon-source-1024.png` — the ibl.ai icon ships with its 1024 source; replace the source with your own logo. See [`../../iblai-vibe-iconography/SKILL.md`](../../iblai-vibe-iconography/SKILL.md). |
| Shell tests | Copy [`../assets/tauri/scripts/`](../assets/tauri/scripts/) into `scripts/` (`shell-test*.sh`, `shell-test*.ps1`, `shell-test-server.mjs`) and add the `shell:*` scripts below: `pnpm shell:smoke` is headless (what `tauri-check.yml` runs), `pnpm shell:touch*` runs the built shell with a checklist on a throwaway organization, `pnpm shell:clear` forgets its cookies and localStorage. |
| CI workflows | Copy the GitHub Actions templates from [`../assets/tauri/workflows/`](../assets/tauri/workflows/) into `.github/workflows/` (desktop, iOS, Android, windows-msix, the shell check). iOS needs `APPLE_API_KEY_*` secrets. |
| List devices | `xcrun simctl list devices` (iOS) / `adb devices` (Android). |
| App-store screenshots | Write `e2e/screenshots.spec.ts`, a Playwright script that captures the app across device viewports. |

## Package scripts and Next config

Add to `package.json` (`@tauri-apps/cli` as a devDependency):

```json
"scripts": {
  "tauri": "tauri",
  "tauri:dev": "tauri dev",
  "tauri:build": "tauri build",
  "tauri:build:debug": "tauri build --debug",
  "tauri:dev:android": "tauri android dev",
  "tauri:build:android": "tauri android build",
  "tauri:dev:ios": "tauri ios dev",
  "tauri:build:ios": "tauri ios build",
  "tauri:build:msix": "powershell -ExecutionPolicy Bypass -File src-tauri/build-msix.ps1",
  "tauri:build:msix:arm64": "powershell -ExecutionPolicy Bypass -File src-tauri/build-msix.ps1 -Architecture arm64",
  "tauri:setup:cert": "powershell -ExecutionPolicy Bypass -File src-tauri/setup-test-cert.ps1",
  "shell:smoke": "bash scripts/shell-test.sh --smoke",
  "shell:smoke:windows": "powershell -ExecutionPolicy Bypass -File scripts/shell-test.ps1 -Smoke",
  "shell:touch": "bash scripts/shell-test.sh",
  "shell:touch:windows": "powershell -ExecutionPolicy Bypass -File scripts/shell-test.ps1",
  "shell:touch:ios": "bash scripts/shell-test-ios.sh",
  "shell:touch:android": "bash scripts/shell-test-android.sh",
  "shell:clear": "bash scripts/shell-test-clear.sh",
  "shell:clear:windows": "powershell -ExecutionPolicy Bypass -File scripts/shell-test-clear.ps1"
},
"devDependencies": { "@tauri-apps/cli": "^2.12.0" }
```

The shell loads the deployed app (`build.frontendDist` in `tauri.conf.json`);
vibe-starter keeps its server routes, so `next.config.ts` is unchanged. An app
with no server routes may ship a static export instead — in `next.config.ts`:

```ts
output: "export",
images: { unoptimized: true, remotePatterns: [{ protocol: "https", hostname: "**" }] },
allowedDevOrigins: ["tauri://localhost", "https://login.iblai.app"],
```

and in `tauri.conf.json` `"frontendDist": "../out"` with
`"beforeBuildCommand": "pnpm build"`.

## Windows MSIX

Windows MSIX uses the generated `pnpm tauri:build:msix` script — see
[`../../iblai-vibe-windows-msix/SKILL.md`](../../iblai-vibe-windows-msix/SKILL.md).

## Related

- Owning skill: [`../SKILL.md`](../SKILL.md) (iblai-vibe-ops-build).
- Icon generation: [`../../iblai-vibe-iconography/SKILL.md`](../../iblai-vibe-iconography/SKILL.md).
- MSIX packaging: [`../../iblai-vibe-windows-msix/SKILL.md`](../../iblai-vibe-windows-msix/SKILL.md).
