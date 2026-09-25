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
const FIELD_ALLOW_FILE = join(ROOT, "scripts", "field-schema-allow.json");
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

// Index the schema as a list of { segs, ops }, grouped by length for a cheap
// structural lookup. `ops` maps UPPER method -> the operation object (kept so
// the field pass can reach requestBody, not just method names).
function indexSchema(schema) {
  const byLen = new Map();
  for (const [rawPath, item] of Object.entries(schema.paths ?? {})) {
    const segs = segmentsOf(rawPath);
    const ops = new Map();
    for (const [method, op] of Object.entries(item ?? {})) {
      if (/^(get|post|put|patch|delete|head|options)$/i.test(method)) {
        ops.set(method.toUpperCase(), op);
      }
    }
    (byLen.get(segs.length) ?? byLen.set(segs.length, []).get(segs.length)).push({ segs, ops });
  }
  return byLen;
}

function structurallyMatches(schemaSegs, skillSegs) {
  if (schemaSegs.length !== skillSegs.length) return false;
  for (let i = 0; i < schemaSegs.length; i++) {
    if (isWildcard(schemaSegs[i])) continue; // schema param — absorbs anything
    if (schemaSegs[i] !== skillSegs[i]) return false;
  }
  return true;
}

// All methods across every schema path that structurally matches `skillSegs`;
// null when nothing matches (path does not exist). Aggregating across matches
// keeps ambiguous skill paths (same length, wildcard-absorbable) permissive.
function matchMethods(byLen, skillSegs) {
  const candidates = byLen.get(skillSegs.length);
  if (!candidates) return null;
  let matched = null;
  for (const { segs, ops } of candidates) {
    if (!structurallyMatches(segs, skillSegs)) continue;
    matched = matched ?? new Set();
    for (const m of ops.keys()) matched.add(m);
  }
  return matched;
}

// The operation object(s) for a given (path, method) — used by the field pass.
// Returns an array (usually length 1) so ambiguous matches are all considered.
function matchOperations(byLen, skillSegs, method) {
  const candidates = byLen.get(skillSegs.length) ?? [];
  const ops = [];
  for (const { segs, ops: opsMap } of candidates) {
    if (!structurallyMatches(segs, skillSegs)) continue;
    const op = opsMap.get(method);
    if (op) ops.push(op);
  }
  return ops;
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

// --- Field pass: request-body fields a skill sends vs the schema ----------
// The endpoint pass catches a renamed PATH. This catches a renamed FIELD on a
// path that still exists (e.g. `mentor_name` -> `agent_name`) — the drift that
// silently no-ops a write.

// Resolve an operation's request body to the SET of allowed top-level property
// names. Follows $ref into components.schemas and merges allOf/oneOf/anyOf.
// Returns null when fields can't be pinned down (no body, or additionalProperties
// permits extras) — never guess, so an open body never false-positives.
function requestFieldNames(op, root) {
  const content = op?.requestBody?.content;
  if (!content) return null;
  // Prefer JSON, then multipart (settings uses multipart/form-data), else first.
  const media =
    content["application/json"] ??
    content["multipart/form-data"] ??
    Object.values(content)[0];
  if (!media?.schema) return null;
  const props = new Set();
  let open = false; // additionalProperties allows fields beyond `properties`
  const seen = new Set();
  const walk = (node) => {
    if (!node || typeof node !== "object") return;
    if (node.$ref) {
      const name = node.$ref.split("/").pop();
      if (seen.has(name)) return;
      seen.add(name);
      return walk(root.components?.schemas?.[name]);
    }
    const ap = node.additionalProperties;
    if (ap === true || (ap && typeof ap === "object")) open = true;
    for (const key of Object.keys(node.properties ?? {})) props.add(key);
    for (const sub of node.allOf ?? []) walk(sub);
    for (const sub of node.oneOf ?? []) walk(sub);
    for (const sub of node.anyOf ?? []) walk(sub);
  };
  walk(media.schema);
  if (open) return null; // extras permitted → cannot assert a field is wrong
  return props.size ? props : null;
}

// Top-level object keys of a (possibly comment-annotated, possibly partial)
// JSON block. Tracks object/array nesting so only depth-1 object keys count.
function topLevelKeys(text) {
  const src = text.replace(/(^|[^:])\/\/[^\n]*/g, "$1"); // strip // comments, keep ://
  const keys = new Set();
  const stack = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '"') {
      let j = i + 1, s = "";
      while (j < src.length && src[j] !== '"') {
        if (src[j] === "\\") { s += src[j + 1] ?? ""; j += 2; continue; }
        s += src[j]; j++;
      }
      let k = j + 1;
      while (k < src.length && /\s/.test(src[k])) k++;
      if (src[k] === ":" && stack.length === 1 && stack[0] === "obj") keys.add(s);
      i = j + 1;
      continue;
    }
    if (c === "{") stack.push("obj");
    else if (c === "[") stack.push("arr");
    else if (c === "}" || c === "]") stack.pop();
    i++;
  }
  return keys;
}

