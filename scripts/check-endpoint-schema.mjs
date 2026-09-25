#!/usr/bin/env node
// Deterministic drift guard (NO LLM): every DM endpoint an `iblai-api-*` skill
// documents must exist in the live OpenAPI schema. Catches the class of rot
// where the backend renames or removes an endpoint but a skill still tells
// builders to call the old path — the exact failure a headless integration hits
// silently (wrong path → 404, or the call quietly does nothing).
//
// Source of truth: the live schema at
//   https://api.iblai.app/dm/api/docs/schema/?format=json
// vibe bundles no copy, and the skills already treat this endpoint as canonical
// (docs/api-skills.md, iblai-vibe-api). Override with a cached file for
// offline/CI runs:  IBLAI_SCHEMA_FILE=/path/to/schema.json
//
// SCOPE (v1): endpoint EXISTENCE (method + path), not request field names —
// field-level checking is a harder follow-up. Only literal
// `https://api.iblai.app/dm/...` URLs are checked; `/edx`, the asgi streaming
// host, and `${var}`-built URLs are different services / dynamic and skipped
// (they would false-positive against the DM schema).
//
// Exit 1 with a grouped report if any documented endpoint is missing; 0 if all
// resolve. Register intentional exceptions in scripts/endpoint-schema-allow.json.

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ROOT, listSkills } from "./lib/skills.mjs";

const SCHEMA_URL = "https://api.iblai.app/dm/api/docs/schema/?format=json";
const ALLOW_FILE = join(ROOT, "scripts", "endpoint-schema-allow.json");
const DM_PREFIX = "https://api.iblai.app/dm";

// --- Schema loading -------------------------------------------------------

async function loadSchema() {
  const override = process.env.IBLAI_SCHEMA_FILE;
  if (override) {
    if (!existsSync(override)) {
      throw new Error(`IBLAI_SCHEMA_FILE=${override} does not exist`);
    }
    return JSON.parse(readFileSync(override, "utf8"));
  }
  // The schema is ~7.5MB; a single fetch can be slow, so allow generous time
  // and one retry. A failed fetch must abort loudly, never pass silently — a
  // check that can't read the truth is not a green check.
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(SCHEMA_URL, {
        signal: AbortSignal.timeout(120_000),
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      lastErr = err;
      process.stderr.write(`schema fetch attempt ${attempt} failed: ${err.message}\n`);
    }
  }
  throw new Error(
    `could not load the OpenAPI schema after 3 attempts (${lastErr?.message}). ` +
      `Set IBLAI_SCHEMA_FILE to a cached copy to run offline.`,
  );
}

// --- Path model -----------------------------------------------------------
// Compare by STRUCTURE, not by param spelling. A path becomes an array of
// segments; a schema `{param}` segment is a wildcard that matches ANY skill
// segment (a real `{param}`, a `$SHELL_VAR`, or an example value like
// `support-qa`). Literal segments (`documents`, `train`, `settings`) must match
// exactly — so a renamed/removed resource (the drift that matters) still fails,
// while param-slot spelling never causes a false positive.
function segmentsOf(path) {
  return path
    .split("?")[0]
    .split("#")[0]
    .split("/")
    .filter(Boolean);
}

const isWildcard = (seg) => /^\{[^}]+\}$/.test(seg); // schema `{param}`

// Index the schema as a list of { segs, methods }, grouped by length for a
// cheap structural lookup.
function indexSchema(schema) {
  const byLen = new Map();
  for (const [rawPath, item] of Object.entries(schema.paths ?? {})) {
    const segs = segmentsOf(rawPath);
    const methods = new Set();
    for (const method of Object.keys(item ?? {})) {
      if (/^(get|post|put|patch|delete|head|options)$/i.test(method)) {
        methods.add(method.toUpperCase());
      }
    }
    (byLen.get(segs.length) ?? byLen.set(segs.length, []).get(segs.length)).push({ segs, methods });
  }
  return byLen;
}

// All methods across every schema path that structurally matches `skillSegs`;
// null when nothing matches (path does not exist). Aggregating across matches
// keeps ambiguous skill paths (same length, wildcard-absorbable) permissive.
function matchMethods(byLen, skillSegs) {
  const candidates = byLen.get(skillSegs.length);
  if (!candidates) return null;
  let matched = null;
  for (const { segs, methods } of candidates) {
    let ok = true;
    for (let i = 0; i < segs.length; i++) {
      if (isWildcard(segs[i])) continue; // schema param — absorbs anything
      if (segs[i] !== skillSegs[i]) { ok = false; break; }
    }
    if (!ok) continue;
    matched = matched ?? new Set();
    for (const m of methods) matched.add(m);
  }
  return matched;
}

