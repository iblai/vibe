---
name: iblai-screenshot
description: Capture app store screenshots for web, iOS, and Android
globs:
alwaysApply: false
---

# /iblai-screenshot

Capture screenshots of your ibl.ai app for app store listings, documentation,
and marketing. Covers pure web, iOS (App Store), and Android (Google Play).

All screenshots require logging in first so you capture the actual app, not
the login screen. See the **Authentication** section for each platform.

## Web Screenshots (Playwright)

Use Playwright to capture screenshots at multiple viewport sizes from the
running dev server.

### Prerequisites

Set credentials in `e2e/.env.development` so the screenshot script can log in:

```bash
PLAYWRIGHT_USERNAME=your-test-user@example.com
PLAYWRIGHT_PASSWORD=your-password
```

### Generate the Screenshot Script

```bash
iblai builds screenshot
```

This creates `e2e/screenshots.spec.ts` with viewport presets for iPhone,
iPad, Android Phone, Android Tablet, Apple Watch, and Desktop.

### Authentication

The generated screenshot spec must authenticate before capturing. The
project's `e2e/auth.setup.ts` handles login automatically -- it navigates
to the app, follows the SSO redirect, fills in username/password credentials,
and saves the authenticated browser state to `playwright/.auth/`.

Update `e2e/screenshots.spec.ts` to use the saved auth state so every
screenshot is taken as a logged-in user:

```typescript
import { test } from "@playwright/test";

// Use the pre-authenticated storage state from auth.setup.ts
test.use({
  storageState: "playwright/.auth/user-setup-chromium.json",
});

// ... viewport and screenshot definitions
```

Then run auth setup before the screenshots:

```bash
pnpm exec playwright test e2e/auth.setup.ts --project=setup-chromium
pnpm exec playwright test e2e/screenshots.spec.ts
```

Or configure the screenshot spec as a Playwright project that depends on
the setup project in `e2e/playwright.config.ts`:

```typescript
{
  name: 'screenshots',
  use: {
    storageState: 'playwright/.auth/user-setup-chromium.json',
  },
  dependencies: ['setup-chromium'],
  testMatch: ['screenshots.spec.ts'],
},
```

### Customize Pages

```bash
iblai builds screenshot --pages / /profile /notifications /analytics
```

### Run the Capture

1. Start the dev server:
   ```bash
   pnpm dev
   ```

2. Run the screenshot spec:
   ```bash
   pnpm exec playwright test e2e/screenshots.spec.ts
   ```

3. Screenshots are saved to `screenshots/<device-slug>/<page-name>.png`.

### Custom Base URL

Capture from a staging or production deployment:

```bash
SCREENSHOT_BASE_URL=https://staging.myapp.com pnpm exec playwright test e2e/screenshots.spec.ts
```

### Viewport Presets

| Device | Width | Height |
|--------|-------|--------|
| iPhone 6.7" | 430 | 932 |
| iPhone 6.1" | 390 | 844 |
| iPad 12.9" | 1024 | 1366 |
| Android Phone | 412 | 915 |
| Android Tablet | 800 | 1280 |
| Apple Watch 49mm | 205 | 251 |
| Apple Watch 45mm | 198 | 242 |
| Desktop | 1440 | 900 |

---

## iOS Screenshots (Xcode Simulator)

Capture screenshots directly from the iOS Simulator for App Store Connect.

### Prerequisites

- Tauri iOS project initialized (`iblai builds ios init`)
- Xcode with simulators installed

### Authentication

The app uses SSO login via iblai.app. When the Simulator launches, the
WebView redirects to the login page. Log in with your username and password
(click "Continue with Password" if needed), then the app redirects back
to the authenticated home page. The session persists in the Simulator's
WebView storage -- you only need to log in once per simulator device.

### Take a Screenshot

1. Start the iOS dev build:
   ```bash
   iblai builds ios dev
   ```

2. Log in when the auth page appears (first run only).

3. Navigate to the page you want to capture in the Simulator.

4. Capture the full Simulator window including the title bar:
   ```bash
   screencapture -l $(osascript -e 'tell app "Simulator" to id of window 1') ~/Desktop/ios-screenshot.png
   ```
   This captures the Simulator window with its title bar showing the device
   name and iOS version (e.g. "iPhone 16 Pro Max - iOS 18.0").

