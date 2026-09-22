#!/usr/bin/env node
// Every skill must be named in CLAUDE.md's catalogue and docs/catalogue.md,
// and every /iblai-* mentioned there must exist. Keeps the front door and the
// directory from drifting apart (they did, repeatedly). README.md stays short
// on purpose and is not required to list everything.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, CATEGORIES, listSkills } from "./lib/skills.mjs";

const skills = listSkills().map((s) => s.name).sort();
const mentioned = (file) => {
  const text = readFileSync(join(ROOT, file), "utf8");
  const set = new Set([...text.matchAll(/\/(iblai-(?:vibe|api)(?:-[a-z0-9]+)*)\b(?!\.(?:png|jpe?g|md|json))/g)].map((m) => m[1]));
  // The headless family is catalogued by suffix ("`/iblai-api-<name>`" rows list `agent-setting`, `org`, …).
  for (const m of text.matchAll(/`([a-z0-9-]+)`/g)) if (skills.includes(`iblai-api-${m[1]}`)) set.add(`iblai-api-${m[1]}`);
  return set;
};

let failed = false;
for (const file of ["CLAUDE.md", "docs/catalogue.md"]) {
  const seen = mentioned(file);
  // Tier-2 tabs are listed as bare suffixes after `/iblai-vibe-agent-`; accept the family form.
  const tabsListed = /`\/iblai-vibe-agent`[^\n]*indexes the 24 tabs|each `\/iblai-vibe-agent-<tab>`/.test(readFileSync(join(ROOT, file), "utf8"));
  const missing = skills.filter((s) => !seen.has(s) && !(tabsListed && /^iblai-vibe-agent-(?!chat|search|create|setting|memory|billing|audit)/.test(s)));
  const ghosts = [...seen].filter((s) => !skills.includes(s) && !["iblai-api", "iblai-vibe-agent-<tab>"].includes(s));
  if (missing.length) { failed = true; console.error(`${file}: skills not mentioned: ${missing.join(", ")}`); }
  if (ghosts.length) { failed = true; console.error(`${file}: mentions skills that do not exist: ${ghosts.join(", ")}`); }
}
// README.md's folder table carries a count per folder; it drifted once (content/ 11 vs 25).
const readme = readFileSync(join(ROOT, "README.md"), "utf8");
for (const c of CATEGORIES.order) {
  const n = listSkills().filter((s) => s.category === c).length;
  const m = new RegExp(`^\\| \\[\`${c}/\`\\]\\(skills/${c}\\) \\|[^|]*\\| (\\d+) \\|`, "m").exec(readme);
  if (!m) { failed = true; console.error(`README.md: no folder-table row for ${c}/`); }
  else if (Number(m[1]) !== n) { failed = true; console.error(`README.md: ${c}/ row says ${m[1]} skills, skills/${c} has ${n}`); }
}
const coreNames = CATEGORIES.core.flatMap((k) => [...k.ui, ...k.api]);
const coreMissing = coreNames.filter((n) => !readme.includes(`/${n}\``));
if (coreMissing.length) { failed = true; console.error(`README.md: core skills not named: ${coreMissing.join(", ")}`); }
if (failed) process.exit(1);
console.log(`check-skill-tables: ${skills.length} skills, CLAUDE.md, docs/catalogue.md and the README folder table consistent.`);
