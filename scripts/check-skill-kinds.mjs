#!/usr/bin/env node
// Every skill declares `metadata.kind` ∈ {ui, api, guide, ops, security}, and
// the kind agrees with the name prefix (docs/skill-kinds.md). Prints counts.
import { readFileSync } from "node:fs";
import { listSkills } from "./lib/skills.mjs";
const KINDS = new Set(["ui", "api", "guide", "ops", "security"]);
const counts = {};
let failed = false;

for (const { name, file } of listSkills()) {
  const src = readFileSync(file, "utf8");
  const fm = /^---\n([\s\S]*?)\n---\n/.exec(src)?.[1] ?? "";
  const kind = /^metadata:\n(?:[ \t]+[^\n]*\n)*?[ \t]+kind:\s*([a-z]+)/m.exec(fm)?.[1];
  const fail = (msg) => { failed = true; console.error(`${name}: ${msg}`); };
  if (!kind) { fail("missing metadata.kind"); continue; }
  if (!KINDS.has(kind)) { fail(`unknown kind "${kind}"`); continue; }
  counts[kind] = (counts[kind] ?? 0) + 1;
  if (name.startsWith("iblai-api-") && !["api", "guide"].includes(kind)) fail(`iblai-api-* must be kind api or guide, got ${kind}`);
  if (name.startsWith("iblai-vibe-security-") && kind !== "security") fail(`security skill must be kind security, got ${kind}`);
  if (name.startsWith("iblai-vibe-ops-") && kind !== "ops") fail(`ops skill must be kind ops, got ${kind}`);
  if (!name.startsWith("iblai-")) fail("name must start with iblai-");
}
if (failed) process.exit(1);
console.log(`check-skill-kinds: ${Object.entries(counts).map(([k, n]) => `${k}=${n}`).join(" ")} (${Object.values(counts).reduce((a, b) => a + b, 0)} skills)`);
