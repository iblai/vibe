#!/usr/bin/env bash
# Tier 1.9: compile and run the Tauri shell /iblai-vibe-ops-build ships (Linux).
#
# A scratch app is built from the skill's assets alone (src-tauri + icons) with
# its frontendDist pointed at a local page, then: cargo fmt --check, cargo test
# with warnings denied, `tauri build --bundles appimage`, and a headless run of
# the release binary under xvfb: the page and an allowed iframe must be served,
# a sign-in return on each custom scheme must land on the app's own pages, and
# the guard must log a foreign iframe and a redirect as blocked.
#
#   bash scripts/test-tauri-shell.sh            # everything
#   bash scripts/test-tauri-shell.sh --prepare  # only sync the scratch (CI runs it before the Rust cache step)
#   SMOKE=0 bash scripts/test-tauri-shell.sh    # build and test, skip the xvfb run
#
# Scratch: .skill-tests/tauri-shell (gitignored; SCRATCH overrides). src-tauri/target
# survives a sync, so a cached build is reused.
# Needs: cargo + rustfmt, python3, and `cargo tauri` or Node (npx); the smoke
# needs xvfb-run on top of the WebKitGTK the build already needs.
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
ASSETS="$ROOT/skills/ship/iblai-vibe-ops-build/assets"
SCRATCH="${SCRATCH:-$ROOT/.skill-tests/tauri-shell}"
SMOKE="${SMOKE:-1}"
PORT=8765

say()  { printf '\n== %s\n' "$*"; }
fail() { printf '\nFAIL: %s\n' "$*" >&2; exit 1; }

[[ -d "$ASSETS/tauri/src-tauri" ]] || fail "no shell at $ASSETS/tauri/src-tauri"
command -v python3 >/dev/null 2>&1 || fail "python3 missing"

# ---- sync the shell into the scratch; src-tauri/target is the build cache, keep it
mkdir -p "$SCRATCH/src-tauri" "$SCRATCH/site"
find "$SCRATCH/src-tauri" -mindepth 1 -maxdepth 1 ! -name target -exec rm -rf {} +
rm -rf "$SCRATCH/squashfs-root" "$SCRATCH/run.log"
cp -R "$ASSETS/tauri/src-tauri/." "$SCRATCH/src-tauri/"
cp -R "$ASSETS/icons" "$SCRATCH/src-tauri/icons"

# The shell loads the local test page instead of a deployed app.
SCRATCH="$SCRATCH" PORT="$PORT" python3 -I - <<'PY'
import json, os
p = os.path.join(os.environ["SCRATCH"], "src-tauri", "tauri.conf.json")
c = json.load(open(p))
c["build"]["frontendDist"] = "http://127.0.0.1:" + os.environ["PORT"]
json.dump(c, open(p, "w"), indent=2)
PY

# Guard page: an iframe the suffix list allows (served here, nothing leaves the
# machine), one it blocks, then after 3 s a sign-in return on the auth app's
# scheme; its page returns on the app's scheme, whose page redirects to a host
# the guard blocks. The return pages have no extension (the auth contract's
# paths), so the test server maps "" to text/html.
cat > "$SCRATCH/site/index.html" <<HTML
<!doctype html><html><body>
<h1>guard test</h1>
<iframe src="http://localhost:$PORT/ok.html" width="300" height="80"></iframe>
<iframe src="https://example.com/" width="300" height="80"></iframe>
<script>setTimeout(function () { location.href = "iblai-mentor:///sso-login-complete?data=x&redirect-path=/"; }, 3000);</script>
</body></html>
HTML
echo '<!doctype html><p>allowed iframe</p>' > "$SCRATCH/site/ok.html"
cat > "$SCRATCH/site/sso-login-complete" <<'HTML'
<!doctype html><p>auth-app scheme return landed</p>
<script>setTimeout(function () { location.href = "my-app:///sso-login?data=y"; }, 1500);</script>
HTML
cat > "$SCRATCH/site/sso-login" <<'HTML'
<!doctype html><p>app scheme return landed</p>
<script>setTimeout(function () { location.href = "https://example.org/"; }, 1500);</script>
HTML

if [[ "${1:-}" == "--prepare" ]]; then
  echo "scratch ready at $SCRATCH"
  exit 0
fi

# ---- toolchain
command -v cargo >/dev/null 2>&1 || fail "Rust missing: install from https://rustup.rs"
cargo fmt --version >/dev/null 2>&1 || fail "rustfmt missing: rustup component add rustfmt"
if cargo tauri --version >/dev/null 2>&1; then
  TAURI=(cargo tauri)
elif command -v npx >/dev/null 2>&1; then
  TAURI=(npx --yes @tauri-apps/cli@2.12.4)
else
  fail "no Tauri CLI: cargo install tauri-cli --version '^2.12' --locked, or Node for npx"
fi

