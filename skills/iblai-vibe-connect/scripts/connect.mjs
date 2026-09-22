#!/usr/bin/env node
/**
 * iblai-vibe-connect — the client half of the connect flow.
 *
 * Opens the browser to the auth app's /connect page, listens on a loopback
 * port for the callback, then writes the org key + minted API token into the
 * project's env files. The token never passes through the chat.
 *
 * Zero dependencies (Node 18+). Point it at a local auth app with
 *   IBLAI_CONNECT_AUTH_URL=http://localhost:3000
 * or --auth-url http://localhost:3000.
 *
 * Flags / env:
 *   --auth-url <url>   IBLAI_CONNECT_AUTH_URL   auth app base (default https://login.iblai.app)
 *   --name <label>     IBLAI_CONNECT_NAME       token label (default "<dir> on <host>")
 *   --org <key>        IBLAI_CONNECT_ORG        preselect an org
 *   --origin <url>     IBLAI_CONNECT_ORIGIN     loopback origin to allow-list (optional)
 *   --dir <path>       IBLAI_CONNECT_DIR        where to write env files (default cwd)
 *   --print-url        print the URL instead of opening a browser (remote sessions)
 *   --paste            read the manual-mode block from stdin, write files, exit
 */

import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { hostname } from 'node:os';
import readline from 'node:readline';

const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? (argv[i + 1] ?? '') : undefined;
};
const has = (name) => argv.includes(name);

const AUTH_URL = (
  flag('--auth-url') ||
  process.env.IBLAI_CONNECT_AUTH_URL ||
  'https://login.iblai.app'
).replace(/\/$/, '');
const DIR = resolve(flag('--dir') || process.env.IBLAI_CONNECT_DIR || process.cwd());
const NAME =
  flag('--name') ||
  process.env.IBLAI_CONNECT_NAME ||
  `${basename(DIR)} on ${hostname()}`;
const ORG = flag('--org') || process.env.IBLAI_CONNECT_ORG || '';
const ORIGIN = flag('--origin') || process.env.IBLAI_CONNECT_ORIGIN || '';

const enc = encodeURIComponent;
const redact = (t) => (t && t.length > 4 ? `****${t.slice(-4)}` : '****');

function apiBaseFor(domain) {
  return `https://api.${domain || 'iblai.app'}`;
}

// ── env file writing ────────────────────────────────────────────────────────
// Set key=value in place, or append; create from <file>.example when missing.
function upsertEnv(file, kv) {
  const path = resolve(DIR, file);
  let text = '';
  if (existsSync(path)) text = readFileSync(path, 'utf8');
  else if (existsSync(`${path}.example`))
    text = readFileSync(`${path}.example`, 'utf8');

  const lines = text.length ? text.split('\n') : [];
  for (const [key, value] of Object.entries(kv)) {
    const re = new RegExp(`^${key}=`);
    const idx = lines.findIndex((l) => re.test(l));
    if (idx >= 0) lines[idx] = `${key}=${value}`;
    else lines.push(`${key}=${value}`);
  }
  writeFileSync(path, lines.join('\n').replace(/\n+$/, '') + '\n');
}

function ensureGitignored(names) {
  const path = resolve(DIR, '.gitignore');
  const current = existsSync(path) ? readFileSync(path, 'utf8') : '';
  const missing = names.filter(
    (n) => !current.split('\n').some((l) => l.trim() === n),
  );
  if (!missing.length) return;
  const next = (current.replace(/\n+$/, '') + '\n' + missing.join('\n') + '\n').replace(/^\n/, '');
  writeFileSync(path, next);
}

function writeFiles({ domain, org, token, username }) {
  upsertEnv('iblai.env', {
    DOMAIN: domain,
    PLATFORM: org,
    TOKEN: token,
    IBLAI_USERNAME: username,
  });
  upsertEnv('.env', {
    IBLAI_ORG: org,
    IBLAI_USERNAME: username,
    IBLAI_API_KEY: token,
  });
  if (existsSync(resolve(DIR, 'package.json'))) {
    upsertEnv('.env.local', {
      NEXT_PUBLIC_MAIN_TENANT_KEY: org,
      IBLAI_API_KEY: token,
    });
  }
  ensureGitignored(['iblai.env', '.env', '.env.local']);
}

