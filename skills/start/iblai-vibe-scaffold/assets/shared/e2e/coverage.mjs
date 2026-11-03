#!/usr/bin/env node
// pnpm e2e:coverage — checks e2e/coverage.json against the specs and the app,
// then approximates e2e coverage from the user journeys: an app file counts as
// exercised when a journey visits a page (or API route) that imports it. No
// browser, no instrumentation. Exit 1 on any ledger error or under THRESHOLD.
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const THRESHOLD = 95;
// Checkpoints per 1,000 app lines: the OS runs 8.9, sis and crm 6 to 7; under this the suite stopped early.
export const MIN_PER_KLOC = 6;
const APP_DIRS = ["app", "components", "hooks", "lib", "providers", "store", "i18n"];
// Loaded on every request, so every visit reaches them.
const ALWAYS_ON = ["middleware.ts", "proxy.ts", "instrumentation.ts", "i18n/request.ts"];
// Rendered around a page by Next.
const WRAPPERS = ["layout.tsx", "template.tsx", "loading.tsx", "error.tsx", "not-found.tsx"];
const EXTS = [".ts", ".tsx", ".js", ".mjs", ".jsx"];
// A test's title, as test(), test.fixme() or test.skip() write it: "<ID> · …".
const TITLE = /\btest(?:\.fixme|\.skip)?\(\s*["'`]([A-Z]+\d+[a-z]?) · /g;
const IMPORT = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|^\s*import\s*['"]([^'"]+)['"]/gm;

const walk = (dir) =>
  existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]))
    : [];
const lineCount = (file) => readFileSync(file, "utf8").split("\n").length;
const isSource = (f) => /\.tsx?$/.test(f) && !/\.d\.ts$|\.test\.|(^|\/)__tests__\//.test(f);
const isPage = (f) => /(^|\/)(page\.tsx|route\.ts)$/.test(f) && f.startsWith("app/");

/** app/(app)/admin/users/page.tsx → /admin/users; a [x] or [[...x]] segment cuts the path to its static prefix. */
export function routeOf(page) {
  const parts = page.split("/").slice(1, -1).filter((p) => !/^\(.*\)$/.test(p));
  const dyn = parts.findIndex((p) => p.startsWith("["));
  return { route: "/" + (dyn === -1 ? parts : parts.slice(0, dyn)).join("/"), dynamic: dyn !== -1 };
}

/** The spec names the path: quoted, or at the end of a template string, followed by a quote, ? or # (a dynamic route may go on). */
export function namesPath(text, route, dynamic) {
  const escaped = route.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  return new RegExp(`['"\`}]${escaped}(?=['"\`?#${dynamic ? "/" : ""}])`).test(text);
}

/** The app files a file imports: @/ and relative specifiers only; packages are not the app. */
export function importsOf(root, file) {
  const text = readFileSync(join(root, file), "utf8");
  const out = [];
  for (const m of text.matchAll(IMPORT)) {
    const spec = m[1] || m[2] || m[3];
    let p;
    if (spec.startsWith("@/")) p = join(root, spec.slice(2));
    else if (spec.startsWith(".")) p = resolve(dirname(join(root, file)), spec);
    else continue;
    for (const c of [p, ...EXTS.map((e) => p + e), ...EXTS.map((e) => join(p, "index" + e))]) {
      if (existsSync(c) && statSync(c).isFile()) {
        out.push(relative(root, c).split("\\").join("/"));
        break;
      }
    }
  }
  return out;
}