cd "$SCRATCH/src-tauri"
say "toolchain"; rustc --version; cargo --version; "${TAURI[@]}" --version
say "cargo fmt --check"; cargo fmt --check
say "cargo test (warnings denied)"; RUSTFLAGS=-Dwarnings cargo test

cd "$SCRATCH"
say "tauri build --bundles appimage (warnings denied)"
RUSTFLAGS=-Dwarnings "${TAURI[@]}" build --bundles appimage
APPIMAGE=$(ls "$SCRATCH"/src-tauri/target/release/bundle/appimage/*.AppImage | head -1)
[[ -f "$APPIMAGE" ]] || fail "no AppImage under src-tauri/target/release/bundle/appimage"
ls -la "$(dirname "$APPIMAGE")"

if [[ "$SMOKE" != "1" ]]; then
  echo "SMOKE=$SMOKE: skipping the headless run"
  exit 0
fi
command -v xvfb-run >/dev/null 2>&1 || fail "xvfb-run missing (apt install xvfb), or set SMOKE=0"

say "AppImage contents"
"$APPIMAGE" --appimage-extract >/dev/null
ls "$SCRATCH"/squashfs-root/*.desktop >/dev/null 2>&1 || fail "no .desktop entry in the AppImage"
cat "$SCRATCH"/squashfs-root/*.desktop

# The run uses the release binary on the system WebKitGTK (no AppRun env). It
# stops as soon as the redirect is logged, under a 90 s cap: on a machine with
# no desktop session, WebKitGTK and tao wait for the desktop portal before the
# first window shows (about 30 s together) unless the portal's D-Bus service
# file is absent — skills-ci removes it, as Tauri's own CI does.
BIN="$SCRATCH/src-tauri/target/release/my-app"
[[ -x "$BIN" ]] || fail "no release binary at $BIN"
LOG="$SCRATCH/run.log"
SRVLOG="$SCRATCH/server.log"
CAP=90
say "headless run (xvfb, up to $CAP s) of the release binary against http://127.0.0.1:$PORT"
SITE="$SCRATCH/site" PORT="$PORT" python3 -I - >"$SRVLOG" 2>&1 <<'PY' &
import functools, http.server, os
class H(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, "": "text/html"}
http.server.test(HandlerClass=functools.partial(H, directory=os.environ["SITE"]), port=int(os.environ["PORT"]), bind="127.0.0.1")
PY
SRV=$!
trap 'kill "$SRV" 2>/dev/null || true' EXIT
sleep 1
kill -0 "$SRV" 2>/dev/null || fail "the test server did not start (is port $PORT busy?)"
setsid xvfb-run -a timeout "$CAP" "$BIN" >"$LOG" 2>&1 &
APP=$!
t=0
while (( t < CAP )); do
  grep -q 'blocked navigation: https://example.org/' "$LOG" 2>/dev/null && break
  kill -0 "$APP" 2>/dev/null || break
  sleep 1
  t=$((t + 1))
done
kill -TERM -- -"$APP" 2>/dev/null || true
rc=0
wait "$APP" 2>/dev/null || rc=$?
if grep -q 'blocked navigation: https://example.org/' "$LOG"; then
  echo "redirect logged after ${t}s; app stopped (exit $rc)"
else
  echo "no redirect logged within ${t}s (exit $rc)"
fi

ok=1
grep -q 'GET / ' "$SRVLOG" || { echo "missing: the page was never requested — the webview did not load the app"; ok=0; }
grep -q 'GET /ok.html' "$SRVLOG" || { echo "missing: the allowed iframe was never requested"; ok=0; }
grep -q 'GET /sso-login-complete?data=x&redirect-path=/' "$SRVLOG" || { echo "missing: the return on the auth app's scheme never landed on the app"; ok=0; }
grep -q 'GET /sso-login?data=y' "$SRVLOG" || { echo "missing: the return on the app's scheme never landed on the app"; ok=0; }
grep -q 'blocked navigation: https://example.com/' "$LOG" || { echo "missing: the foreign iframe was not blocked"; ok=0; }
grep -q 'blocked navigation: https://example.org/' "$LOG" || { echo "missing: the redirect was not blocked"; ok=0; }
grep -q 'blocked navigation: http://127.0.0.1' "$LOG" && { echo "wrong: the app's own origin was blocked"; ok=0; }
grep -q 'blocked navigation: http://localhost' "$LOG" && { echo "wrong: the allowed iframe was blocked"; ok=0; }
if [[ "$ok" == 1 ]]; then
  echo "PASS: the app, the allowed iframe and both sign-in returns were served; the foreign iframe and the redirect were blocked"
else
  say "server.log"; cat "$SRVLOG"
  say "run.log"; cat "$LOG"
  say "webkit2gtk"; pkg-config --modversion webkit2gtk-4.1 2>/dev/null || echo "pkg-config: no webkit2gtk-4.1"
  fail "the navigation guard did not behave as expected (see the logs above)"
fi
