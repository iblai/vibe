#!/usr/bin/env node
// Guards against cross-repo link rot: every github.com/iblai/... and
// raw.githubusercontent.com/iblai/... URL in the repo must resolve. Catches
// the class of breakage where a companion repo (iblai/api, iblai/os, ...)
// renames a path and our references 404 silently — as happened when
// iblai/api renamed iblai-analytics to iblai-api-analytics.
//
// Fails (exit 1) only on 404/410 — definitely dead. Transient trouble
// (429/5xx/network) is retried once, then warned but passed, so nightly CI
// doesn't go red on GitHub flakiness.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const CHECKED_EXTENSIONS = /\.(md|j2|json|ts|tsx|mjs|js|sh|yaml|yml)$/;
const SKIP_DIRS = new Set(["node_modules", "adapters"]); // adapters mirror skills/ — same URLs
const SKIP_FILES = new Set(["CHANGELOG.md", "pnpm-lock.yaml"]);
const URL_PATTERN = /https:\/\/(?:raw\.githubusercontent\.com|github\.com)\/iblai\/[^\s)"'`<>\]*]+/g;

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith(".") || SKIP_DIRS.has(entry) || SKIP_FILES.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) yield* walk(full);
    else if (CHECKED_EXTENSIONS.test(entry)) yield full;
  }
}

const sources = new Map(); // url -> ["file:line", ...]
for (const file of walk(ROOT)) {
  const rel = relative(ROOT, file);
  readFileSync(file, "utf8").split("\n").forEach((line, i) => {
    for (const match of line.matchAll(URL_PATTERN)) {
      const url = match[0].replace(/[.,;:!?]+$/, "").replace(/#.*$/, "");
      if (!sources.has(url)) sources.set(url, []);
      sources.get(url).push(`${rel}:${i + 1}`);
    }
  });
}

async function status(url) {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, { redirect: "follow" });
      if (res.ok || res.status === 404 || res.status === 410 || attempt) return res.status;
    } catch (err) {
      if (attempt) return `network error (${err.cause?.code ?? err.message})`;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
}

const urls = [...sources.keys()].sort();
const dead = [];
const flaky = [];
for (let i = 0; i < urls.length; i += 8) {
  await Promise.all(urls.slice(i, i + 8).map(async (url) => {
    const s = await status(url);
    if (s === 404 || s === 410) dead.push([url, s]);
    else if (s !== 200) flaky.push([url, s]);
  }));
}

console.log(`check-links: ${urls.length} distinct iblai URLs checked.`);
for (const [url, s] of flaky) console.warn(`  warn ${s}  ${url} (transient — not failing the check)`);
if (dead.length) {
  console.error(`\ncheck-links — ${dead.length} dead link(s):\n`);
  for (const [url, s] of dead) {
    console.error(`  ${s}  ${url}`);
    for (const src of sources.get(url)) console.error(`         ${src}`);
  }
  console.error("\nFix the reference (the target repo likely renamed or removed the path).");
  process.exit(1);
}
console.log("check-links: all links resolve.");
