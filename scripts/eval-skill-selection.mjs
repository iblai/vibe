#!/usr/bin/env node
// Selection eval: does the model pick the RIGHT skill for a build goal? Picking
// the wrong skill = building the wrong thing (it compiles, it runs, it's just not
// what was asked). This is the ONE reliability check that needs a model — a
// fixed rule can't judge that "charge users to enter my app" means the app
// paywall and not credits.
//
// LLM-driven, so it does NOT belong in blocking per-PR CI (token cost + non-
// determinism). Run it locally on a Claude subscription:
//     node scripts/eval-skill-selection.mjs
// which shells out to `claude -p` by default. Override the model command with
//     SKILL_EVAL_CMD='<cmd reading the prompt on stdin, printing the answer>'
// (a stub for testing the harness itself, another CLI, etc.).

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, listSkills } from "./lib/skills.mjs";

const FIXTURES = join(ROOT, "scripts", "skill-eval", "fixtures.json");
const CMD = process.env.SKILL_EVAL_CMD || "claude -p";

// --- catalogue: name + one-line description from frontmatter -----------------
function catalogue() {
  const out = [];
  for (const s of listSkills()) {
    const src = readFileSync(s.file, "utf8");
    const fm = /^---\n([\s\S]*?)\n---/.exec(src)?.[1] ?? "";
    const desc = /^description:\s*(.*)$/m.exec(fm)?.[1]?.replace(/^["']|["']$/g, "") ?? "";
    out.push({ name: s.name, desc: desc.split(/(?<=\.)\s/)[0].slice(0, 160) });
  }
  return out;
}

const skills = catalogue();
const names = new Set(skills.map((s) => s.name));
const catalogueText = skills.map((s) => `- ${s.name}: ${s.desc}`).join("\n");

// --- fixtures + integrity preflight -----------------------------------------
const { cases } = JSON.parse(readFileSync(FIXTURES, "utf8"));
const unknown = [];
for (const c of cases) {
  for (const n of [...(c.expectAny ?? []), ...(c.forbid ?? [])]) {
    if (!names.has(n)) unknown.push(`${n} (in "${c.goal}")`);
  }
}
if (unknown.length) {
  process.stderr.write(`Fixtures reference skills that no longer exist:\n  ${unknown.join("\n  ")}\n`);
  process.exit(1);
}

// --- ask the model -----------------------------------------------------------
function prompt(goal) {
  return `You select ibl.ai "vibe" skills for a build task. Below is the catalogue of available skills as "name: description".

CATALOGUE:
${catalogueText}

USER GOAL: "${goal}"

Return ONLY a JSON array of the skill name(s) that best apply, most relevant first. No prose, no code fence.`;
}

function pickSkills(goal) {
  const res = spawnSync(CMD, { input: prompt(goal), shell: true, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  if (res.status !== 0) throw new Error(`model command failed: ${res.stderr || res.error?.message || "non-zero exit"}`);
  const text = res.stdout ?? "";
  // Take the last JSON array that parses to a string list (models sometimes
  // add prose before it despite the instruction).
  const matches = [...text.matchAll(/\[[\s\S]*?\]/g)].map((m) => m[0]).reverse();
  for (const m of matches) {
    try {
      const arr = JSON.parse(m);
      if (Array.isArray(arr) && arr.every((x) => typeof x === "string")) return arr;
    } catch {
      /* try the next candidate */
    }
  }
  throw new Error(`could not parse a JSON array of skill names from the model output:\n${text.slice(0, 400)}`);
}

// --- run ---------------------------------------------------------------------
process.stdout.write(`Selection eval — ${cases.length} cases, model: \`${CMD}\`\n\n`);
let failed = 0;
for (const c of cases) {
  let picked;
  try {
    picked = pickSkills(c.goal);
  } catch (err) {
    failed++;
    process.stdout.write(`  ✗ ${c.goal}\n      ${err.message.split("\n")[0]}\n`);
    continue;
  }
  const set = new Set(picked);
  const hit = (c.expectAny ?? []).some((n) => set.has(n));
  const bad = (c.forbid ?? []).filter((n) => set.has(n));
  if (hit && bad.length === 0) {
    process.stdout.write(`  ✓ ${c.goal}\n      → ${picked.slice(0, 3).join(", ")}\n`);
  } else {
    failed++;
    const why = !hit
      ? `expected one of [${(c.expectAny ?? []).join(", ")}]`
      : `picked forbidden [${bad.join(", ")}]`;
    process.stdout.write(`  ✗ ${c.goal}\n      ${why}; got [${picked.join(", ")}]\n`);
  }
}

process.stdout.write(`\n${cases.length - failed}/${cases.length} passed.\n`);
process.exit(failed ? 1 : 0);
