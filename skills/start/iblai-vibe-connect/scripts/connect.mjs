#!/usr/bin/env node
// connect.mjs — one browser round trip that returns an ibl.ai organization key
// and a Platform API Token, then writes them into this project's env files.
//
// Contract: docs/connect-flow.md ("The client (in this repo)").
// Node 18+, ESM, zero dependencies. The token is never printed.

import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { hostname } from "node:os";
import { pathToFileURL } from "node:url";
import process from "node:process";

export const DEFAULT_DOMAIN = "iblai.app";
export const DEFAULT_ORIGIN = "http://localhost:3000";
export const CALLBACK_TIMEOUT_MS = 5 * 60 * 1000;

export const EXIT_OK = 0;
export const EXIT_FAILED = 1;
export const EXIT_HOSTED_PAGE_UNAVAILABLE = 3;
export const EXIT_NETWORK_ERROR = 4;

export const GITIGNORE_ENTRIES = ["iblai.env", ".env", ".env.local"];

const USAGE = `connect.mjs — connect an ibl.ai organization to this project

Usage
  node connect.mjs [options]

Options
  --domain <host>   platform base domain (default: ${DEFAULT_DOMAIN})
  --name <label>    name for the minted token (default: "<project> on <machine>")
  --origin <url>    loopback origin to allow for sign-in redirects
                    (default: ${DEFAULT_ORIGIN} when a Next.js package.json is present)
  --org <key>       preselect an organization key on the hosted page
  --paste           read the manual-mode block from stdin instead of opening a browser
  --dry-run         do everything except write files; print the planned changes
  --help            show this message

Writes iblai.env, .env, and (when a package.json exists) .env.local, and makes
sure all three are gitignored. The token is never printed.

Exit codes: 0 connected · 1 failed · 3 hosted page unavailable · 4 network error`;

// ---------------------------------------------------------------------------
// Pure helpers (exported for the tests)
// ---------------------------------------------------------------------------

/** `****ab12` — the last 4 characters of a secret, and nothing else. */
export function maskToken(token) {
  const s = String(token ?? "");
  return `****${s.length <= 4 ? s : s.slice(-4)}`;
}

/** Replace a secret wherever it might have leaked into a string. */
export function redact(text, token) {
  const s = String(text ?? "");
  if (!token || String(token).length < 4) return s;
  return s.split(String(token)).join(maskToken(token));
}

export function randomState(bytes = 24) {
  // 24 bytes → 32 base64url characters.
  return randomBytes(bytes).toString("base64url");
}

/** The CSRF guard: a callback whose state does not match is not ours. */
export function stateMatches(expected, received) {
  return typeof received === "string" && received.length > 0 && received === expected;
}

export function parseArgs(argv) {
  const out = {
    help: false,
    paste: false,
    dryRun: false,
    domain: null,
    name: null,
    origin: null,
    org: null,
  };
  const flags = { "--domain": "domain", "--name": "name", "--origin": "origin", "--org": "org" };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") { out.help = true; continue; }
    if (arg === "--paste") { out.paste = true; continue; }
    if (arg === "--dry-run") { out.dryRun = true; continue; }
    const eq = arg.indexOf("=");
    const key = eq === -1 ? arg : arg.slice(0, eq);
    if (!(key in flags)) throw new Error(`unknown option: ${key}`);
    const value = eq === -1 ? argv[++i] : arg.slice(eq + 1);
    if (value === undefined) throw new Error(`${key} needs a value`);
    out[flags[key]] = value;
  }
  return out;
}

/** The label the minted token carries, so the user can recognize and revoke it. */
export function defaultTokenName({ packageName, dirName, machine }) {
  const project = packageName || dirName || "vibe-app";
  return `${project} on ${machine || "this machine"}`;
}

export function buildConnectUrl({ domain, port, state, name, origin, org }) {
  const url = new URL(`https://login.${domain}/connect`);
  url.searchParams.set("callback", `http://127.0.0.1:${port}/callback`);
  url.searchParams.set("state", state);
  url.searchParams.set("name", name);
  if (origin) url.searchParams.set("origin", origin);
  if (org) url.searchParams.set("org", org);
  return url.toString();
}

/**
 * Parse the manual-mode block the hosted page shows (`--paste`). Accepts both
 * spellings of the same three values.
 */
