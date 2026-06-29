'use strict';

/*
 * .nemoclaw-preload.js — THE single NODE_OPTIONS `--require` module for the
 * NemoClaw / OpenShell sandbox.
 *
 * `~/.bashrc` sets exactly one require:
 *
 *     export NODE_OPTIONS="--require /sandbox/.nemoclaw-preload.js"
 *
 * Only ONE `--require` is used on purpose — pnpm / npx and friends misbehave
 * with multiple `--require` entries in NODE_OPTIONS. This module is the single
 * entry point; it pulls in the individual guards with ordinary CommonJS
 * `require()` calls below (those are NOT extra `--require` flags, so the
 * package managers stay happy).
 *
 * It is loaded into EVERY Node process (node, npx, pnpm, and anything they
 * spawn), so the sandbox guards are active even for tools that can't consume
 * NODE_OPTIONS as inline shell.
 *
 * Load policy
 * -----------
 *   critical:false  ("…-fix" / safety-net shims) -> best-effort. A failure is
 *                   logged and skipped; Node keeps running.
 *   critical:true   ("…-guard" files)            -> FAIL-CLOSED. A failure is
 *                   logged and the process is aborted (exit 78), so the agent
 *                   never runs with seccomp / network / Slack policy silently
 *                   disabled.
 *
 * Diagnostics go to /sandbox/command-logs (sandbox stdout is not durable).
 *
 * Env overrides (default to the canonical sandbox paths):
 *   NEMOCLAW_GUARD_DIR        dir holding the guard files     (default /tmp)
 *   NEMOCLAW_LOG_DIR          dir for the preload log         (default /sandbox/command-logs)
 *   NEMOCLAW_PRELOAD_VERBOSE  "1" => also log successful loads (default off)
 */

const fs = require('fs');
const path = require('path');

const GUARD_DIR = process.env.NEMOCLAW_GUARD_DIR || '/tmp';
const LOG_DIR = process.env.NEMOCLAW_LOG_DIR || '/sandbox/command-logs';
const LOG_FILE = path.join(LOG_DIR, 'nemoclaw-preload.log');
const VERBOSE = process.env.NEMOCLAW_PRELOAD_VERBOSE === '1';

function log(level, msg) {
  const line =
    '[' + new Date().toISOString() + '] [pid:' + process.pid + '] [' + level + '] ' + msg + '\n';
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(LOG_FILE, line);
  } catch (_) {
    // Last resort: command-logs unavailable. Use stderr so we are never silent.
    try { process.stderr.write('nemoclaw-preload ' + line); } catch (_) {}
  }
}

// Canonical load order. `critical:true` => fail-closed.
const MODULES = [
  { file: 'nemoclaw-sandbox-safety-net.js',     critical: false },
  { file: 'nemoclaw-http-proxy-fix.js',         critical: false },
  { file: 'nemoclaw-nemotron-inference-fix.js', critical: false },
  { file: 'nemoclaw-seccomp-guard.js',          critical: true  },
  { file: 'nemoclaw-ciao-network-guard.js',     critical: true  },
  { file: 'nemoclaw-slack-channel-guard.js',    critical: true  },
];

for (const mod of MODULES) {
  const target = path.join(GUARD_DIR, mod.file);
  try {
    require(target);
    if (VERBOSE) log('ok', 'loaded ' + target);
  } catch (err) {
    const detail = err && err.message ? err.message : String(err);
    if (mod.critical) {
      log('fatal', 'security guard failed to load: ' + target + ' :: ' + detail);
      log('fatal', 'fail-closed: refusing to start Node without an active guard');
      // Hard stop during preload — Node aborts before the main module runs.
      process.exit(78); // EX_CONFIG (sysexits.h): configuration error
    }
    log('warn', 'optional shim skipped: ' + target + ' :: ' + detail);
  }
}
