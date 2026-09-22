#!/usr/bin/env node
// Remove the boilerplate paragraphs that ~40 skills copy-pasted (brand block,
// "run ops-test", "start pnpm dev", "iblai.env is NOT .env.local", "use pnpm")
// from every SKILL.md that already carries the one-line pointer to
// docs/skill-setup.md, which says all of it once. Idempotent; prints a report.
//
//   node scripts/dedupe-boilerplate.mjs [--dry]
import { readFileSync, writeFileSync } from "node:fs";
import { listSkills } from "./lib/skills.mjs";
const DRY = process.argv.includes("--dry");
const POINTER = "Common setup (brand, conventions, env files, verification)";

// A paragraph is dropped when it STARTS with one of these (after trimming).
const PREFIXES = [
  "Do NOT add custom styles, colors, or CSS overrides to ibl.ai SDK components.",
  "Do NOT add custom styles to ibl.ai SDK components",
  "When building custom UI around SDK components, use the ibl.ai brand:",
  "You MUST run `/iblai-vibe-ops-test` before telling the user the work is ready.",
  "After all work is complete, start a dev server (`pnpm dev`) so the user",
  "`iblai.env` is NOT a `.env.local` replacement",
  "Use `pnpm` as the default package manager.",
  "Follow the component hierarchy: use ibl.ai SDK components",
  "Follow [BRAND.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/BRAND.md) for",
  "When building a navbar or header, do NOT display the",
  "Project names MUST be all lowercase",
  "Do NOT ask the user for their platform key.",
];
// Never touch these paragraphs even if they look like boilerplate.
const KEEP_IF_CONTAINS = ["MUST follow BRAND.md colors", "Do NOT add Lucide icons"];

let touched = 0, removed = 0;
for (const { name, file } of listSkills()) {
  const src = readFileSync(file, "utf8");
  if (!src.includes(POINTER)) continue;
  // Only operate on the prose ABOVE the first "## " heading (where the block lives).
  const fm = src.indexOf("\n---\n", 4) + 5; // end of frontmatter
  const firstH2 = src.indexOf("\n## ", fm);
  const head = src.slice(fm, firstH2 === -1 ? src.length : firstH2);
  const tail = firstH2 === -1 ? "" : src.slice(firstH2);
  const paras = head.split(/\n{2,}/);
  const kept = paras.filter((p) => {
    const t = p.trim();
    if (KEEP_IF_CONTAINS.some((k) => t.includes(k))) return true;
    return !PREFIXES.some((pre) => t.startsWith(pre));
  });
  const n = paras.length - kept.length;
  if (!n) continue;
  touched++; removed += n;
  const out = src.slice(0, fm) + kept.join("\n\n").replace(/\n{3,}/g, "\n\n") + tail;
  console.log(`${name}: -${n} paragraph(s)`);
  if (!DRY) writeFileSync(file, out);
}
console.log(`${DRY ? "[dry] " : ""}${touched} skills, ${removed} paragraphs removed`);