/** Everything pnpm e2e:coverage prints, as data: ledger errors, the coverage numbers, the unreached files. */
export function check(root) {
  const at = (f) => join(root, f);
  const rel = (f) => relative(root, f).split("\\").join("/");
  const errors = [];
  if (!existsSync(at("e2e/coverage.json"))) return { errors: ["e2e/coverage.json is missing"], percent: 0, unreached: [] };
  const ledger = JSON.parse(readFileSync(at("e2e/coverage.json"), "utf8"));
  const journeys = ledger.journeys ?? [];
  const md = existsSync(at("e2e/COVERAGE.md")) ? readFileSync(at("e2e/COVERAGE.md"), "utf8") : "";

  const declared = new Set(journeys.map((j) => j.spec));
  for (const s of walk(at("e2e/journeys")).map(rel).filter((f) => f.endsWith(".spec.ts")))
    if (!declared.has(s.slice("e2e/".length))) errors.push(`${s} is not a journey in e2e/coverage.json`);
  const seen = new Set();
  for (const j of journeys) {
    const ids = (j.checkpoints ?? []).map((c) => c.id);
    for (const id of ids) {
      if (seen.has(id)) errors.push(`checkpoint ${id} is listed twice`);
      seen.add(id);
      if (!md.includes(id)) errors.push(`checkpoint ${id} is not in e2e/COVERAGE.md`);
    }
    if (!existsSync(at(`e2e/${j.spec}`))) {
      errors.push(`journey ${j.id}: e2e/${j.spec} does not exist`);
      continue;
    }
    const text = readFileSync(at(`e2e/${j.spec}`), "utf8");
    const titled = [...text.matchAll(TITLE)].map((m) => m[1]);
    for (const id of ids) if (!titled.includes(id)) errors.push(`${j.spec}: checkpoint ${id} heads no test title ("${id} · …")`);
    for (const id of titled) if (!ids.includes(id)) errors.push(`${j.spec}: test ${id} is not in e2e/coverage.json`);
    for (const src of j.sourceFiles ?? []) {
      if (!isPage(src)) {
        errors.push(`${j.spec}: ${src} is not a page or route; components are reached through the pages a journey visits`);
        continue;
      }
      if (!existsSync(at(src))) {
        errors.push(`${j.spec}: ${src} does not exist`);
        continue;
      }
      // The sign-in setup returns through the SSO landing page without naming its path.
      if (!j.spec.startsWith("journeys/")) continue;
      const { route, dynamic } = routeOf(src);
      if (!namesPath(text, route, dynamic)) errors.push(`${j.spec}: never names ${route}, the path of ${src}`);
    }
  }
  const summary = { totalCheckpoints: journeys.reduce((n, j) => n + (j.checkpoints ?? []).length, 0), totalJourneys: journeys.length };
  if (JSON.stringify(ledger.summary) !== JSON.stringify(summary)) errors.push(`summary should be ${JSON.stringify(summary)}`);

  const pages = walk(at("app")).map(rel).filter(isPage);
  const visited = new Set(journeys.flatMap((j) => j.sourceFiles ?? []));
  for (const p of pages) if (!visited.has(p)) errors.push(`${p} (${routeOf(p).route}) is visited by no journey`);

  const universe = [...new Set([...APP_DIRS.flatMap((d) => walk(at(d)).map(rel)), ...ALWAYS_ON])].filter(
    (f) => existsSync(at(f)) && isSource(f) && !f.startsWith("components/ui/"),
  );
  const seeds = ALWAYS_ON.filter((f) => existsSync(at(f)));
  for (const p of visited) {
    if (!existsSync(at(p))) continue;
    seeds.push(p);
    const parts = p.split("/");
    for (let i = 1; i < parts.length; i++)
      for (const w of WRAPPERS) if (existsSync(at(join(...parts.slice(0, i), w)))) seeds.push([...parts.slice(0, i), w].join("/"));
  }
  const reached = new Set();
  const stack = [...seeds];
  while (stack.length) {
    const f = stack.pop();
    if (reached.has(f)) continue;
    reached.add(f);
    for (const i of importsOf(root, f)) if (!reached.has(i)) stack.push(i);
  }
  const importers = new Map();
  for (const f of universe) for (const i of importsOf(root, f)) importers.set(i, [...(importers.get(i) ?? []), f]);
  const total = universe.reduce((n, f) => n + lineCount(at(f)), 0);
  const covered = universe.filter((f) => reached.has(f)).reduce((n, f) => n + lineCount(at(f)), 0);
  const perKloc = total ? (1000 * summary.totalCheckpoints) / total : 0;
  if (perKloc < MIN_PER_KLOC)
    errors.push(`checkpoints per 1,000 app lines: ${perKloc.toFixed(1)} (${summary.totalCheckpoints} for ${total} lines; floor ${MIN_PER_KLOC}) — enumerate every page, control and state and give each a checkpoint`);
  const unreached = universe
    .filter((f) => !reached.has(f))
    .map((f) => {
      const by = (importers.get(f) ?? []).find(isPage) ?? importers.get(f)?.[0];
      const why = isPage(f)
        ? `no journey visits ${routeOf(f).route}`
        : WRAPPERS.includes(f.split("/").pop())
          ? `wraps the pages under ${f.slice(0, f.lastIndexOf("/"))}/, none visited`
          : by
            ? `imported by ${by}${isPage(by) ? ` — no journey visits ${routeOf(by).route}` : ""}`
            : "imported by nothing";
      return { file: f, lines: lineCount(at(f)), why };
    });
  return {
    errors,
    journeys: journeys.length,
    checkpoints: summary.totalCheckpoints,
    pages: pages.length,
    pagesVisited: pages.filter((p) => visited.has(p)).length,
    files: universe.length,
    filesReached: universe.length - unreached.length,
    lines: total,
    linesReached: covered,
    percent: total ? (100 * covered) / total : 100,
    perKloc,
    unreached,
  };
}

function main() {
  const r = check(process.cwd());
  for (const e of r.errors) console.error(`error: ${e}`);
  if (r.lines !== undefined) {
    console.log(`e2e coverage · ${r.journeys} journeys · ${r.checkpoints} checkpoints (${r.perKloc.toFixed(1)} per 1,000 app lines, floor ${MIN_PER_KLOC}) · ${r.pagesVisited}/${r.pages} pages and routes visited`);
    console.log(`  app files reached ${r.filesReached}/${r.files} · lines ${r.linesReached}/${r.lines} · ${r.percent.toFixed(1)}% (threshold ${THRESHOLD})`);
    console.log("  approximate: a file counts when a journey visits a page that imports it (components/ui/** not counted)");
    for (const u of r.unreached) console.log(`  unreached: ${u.file} (${u.lines} lines) — ${u.why}`);
  }
  process.exit(r.errors.length || r.percent < THRESHOLD ? 1 : 0);
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) main();
