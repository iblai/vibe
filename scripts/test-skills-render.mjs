#!/usr/bin/env node
// Tier-1 deterministic skill test: materialize each skill's code into a scratch
// copy of vibe-starter and typecheck it against the currently-pinned SDK.
//
// Two code sources:
//   1. assets/ declared in skills/<name>/test.json  ({overlay, render_only, vars})
//   2. ts/tsx fences inside every SKILL.md (mirrored under __fences__/<skill>/,
//      skippable via scripts/skill-render-skips.json)
//
// Usage: node scripts/test-skills-render.mjs [--build] [--skills a,b,c]
//   --build   also run `pnpm build` for vibe-starter (ops-init)
//
// The scratch lives in .skill-tests/ (gitignored). node_modules is symlinked
// from the real vibe-starter when present locally, else installed fresh.

import { execFileSync } from "node:child_process";
import {
  cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync,
  statSync, symlinkSync, writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const SKILLS_DIR = join(ROOT, "skills");
const STARTER_SRC = join(SKILLS_DIR, "iblai-vibe-ops-init", "assets", "vibe-starter");
const WORK = join(ROOT, ".skill-tests");
const SCRATCH = join(WORK, "starter");
const SKIPS = existsSync(join(ROOT, "scripts", "skill-render-skips.json"))
  ? JSON.parse(readFileSync(join(ROOT, "scripts", "skill-render-skips.json"), "utf8"))
  : {};

const args = process.argv.slice(2);
const RUN_BUILD = args.includes("--build");
const onlyArg = args.find((a) => a.startsWith("--skills"));
const ONLY = onlyArg ? (onlyArg.split("=")[1] ?? args[args.indexOf(onlyArg) + 1]).split(",") : null;

const failures = [];
const log = (msg) => console.log(msg);

// ---------- minimal Jinja subset ----------
// Supports: {{ var }}, {% if var %}…{% else %}…{% endif %} (non-nested),
// {% raw %}…{% endraw %}, and literal escapes like {{ '{{' }} / {{ '}' }}.
function renderJ2(source, vars, file) {
  const shelf = [];
  const shelve = (body) => {
    shelf.push(body);
    return `\x00RAW${shelf.length - 1}\x00`;
  };
  source = source.replace(/\{%\s*raw\s*%\}([\s\S]*?)\{%\s*endraw\s*%\}/g, (_, body) => shelve(body));
  source = source.replace(/\{\{\s*'([^']*)'\s*\}\}/g, (_, lit) => shelve(lit));
  let out = source.replace(
    /\{%\s*if\s+([a-z_0-9]+)\s*%\}([\s\S]*?)(?:\{%\s*else\s*%\}([\s\S]*?))?\{%\s*endif\s*%\}/g,
    (_, name, thenBody, elseBody) => {
      if (/\{%\s*if/.test(thenBody)) throw new Error(`${file}: nested {% if %} not supported by the test renderer`);
      return vars[name] ? thenBody : (elseBody ?? "");
    },
  );
  out = out.replace(/\{\{\s*([a-z_0-9]+)\s*\}\}/g, (_, name) => {
    if (!(name in vars)) throw new Error(`${file}: no test var for {{ ${name} }} — add it to the skill's test.json "vars"`);
    return String(vars[name]);
  });
  const leftover = out.match(/\{%\s*(if|endif|else|for)[^%]*%\}/);
  if (leftover) throw new Error(`${file}: unrendered template tag ${leftover[0]}`);
  return out.replace(/\x00RAW(\d+)\x00/g, (_, i) => shelf[Number(i)]);
}

// ---------- scratch management ----------
function copyStarterSources(dest) {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(STARTER_SRC)) {
    if (["node_modules", ".next", "test-results", "playwright-report"].includes(entry)) continue;
    cpSync(join(STARTER_SRC, entry), join(dest, entry), { recursive: true });
  }
}

function ensureNodeModules(dir) {
  const target = join(dir, "node_modules");
  if (existsSync(target)) return;
  const local = join(STARTER_SRC, "node_modules");
  if (existsSync(local)) {
    // Hardlink clone — Turbopack (--build) refuses node_modules symlinks that
    // point outside the project root; tsc wouldn't care, next build does.
    execFileSync("cp", ["-al", local, target]);
    return;
  }
  log("  installing starter deps (pnpm)…");
  execFileSync("pnpm", ["install", "--frozen-lockfile", "--ignore-scripts", "--prefer-offline"], {
    cwd: dir, stdio: "inherit",
  });
}

function writeDummyEnv(dir) {
  writeFileSync(join(dir, ".env.local"),
    "NEXT_PUBLIC_MAIN_TENANT_KEY=testtenant\nIBLAI_API_KEY=dummy-not-a-real-key\n");
  writeFileSync(join(dir, "iblai.env"),
    "DOMAIN=iblai.app\nPLATFORM=testtenant\nTOKEN=dummy-not-a-real-key\n");
}

function newScratch(name) {
  const dir = join(WORK, "render", name);
  rmSync(dir, { recursive: true, force: true });
  copyStarterSources(dir);
  symlinkSync(join(SCRATCH, "node_modules"), join(dir, "node_modules"));
  writeDummyEnv(dir);
  return dir;
}

function run(cmd, cmdArgs, cwd) {
  try {
    execFileSync(cmd, cmdArgs, { cwd, stdio: "pipe", encoding: "utf8" });
    return null;
  } catch (err) {
    return (err.stdout || "") + (err.stderr || "") || String(err);
  }
}

// ---------- source 1: assets via test.json ----------
function testAssetSkill(name, manifest) {
  const skillDir = join(SKILLS_DIR, name);
  const vars = manifest.vars ?? {};
  const renderFile = (rel) => {
    const raw = readFileSync(join(skillDir, rel), "utf8");
    return rel.endsWith(".j2") ? renderJ2(raw, vars, `${name}/${rel}`) : raw;
  };

  // render_only: template must render clean; .json must parse.
  for (const rel of manifest.render_only ?? []) {
    try {
      const out = renderFile(rel);
      if (/\.json(\.j2)?$/.test(rel)) JSON.parse(out);
    } catch (err) {
      failures.push(`${name}: ${err.message}`);
    }
  }

  const overlay = manifest.overlay ?? {};
  if (!Object.keys(overlay).length) return;
  const dir = newScratch(name);
  for (const [src, dest] of Object.entries(overlay)) {
    try {
      const out = renderFile(src);
      const destPath = join(dir, dest);
      mkdirSync(dirname(destPath), { recursive: true });
      writeFileSync(destPath, out);
    } catch (err) {
      failures.push(`${name}: ${err.message}`);
      return;
    }
  }
  const err = run("pnpm", ["typecheck"], dir);
  if (err) failures.push(`${name}: typecheck failed after overlay\n${indent(err)}`);
  else log(`  ✓ ${name} (assets overlay)`);
}

// ---------- source 2: SKILL.md ts/tsx fences ----------
function extractFences(name) {
  const text = readFileSync(join(SKILLS_DIR, name, "SKILL.md"), "utf8");
  const lines = text.split("\n");
  const fences = [];
  let open = null;
  for (let i = 0; i < lines.length; i++) {
    const fence = /^```(\w+)?\s*$/.exec(lines[i]);
    if (!fence) continue;
    if (!open && /^(tsx?|typescript)$/.test(fence[1] ?? "")) {
      // Look back a few lines for a backticked target path.
      let target = null;
      for (let j = i - 1; j >= Math.max(0, i - 4); j--) {
        const m = /`([\w@()[\]./-]+\.tsx?)`/.exec(lines[j]);
        if (m && !m[1].startsWith("node_modules")) { target = m[1].replace(/^\.\//, ""); break; }
      }
      open = { start: i + 1, target };
    } else if (open) {
      fences.push({ ...open, code: lines.slice(open.start, i).join("\n"), index: fences.length });
      open = null;
    } else {
      // Non-ts fence (labeled or bare): skip to its closing ``` so the scanner
      // never mistakes a closer for an opener.
      for (i++; i < lines.length && !/^```\s*$/.test(lines[i]); i++);
    }
  }
  return fences;
}

function collectFenceOverlays() {
  const dir = join(WORK, "render", "__fences__");
  rmSync(dir, { recursive: true, force: true });
  copyStarterSources(dir);
  symlinkSync(join(SCRATCH, "node_modules"), join(dir, "node_modules"));
  writeDummyEnv(dir);

  let placed = 0;
  let autoSkipped = 0;
  for (const name of skillNames()) {
    const skip = SKIPS[name];
    if (skip === "all" || skip?.all === true) continue;
    const skippedFences = new Set(Array.isArray(skip?.fences) ? skip.fences : []);
    const skippedTargets = new Set(Array.isArray(skip?.targets) ? skip.targets : []);
    for (const fence of extractFences(name)) {
      // Bare type-shapes / payload docs (no import/export) aren't modules — skip.
      if (!/^(import|export)\s/m.test(fence.code)) { autoSkipped++; continue; }
      // Elided import lists ("…, ... }" in catalogue docs) can't compile — skip.
      if (/,\s*\.\.\.[\s,]*\}/.test(fence.code)) { autoSkipped++; continue; }
      if (skippedFences.has(fence.index)) continue;
      if (fence.target && skippedTargets.has(fence.target)) continue;
      const rel = fence.target ?? `snippet-${fence.index}.tsx`;
      const dest = join(dir, "__fences__", name, rel);
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, fence.code);
      placed++;
    }
  }
  log(`  fences placed: ${placed} (auto-skipped ${autoSkipped} non-module shapes)`);

  // Self-repair loop: fix the *context* problems snippets legitimately have
  // (undeclared surrounding variables, third-party modules not in the starter,
  // cross-skill relative files), so the final pass only reports genuine drift:
  // wrong exports, props, and types. @iblai/* specifiers are never stubbed —
  // a bad @iblai import in prose IS drift (and a shorthand ambient module
  // would shadow the real package for the whole program).
  let err = run("pnpm", ["typecheck"], dir);
  const fileDeclares = new Map(); // fence file -> Set<identifier> (cumulative)
  const stubs = new Set(); // bare third-party module specifiers
  const relStubs = new Map(); // stub path -> Set<named export> (cumulative)
  const droppedAll = new Set(); // removed illustrative fragments
  const originals = new Map(); // fence file -> pristine content
  for (let pass = 0; err && pass < 3; pass++) {
    let changed = false;
    for (const line of err.split("\n")) {
      const m = /^(__fences__\/[^(]+)\((\d+),\d+\): error (TS\d+): (.*)$/.exec(line.trim());
      if (!m) continue;
      const [, file, , code, message] = m;
      let idm;
      const addDeclare = (name) => {
        if (!fileDeclares.has(file)) fileDeclares.set(file, new Set());
        if (!fileDeclares.get(file).has(name)) { fileDeclares.get(file).add(name); changed = true; }
      };
      if ((code === "TS2304" || code === "TS2552") && (idm = /Cannot find name '([\w$]+)'/.exec(message))) {
        addDeclare(idm[1]);
      } else if (code === "TS18004" && (idm = /shorthand property '([\w$]+)'/.exec(message))) {
        addDeclare(idm[1]);
      } else if ((code === "TS2307" || code === "TS2882") && (idm = /module[^']*'([^']+)'/.exec(message))) {
        const spec = idm[1];
        if (spec.startsWith("@iblai/")) continue; // genuine drift — never stub the SDK
        if (!spec.startsWith(".")) {
          if (!stubs.has(spec)) { stubs.add(spec); changed = true; }
        } else if (/snippet-\d+\.tsx$/.test(file)) {
          if (!droppedAll.has(file)) { droppedAll.add(file); changed = true; }
        } else {
          const stubPath = join(dir, dirname(file), `${spec}.d.ts`);
          if (!relStubs.has(stubPath)) { relStubs.set(stubPath, new Set()); changed = true; }
        }
      } else if ((code === "TS2305" || code === "TS2614") && (idm = /Module '"(\.[^"]+)"' has no exported member '([\w$]+)'/.exec(message))) {
        // Named import from one of our relative stubs — augment it.
        const stubPath = join(dir, dirname(file), `${idm[1]}.d.ts`);
        if (relStubs.has(stubPath) && !relStubs.get(stubPath).has(idm[2])) {
          relStubs.get(stubPath).add(idm[2]);
          changed = true;
        }
      } else if (/^TS1\d{3}$/.test(code) && /snippet-\d+\.tsx$/.test(file)) {
        if (!droppedAll.has(file)) { droppedAll.add(file); changed = true; }
      }
    }
    if (!changed) break;
    for (const [file, names] of fileDeclares) {
      const full = join(dir, file);
      if (!existsSync(full)) continue;
      if (!originals.has(file)) originals.set(file, readFileSync(full, "utf8"));
      const prelude = [...names].map((n) => `declare const ${n}: any;`).join("\n");
      writeFileSync(full, `${prelude}\n${originals.get(file)}`);
    }
    if (stubs.size) {
      writeFileSync(join(dir, "__fences__", "module-stubs.d.ts"),
        [...stubs].map((s) => `declare module "${s}";`).join("\n") + "\n");
    }
    for (const [stubPath, names] of relStubs) {
      mkdirSync(dirname(stubPath), { recursive: true });
      writeFileSync(stubPath,
        "declare const __stub: any;\nexport default __stub;\n" +
        [...names].map((n) => `export declare const ${n}: any;`).join("\n") + "\n");
    }
    for (const file of droppedAll) rmSync(join(dir, file), { force: true });
    err = run("pnpm", ["typecheck"], dir);
  }
  if (fileDeclares.size || stubs.size || relStubs.size || droppedAll.size) {
    log(`  self-repair: ${fileDeclares.size} snippet(s) given context declares, ${stubs.size + relStubs.size} module stub(s), ${droppedAll.size} fragment(s) dropped`);
  }
  if (err) {
    // Implicit-any in doc callbacks (TS7006/TS7031) is a style nit in prose
    // snippets, not drift — downgrade to a warning count.
    const lines = err.split("\n");
    const lintOnly = (l) => /error TS70(06|31):/.test(l);
    const realErrors = lines.filter((l) => /error TS\d+:/.test(l) && !lintOnly(l));
    if (realErrors.length) {
      failures.push(
        `SKILL.md fences: typecheck failed (genuine drift — fix the SKILL.md or add a justified skip)\n${indent(lines.filter((l) => !lintOnly(l)).join("\n"))}`,
      );
      return;
    }
    log(`  ✓ SKILL.md fences typecheck (${lines.filter(lintOnly).length} implicit-any doc warnings ignored)`);
    return;
  }
  log("  ✓ SKILL.md fences typecheck");
}

// ---------- helpers ----------
const indent = (s) => s.split("\n").slice(0, 60).map((l) => `    ${l}`).join("\n");
const skillNames = () =>
  readdirSync(SKILLS_DIR).filter((n) => {
    if (!statSync(join(SKILLS_DIR, n)).isDirectory()) return false;
    if (ONLY && !ONLY.includes(n)) return false;
    return existsSync(join(SKILLS_DIR, n, "SKILL.md"));
  });

// ---------- main ----------
mkdirSync(WORK, { recursive: true });

log("• preparing scratch vibe-starter");
rmSync(SCRATCH, { recursive: true, force: true });
copyStarterSources(SCRATCH);
ensureNodeModules(SCRATCH);
writeDummyEnv(SCRATCH);

log("• vibe-starter itself (iblai-vibe-ops-init)");
if (!ONLY || ONLY.includes("iblai-vibe-ops-init")) {
  for (const [label, cmdArgs] of [
    ["typecheck", ["typecheck"]],
    ["unit tests", ["test"]],
    ...(RUN_BUILD ? [["build", ["build"]]] : []),
  ]) {
    const err = run("pnpm", cmdArgs, SCRATCH);
    if (err) failures.push(`iblai-vibe-ops-init: starter ${label} failed\n${indent(err)}`);
    else log(`  ✓ starter ${label}`);
  }
}

log("• asset skills (test.json manifests)");
for (const name of skillNames()) {
  const manifestPath = join(SKILLS_DIR, name, "test.json");
  if (!existsSync(manifestPath)) continue;
  testAssetSkill(name, JSON.parse(readFileSync(manifestPath, "utf8")));
}

log("• SKILL.md prose fences");
collectFenceOverlays();

if (failures.length) {
  console.error(`\ntest-skills-render: ${failures.length} failure(s)\n`);
  for (const f of failures) console.error(`✗ ${f}\n`);
  process.exit(1);
}
console.log("\ntest-skills-render: all green.");
