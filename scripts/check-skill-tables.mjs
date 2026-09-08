#!/usr/bin/env node
// Every skills/<name> must be named in CLAUDE.md's catalogue and README.md,
// and every /iblai-vibe-* mentioned there must exist. Keeps the front door and
// the directory from drifting apart (they did, repeatedly).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const skills = readdirSync(join(ROOT, "skills")).filter((d) => statSync(join(ROOT, "skills", d)).isDirectory()).sort();
const mentioned = (file) => {
  const text = readFileSync(join(ROOT, file), "utf8");
  const set = new Set([...text.matchAll(/\/(iblai-(?:vibe|api)(?:-[a-z0-9]+)*)\b(?!\.(?:png|jpe?g|md|json))/g)].map((m) => m[1]));
  // The headless family is catalogued by suffix ("`/iblai-api-<name>`" rows list `agent-setting`, `org`, …).
  for (const m of text.matchAll(/`([a-z0-9-]+)`/g)) if (skills.includes(`iblai-api-${m[1]}`)) set.add(`iblai-api-${m[1]}`);
  return set;
};

let failed = false;
for (const file of ["CLAUDE.md", "README.md"]) {
  const seen = mentioned(file);
  // Tier-2 tabs are listed as bare suffixes after `/iblai-vibe-agent-`; accept the family form.
  const tabsListed = /`\/iblai-vibe-agent`[^\n]*indexes the 24 tabs|each `\/iblai-vibe-agent-<tab>`/.test(readFileSync(join(ROOT, file), "utf8"));
  const missing = skills.filter((s) => !seen.has(s) && !(tabsListed && /^iblai-vibe-agent-(?!chat|search|create|setting|memory|billing|audit)/.test(s)));
  const ghosts = [...seen].filter((s) => !skills.includes(s) && !["iblai-api", "iblai-vibe-agent-<tab>"].includes(s));
  if (missing.length) { failed = true; console.error(`${file}: skills not mentioned: ${missing.join(", ")}`); }
  if (ghosts.length) { failed = true; console.error(`${file}: mentions skills that do not exist: ${ghosts.join(", ")}`); }
}
if (failed) process.exit(1);
console.log(`check-skill-tables: ${skills.length} skills, CLAUDE.md and README.md consistent.`);
