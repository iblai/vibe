#!/usr/bin/env bash
# The desktop shell on this machine (Linux, macOS), built from src-tauri/ with
# this app's own values. `--smoke` is the headless gate CI runs: the guard and
# both sign-in returns against a local page. The default is the touch test:
# the installer's app against the deployed URL, a checklist, the guard's log
# judged at the end. Prerequisites: /iblai-vibe-ops-build.
#
#   bash scripts/shell-test.sh --check       # the values the shell uses; builds nothing
#   bash scripts/shell-test.sh --smoke       # headless, PASS/FAIL (Linux needs xvfb-run)
#   bash scripts/shell-test.sh               # touch test against build.frontendDist
#   bash scripts/shell-test.sh --host URL    # touch test against another deployment
set -euo pipefail
cd "$(dirname "$0")/.."

need() { command -v "$1" >/dev/null 2>&1 || { echo "missing: $1 ($2)" >&2; exit 1; }; }
need node "https://nodejs.org"
eval "$(node -e '
const c = require("./src-tauri/tauri.conf.json");
const dist = c.build.frontendDist;
if (!/^https?:\/\//.test(dist)) { console.error("src-tauri/tauri.conf.json: build.frontendDist must be the deployed URL, not " + JSON.stringify(dist)); process.exit(1); }
console.log(`APP_ORIGIN=${new URL(dist).origin} SCHEME=${c.plugins["deep-link"].mobile[0].scheme[0]} IDENT=${c.identifier}`);
')"
BIN_NAME=$(awk -F'"' '/^name *=/ { print $2; exit }' src-tauri/Cargo.toml)
echo "app=$APP_ORIGIN scheme=$SCHEME id=$IDENT binary=$BIN_NAME"

MODE=touch
HOST=$APP_ORIGIN
case "${1:-}" in
  --check) exit 0 ;;
  --smoke) MODE=smoke; HOST=http://127.0.0.1:8765 ;;
  --host) HOST=${2:?--host needs a URL} ;;
  "") ;;
  *) echo "usage: $0 [--check | --smoke | --host URL]" >&2; exit 2 ;;
esac
need pnpm "https://pnpm.io"
OS=$(uname -s)
OUT=src-tauri/target/shell-test
mkdir -p "$OUT"
LOG=$OUT/app.log
CFG=(-c "{\"build\":{\"frontendDist\":\"$HOST\"}}")

if [[ $MODE == smoke ]]; then
  [[ $OS == Linux ]] && need xvfb-run "apt install xvfb"
  SITE=$OUT/site
  rm -rf "$SITE"
  mkdir -p "$SITE"
  # Guard page: an iframe the suffix list allows (served here), one it blocks,
  # then after 3 s a sign-in return on the auth app's scheme; its page returns on
  # this app's scheme, whose page redirects to a host the guard blocks. The return
  # pages have no extension (the auth contract's paths): the test server maps
  # "" to text/html (scripts/shell-test-server.mjs).
  cat > "$SITE/index.html" <<HTML
<!doctype html><html><body><h1>guard test</h1>
<iframe src="http://localhost:8765/ok.html" width="300" height="80"></iframe>
<iframe src="https://example.com/" width="300" height="80"></iframe>
<script>setTimeout(function () { location.href = "iblai-mentor:///sso-login-complete?data=x&redirect-path=/"; }, 3000);</script>
</body></html>
HTML
  echo '<!doctype html><p>allowed iframe</p>' > "$SITE/ok.html"
  cat > "$SITE/sso-login-complete" <<HTML
<!doctype html><p>auth-app scheme return landed</p>
<script>setTimeout(function () { location.href = "${SCHEME}:///sso-login?data=y"; }, 1500);</script>
HTML
  cat > "$SITE/sso-login" <<'HTML'