export function parsePasteBlock(text) {
  const alias = {
    DOMAIN: "domain",
    PLATFORM: "org",
    IBLAI_ORG: "org",
    NEXT_PUBLIC_MAIN_TENANT_KEY: "org",
    TOKEN: "token",
    IBLAI_API_KEY: "token",
    IBLAI_USERNAME: "username",
    USERNAME: "username",
    ORG_NAME: "org_name",
  };
  const out = {};
  for (const rawLine of String(text ?? "").split(/\r?\n/)) {
    const line = rawLine.trim().replace(/^export\s+/, "");
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim().toUpperCase();
    if (!(key in alias)) continue;
    let value = line.slice(eq + 1).trim();
    value = value.replace(/^(["'])(.*)\1$/s, "$2").trim();
    if (value) out[alias[key]] = value;
  }
  return out;
}

/**
 * Merge `KEY=value` pairs into dotenv-shaped content: existing keys are
 * rewritten in place, missing keys are appended, everything else is preserved.
 */
export function mergeEnvContent(content, updates) {
  const original = String(content ?? "");
  const lines = original === "" ? [] : original.replace(/\n$/, "").split("\n");
  const seen = new Set();
  const next = lines.map((line) => {
    const match = /^(\s*)(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line);
    if (!match) return line;
    const key = match[2];
    if (!(key in updates)) return line;
    seen.add(key);
    return `${key}=${updates[key]}`;
  });
  for (const [key, value] of Object.entries(updates)) {
    if (!seen.has(key)) next.push(`${key}=${value}`);
  }
  const joined = next.join("\n");
  return joined === "" ? "" : `${joined}\n`;
}

/**
 * The content an env file should have next. `existing === null` means the file
 * is absent; then `example` (its `.example` sibling) seeds it when present.
 */
export function nextEnvContent({ existing, example, updates }) {
  const base = existing !== null && existing !== undefined
    ? existing
    : (example !== null && example !== undefined ? example : "");
  return mergeEnvContent(base, updates);
}

/** Append the entries a `.gitignore` is missing; `null` creates one. */
export function nextGitignoreContent(existing, entries = GITIGNORE_ENTRIES) {
  const present = new Set(
    (existing ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean),
  );
  const missing = entries.filter((e) => !present.has(e) && !present.has(`/${e}`));
  if (missing.length === 0) return existing ?? "";
  if (existing === null || existing === undefined || existing.trim() === "") {
    return `${["# ibl.ai credentials", ...missing].join("\n")}\n`;
  }
  const head = existing.endsWith("\n") ? existing : `${existing}\n`;
  return `${head}\n# ibl.ai credentials\n${missing.join("\n")}\n`;
}

/** The values, split into the keys each file family uses. */
export function envUpdatesFor(values) {
  return {
    "iblai.env": {
      DOMAIN: values.domain,
      PLATFORM: values.org,
      TOKEN: values.token,
      IBLAI_USERNAME: values.username,
    },
    ".env": {
      IBLAI_ORG: values.org,
      IBLAI_USERNAME: values.username,
      IBLAI_API_KEY: values.token,
    },
    ".env.local": {
      NEXT_PUBLIC_MAIN_TENANT_KEY: values.org,
      IBLAI_API_KEY: values.token,
    },
  };
}

/**
 * Read the working directory and decide the exact bytes each file should hold.
 * Returns `[{ path, content, action }]`; nothing is written here.
 */
export function buildPlan(cwd, values, io = defaultIO) {
  const updates = envUpdatesFor(values);
  // `.env.local` belongs to a Next.js app; write it only when one is here.
  const files = io.exists(join(cwd, "package.json"))
    ? ["iblai.env", ".env", ".env.local"]
    : ["iblai.env", ".env"];
  const plan = [];
  for (const file of files) {
    const path = join(cwd, file);
    const examplePath = `${path}.example`;
    const existing = io.exists(path) ? io.read(path) : null;
    const example = existing === null && io.exists(examplePath) ? io.read(examplePath) : null;
    const content = nextEnvContent({ existing, example, updates: updates[file] });
    if (existing === content) continue;
    plan.push({
      path,
      content,
      action: existing === null ? (example === null ? "create" : "create from example") : "update",
    });
  }
  const gitignorePath = join(cwd, ".gitignore");
  const gitignore = io.exists(gitignorePath) ? io.read(gitignorePath) : null;
  const nextGitignore = nextGitignoreContent(gitignore);
  if (nextGitignore !== (gitignore ?? "")) {
    plan.push({
      path: gitignorePath,
      content: nextGitignore,
      action: gitignore === null ? "create" : "update",
    });
  }
  return plan;
}

export function applyPlan(plan, io = defaultIO) {
  for (const entry of plan) io.write(entry.path, entry.content);
  return plan.map((entry) => entry.path);
}

export const defaultIO = {
  exists: (p) => existsSync(p),
  read: (p) => readFileSync(p, "utf8"),
  write: (p, c) => writeFileSync(p, c, "utf8"),
};

export function successLine(values) {
  const label = values.org_name || values.org;
  return `connected: ${label} (${values.org}) as ${values.username} · token ${maskToken(values.token)}`;
}

// ---------------------------------------------------------------------------
// Network steps (fetch is injectable so the tests never touch the network)
// ---------------------------------------------------------------------------

export class HostedPageUnavailable extends Error {}
export class NetworkError extends Error {}
export class StateMismatch extends Error {}

/** HEAD the hosted page; 404/405 means it is not deployed yet. */
export async function probeHostedPage({ domain, fetchImpl = fetch }) {
  let res;
  try {
    res = await fetchImpl(`https://login.${domain}/connect`, { method: "HEAD" });
  } catch (cause) {
    throw new NetworkError(`cannot reach login.${domain}`, { cause });
  }
  if (res.status === 404 || res.status === 405) {
    throw new HostedPageUnavailable(`login.${domain}/connect is not available`);
  }
  return true;
}

/**
 * Turn callback query params into the connection values: a `code` is exchanged
 * for the secret; the first-version fallback carries the fields directly.
 */
export async function resolveCallback({ query, state, domain, fetchImpl = fetch }) {
  if (!stateMatches(state, query.state)) throw new StateMismatch("state mismatch");
  if (query.code) {
    let res;
    try {
      res = await fetchImpl(`https://login.${domain}/connect/exchange`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: query.code, state }),
      });
    } catch (cause) {
      throw new NetworkError("code exchange failed", { cause });
    }
    if (!res.ok) throw new Error(`code exchange refused (HTTP ${res.status})`);
    const body = await res.json();
    return {
      domain: body.domain || domain,
      org: body.org,
      org_name: body.org_name,
      username: body.username,
      token: body.token,
    };
  }
  if (!query.token || !query.org) throw new Error("callback carried no code and no values");
  return {
    domain: query.domain || domain,
    org: query.org,
    org_name: query.org_name,
    username: query.username,
    token: query.token,
  };
}

