// Skill discovery for the folder layout: skills/<category>/<name>/SKILL.md.
// Categories and their order come from scripts/skill-categories.json.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export const ROOT = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");
export const SKILLS_DIR = join(ROOT, "skills");
export const CATEGORIES = JSON.parse(readFileSync(join(ROOT, "scripts", "skill-categories.json"), "utf8"));
export const STARTER_DIR = join(SKILLS_DIR, "start", "iblai-vibe-ops-init", "assets", "vibe-starter");

/** Every skill: { name, category, dir, file } sorted by category order, then name. */
export function listSkills() {
  const out = [];
  for (const category of CATEGORIES.order) {
    const catDir = join(SKILLS_DIR, category);
    if (!existsSync(catDir)) continue;
    for (const name of readdirSync(catDir).sort()) {
      const dir = join(catDir, name);
      const file = join(dir, "SKILL.md");
      if (statSync(dir).isDirectory() && existsSync(file)) out.push({ name, category, dir, file });
    }
  }
  return out;
}

export function skillDir(name) {
  return listSkills().find((s) => s.name === name)?.dir;
}
