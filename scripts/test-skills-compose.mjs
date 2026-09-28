#!/usr/bin/env node
// Deterministic composition guard (NO LLM): real apps stack many skills, but the
// render tier tests each skill in its OWN scratch, so it can never see two skills
// clashing. This catches the one composition conflict that IS deterministic —
// an overlay CLOBBER: two skills (or one skill twice) writing the same
// destination file, where the last write silently wins and the other is lost.
//
// It does NOT attempt a semantic "do the skills work together" build — most
// skills wire themselves via SKILL.md prose (editing providers/index.tsx, …),
// not machine-applicable overlays, so true composition needs the agent tier.
// This is the file-level half, and it is deterministic, instant, and secret-free.
//
// Intended overrides (a feature skill replacing a scaffold stub) are registered
// in scripts/overlay-clobber-allow.json with a reason; anything else fails, so a
// newly-added skill that silently overwrites another skill's file is caught.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, listSkills } from "./lib/skills.mjs";

const ALLOW_FILE = join(ROOT, "scripts", "overlay-clobber-allow.json");

function loadAllow() {
  if (!existsSync(ALLOW_FILE)) return new Set();
  const raw = JSON.parse(readFileSync(ALLOW_FILE, "utf8"));
  // Each entry is { dest, reason }. Only `dest` drives suppression; `reason`
  // documents why the override is intentional (e.g. agent-chat's real
  // chat-widget replacing scaffold's stub).
  return new Set((raw.allow ?? []).map((e) => e.dest));
}

// dest -> [{ skill, src }]  (a skill contributes one writer per overlay entry,
// so the same skill mapping two sources to one dest also shows up as a clobber).
function collectWriters() {
  const byDest = new Map();
  for (const s of listSkills()) {
    const tj = join(s.dir, "test.json");
    if (!existsSync(tj)) continue;
    let manifest;
    try {
      manifest = JSON.parse(readFileSync(tj, "utf8"));
    } catch (err) {
      throw new Error(`${s.name}: test.json is not valid JSON — ${err.message}`);
    }
    for (const [src, dest] of Object.entries(manifest.overlay ?? {})) {
      (byDest.get(dest) ?? byDest.set(dest, []).get(dest)).push({ skill: s.name, src });
    }
  }
  return byDest;
}

const allow = loadAllow();
const byDest = collectWriters();

const clobbers = [];
for (const [dest, writers] of byDest) {
  if (writers.length < 2) continue; // one writer — no clobber
  if (allow.has(dest)) continue; // intended override
  clobbers.push({ dest, writers });
}

const totalOverlays = [...byDest.values()].reduce((n, w) => n + w.length, 0);
process.stdout.write(
  `Checked ${totalOverlays} overlay writes across ${byDest.size} destination files.\n`,
);

if (clobbers.length === 0) {
  process.stdout.write(`\nOK — no unintended overlay clobbers between skills.\n`);
  process.exit(0);
}

process.stderr.write(`\n${clobbers.length} overlay clobber(s):\n\n`);
for (const { dest, writers } of clobbers.sort((a, b) => a.dest.localeCompare(b.dest))) {
  const who = writers.map((w) => `${w.skill} (${w.src})`).join("\n      ");
  process.stderr.write(`  ✗ ${dest} is written by ${writers.length} overlays:\n      ${who}\n`);
}
process.stderr.write(
  `\nTwo skills writing the same file silently lose one version. Fix the overlay,\n` +
    `or if the override is intentional register it in scripts/overlay-clobber-allow.json.\n`,
);
process.exit(1);
