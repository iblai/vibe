#!/usr/bin/env bash
# The iOS shell on a simulator (or a connected device) from a Mac, built from
# src-tauri/ with this app's own values through `tauri ios dev` on the config's
# `devUrl` — the app's live `.iblai.me` host (`--host` overrides): the installed app's URL types, the scheme opened from outside, a
# screenshot, a checklist, the app's log judged at the end. Prerequisites:
# /iblai-vibe-ops-build (Xcode, the iOS rust targets, scripts/mobile-init.sh
# once for src-tauri/gen/apple).
#
#   bash scripts/shell-test-ios.sh --check                      # the values and gen/apple; builds nothing
#   bash scripts/shell-test-ios.sh "iPhone 16 Pro"              # a name from `xcrun simctl list devices`
#   bash scripts/shell-test-ios.sh "iPhone 16 Pro" --host URL   # against another deployment
set -euo pipefail
cd "$(dirname "$0")/.."

need() { command -v "$1" >/dev/null 2>&1 || { echo "missing: $1 ($2)" >&2; exit 1; }; }
need node "https://nodejs.org"
eval "$(node -e '
const c = require("./src-tauri/tauri.conf.json");
console.log(`DEV_URL=${c.build.devUrl} SCHEME=${c.plugins["deep-link"].mobile[0].scheme[0]} IDENT=${c.identifier}`);
')"
PLIST=$(ls src-tauri/gen/apple/*_iOS/Info.plist 2>/dev/null | head -1 || true)
[[ -n $PLIST ]] || { echo "missing: src-tauri/gen/apple (scripts/mobile-init.sh on a Mac generates it)" >&2; exit 1; }
grep -q "<string>$SCHEME</string>" "$PLIST" || echo "note: $PLIST has no $SCHEME URL type yet — the first tauri ios dev|build writes it; commit that change"
HOST=$DEV_URL
echo "scheme=$SCHEME id=$IDENT plist=$PLIST loads=$HOST"

DEVICE=
case "${1:-}" in
  --check) exit 0 ;;
  "") echo "usage: $0 [--check | \"<device name>\" [--host URL]]   (names: xcrun simctl list devices)" >&2; exit 2 ;;
  *) DEVICE=$1 ;;
esac
if [[ ${2:-} == --host ]]; then HOST=${3:?--host needs a URL}; fi
[[ $(uname -s) == Darwin ]] || { echo "iOS builds need a Mac" >&2; exit 1; }
need xcrun "Xcode"
need pnpm "https://pnpm.io"

OUT=src-tauri/target/shell-test-ios
mkdir -p "$OUT"
LOG=$OUT/app.log
# `tauri ios dev` builds, installs and launches the app and keeps streaming its
# output; devUrl passed explicitly so --host can point it elsewhere.
pnpm exec tauri ios dev "$DEVICE" -c "{\"build\":{\"devUrl\":\"$HOST\"}}" >"$LOG" 2>&1 &
DEV=$!
trap 'kill "$DEV" 2>/dev/null || true' EXIT
echo "== building and installing on $DEVICE (log: $LOG)"
t=0
until xcrun simctl get_app_container booted "$IDENT" >/dev/null 2>&1 || (( t >= 900 )) || ! kill -0 "$DEV" 2>/dev/null; do
  sleep 5
  t=$((t + 5))
done
kill -0 "$DEV" 2>/dev/null || { echo "tauri ios dev stopped — log: $LOG" >&2; tail -30 "$LOG" >&2; exit 1; }
APP_DIR=$(xcrun simctl get_app_container booted "$IDENT" 2>/dev/null || true)
[[ -n $APP_DIR ]] || { echo "no app on a booted simulator after ${t}s (a physical device: walk the checklist by hand) — log: $LOG" >&2; exit 1; }
sleep 10

ok=1
chk() { if eval "$2"; then echo "ok:   $1"; else echo "FAIL: $1"; ok=0; fi; }
chk "the installed app registers $SCHEME" "plutil -extract CFBundleURLTypes json -o - '$APP_DIR/Info.plist' | grep -q '\"$SCHEME\"'"
chk "the app is running" 'xcrun simctl spawn booted launchctl list 2>/dev/null | grep -q "UIKitApplication:$IDENT"'
xcrun simctl io booted screenshot "$OUT/launch.png" >/dev/null
chk "$SCHEME:// opens the app from outside" "xcrun simctl openurl booted '$SCHEME:///x'"
sleep 2
xcrun simctl io booted screenshot "$OUT/deep-link.png" >/dev/null

cat <<EOF

Phone checklist — $OUT/launch.png and deep-link.png should show the app. Console: Safari → Develop → Simulator → the page.
  1. password sign-in → signed in
  2. Log Out → Google sign-in in the ASWebAuthenticationSession sheet → back in the app, signed in (the $SCHEME:// return)
  3. safe areas: nothing under the notch or the home indicator; no overscroll bounce
  4. the keyboard does not cover the focused input
  5. links that open a new tab (help, the learning platform, downloads): note where they open
  6. on a device: start a Google sign-in, swipe the app away, finish in Safari → the app opens signed in
EOF
read -rp "Enter when done… "
chk "no panic or failed auth session" "! grep -Eq 'panicked at|Failed to open auth session|ASWebAuthenticationSession error' '$LOG'"
chk "no refused plugin call"          "! grep -q 'not allowed' '$LOG'"
if [[ $ok == 1 ]]; then echo "PASS — logs: $OUT"; else echo "FAIL — logs: $OUT" >&2; exit 1; fi
