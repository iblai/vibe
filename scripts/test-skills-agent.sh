#!/bin/bash
# Tier-2 skill test: run a skill the way it actually executes — a headless
# Claude agent following SKILL.md inside a scratch vibe app — then assert the
# result compiles and builds. Tier-3 (RUN_LIVE=1) boots the built app and runs
# the real SSO login flow against it.
#
# Usage:
#   scripts/test-skills-agent.sh <skill> [<skill>…]     # explicit skills
#   scripts/test-skills-agent.sh --changed              # skills touched vs origin/main
#
# Env:
#   MAX_TURNS   agent turn cap            (default 40)
#   AGENT_TIMEOUT  seconds per skill      (default 900)
#   RUN_LIVE=1  after build: pnpm start + Playwright SSO login (needs
#               AUTH_HOST, PLAYWRIGHT_USERNAME, PLAYWRIGHT_PASSWORD,
#               IBLAI_TEST_TENANT_KEY, IBLAI_TEST_API_KEY)
#
# Log hygiene: the agent only ever sees dummy credentials; real secrets enter
# only the live-tier Playwright/server env. Server output goes to a file, never
# the console. No `set -x` — do not add one.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STARTER="$ROOT/skills/iblai-vibe-ops-init/assets/vibe-starter"
WORK="$ROOT/.skill-tests/agent"
MAX_TURNS="${MAX_TURNS:-40}"
AGENT_TIMEOUT="${AGENT_TIMEOUT:-900}"

fail() { echo "✗ $*" >&2; exit 1; }
note() { echo "• $*"; }

command -v claude >/dev/null || fail "claude CLI not found (npm i -g @anthropic-ai/claude-code)"

