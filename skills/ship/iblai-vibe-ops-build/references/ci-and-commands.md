# Native builds — CI workflows and the command summary

Moved out of `SKILL.md` to keep the skill scannable; this is the full text.

## All Platforms CI

Copy the templates from `assets/tauri/workflows/` into `.github/workflows/`:
`tauri-build-desktop.yml` (unsigned macOS / Linux / Windows artifacts),
`tauri-build-ios.yml`, `tauri-build-android.yml` (unsigned `.aab` + `.apk`),
`tauri-build-windows-msix.yml`, `tauri-check.yml` (fmt, check and test of the
shell on every change under `src-tauri/`), and the three release workflows that
run on an `app-v*` tag — `tauri-release-macos-dmg.yml`,
`tauri-release-windows.yml`, `tauri-release-linux.yml`. The iOS and Android
workflows build the committed `src-tauri/gen/` projects and run `init` only
without one ([`mobile-projects.md`](mobile-projects.md)).

## Summary of Commands

| Task | Command |
|------|---------|
| Add Tauri support | the Tauri shell (copy `assets/tauri/` into `src-tauri/`) |
| Generate app icons | `pnpm exec tauri icon logo.png` |
| List available devices | `xcrun simctl list devices` (iOS) / `emulator -list-avds`, `adb devices -l` (Android) |
| **iOS** | |
| Generate the iOS project (once, on a Mac; committed) | `bash scripts/mobile-init.sh`, then one `pnpm exec tauri ios dev "<device>"` — [`mobile-projects.md`](mobile-projects.md) |
| Run on iOS Simulator | `pnpm exec tauri ios dev "iPhone 16 Pro Max"` |
| Run on physical iPhone | `pnpm exec tauri ios dev "<device name>"` (`xcrun devicectl list devices`) |
| Build release .ipa | `pnpm exec tauri ios build` |
| iOS CI workflow | `tauri-build-ios.yml` |
| **Android** | |
| Generate the Android project (once, on Linux; committed) | `bash scripts/mobile-init.sh`, then one `pnpm exec tauri android build --debug --apk` |
| Run on Android emulator | `pnpm exec tauri android dev "Pixel_9"` |
| Run on physical Android | `pnpm exec tauri android dev "<device name>"` (`adb devices -l`) |
| Build release APK | `pnpm exec tauri android build` |
| Android CI workflow | `tauri-build-android.yml` — manual run, unsigned `.aab` + `.apk` |
| **Desktop** | |
| Run desktop dev mode | `pnpm exec tauri dev` |
| Build desktop release | `pnpm exec tauri build` |
| macOS signed + notarized DMG (CI) | `tauri-release-macos-dmg.yml` — push an `app-v*` tag |
| Windows signed NSIS x64 + arm64 (CI) | `tauri-release-windows.yml` — push an `app-v*` tag |
| Linux AppImage x64 + arm64 (CI) | `tauri-release-linux.yml` — push an `app-v*` tag |
| macOS signed DMG (local, no CI) | `make -f desktop-release.mk macos-dmg` |
| Windows signed NSIS (local, no CI) | `make -f desktop-release.mk windows-nsis` |
| Linux AppImage (local) | `pnpm exec tauri build --bundles appimage` |
| Unsigned artifacts, all three desktops | `tauri-build-desktop.yml` — manual run |
| Surface MSIX x64 + arm64 | `tauri-build-windows-msix.yml` — manual run |
| Shell check on every change (fmt, check, test) | `tauri-check.yml` |
| All CI workflows | copy every file in `assets/tauri/workflows/` |
| **Deploy** | |
| Deploy frontend via ibl.ai hosting (Vercel) | the `/iblai-vibe-ops-deploy` skill — writes `build.frontendDist` |
| Dev build on the hosted app | `pnpm exec tauri dev -c '{"build":{"devUrl":"https://<app>","beforeDevCommand":""}}'` |