### Capture All Required Sizes

App Store Connect requires screenshots for specific device sizes. Use
these simulators:

| Display Size | Simulator Device | Resolution |
|-------------|-----------------|------------|
| 6.9" | iPhone 16 Pro Max | 1320 x 2868 |
| 6.3" | iPhone 16 Pro | 1206 x 2622 |
| 6.7" | iPhone 15 Plus | 1290 x 2796 |
| 6.5" | iPhone 15 Pro Max | 1290 x 2796 |
| 5.5" | iPhone 8 Plus | 1242 x 2208 |
| 12.9" iPad | iPad Pro 12.9" (6th gen) | 2048 x 2732 |
| 11" iPad | iPad Pro 11" (4th gen) | 1668 x 2388 |

### Batch Capture Script

Capture the same page across all required simulators:

```bash
DEVICES=(
  "iPhone 16 Pro Max"
  "iPhone 16 Pro"
  "iPhone 15 Plus"
  "iPad Pro 12.9-inch (6th generation)"
  "iPad Pro 11-inch (4th generation)"
)

for device in "${DEVICES[@]}"; do
  slug=$(echo "$device" | tr ' ' '-' | tr '[:upper:]' '[:lower:]')
  xcrun simctl boot "$device" 2>/dev/null
  sleep 5
  # Capture the Simulator window with its title bar
  screencapture -l $(osascript -e 'tell app "Simulator" to id of window 1') "screenshots/ios-${slug}.png"
  xcrun simctl shutdown "$device"
done
```

> Boot the app in the simulator first with `iblai builds ios dev` so
> each simulator has the app installed.

---

## Android Screenshots (Emulator)

Capture screenshots from the Android emulator for Google Play Console.

### Prerequisites

- Tauri Android project initialized (`iblai builds android init`)
- Android Studio with emulators configured

### Authentication

Same SSO flow as iOS -- the WebView redirects to the login page on first
launch. Log in with your username and password, and the session persists
in the emulator's WebView storage for subsequent runs.

### Take a Screenshot

1. Start the Android dev build:
   ```bash
   iblai builds android dev
   ```

2. Log in when the auth page appears (first run only).

3. Navigate to the page you want to capture in the emulator.

4. Capture the full emulator window including the title bar:
   ```bash
   # macOS — capture the emulator window with its title bar (shows device name)
   screencapture -l $(osascript -e 'tell app "qemu-system-aarch64" to id of window 1') ~/Desktop/android-screenshot.png
   ```
   Or on Linux, use `xdotool` to capture the emulator window:
   ```bash
   import -window "$(xdotool search --name 'Android Emulator')" ~/Desktop/android-screenshot.png
   ```

### Required Sizes for Google Play

Google Play requires screenshots for phones and tablets:

| Type | Resolution | Emulator Device |
|------|-----------|-----------------|
| Phone | 1080 x 2400 | Pixel 8 |
| Phone (larger) | 1440 x 3120 | Pixel 8 Pro |
| 7" Tablet | 1200 x 1920 | Nexus 7 |
| 10" Tablet | 1600 x 2560 | Pixel Tablet |

### Batch Capture Script

```bash
EMULATORS=(
  "Pixel_8"
  "Pixel_8_Pro"
  "Pixel_Tablet"
)

for avd in "${EMULATORS[@]}"; do
  emulator -avd "$avd" -no-audio -no-boot-anim &
  adb wait-for-device
  sleep 10
  # Capture emulator window with title bar
  screencapture -l $(osascript -e 'tell app "qemu-system-aarch64" to id of window 1') "screenshots/android-${avd}.png"
  adb emu kill
done
```

> The app must be installed on each emulator first. Run
> `iblai builds android dev` once per emulator to install it.

---

## Summary of Commands

| Task | Command |
|------|---------|
| Generate Playwright screenshot script | `iblai builds screenshot` |
| Generate with custom pages | `iblai builds screenshot --pages / /profile` |
| Run web screenshots | `pnpm exec playwright test e2e/screenshots.spec.ts` |
| iOS Simulator screenshot | `xcrun simctl io booted screenshot output.png` |
| Android emulator screenshot | `adb exec-out screencap -p > output.png` |
| Start iOS dev build | `iblai builds ios dev` |
| Start Android dev build | `iblai builds android dev` |