# ---- resolve target skills ----------------------------------------------
skills=()
if [[ "${1:-}" == "--changed" ]]; then
  base="${BASE_REF:-origin/main}"
  git -C "$ROOT" rev-parse --verify -q "$base" >/dev/null || base="main"
  while IFS= read -r dir; do
    [[ -f "$ROOT/skills/$dir/SKILL.md" ]] && skills+=("$dir")
  done < <(git -C "$ROOT" diff --name-only "$base"...HEAD -- skills/ | awk -F/ '{print $2}' | sort -u)
  if [[ ${#skills[@]} -eq 0 ]]; then
    echo "test-skills-agent: no skills changed vs $base — nothing to do."
    exit 0
  fi
else
  [[ $# -ge 1 ]] || fail "usage: $0 <skill>… | --changed"
  skills=("$@")
fi

# ---- scratch app helpers -------------------------------------------------
make_scratch() {
  local dest="$1"
  rm -rf "$dest"
  mkdir -p "$dest"
  # Copy starter sources; link node_modules (agent must not need network).
  (cd "$STARTER" && find . -maxdepth 1 -mindepth 1 \
      ! -name node_modules ! -name .next ! -name test-results ! -name playwright-report \
      -exec cp -a {} "$dest/" \;)
  if [[ -d "$STARTER/node_modules" ]]; then
    # Hardlink clone, not a symlink — Turbopack refuses node_modules symlinks
    # that point outside the project root.
    cp -al "$STARTER/node_modules" "$dest/node_modules"
  else
    (cd "$dest" && pnpm install --frozen-lockfile --ignore-scripts --prefer-offline >/dev/null)
  fi
  # Dummy env — the agent NEVER sees real credentials.
  printf 'NEXT_PUBLIC_MAIN_TENANT_KEY=testtenant\nIBLAI_API_KEY=dummy-not-a-real-key\n' > "$dest/.env.local"
  printf 'DOMAIN=iblai.app\nPLATFORM=testtenant\nTOKEN=dummy-not-a-real-key\n' > "$dest/iblai.env"
  # Make every skill discoverable in the scratch project.
  mkdir -p "$dest/.claude"
  cp -a "$ROOT/skills" "$dest/.claude/skills"
}

json_field() { # json_field <file> <expr>  (node-evaluated, prints value or empty)
  node -e "const m=require('$1');const v=$2;if(v)console.log(Array.isArray(v)?v.join('\n'):v)" 2>/dev/null || true
}

# ---- per-skill run -------------------------------------------------------
overall=0
for skill in "${skills[@]}"; do
  [[ -f "$ROOT/skills/$skill/SKILL.md" ]] || { echo "✗ $skill: no such skill"; overall=1; continue; }
  scratch="$WORK/$skill"
  note "$skill → scratch $scratch"
  make_scratch "$scratch"

  prompt="Use the $skill skill to add its feature to this app. Follow the skill exactly. Do not ask questions; use placeholder values wherever a real ID, UUID, or credential is required. Stop when the skill's own verification steps pass or cannot proceed further without real credentials."
  log="$scratch/.agent-run.log"
  note "$skill: running agent (max ${MAX_TURNS} turns, ${AGENT_TIMEOUT}s cap)"
  if ! (cd "$scratch" && timeout "$AGENT_TIMEOUT" \
        claude -p "$prompt" --dangerously-skip-permissions --max-turns "$MAX_TURNS" \
        >"$log" 2>&1); then
    echo "✗ $skill: agent run failed or timed out — last 40 lines:"
    tail -40 "$log" | sed 's/^/    /'
    overall=1
    continue
  fi

  note "$skill: typecheck + build"
  if ! (cd "$scratch" && pnpm typecheck >"$scratch/.typecheck.log" 2>&1); then
    echo "✗ $skill: typecheck failed after agent run:"
    tail -30 "$scratch/.typecheck.log" | sed 's/^/    /'
    overall=1
    continue
  fi
  if ! (cd "$scratch" && pnpm build >"$scratch/.build.log" 2>&1); then
    echo "✗ $skill: build failed after agent run:"
    tail -30 "$scratch/.build.log" | sed 's/^/    /'
    overall=1
    continue
  fi

  # Optional assertions from skills/<skill>/test.json
  manifest="$ROOT/skills/$skill/test.json"
  if [[ -f "$manifest" ]]; then
    while IFS= read -r f; do
      [[ -z "$f" ]] && continue
      [[ -e "$scratch/$f" ]] || { echo "✗ $skill: expected file missing: $f"; overall=1; }
    done < <(json_field "$manifest" "m.assert_files")
  fi

  # ---- tier 3: live platform (opt-in, real credentials from env) --------
  if [[ "${RUN_LIVE:-0}" == "1" ]]; then
    : "${AUTH_HOST:?RUN_LIVE=1 needs AUTH_HOST}"
    : "${PLAYWRIGHT_USERNAME:?RUN_LIVE=1 needs PLAYWRIGHT_USERNAME}"
    : "${PLAYWRIGHT_PASSWORD:?RUN_LIVE=1 needs PLAYWRIGHT_PASSWORD}"
    : "${IBLAI_TEST_TENANT_KEY:?RUN_LIVE=1 needs IBLAI_TEST_TENANT_KEY}"
    note "$skill: live tier — starting server"
    printf 'NEXT_PUBLIC_MAIN_TENANT_KEY=%s\nIBLAI_API_KEY=%s\n' \
      "$IBLAI_TEST_TENANT_KEY" "${IBLAI_TEST_API_KEY:-}" > "$scratch/.env.local"
    (cd "$scratch" && pnpm start >"$scratch/.server.log" 2>&1) &
    server_pid=$!
    trap 'kill $server_pid 2>/dev/null || true' EXIT
    for _ in $(seq 1 30); do
      curl -sf -o /dev/null "http://localhost:3000" && break
      sleep 1
    done
    # Real SSO login via the starter's own Playwright setup. Minimal reporter,
    # no traces/video/screenshots, sanitized failure output (URLs can carry
    # SSO authorization codes).
    if (cd "$scratch" && APP_HOST="http://localhost:3000" AUTH_HOST="$AUTH_HOST" \
        PLAYWRIGHT_USERNAME="$PLAYWRIGHT_USERNAME" PLAYWRIGHT_PASSWORD="$PLAYWRIGHT_PASSWORD" \
        pnpm exec playwright test e2e/auth.setup.ts --config e2e/playwright.config.ts \
        --reporter=dot --trace=off \
        >"$scratch/.live.log" 2>&1); then
      note "$skill: live SSO login OK"
    else
      echo "✗ $skill: live SSO login failed (details withheld from log — see $scratch/.live.log locally)"
      overall=1
    fi
    kill "$server_pid" 2>/dev/null || true
    trap - EXIT
  fi

  echo "✓ $skill"
done

exit "$overall"