<!doctype html><p>app scheme return landed</p>
<script>setTimeout(function () { location.href = "https://example.org/"; }, 1500);</script>
HTML

  pnpm exec tauri build --no-bundle "${CFG[@]}"
  BIN=src-tauri/target/release/$BIN_NAME
  [[ -x $BIN ]] || { echo "no binary at $BIN" >&2; exit 1; }

  SRVLOG=$OUT/server.log
  node scripts/shell-test-server.mjs "$SITE" >"$SRVLOG" 2>&1 &
  SRV=$!
  trap 'kill "$SRV" 2>/dev/null || true' EXIT
  sleep 1
  kill -0 "$SRV" 2>/dev/null || { echo "the test server did not start (is port 8765 busy?)" >&2; exit 1; }

  CAP=90
  echo "== headless run (up to $CAP s): $BIN against $HOST"
  if [[ $OS == Linux ]]; then
    WEBKIT_DISABLE_COMPOSITING_MODE=1 setsid xvfb-run -a timeout "$CAP" "$BIN" >"$LOG" 2>&1 &
  else
    "$BIN" >"$LOG" 2>&1 &
  fi
  APP=$!
  t=0
  while (( t < CAP )) && kill -0 "$APP" 2>/dev/null && ! grep -q 'blocked navigation: https://example.org/' "$LOG"; do
    sleep 1
    t=$((t + 1))
  done
  if [[ $OS == Linux ]]; then kill -TERM -- -"$APP" 2>/dev/null || true; else kill "$APP" 2>/dev/null || true; fi
  wait "$APP" 2>/dev/null || true
  echo "stopped after ${t}s"
  kill "$SRV" 2>/dev/null || true

  ok=1
  chk() { if eval "$2"; then echo "ok:   $1"; else echo "FAIL: $1"; ok=0; fi; }
  chk "the page was requested"                 "grep -q 'GET / ' '$SRVLOG'"
  chk "the allowed iframe was served"          "grep -q 'GET /ok.html' '$SRVLOG'"
  chk "the foreign iframe was blocked"         "grep -q 'blocked navigation: https://example.com/' '$LOG'"
  chk "the iblai-mentor return landed"         "grep -q 'GET /sso-login-complete?data=x&redirect-path=/' '$SRVLOG'"
  chk "the $SCHEME return landed"              "grep -q 'GET /sso-login?data=y' '$SRVLOG'"
  chk "the final redirect was blocked"         "grep -q 'blocked navigation: https://example.org/' '$LOG'"
  chk "nothing of the app's own origin was blocked" "! grep -Eq 'blocked navigation: (null|http://127.0.0.1|http://localhost)' '$LOG'"
  if [[ $ok == 1 ]]; then
    echo "PASS: the app, the allowed iframe and both sign-in returns were served; the foreign iframe and the redirect were blocked"
    exit 0
  fi
  echo "== $SRVLOG"; cat "$SRVLOG"
  echo "== $LOG"; cat "$LOG"
  echo "FAIL: the shell did not behave as expected (logs above)" >&2
  exit 1
fi

case $OS in
  Linux)
    pnpm exec tauri build --bundles appimage "${CFG[@]}"
    APPIMAGE=$(ls -t src-tauri/target/release/bundle/appimage/*.AppImage | head -1)
    RUN=(env APPIMAGE_EXTRACT_AND_RUN=1 "$APPIMAGE")
    echo "running $APPIMAGE (a blank window: rerun with WEBKIT_DISABLE_DMABUF_RENDERER=1)"
    ;;
  Darwin)
    pnpm exec tauri build --bundles app "${CFG[@]}"
    APP_BUNDLE=$(ls -td src-tauri/target/release/bundle/macos/*.app | head -1)
    PLIST=$APP_BUNDLE/Contents/Info.plist
    plutil -lint "$PLIST"
    [[ $(plutil -extract CFBundleIdentifier raw "$PLIST") == "$IDENT" ]] || { echo "FAIL: $PLIST names another bundle id" >&2; exit 1; }
    RUN=("$APP_BUNDLE/Contents/MacOS/$(plutil -extract CFBundleExecutable raw "$PLIST")")
    echo "running $APP_BUNDLE"
    ;;
  *)
    echo "unsupported OS: $OS (Windows: install the NSIS build from tauri-build-desktop and walk the list by hand)" >&2
    exit 1
    ;;
esac

cat <<EOF

Touch test against $HOST — sign in on a throwaway platform, never main. Close the window when done.
  1. the window shows the app, not white
  2. password sign-in → signed in, on your platform's home
  3. Log Out → the auth app; Google sign-in → the popup (Linux, Windows) or the sheet (macOS) opens, closes, signed in
  4. links that open a new tab (help, the learning platform, downloads): note system browser / nothing / this window
  5. a download: was a file saved?
  6. the upgrade dialog → Stripe checkout loads → cancel returns here
  7. narrow the window to a phone width: the layout holds
  8. right-click → Inspect → Console: no errors, no "not allowed"; on the auth page the URL carries scheme=$SCHEME
EOF
"${RUN[@]}" 2>&1 | tee "$LOG" || true

echo
echo "== blocked origins"
grep -o 'blocked navigation: .*' "$LOG" | sort | uniq -c || echo "nothing blocked"
HOST_RE=$(printf '%s' "$HOST" | sed 's/[.]/\\./g')
if grep -Eq "blocked navigation: (null|${HOST_RE}|https?://([^/]+\.)?(iblai\.app|iblai\.org|stripe\.com|localhost|127\.0\.0\.1))(:[0-9]+)?/" "$LOG"; then
  echo "FAIL: the guard blocked the app or the platform (a blob:, data: or about: URL shows as the app origin or null) — log: $LOG" >&2
  exit 1
fi
echo "PASS: nothing of the app or the platform was blocked — log: $LOG"
