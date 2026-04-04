---
name: iblai-ios
description: Build and run your ibl.ai app on iOS (Simulator and real device)
globs:
alwaysApply: false
---

# /iblai-ios

Build and run your ibl.ai app on iOS using Tauri v2. Covers project
initialization, Simulator development, real device testing, and
production .ipa builds.

## Prerequisites

- **macOS** (iOS builds require Xcode)
- **Xcode** installed from the Mac App Store (includes iOS SDK + Simulator)
- **Xcode Command Line Tools**: `xcode-select --install`
- **Rust toolchain** with iOS targets:
  ```bash
  rustup target add aarch64-apple-ios aarch64-apple-ios-sim
  ```
- **Tauri support** already added to your project:
  ```bash
  iblai add builds
  pnpm install
  ```

## Step 1: Initialize the iOS Project

Run this once after adding Tauri support:

```bash
iblai builds ios init
```

This generates `src-tauri/gen/apple/` with the Xcode project, Swift bridge
code, and iOS configuration. You only need to run this once.

> If you get a Rust target error, make sure both targets are installed:
> `rustup target add aarch64-apple-ios aarch64-apple-ios-sim`

## Step 2: Run on iOS Simulator

```bash
iblai builds ios dev
```

Or use the pnpm script:

```bash
pnpm tauri:dev:ios
```

This:
1. Starts the Next.js dev server
2. Compiles the Rust backend for the iOS Simulator target (`aarch64-apple-ios-sim`)
3. Launches the app in the default iOS Simulator

The first build takes several minutes (Rust compilation). Subsequent builds
are fast thanks to incremental compilation.

### Choosing a Specific Simulator

List available simulators:

```bash
iblai builds device
```

Then specify one:

```bash
iblai builds ios dev --device "iPhone 16 Pro"
```

### Troubleshooting Simulator

- **"No available iOS simulators"**: Open Xcode > Settings > Platforms > download an iOS runtime
- **Build fails with "linking" errors**: Verify Xcode path with `xcode-select -p`. If incorrect, the user should run `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer` themselves (requires elevated privileges -- confirm with the user before suggesting this)
- **Simulator won't launch**: Try `xcrun simctl shutdown all` then retry

## Step 3: Run on a Physical Device

Connect your iPhone via USB, then:

```bash
iblai builds ios dev --device
```

This deploys to the connected device instead of the Simulator.

### Requirements for Physical Devices

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

## Step 4: Build a Release .ipa

### Local Build (Ad Hoc / Development)

```bash
iblai builds ios build
```

Or:

```bash
pnpm tauri:build:ios
```

The .ipa file is generated at `src-tauri/gen/apple/build/` (or use
`find src-tauri/gen/apple -name "*.ipa"` to locate it).

### App Store Build (CI)

Generate the GitHub Actions workflow:

```bash
iblai builds ci-workflow --ios
```

This creates `.github/workflows/tauri-build-ios.yml` which:
1. Sets up Node.js, pnpm, and Rust with iOS targets
2. Installs the Tauri CLI
3. Runs `cargo tauri ios init` and `cargo tauri ios build --export-method app-store-connect`
4. Uploads the .ipa as a build artifact

### Required GitHub Secrets for CI

| Secret | Description |
|--------|-------------|
| `APPLE_API_KEY_BASE64` | Base64-encoded App Store Connect API key (.p8 file) |
| `APPLE_API_KEY_ID` | Key ID from App Store Connect > Users and Access > Keys |
| `APPLE_API_ISSUER` | Issuer ID from App Store Connect > Users and Access > Keys |

To encode your .p8 key:

```bash
base64 -i AuthKey_XXXXXXXXXX.p8 | pbcopy
```

## App Icons

Generate iOS-ready icons from your logo:

```bash
iblai builds iconography path/to/logo.png
```

This creates all required sizes in `src-tauri/icons/`. Tauri maps them
to the iOS asset catalog during `ios init`.

## Summary of Commands

| Task | Command |
|------|---------|
| Add Tauri support | `iblai add builds` |
| Initialize iOS project | `iblai builds ios init` |
| Run on Simulator | `iblai builds ios dev` |
| Run on physical device | `iblai builds ios dev --device` |
| List available devices | `iblai builds device` |
| Build release .ipa | `iblai builds ios build` |
| Generate CI workflow | `iblai builds ci-workflow --ios` |
| Generate app icons | `iblai builds iconography logo.png` |

## Reference

- [iblai-app-cli](https://github.com/iblai/iblai-app-cli) -- CLI source and templates
- `iblai builds --help` -- full list of build commands
