# Native builds — CI workflows and the command summary

Moved out of `SKILL.md` to keep the skill scannable; this is the full text.

## All Platforms CI

Generate CI workflows for all platforms at once:

```bash
# create the workflow from assets/tauri/workflows/ (desktop, ios, windows-msix templates)
```

## Summary of Commands

| Task | Command |
|------|---------|
| Add Tauri support | the Tauri shell (copy `assets/tauri/` into `src-tauri/`) |
| Generate app icons | `pnpm exec tauri icon logo.png` |
| List available devices | `xcrun simctl list devices` (iOS) / `adb devices` (Android) |
| **iOS** | |
| Initialize iOS project | `pnpm exec tauri ios init` |
| Run on iOS Simulator | `pnpm exec tauri ios dev "iPhone 16 Pro Max"` |
| Run on physical iPhone | `pnpm exec tauri ios dev --device` |
| Build release .ipa | `pnpm exec tauri ios build` |
| iOS CI workflow | the templates in `assets/tauri/workflows/` |
| **Android** | |
| Initialize Android project | `pnpm exec tauri android init` |
| Run on Android emulator | `pnpm exec tauri android dev "Pixel_9"` |
| Run on physical Android | `pnpm exec tauri android dev --device` |
| Build release APK | `pnpm exec tauri android build` |
| Android CI workflow | the templates in `assets/tauri/workflows/` |
| **Desktop** | |
| Run desktop dev mode | `pnpm exec tauri dev` |
| Build desktop release | `pnpm exec tauri build` |
| macOS signed + notarized DMG (CI) | `tauri-release-macos-dmg.yml` — push an `app-v*` tag |
| Windows signed NSIS x64 + arm64 (CI) | `tauri-release-windows.yml` — push an `app-v*` tag |
| macOS signed DMG (local, no CI) | `make -f desktop-release.mk macos-dmg` |
| Windows signed NSIS (local, no CI) | `make -f desktop-release.mk windows-nsis` |
| macOS CI workflow | the templates in `assets/tauri/workflows/` |
| Surface CI workflow | the templates in `assets/tauri/workflows/` |
| Linux CI workflow | the templates in `assets/tauri/workflows/` |
| All CI workflows | the templates in `assets/tauri/workflows/` |
| **Deploy** | |
| Deploy frontend via ibl.ai hosting (Vercel) | the `/iblai-vibe-ops-deploy` skill |
| Remove hosted dev URL | Remove `devUrl` from `src-tauri/tauri.conf.json` |
