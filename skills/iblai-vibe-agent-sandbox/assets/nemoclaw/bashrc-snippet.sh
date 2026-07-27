# >>> nemoclaw sandbox >>>
# Append this block to the sandbox's ~/.bashrc (here: /sandbox/.bashrc).
# It is sourced by every `bash -ic '<command>'` the agent runs.

# 1) Node toolchain guard ----------------------------------------------------
# EXACTLY ONE `--require`, pointing at the single preload module. Do NOT add a
# second `--require` here — pnpm / npx misbehave with multiple `--require`
# entries in NODE_OPTIONS. The preload pulls in every guard internally via
# ordinary require() calls, so one entry covers them all.
export NODE_OPTIONS="--require /sandbox/.nemoclaw-preload.js"

# 2) Durable command logging -------------------------------------------------
# Sandbox stdout is NOT durable. Every command's output must land in a file
# under /sandbox/command-logs. `nemoclaw_run` runs a command (inheriting the
# export above), captures stdout+stderr to a timestamped log, and prints only
# the log path + exit code.
export NEMOCLAW_LOG_DIR="${NEMOCLAW_LOG_DIR:-/sandbox/command-logs}"

nemoclaw_run() {
  mkdir -p "$NEMOCLAW_LOG_DIR" 2>/dev/null
  local ts log rc
  ts="$(date +%Y%m%dT%H%M%S)"
  log="$NEMOCLAW_LOG_DIR/${ts}-$$-${RANDOM}.log"
  # Run in a subshell; NODE_OPTIONS (exported above) is inherited by children.
  ( eval "$*" ) >"$log" 2>&1
  rc=$?
  printf 'logged-to=%s exit=%s\n' "$log" "$rc"
  return "$rc"
}
# <<< nemoclaw sandbox <<<
