---
name: iblai-build
description: Build and run your ibl.ai app on desktop and mobile (iOS, Android, macOS, Surface)
globs:
alwaysApply: false
---

# /iblai-build

Build and run your ibl.ai app on desktop and mobile using Tauri v2. Covers
iOS, Android, macOS/Linux desktop, and Surface tablet builds.

Before adding build support or running a dev build, **stop all running dev
servers** (`pnpm dev`, `next dev`, etc.) to avoid port conflicts. Kill any
process on port 3000 before proceeding.

When the user asks to add iOS or Android build support, automatically start
the emulator/simulator after initialization -- just like you would start
`pnpm dev` after adding auth. Run `iblai builds device` to find the
available device name, then start the dev build with that device.

Do NOT guess device names. Always run `iblai builds device` first and use
a device name from the output.

## Prerequisites (All Platforms)

- **Tauri support** added to your project:
  ```bash
  iblai add builds
  pnpm install
  ```
- **Rust toolchain** installed via [rustup](https://rustup.rs)

## How Dev Builds Work

All platforms (desktop and mobile) use a static `next build` export. The CLI
runs the frontend build automatically before starting the Tauri dev server --
there is no separate `devUrl` or `beforeDevCommand`. The Tauri WebView loads
the static files from `../out` on all platforms.

For mobile dev builds, you can optionally deploy the `out/` directory to
Vercel and point `devUrl` at the Vercel URL. See
[Vercel Deployment (Mobile Dev)](#vercel-deployment-mobile-dev) below.

## Mobile Safe Area

The generated CSS includes `padding: env(safe-area-inset-*)` on `<body>` and
the layout sets `viewport-fit=cover`. This prevents content from overlapping
with the iOS status bar / notch and Android status bar. If you see content
behind the status bar, verify:

1. `globals.css` (or `iblai-styles.css`) has `padding-top: env(safe-area-inset-top)` on body
2. `app/layout.tsx` metadata includes `viewport: "width=device-width, initial-scale=1, viewport-fit=cover"`

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

![iOS Simulator](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/iblai-build/iblai-build-ios.png)

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

First, list available simulators:

```bash
iblai builds device
```

**Always pick a device from the list.** Choose the most mainstream iPhone
(e.g., the newest Pro Max available). Do NOT run without a device name.

If `VERCEL_TOKEN` is set in `iblai.env`, deploy the frontend first and set
`devUrl` before starting the simulator (see
[Vercel Deployment](#vercel-deployment-mobile-dev)):

```bash
pnpm build
npx vercel deploy out/ --token=$VERCEL_TOKEN --yes --public
# Update devUrl in src-tauri/tauri.conf.json with the deployment URL
```

Then start the dev build:

```bash
iblai builds ios dev "iPhone 16 Pro Max"
```

The first build takes several minutes; subsequent builds are fast.

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

![Android Emulator](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/iblai-build/iblai-build-android.png)

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

First, list available emulators:

```bash
iblai builds device
```

**Always pick a device from the list.** Choose the most mainstream Pixel
(e.g., "Pixel_9", "Pixel_8" — whichever is the newest in the list).
Do NOT run without a device name.

If `VERCEL_TOKEN` is set in `iblai.env`, deploy the frontend first and set
`devUrl` before starting the emulator (see
[Vercel Deployment](#vercel-deployment-mobile-dev)):

```bash
pnpm build
npx vercel deploy out/ --token=$VERCEL_TOKEN --yes --public
# Update devUrl in src-tauri/tauri.conf.json with the deployment URL
```

Then start the dev build:

```bash
iblai builds android dev "Pixel_9"
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

![macOS Desktop](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/iblai-build/iblai-build-osx.png)

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

## Vercel Deployment (Mobile Dev)

Deploy the frontend to Vercel so mobile WebViews load from a network URL
instead of local static files. This is useful when iterating on the frontend
while running mobile dev builds.

### Step 1: Get the Vercel token

Check `iblai.env` for `VERCEL_TOKEN`. If it's missing or set to a placeholder
(e.g., `your-vercel-token`), ask the user once for their token and save it.
Don't ask again if a real token is already set. Token creation:
https://vercel.com/account/tokens

```bash
echo 'VERCEL_TOKEN=<token>' >> iblai.env
```

### Step 2: Build and deploy

If `VERCEL_TOKEN` is set in `iblai.env`, **always** deploy to Vercel after
building — don't ask, just do it.

Build first, then write `out/vercel.json` (must be after build because
`pnpm build` wipes the `out/` directory):

```bash
pnpm build
```

Create `out/vercel.json` so Vercel serves clean URLs and falls back to
`index.html` for client-side routes:

```json
{
  "cleanUrls": true,
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

`cleanUrls` maps `/foo` → `foo.html` for static pages (e.g., `sso-login-complete`).
The rewrite catches everything else for client-side routing.

Then deploy:

```bash
npx vercel deploy out/ --token=$VERCEL_TOKEN --yes --public
```

Capture the deployment URL from the output (e.g., `https://my-app-abc123.vercel.app`).

After the first deploy, disable Vercel Authentication and password protection
so the mobile WebView can access the site:

```bash
PROJECT_ID=$(python3 -c "import json; print(json.load(open('out/.vercel/project.json'))['projectId'])")
curl -s -X PATCH "https://api.vercel.com/v9/projects/$PROJECT_ID" \
  -H "Authorization: Bearer $VERCEL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ssoProtection":null,"passwordProtection":null}'
```

Only needed once per project — subsequent deploys inherit the setting.

### Step 3: Point Tauri at the Vercel URL

Update `src-tauri/tauri.conf.json` to add `devUrl`:

```json
{
  "build": {
    "devUrl": "https://my-app-abc123.vercel.app",
    "beforeBuildCommand": "pnpm build",
    "frontendDist": "../out"
  }
}
```

### Step 4: Run the mobile dev build

```bash
iblai builds ios dev
# or
iblai builds android dev
```

### Redeploying after changes

Rebuild, recreate `out/vercel.json` (build wipes `out/`), then deploy:

```bash
pnpm build
# Recreate out/vercel.json with SPA rewrites (see Step 2)
npx vercel deploy out/ --token=$VERCEL_TOKEN --yes --public
```

Update `devUrl` in `tauri.conf.json` with the new URL.

To go back to local static files, remove `devUrl` from `tauri.conf.json`.

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
| Run on iOS Simulator | `iblai builds ios dev "iPhone 16 Pro Max"` |
| Run on physical iPhone | `iblai builds ios dev --device` |
| Build release .ipa | `iblai builds ios build` |
| iOS CI workflow | `iblai builds ci-workflow --ios` |
| **Android** | |
| Initialize Android project | `iblai builds android init` |
| Run on Android emulator | `iblai builds android dev "Pixel_9"` |
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
| **Vercel (Mobile Dev)** | |
| Deploy frontend to Vercel | `pnpm build` then write `out/vercel.json` then `npx vercel deploy out/ --token=$VERCEL_TOKEN --yes --public` |
| Remove Vercel dev URL | Remove `devUrl` from `src-tauri/tauri.conf.json` |

## Reference

- [iblai-app-cli](https://github.com/iblai/iblai-app-cli) -- CLI source and templates
- `iblai builds --help` -- full list of build commands