// Pair each write endpoint (POST/PUT/PATCH) with the ```json body block that
// follows it, and pull the field names the skill tells you to send. A new
// endpoint, a GET, or a heading before the block clears the pairing.
function extractRequestBodies(markdown) {
  const out = [];
  const lines = markdown.split("\n");
  let pending = null;
  let inFence = false, fenceIsJson = false, buf = [];
  for (const line of lines) {
    if (inFence) {
      if (/^```/.test(line.trim())) {
        if (fenceIsJson && pending) {
          const fields = topLevelKeys(buf.join("\n"));
          if (fields.size) out.push({ ...pending, fields });
          pending = null;
        }
        inFence = false; fenceIsJson = false; buf = [];
      } else buf.push(line);
      continue;
    }
    const fence = /^```(\w+)?/.exec(line.trim());
    if (fence) {
      inFence = true;
      fenceIsJson = /^(json|jsonc|json5)$/i.test(fence[1] ?? "");
      buf = [];
      continue;
    }
    const url = line.match(DM_URL_RE)?.[0];
    const writeMethod =
      /\*\*(POST|PUT|PATCH)\*\*/.exec(line)?.[1] ??
      /-X\s+(POST|PUT|PATCH)/i.exec(line)?.[1]?.toUpperCase();
    if (url && writeMethod) {
      const segs = segmentsOf(url.replace(/[.,;:]+$/, "").slice(DM_PREFIX.length)).map((s) =>
        /^\{[^}]+\}$/.test(s) || s.startsWith("$") ? "{}" : s,
      );
      pending = segs.length >= 3 && segs[0] === "api" ? { method: writeMethod, segs, sample: url } : null;
    } else if (/^\s*#/.test(line) || (url && !writeMethod)) {
      pending = null; // heading or a non-write endpoint ends the association
    }
  }
  return out;
}

// --- Main -----------------------------------------------------------------

function loadAllowFile(file) {
  if (!existsSync(file)) return new Set();
  const raw = JSON.parse(readFileSync(file, "utf8"));
  // Each entry is { match, reason }. Only `match` drives suppression; `reason`
  // documents WHY, so the baseline is not a silent mute — a "schema gap" stays
  // forever, a "drift" marker is temporary and should shrink to zero.
  return new Set((raw.allow ?? []).map((e) => e.match));
}
const loadAllow = () => loadAllowFile(ALLOW_FILE);
const loadFieldAllow = () => loadAllowFile(FIELD_ALLOW_FILE);

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

  const fieldAllow = loadFieldAllow();
  const findings = []; // endpoint (path/method) drift
  const fieldFindings = []; // request-field drift
  let bodiesAsserted = 0; // request bodies with a resolvable strict schema
  let fieldsAsserted = 0; // individual fields actually compared

  for (const skill of apiSkills) {
    const md = readFileSync(skill.file, "utf8");

    // Pass 1 — endpoint existence.
    for (const { segs, methods, sample } of extractEndpoints(md).values()) {
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

    // Pass 2 — request-body fields (only where the endpoint itself resolves).
    for (const { method, segs, fields, sample } of extractRequestBodies(md)) {
      const path = "/" + segs.join("/");
      // Don't pile field findings on a path the endpoint pass already owns.
      if (allow.has(`* ${path}`) || allow.has(`${method} ${path}`)) continue;
      const ops = matchOperations(byLen, segs, method);
      if (ops.length === 0) continue; // path/method missing — endpoint pass owns it
      let allowed = null;
      for (const op of ops) {
        const names = requestFieldNames(op, schema);
        if (names) {
          allowed = allowed ?? new Set();
          for (const n of names) allowed.add(n);
        }
      }
      if (!allowed) continue; // open body / unresolvable — never assert
      bodiesAsserted += 1;
      for (const field of fields) {
        fieldsAsserted += 1;
        if (allowed.has(field)) continue;
        if (fieldAllow.has(`${method} ${path} ${field}`)) continue;
        fieldFindings.push({ skill: skill.name, method, path, field, sample });
      }
    }
  }

  process.stdout.write(
    `Checked ${apiSkills.length} api skills; asserted ${fieldsAsserted} request fields across ${bodiesAsserted} bodies.\n`,
  );

  if (findings.length === 0 && fieldFindings.length === 0) {
    process.stdout.write(`\nOK — endpoints and request fields match the schema.\n`);
    return;
  }

  const group = (arr) => {
    const m = new Map();
    for (const f of arr) (m.get(f.skill) ?? m.set(f.skill, []).get(f.skill)).push(f);
    return [...m].sort();
  };

  if (findings.length) {
    process.stderr.write(`\n${findings.length} endpoint(s) not found in the schema:\n\n`);
    for (const [skill, fs] of group(findings)) {
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
    process.stderr.write(`\n  → fix the skill, or add an exception to scripts/endpoint-schema-allow.json.\n`);
  }

  if (fieldFindings.length) {
    process.stderr.write(`\n${fieldFindings.length} request field(s) not in the schema:\n\n`);
    for (const [skill, fs] of group(fieldFindings)) {
      process.stderr.write(`  ${skill}\n`);
      for (const f of fs) {
        process.stderr.write(`    ✗ field "${f.field}" not in ${f.method} ${f.path}\n      ${f.sample}\n`);
      }
    }
    process.stderr.write(`\n  → fix the skill, or add an exception to scripts/field-schema-allow.json.\n`);
  }
  process.exitCode = 1;
}

main().catch((err) => {
  process.stderr.write(`check-endpoint-schema: ${err.message}\n`);
  process.exitCode = 1;
});
