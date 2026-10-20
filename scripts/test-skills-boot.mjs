#!/usr/bin/env node
// Deterministic boot smoke (NO LLM): build the scaffolded vibe-starter and prove
// it actually RENDERS — not just typechecks. Catches "compiles but the page is
// blank / crashes on mount" (a broken provider, layout, or hook), which tsc
// cannot see. Boots `next start` via Playwright's webServer and asserts the app
// mounts with no render-breaking console/page errors on an unauthenticated route.
//
// Scope: the base scaffold (what `iblai-vibe-ops-init` produces). Per-skill boot
// is a heavier follow-up. Reuses the same scratch/build approach as
// test-skills-render.mjs so the "starter builds" cost is shared with CI.

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { ROOT, STARTER_DIR } from "./lib/skills.mjs";

const SCRATCH = join(ROOT, ".skill-tests", "boot");
const SMOKE_SRC = join(ROOT, "scripts", "boot-smoke");
const PORT = process.env.SMOKE_PORT || "3999";

function copyStarter(dest) {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(STARTER_DIR)) {
    if (["node_modules", ".next", "test-results", "playwright-report"].includes(entry)) continue;
    cpSync(join(STARTER_DIR, entry), join(dest, entry), { recursive: true });
  }
}

function ensureNodeModules(dir) {
  const target = join(dir, "node_modules");
  if (existsSync(target)) return;
  const local = join(STARTER_DIR, "node_modules");
  if (existsSync(local)) {
    // Hardlink clone — next build refuses node_modules symlinks pointing outside
    // the project root (same constraint test-skills-render.mjs works around).
    execFileSync("cp", ["-al", local, target]);
    return;
  }
  execFileSync("pnpm", ["install", "--frozen-lockfile", "--ignore-scripts", "--prefer-offline"], {
    cwd: dir,
    stdio: "inherit",
  });
}

function dummyEnv(dir) {
  writeFileSync(
    join(dir, ".env.local"),
    "NEXT_PUBLIC_MAIN_TENANT_KEY=testtenant\nIBLAI_API_KEY=dummy-not-a-real-key\n",
  );
  writeFileSync(
    join(dir, "iblai.env"),
    "DOMAIN=iblai.app\nPLATFORM=testtenant\nTOKEN=dummy-not-a-real-key\n",
  );
}

function run(cmd, args, extraEnv) {
  execFileSync(cmd, args, {
    cwd: SCRATCH,
    stdio: "inherit",
    env: { ...process.env, ...extraEnv },
  });
}

rmSync(SCRATCH, { recursive: true, force: true });
copyStarter(SCRATCH);
ensureNodeModules(SCRATCH);
dummyEnv(SCRATCH);

// The smoke files live in the vibe repo (not shipped in the starter); drop them
// into the scratch so Playwright resolves @playwright/test from starter deps.
const smokeDir = join(SCRATCH, "e2e-smoke");
mkdirSync(smokeDir, { recursive: true });
for (const f of readdirSync(SMOKE_SRC)) cpSync(join(SMOKE_SRC, f), join(smokeDir, f));

console.log("› building vibe-starter…");
run("pnpm", ["build"]);
console.log("› ensuring chromium…");
run("pnpm", ["exec", "playwright", "install", "chromium"]);
console.log(`› boot smoke on :${PORT}…`);
run("pnpm", ["exec", "playwright", "test", "--config", "e2e-smoke/smoke.config.ts"], {
  SMOKE_PORT: PORT,
});
console.log("\nOK — vibe-starter boots and mounts without render-breaking errors.");
