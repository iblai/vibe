#!/usr/bin/env node
// Guards against SDK version drift: every "@iblai/<pkg> <version>" mention in
// skills/ must agree with vibe-starter's package.json (the canonical, CI-built
// dependency set). Catches the class of rot where a SKILL.md or template keeps
// installing a years-old SDK line long after the starter moved on.
//
// Rules:
//  - pkg present in vibe-starter: mention must match the starter's major and
//    must not differ in minor (behind = rot, ahead = starter is stale; both fail).
//  - retired v1-era packages (bundled into @iblai/iblai-js v2): any versioned
//    mention fails.
//  - other @iblai packages: must be registered in EXPECTED below (major match),
//    else fail — forces conscious registration of new pins.
// Unversioned prose mentions ("use @iblai/mcp") are ignored.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const SKILLS_DIR = join(ROOT, "skills");
const STARTER_DIR = join(SKILLS_DIR, "iblai-vibe-ops-init", "assets", "vibe-starter");
const STARTER_PKG = join(STARTER_DIR, "package.json");

// @iblai packages that are legitimate but absent from vibe-starter: expected major.
const EXPECTED = {
  "@iblai/mcp": 1,
};

// v1-era packages folded into @iblai/iblai-js v2 subpaths — must not be installed.
const RETIRED = new Set([
  "@iblai/iblai-api",
  "@iblai/web-containers",
  "@iblai/web-utils",
  "@iblai/data-layer",
]);

// Substring matches against "<relative-file>:<pkg>" for intentional exceptions.
const ALLOWLIST = [];

const starterDeps = (() => {
  const pkg = JSON.parse(readFileSync(STARTER_PKG, "utf8"));
  return { ...pkg.devDependencies, ...pkg.dependencies };
})();

const CHECKED_EXTENSIONS = /\.(md|j2|json|ts|tsx|mjs|js|sh|yaml|yml)$/;

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (full === STARTER_DIR) continue; // canonical source, not a subject
    const st = statSync(full);
    if (st.isDirectory()) yield* walk(full);
    else if (CHECKED_EXTENSIONS.test(entry)) yield full;
  }
}

function parseVersion(raw) {
  const m = /^[\^~]?v?(\d+)\.(\d+)/.exec(raw);
  return m ? { major: Number(m[1]), minor: Number(m[2]), raw } : null;
}

// The three shapes a versioned mention takes in this repo:
//   json dep:  "@iblai/x": "^1.2.3"
//   prose/cli: @iblai/x@^1.2.3
//   md table:  | `@iblai/x` | ^1.2.3 |
const MENTION_PATTERNS = [
  /"(@iblai\/[a-z0-9-]+)"\s*:\s*"([^"]+)"/g,
  /(@iblai\/[a-z0-9-]+)@([\^~]?v?\d[\w.-]*)/g,
  /`(@iblai\/[a-z0-9-]+)`\s*\|\s*`?([\^~]?v?\d[\w.-]*)`?\s*\|/g,
];

const violations = [];

for (const file of walk(SKILLS_DIR)) {
  const rel = relative(ROOT, file);
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    for (const pattern of MENTION_PATTERNS) {
      pattern.lastIndex = 0;
      for (const match of line.matchAll(pattern)) {
        const [, pkg, rawVersion] = match;
        const where = `${rel}:${i + 1}`;
        if (ALLOWLIST.some((entry) => `${rel}:${pkg}`.includes(entry))) continue;
        const mention = parseVersion(rawVersion);
        if (!mention) continue;

        if (RETIRED.has(pkg)) {
          violations.push(`${where}  ${pkg}@${rawVersion} — retired v1-era package (bundled into @iblai/iblai-js v2)`);
          continue;
        }
        const starterRange = starterDeps[pkg];
        if (starterRange) {
          const canonical = parseVersion(starterRange);
          if (mention.major !== canonical.major || mention.minor !== canonical.minor) {
            violations.push(
              `${where}  ${pkg}@${rawVersion} — vibe-starter ships ${starterRange}; align the mention (or bump vibe-starter)`,
            );
          }
        } else if (pkg in EXPECTED) {
          if (mention.major !== EXPECTED[pkg]) {
            violations.push(`${where}  ${pkg}@${rawVersion} — expected major ${EXPECTED[pkg]} (see EXPECTED map)`);
          }
        } else {
          violations.push(`${where}  ${pkg}@${rawVersion} — unknown @iblai package; add it to EXPECTED in scripts/check-sdk-pins.mjs`);
        }
      }
    }
  });
}

if (violations.length) {
  console.error(`SDK pin drift — ${violations.length} violation(s):\n`);
  for (const v of violations) console.error(`  ${v}`);
  console.error("\nCanonical versions live in skills/iblai-vibe-ops-init/assets/vibe-starter/package.json.");
  process.exit(1);
}
console.log("check-sdk-pins: all @iblai version mentions agree with vibe-starter.");