/** The token has to work before anything is written to disk. */
export async function verifyToken({ domain, token, fetchImpl = fetch }) {
  let res;
  try {
    res = await fetchImpl(`https://api.${domain}/dm/api/core/token/verify/`, {
      headers: { Authorization: `Api-Token ${token}` },
    });
  } catch (cause) {
    throw new NetworkError(`cannot reach api.${domain}`, { cause });
  }
  if (res.status !== 200) throw new Error(`token refused (HTTP ${res.status})`);
  let body = {};
  try { body = await res.json(); } catch { body = {}; }
  return { username: body.username || "" };
}

// ---------------------------------------------------------------------------
// Local pieces
// ---------------------------------------------------------------------------

const CONNECTED_HTML = `<!doctype html><meta charset="utf-8"><title>Connected</title>
<style>body{font:16px/1.6 system-ui,sans-serif;margin:20vh auto;max-width:32rem;text-align:center;color:#111}
h1{font-size:1.25rem}p{color:#555}</style>
<h1>Connected — you can close this tab.</h1>
<p>Your organization and API token were written to the project. Back to your agent.</p>`;

function readPackageJson(cwd, io = defaultIO) {
  const path = join(cwd, "package.json");
  if (!io.exists(path)) return null;
  try { return JSON.parse(io.read(path)); } catch { return null; }
}

export function defaultOriginFor(pkg) {
  if (!pkg) return null;
  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  return "next" in deps ? DEFAULT_ORIGIN : null;
}

function openBrowser(url) {
  const cmd = process.platform === "darwin"
    ? ["open", [url]]
    : process.platform === "win32"
      ? ["cmd", ["/c", "start", "", url]]
      : ["xdg-open", [url]];
  try {
    const child = spawn(cmd[0], cmd[1], { stdio: "ignore", detached: true });
    child.on("error", () => {});
    child.unref();
  } catch {
    // The printed URL is the fallback; a missing opener is not fatal.
  }
}

/**
 * Listen on 127.0.0.1:<random free port>. Resolves to `{ port, done }`: the
 * port is needed to build the URL, `done` settles when the callback arrives.
 */
