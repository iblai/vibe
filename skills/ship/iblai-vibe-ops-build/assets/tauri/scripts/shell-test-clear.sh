#!/usr/bin/env bash
# Forget the shell's web state — cookies, localStorage, caches — so the next
# touch test starts signed out. No argument: this desktop's store (Linux: the
# WebKitGTK data directory Tauri hands the webview; macOS: the WKWebView store
# keyed by the bundle id, and by the binary name for a bundle-less run);
# `android`: the app's data on the phone; `ios`: the app on the booted
# simulator (the next shell-test-ios.sh run reinstalls it). `--dry` only lists.
#
#   bash scripts/shell-test-clear.sh [--dry] [android | ios]
set -euo pipefail
cd "$(dirname "$0")/.."

need() { command -v "$1" >/dev/null 2>&1 || { echo "missing: $1 ($2)" >&2; exit 1; }; }
need node "https://nodejs.org"
eval "$(node -e '
const c = require("./src-tauri/tauri.conf.json");
console.log(`IDENT=${c.identifier}`);
')"
: "${IDENT:?}"
BIN_NAME=$(awk -F'"' '/^name *=/ { print $2; exit }' src-tauri/Cargo.toml)
: "${BIN_NAME:?}"

DRY=0
if [[ ${1:-} == --dry ]]; then DRY=1; shift; fi
run() { if (( DRY )); then echo "would run: $*"; else "$@"; fi; }

case "${1:-}" in
  android)
    export PATH="${ANDROID_HOME:+$ANDROID_HOME/platform-tools:}$PATH"
    need adb "Android SDK Platform-Tools; export ANDROID_HOME"
    adb get-state >/dev/null
    run adb shell pm clear "$IDENT" # all of the app's data; the app stays installed
    ;;
  ios)
    [[ $(uname -s) == Darwin ]] || { echo "the simulator needs a Mac" >&2; exit 1; }
    need xcrun "Xcode"
    run xcrun simctl terminate booted "$IDENT" || true
    run xcrun simctl uninstall booted "$IDENT"
    ;;
  "")
    if pgrep -x "$BIN_NAME" >/dev/null; then echo "close the app first ($BIN_NAME is running)" >&2; exit 1; fi
    case $(uname -s) in
      Linux) PATHS=("${XDG_DATA_HOME:-$HOME/.local/share}/$IDENT" "${XDG_CACHE_HOME:-$HOME/.cache}/$IDENT") ;;
      Darwin) PATHS=(
        "$HOME/Library/WebKit/$IDENT"
        "$HOME/Library/HTTPStorages/$IDENT"
        "$HOME/Library/HTTPStorages/$IDENT.binarycookies"
        "$HOME/Library/Caches/$IDENT"
        "$HOME/Library/Cookies/$IDENT.binarycookies"
        "$HOME/Library/WebKit/$BIN_NAME"
        "$HOME/Library/HTTPStorages/$BIN_NAME"
        "$HOME/Library/HTTPStorages/$BIN_NAME.binarycookies"
      ) ;;
      *) echo "unsupported OS: $(uname -s) (Windows: scripts/shell-test-clear.ps1)" >&2; exit 1 ;;
    esac
    n=0
    for p in "${PATHS[@]}"; do
      [[ -e $p ]] || continue
      n=$((n + 1))
      if (( DRY )); then echo "would remove $p"; else rm -rf "$p"; echo "removed $p"; fi
    done
    (( n )) || echo "nothing to clear for $IDENT"
    ;;
  *) echo "usage: $0 [--dry] [android | ios]" >&2; exit 2 ;;
esac
