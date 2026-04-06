---
name: iblai-build
description: Build and run your ibl.ai app on desktop and mobile (iOS, Android, macOS, Surface)
globs:
alwaysApply: false
---

# /iblai-build

Build and run your ibl.ai app on desktop and mobile using Tauri v2. Covers
iOS, Android, macOS/Linux desktop, and Surface tablet builds.

## Prerequisites (All Platforms)

- **Tauri support** added to your project:
  ```bash
  iblai add builds
  pnpm install
  ```
- **Rust toolchain** installed via [rustup](https://rustup.rs)

## App Icons

Generate platform-ready icons from your logo (works for all platforms):

```bash
iblai builds iconography path/to/logo.png
```

This creates all required sizes in `src-tauri/icons/`.

## List Available Devices

```bash
iblai builds device
```

---

## iOS

Build and run on iOS Simulator and real devices.

### iOS Prerequisites

- **macOS** (iOS builds require Xcode)
- **Xcode** installed from the Mac App Store (includes iOS SDK + Simulator)
- **Xcode Command Line Tools**: `xcode-select --install`
- **Rust iOS targets**:
  ```bash
  rustup target add aarch64-apple-ios aarch64-apple-ios-sim
  ```

### Initialize iOS Project

Run this once after adding Tauri support:

```bash
iblai builds ios init
```

This generates `src-tauri/gen/apple/` with the Xcode project, Swift bridge
code, and iOS configuration.

> If you get a Rust target error, make sure both targets are installed:
> `rustup target add aarch64-apple-ios aarch64-apple-ios-sim`

### Run on iOS Simulator

```bash
iblai builds ios dev
```

Or use the pnpm script:

```bash
pnpm tauri:dev:ios
```

This starts the Next.js dev server, compiles Rust for `aarch64-apple-ios-sim`,
and launches the app in the default iOS Simulator. The first build takes
several minutes; subsequent builds are fast.

#### Choosing a Specific Simulator

```bash
iblai builds ios dev --device "iPhone 16 Pro"
```

#### Troubleshooting Simulator

- **"No available iOS simulators"**: Open Xcode > Settings > Platforms > download an iOS runtime
- **Build fails with "linking" errors**: Verify Xcode path with `xcode-select -p`. If incorrect, the user should run `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer` themselves (requires elevated privileges -- confirm with the user before suggesting this)
- **Simulator won't launch**: Try `xcrun simctl shutdown all` then retry

### Run on Physical iOS Device

Connect your iPhone via USB, then:

```bash
iblai builds ios dev --device
```

#### Requirements for Physical Devices

1. **Apple Developer account** (free or paid)
2. **Device registered** in your Apple Developer portal
3. **Development provisioning profile** configured in Xcode

To set up signing:
1. Open `src-tauri/gen/apple/<app>.xcodeproj` in Xcode
2. Select the target > Signing & Capabilities
3. Set your Team and Bundle Identifier
4. Xcode auto-manages provisioning profiles

> **Free developer accounts** can run on up to 3 devices for 7 days.
> A paid Apple Developer Program ($99/year) removes this restriction.

### Build Release .ipa

#### Local Build

```bash
iblai builds ios build
```

Or:

```bash
pnpm tauri:build:ios
```

The .ipa file is generated at `src-tauri/gen/apple/build/` (or use
`find src-tauri/gen/apple -name "*.ipa"` to locate it).

#### App Store Build (CI)

Generate the GitHub Actions workflow:

```bash
iblai builds ci-workflow --ios
```

This creates `.github/workflows/tauri-build-ios.yml` which sets up the
full pipeline and uploads the .ipa as a build artifact.

##### Required GitHub Secrets for iOS CI

| Secret | Description |
|--------|-------------|
| `APPLE_API_KEY_BASE64` | Base64-encoded App Store Connect API key (.p8 file) |
| `APPLE_API_KEY_ID` | Key ID from App Store Connect > Users and Access > Keys |
| `APPLE_API_ISSUER` | Issuer ID from App Store Connect > Users and Access > Keys |

To encode your .p8 key:

```bash
base64 -i AuthKey_XXXXXXXXXX.p8 | pbcopy
```

---

## Android

Build and run on Android emulators and real devices.

### Android Prerequisites

- **Android Studio** with SDK and NDK installed
- **Android SDK** (API level 24+)
- **Rust Android targets**:
  ```bash
  rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
  ```

### Initialize Android Project

```bash
iblai builds android init
```

This generates `src-tauri/gen/android/` with the Gradle project.

### Run on Android Emulator

```bash
iblai builds android dev
```

Or:

```bash
pnpm tauri:dev:android
```

### Run on Physical Android Device

Connect your device via USB with USB debugging enabled, then:

```bash
iblai builds android dev --device
```

### Build Release APK

```bash
iblai builds android build
```

Or:

```bash
pnpm tauri:build:android
```

#### Android CI

```bash
iblai builds ci-workflow --android
```

---

## macOS (Desktop)

### macOS Prerequisites

- **Xcode Command Line Tools**: `xcode-select --install`

### Run in Dev Mode

```bash
iblai builds dev
```

Or:

```bash
pnpm tauri:dev
```

### Build Release .dmg / .app

```bash
iblai builds build
```

Or:

```bash
pnpm tauri:build
```

#### macOS CI

```bash
iblai builds ci-workflow --mac
```

---

## Surface

Build for Microsoft Surface tablets running Windows.

### Surface Prerequisites

- **Visual Studio** Build Tools with C++ workload
- **WebView2** runtime (included on Windows 11, downloadable for Windows 10)

### Run in Dev Mode

```bash
iblai builds dev
```

### Build Release .msi / .exe

```bash
iblai builds build
```

The installer targets are configured in `src-tauri/tauri.conf.json` under
`bundle.targets` (includes `nsis` and `msi` by default).

#### Surface CI

```bash
iblai builds ci-workflow --windows
```

---

## Linux (Desktop)

### Linux Prerequisites

- System dependencies (Debian/Ubuntu):
  ```bash
  sudo apt install libwebkit2gtk-4.1-dev build-essential libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev
  ```

### Run in Dev Mode

```bash
iblai builds dev
```

### Build Release .deb / .AppImage

```bash
iblai builds build
```

#### Linux CI

```bash
iblai builds ci-workflow --linux
```

---

## All Platforms CI

Generate CI workflows for all platforms at once:

```bash
iblai builds ci-workflow --all
```

## Summary of Commands

| Task | Command |
|------|---------|
| Add Tauri support | `iblai add builds` |
| Generate app icons | `iblai builds iconography logo.png` |
| List available devices | `iblai builds device` |
| **iOS** | |
| Initialize iOS project | `iblai builds ios init` |
| Run on iOS Simulator | `iblai builds ios dev` |
| Run on physical iPhone | `iblai builds ios dev --device` |
| Build release .ipa | `iblai builds ios build` |
| iOS CI workflow | `iblai builds ci-workflow --ios` |
| **Android** | |
| Initialize Android project | `iblai builds android init` |
| Run on Android emulator | `iblai builds android dev` |
| Run on physical Android | `iblai builds android dev --device` |
| Build release APK | `iblai builds android build` |
| Android CI workflow | `iblai builds ci-workflow --android` |
| **Desktop** | |
| Run desktop dev mode | `iblai builds dev` |
| Build desktop release | `iblai builds build` |
| macOS CI workflow | `iblai builds ci-workflow --mac` |
| Surface CI workflow | `iblai builds ci-workflow --windows` |
| Linux CI workflow | `iblai builds ci-workflow --linux` |
| All CI workflows | `iblai builds ci-workflow --all` |

## Reference

- [iblai-app-cli](https://github.com/iblai/iblai-app-cli) -- CLI source and templates
- `iblai builds --help` -- full list of build commands
