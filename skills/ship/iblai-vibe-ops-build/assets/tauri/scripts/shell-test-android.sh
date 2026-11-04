#!/usr/bin/env bash
# The Android shell on the phone (or emulator) on adb, built from src-tauri/
# with this app's own values and loading the config's `frontendDist` — the app's
# live `.iblai.me` host (`--host` overrides; a prebuilt `--apk` loads what it was
# built with): a debug
# APK (installable — a release APK is unsigned), the scheme, a cold launch, a warm deep link, a screenshot, a
# checklist, logcat judged at the end. Prerequisites: /iblai-vibe-ops-build.
#
#   bash scripts/shell-test-android.sh --check      # the values and the manifest; builds nothing
#   bash scripts/shell-test-android.sh              # build, install, check, checklist
#   bash scripts/shell-test-android.sh --apk PATH   # an APK built elsewhere (signed)
#   bash scripts/shell-test-android.sh --host URL   # against another deployment
# Several devices: ANDROID_SERIAL=<serial from `adb devices -l`>.
set -euo pipefail
cd "$(dirname "$0")/.."

need() { command -v "$1" >/dev/null 2>&1 || { echo "missing: $1 ($2)" >&2; exit 1; }; }
need node "https://nodejs.org"
eval "$(node -e '
const c = require("./src-tauri/tauri.conf.json");
console.log(`DIST=${c.build.frontendDist} SCHEME=${c.plugins["deep-link"].mobile[0].scheme[0]} IDENT=${c.identifier}`);
')"
MANIFEST=src-tauri/gen/android/app/src/main/AndroidManifest.xml
[[ -f $MANIFEST ]] || { echo "missing: $MANIFEST (scripts/mobile-init.sh on Linux generates the project)" >&2; exit 1; }
grep -q "android:scheme=\"$SCHEME\"" "$MANIFEST" || { echo "missing: the $SCHEME intent filter in $MANIFEST (one tauri android build --debug --apk writes it; commit it)" >&2; exit 1; }
grep -q 'android:launchMode="singleTask"' "$MANIFEST" || { echo "missing: launchMode=\"singleTask\" in $MANIFEST" >&2; exit 1; }
HOST=$DIST
echo "id=$IDENT scheme=$SCHEME manifest=ok loads=$HOST"

APK=
case "${1:-}" in
  --check) exit 0 ;;
  --apk) APK=${2:?--apk needs a path} ;;
  --host) HOST=${2:?--host needs a URL} ;;
  "") ;;
  *) echo "usage: $0 [--check | --apk PATH | --host URL]" >&2; exit 2 ;;
esac

export PATH="${ANDROID_HOME:+$ANDROID_HOME/platform-tools:}$PATH"
need adb "Android SDK Platform-Tools; export ANDROID_HOME"
adb get-state >/dev/null # adb says it: no device, several (set ANDROID_SERIAL), unauthorized
case $(adb shell getprop ro.product.cpu.abi | tr -d '\r') in
  arm64-v8a) TARGET=aarch64 ;;
  armeabi-v7a) TARGET=armv7 ;;
  x86_64) TARGET=x86_64 ;;
  x86) TARGET=i686 ;;
  *) echo "unknown device ABI" >&2; exit 1 ;;
esac

if [[ -z $APK ]]; then
  for v in JAVA_HOME ANDROID_HOME NDK_HOME; do
    [ -n "${!v:-}" ] || { echo "missing: \$$v (references/mobile-projects.md of /iblai-vibe-ops-build)" >&2; exit 1; }
  done
  need pnpm "https://pnpm.io"
  pnpm exec tauri android build --debug --apk --target "$TARGET" -c "{\"build\":{\"frontendDist\":\"$HOST\"}}"
  APK=$(ls -t src-tauri/gen/android/app/build/outputs/apk/*/debug/*.apk | head -1)
fi
echo "== installing $APK"
adb install -r "$APK" || { echo "install failed — a differently signed $IDENT on the device? adb uninstall $IDENT (wipes its data), then rerun" >&2; exit 1; }

OUT=src-tauri/target/shell-test-android
mkdir -p "$OUT"
LOGCAT=$OUT/logcat.txt
adb logcat -c || true
adb logcat -v threadtime >"$LOGCAT" 2>&1 &
LC=$!
trap 'kill "$LC" 2>/dev/null || true' EXIT

ok=1
chk() { if eval "$2"; then echo "ok:   $1"; else echo "FAIL: $1"; ok=0; fi; }
VIEW="-a android.intent.action.VIEW -c android.intent.category.BROWSABLE -d $SCHEME:///x"
chk "$SCHEME:// resolves to the app" '[[ $(adb shell pm resolve-activity --brief $VIEW | tr -d "\r" | tail -1) == "$IDENT/.MainActivity" ]]'
adb shell am force-stop "$IDENT"
chk "cold launch" 'adb shell am start -W -n "$IDENT/.MainActivity" | grep -q "Status: ok"'
sleep 8
PID1=$(adb shell pidof "$IDENT" | tr -d '\r' || true)
adb exec-out screencap -p >"$OUT/launch.png"
chk "the app is running after 8 s" '[[ -n $PID1 ]]'
chk "a warm deep link is accepted" 'adb shell am start -W $VIEW | grep -q "Status: ok"'
sleep 2
PID2=$(adb shell pidof "$IDENT" | tr -d '\r' || true)
chk "the deep link reached the running process (singleTask)" '[[ -n $PID1 && $PID1 == "$PID2" ]]'

cat <<EOF

Phone checklist — $OUT/launch.png should show the app; the console is chrome://inspect in Chrome on this machine.
  1. password sign-in → signed in
  2. Log Out → Google sign-in opens Chrome → back in the app, signed in (the $SCHEME:// return)
  3. safe areas: nothing under the status bar or the gesture bar
  4. the keyboard does not cover the focused input
  5. the back key goes back, not out of the app
  6. links that open a new tab (help, the learning platform, downloads): note where they open
  7. start a Google sign-in, swipe the app away in recents, finish in Chrome → the app opens signed in
EOF
read -rp "Enter when done… "
chk "no crash of $IDENT"                   "! grep -Eq 'Process: $IDENT|>>> $IDENT <<<|panicked at' '$LOGCAT'"
chk "no refused plugin call"               "! grep -E 'Tauri|RustStdoutStderr' '$LOGCAT' | grep -q 'not allowed'"
chk "no unknown-scheme page (best effort)" "! grep -q 'ERR_UNKNOWN_URL_SCHEME' '$LOGCAT'"
grep -E 'RustStdoutStderr|Tauri' "$LOGCAT" >"$OUT/app.log" || true
if [[ $ok == 1 ]]; then echo "PASS — logs: $OUT"; else echo "FAIL — logs: $OUT" >&2; exit 1; fi