async function verifyToken(domain, token) {
  try {
    const res = await fetch(`${apiBaseFor(domain)}/dm/api/core/token/verify/`, {
      headers: { Authorization: `Token ${token}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function finish({ domain, org, orgName, token, username }) {
  const ok = await verifyToken(domain, token);
  if (!ok) {
    console.warn(
      `warning: token did not verify against ${apiBaseFor(domain)} — writing it anyway`,
    );
  }
  writeFiles({ domain, org, token, username });
  console.log(
    `connected: ${orgName || org} (${org}) as ${username} · token ${redact(token)}`,
  );
}

// ── --paste (manual mode) ───────────────────────────────────────────────────
async function pasteMode() {
  const rl = readline.createInterface({ input: process.stdin });
  const kv = {};
  for await (const line of rl) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m) kv[m[1]] = m[2];
  }
  const token = kv.TOKEN;
  const org = kv.PLATFORM;
  if (!token || !org) {
    console.error(
      'paste did not contain PLATFORM and TOKEN. Expected the DOMAIN/PLATFORM/TOKEN/IBLAI_USERNAME block.',
    );
    process.exit(1);
  }
  await finish({
    domain: kv.DOMAIN || 'iblai.app',
    org,
    orgName: org,
    token,
    username: kv.IBLAI_USERNAME || '',
  });
  process.exit(0);
}

// ── browser open ────────────────────────────────────────────────────────────
function openBrowser(url) {
  const cmd =
    process.platform === 'darwin'
      ? ['open', [url]]
      : process.platform === 'win32'
        ? ['cmd', ['/c', 'start', '', url]]
        : ['xdg-open', [url]];
  try {
    spawn(cmd[0], cmd[1], { stdio: 'ignore', detached: true }).unref();
  } catch {
    /* fall back to the printed URL */
  }
}

// Is the hosted /connect page deployed? A 404 means the auth team hasn't
// shipped it yet — the caller should fall back to the manual questions.
async function hostedPageAvailable() {
  try {
    const res = await fetch(`${AUTH_URL}/connect`, { redirect: 'manual' });
    return res.status !== 404;
  } catch {
    return true; // network hiccup — don't block; let the browser try
  }
}

// ── loopback (callback) mode ────────────────────────────────────────────────
async function loopbackMode() {
  if (!(await hostedPageAvailable())) {
    console.error('HOSTED_PAGE_UNAVAILABLE');
    process.exit(3);
  }
  const state = randomBytes(24).toString('hex');
  const timer = setTimeout(
    () => {
      console.error('timed out after 5 minutes waiting for the browser.');
      process.exit(1);
    },
    5 * 60 * 1000,
  );

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname !== '/callback') {
      res.writeHead(404);
      res.end();
      return;
    }
    const p = url.searchParams;
    if (p.get('state') !== state) {
      res.writeHead(400, { 'content-type': 'text/plain' });
      res.end('state mismatch');
      return; // ignore forged callbacks; keep waiting
    }
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<!doctype html><h2>Connected — you can close this tab.</h2>');

    clearTimeout(timer);
    server.close();
    try {
      await finish({
        domain: p.get('domain') || 'iblai.app',
        org: p.get('org') || '',
        orgName: p.get('org_name') || '',
        token: p.get('token') || '',
        username: p.get('username') || '',
      });
      process.exit(0);
    } catch (e) {
      console.error('failed to write env files:', e?.message || e);
      process.exit(1);
    }
  });

  server.listen(0, '127.0.0.1', () => {
    const { port } = server.address();
    const callback = `http://127.0.0.1:${port}/callback`;
    const q = new URLSearchParams({ callback, state, name: NAME });
    if (ORG) q.set('org', ORG);
    if (ORIGIN) q.set('origin', ORIGIN);
    const connectUrl = `${AUTH_URL}/connect?${q.toString()}`;

    console.log('Opening your browser to connect your ibl.ai organization…');
    console.log(connectUrl);
    if (!has('--print-url')) openBrowser(connectUrl);
  });
}

if (has('--paste')) pasteMode();
else loopbackMode();
