#!/usr/bin/env bash
# Generate the native mobile project for this machine's OS and leave it ready
# to commit: macOS → src-tauri/gen/apple (iOS), Linux → src-tauri/gen/android.
# Prerequisites and the one build that follows: /iblai-vibe-ops-build,
# references/mobile-projects.md.
set -euo pipefail
cd "$(dirname "$0")/.."

need() { command -v "$1" >/dev/null 2>&1 || { echo "missing: $1 ($2)" >&2; exit 1; }; }
need pnpm "https://pnpm.io"
need rustup "https://rustup.rs; a distro rust package cannot add targets"

case "$(uname -s)" in
  Darwin)
    xcode-select -p 2>/dev/null | grep -q 'Xcode.app' \
      || { echo "missing: Xcode (the command-line tools alone are not enough); xcode-select -s /Applications/Xcode.app" >&2; exit 1; }
    rustup target add aarch64-apple-ios aarch64-apple-ios-sim x86_64-apple-ios
    pnpm install --frozen-lockfile --ignore-scripts
    pnpm exec tauri ios init
    # The privacy manifest ships inside the app: the project lists the app
    # folder (<package>_iOS) as a source, so xcodegen picks the file up.
    cp src-tauri/PrivacyInfo.xcprivacy src-tauri/gen/apple/*_iOS/
    need xcodegen "brew install xcodegen"
    (cd src-tauri/gen/apple && xcodegen generate)
    echo
    echo "iOS project generated. Next:"
    echo "  xcrun simctl list devices                   # pick a simulator name"
    echo "  pnpm exec tauri ios dev \"iPhone 16 Pro\"     # one run writes CFBundleURLTypes into Info.plist"
    echo "  git add src-tauri/gen/apple"
    ;;
  Linux)
    for v in JAVA_HOME ANDROID_HOME NDK_HOME; do
      [ -n "${!v:-}" ] || { echo "missing: \$$v (references/mobile-projects.md of /iblai-vibe-ops-build)" >&2; exit 1; }
    done
    rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
    pnpm install --frozen-lockfile --ignore-scripts
    pnpm exec tauri android init
    echo
    echo "Android project generated. Next:"
    echo "  pnpm exec tauri android build --debug --apk   # one build writes the intent filter into AndroidManifest.xml"
    echo "  git add src-tauri/gen/android"
    ;;
  *)
    echo "unsupported OS: $(uname -s)" >&2
    exit 1
    ;;
esac