// --- Skill endpoint extraction -------------------------------------------
// Pull every literal DM URL and, where stated, its HTTP method. Two method
// signals: a bold **POST** near the URL, or `-X POST` in a curl. Absent either,
// the method is unknown and we only assert the PATH exists (never guess a verb).
const METHOD_RE = /\b(GET|POST|PUT|PATCH|DELETE)\b/;
// Stop at brackets too: skills write optional-query notation like `.../v2/[?x=]`,
// and `[` is never part of a real path.
const DM_URL_RE = /https:\/\/api\.iblai\.app\/dm\/[^\s`)"'<>\[\]]+/g;

function extractEndpoints(markdown) {
  const found = new Map(); // segs.join("/") -> { segs, methods:Set, sample:url }
  const lines = markdown.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const urls = line.match(DM_URL_RE);
    if (!urls) continue;
    // Method hints on this line: a bold marker or a curl -X flag.
    const boldMethod = /\*\*(GET|POST|PUT|PATCH|DELETE)\*\*/.exec(line)?.[1];
    const curlMethod = /-X\s+(GET|POST|PUT|PATCH|DELETE)/i.exec(line)?.[1]?.toUpperCase();
    // A bare `curl ... "url"` with no -X is a GET by convention.
    const isCurl = /\bcurl\b/.test(line);
    const method =
      boldMethod ?? curlMethod ?? (isCurl && !/-X/.test(line) ? "GET" : undefined);
    // Only validate URLs the skill presents as CALLABLE — i.e. carrying a
    // method (a bold **VERB**, a curl, or `-X`). A URL with no method is a
    // base-URL or prefix mention in prose ("endpoints under .../orgs/{org}"),
    // not a claim that you can call it; checking those just adds false noise.
    if (!method) continue;
    for (const url of urls) {
      // Prose fragments, not endpoints: an ellipsis or a truncated tail.
      if (/[…]|\.\.\./.test(url)) continue;
      const trimmed = url.replace(/[.,;:]+$/, ""); // strip trailing punctuation
      // Canonicalize param slots so one logical endpoint is one finding: a
      // `{param}` placeholder and a `$SHELL_VAR` example both become `{}`.
      // (Literal example values like `support-qa` stay literal — the schema `{}`
      // still absorbs them at match time.)
      const segs = segmentsOf(trimmed.slice(DM_PREFIX.length)).map((s) =>
        /^\{[^}]+\}$/.test(s) || s.startsWith("$") ? "{}" : s,
      );
      // A real DM endpoint is at least /api/<service>/<...>; anything shorter is
      // a base-URL or prefix mention in prose, not a callable path.
      if (segs.length < 3 || segs[0] !== "api") continue;
      const key = segs.join("/");
      const entry = found.get(key) ?? { segs, methods: new Set(), sample: trimmed };
      if (method) entry.methods.add(method);
      found.set(key, entry);
    }
  }
  return found;
}

// --- Main -----------------------------------------------------------------

function loadAllow() {
  if (!existsSync(ALLOW_FILE)) return new Set();
  const raw = JSON.parse(readFileSync(ALLOW_FILE, "utf8"));
  // Each entry is { match: "METHOD /path" | "* /path", reason: "..." }. Only
  // `match` drives suppression; `reason` documents WHY, so the baseline is not
  // a silent mute — a "schema gap" stays forever, a "drift, fix in #NNN" is a
  // temporary marker that should shrink to zero.
  return new Set((raw.allow ?? []).map((e) => e.match));
}

async function main() {
  const schema = await loadSchema();
  const byLen = indexSchema(schema);
  const total = [...byLen.values()].reduce((n, arr) => n + arr.length, 0);
  const allow = loadAllow();
  process.stdout.write(`Loaded ${total} endpoint paths from the OpenAPI schema.\n`);

  // Select by the frontmatter `kind: api` — but read the WHOLE frontmatter
  // block, not a fixed prefix: `kind` sits under `metadata:` after the (often
  // long) description, so a char cap would silently skip skills.
  const apiSkills = listSkills().filter((s) => {
    const src = readFileSync(s.file, "utf8");
    const fm = /^---\n([\s\S]*?)\n---/.exec(src)?.[1] ?? "";
    return /\bkind:\s*api\b/.test(fm);
  });

  const findings = [];
  for (const skill of apiSkills) {
    const md = readFileSync(skill.file, "utf8");
    const endpoints = extractEndpoints(md);
    for (const { segs, methods, sample } of endpoints.values()) {
      const path = "/" + segs.join("/");
      const schemaMethods = matchMethods(byLen, segs);
      if (!schemaMethods) {
        if (allow.has(`* ${path}`)) continue;
        findings.push({ skill: skill.name, kind: "path-missing", path, sample });
        continue;
      }
      for (const method of methods) {
        if (schemaMethods.has(method)) continue;
        if (allow.has(`${method} ${path}`) || allow.has(`* ${path}`)) continue;
        findings.push({
          skill: skill.name,
          kind: "method-missing",
          path,
          method,
          have: [...schemaMethods].sort().join(","),
          sample,
        });
      }
    }
  }

  if (findings.length === 0) {
    process.stdout.write(
      `\nOK — every DM endpoint documented across ${apiSkills.length} api skills exists in the schema.\n`,
    );
    return;
  }

  process.stderr.write(`\n${findings.length} endpoint(s) not found in the schema:\n\n`);
  const bySkill = new Map();
  for (const f of findings) (bySkill.get(f.skill) ?? bySkill.set(f.skill, []).get(f.skill)).push(f);
  for (const [skill, fs] of [...bySkill].sort()) {
    process.stderr.write(`  ${skill}\n`);
    for (const f of fs) {
      if (f.kind === "path-missing") {
        process.stderr.write(`    ✗ path not in schema: ${f.path}\n      ${f.sample}\n`);
      } else {
        process.stderr.write(
          `    ✗ ${f.method} not allowed on ${f.path} (schema has: ${f.have})\n      ${f.sample}\n`,
        );
      }
    }
  }
  process.stderr.write(
    `\nFix the skill, or register an intentional exception in scripts/endpoint-schema-allow.json.\n`,
  );
  process.exitCode = 1;
}

main().catch((err) => {
  process.stderr.write(`check-endpoint-schema: ${err.message}\n`);
  process.exitCode = 1;
});