export function listenForCallback({ state, domain, timeoutMs = CALLBACK_TIMEOUT_MS }) {
  return new Promise((ready, readyFailed) => {
    let settle;
    const done = new Promise((res, rej) => { settle = { res, rej }; });
    let timer;
    const stop = (fn) => { clearTimeout(timer); server.close(fn); };

    const server = createServer(async (req, res) => {
      const url = new URL(req.url, "http://127.0.0.1");
      if (url.pathname !== "/callback") {
        res.writeHead(404, { "Content-Type": "text/plain" }).end("not found");
        return;
      }
      const query = Object.fromEntries(url.searchParams.entries());
      if (!stateMatches(state, query.state)) {
        // Not our callback: refuse it and keep waiting for the real one.
        res.writeHead(400, { "Content-Type": "text/plain" }).end("state mismatch");
        return;
      }
      try {
        const values = await resolveCallback({ query, state, domain });
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(CONNECTED_HTML);
        stop(() => settle.res(values));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "text/plain" }).end("could not complete the connection");
        stop(() => settle.rej(err));
      }
    });

    server.on("error", (err) => { readyFailed(err); settle?.rej(err); });
    server.listen(0, "127.0.0.1", () => {
      timer = setTimeout(
        () => stop(() => settle.rej(new Error("timed out after 5 minutes waiting for the browser"))),
        timeoutMs,
      );
      timer.unref?.();
      ready({ port: server.address().port, done, close: () => stop(() => {}) });
    });
  });
}

function readStdin() {
  return new Promise((resolvePromise, rejectPromise) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => { data += chunk; });
    process.stdin.on("end", () => resolvePromise(data));
    process.stdin.on("error", rejectPromise);
  });
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function finish({ values, cwd, dryRun }) {
  const plan = buildPlan(cwd, values);
  if (dryRun) {
    console.log("--dry-run: no files written. Planned changes:");
    for (const entry of plan) {
      console.log(`\n--- ${entry.path} (${entry.action}) ---`);
      console.log(redact(entry.content, values.token).replace(/\n$/, ""));
    }
    if (plan.length === 0) console.log("  (nothing to change)");
    console.log("");
  } else {
    applyPlan(plan);
  }
  console.log(successLine(values));
}

async function main(argv) {
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (err) {
    console.error(err.message);
    console.error(USAGE);
    return EXIT_FAILED;
  }
  if (opts.help) { console.log(USAGE); return EXIT_OK; }

  const cwd = process.cwd();
  const domain = opts.domain || DEFAULT_DOMAIN;

  if (opts.paste) {
    const parsed = parsePasteBlock(await readStdin());
    if (!parsed.org || !parsed.token) {
      console.error("paste block is missing PLATFORM/TOKEN (or IBLAI_ORG/IBLAI_API_KEY)");
      return EXIT_FAILED;
    }
    const values = { ...parsed, domain: parsed.domain || domain };
    try {
      const verified = await verifyToken({ domain: values.domain, token: values.token });
      values.username = values.username || verified.username;
    } catch (err) {
      if (err instanceof NetworkError) { console.error("NETWORK_ERROR"); return EXIT_NETWORK_ERROR; }
      console.error(redact(err.message, values.token));
      return EXIT_FAILED;
    }
    await finish({ values, cwd, dryRun: opts.dryRun });
    return EXIT_OK;
  }

  try {
    await probeHostedPage({ domain });
  } catch (err) {
    if (err instanceof HostedPageUnavailable) {
      console.log("HOSTED_PAGE_UNAVAILABLE");
      return EXIT_HOSTED_PAGE_UNAVAILABLE;
    }
    console.log("NETWORK_ERROR");
    return EXIT_NETWORK_ERROR;
  }

  const pkg = readPackageJson(cwd);
  const name = opts.name || defaultTokenName({
    packageName: pkg?.name,
    dirName: basename(cwd),
    machine: hostname(),
  });
  const origin = opts.origin || defaultOriginFor(pkg);
  const state = randomState();

  const { port, done } = await listenForCallback({ state, domain });
  const url = buildConnectUrl({ domain, port, state, name, origin, org: opts.org });

  console.log("Opening your browser to connect your ibl.ai organization.");
  console.log(`If it does not open, visit:\n  ${url}`);
  console.log("Waiting for the browser (5 minutes)…");
  openBrowser(url);

  let values;
  try {
    values = await done;
  } catch (err) {
    if (err instanceof NetworkError) { console.error("NETWORK_ERROR"); return EXIT_NETWORK_ERROR; }
    console.error(err.message);
    return EXIT_FAILED;
  }

  try {
    const verified = await verifyToken({ domain: values.domain || domain, token: values.token });
    values.username = values.username || verified.username;
  } catch (err) {
    if (err instanceof NetworkError) { console.error("NETWORK_ERROR"); return EXIT_NETWORK_ERROR; }
    console.error(redact(err.message, values.token));
    return EXIT_FAILED;
  }
  values.domain = values.domain || domain;

  await finish({ values, cwd, dryRun: opts.dryRun });
  return EXIT_OK;
}

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; });
}
