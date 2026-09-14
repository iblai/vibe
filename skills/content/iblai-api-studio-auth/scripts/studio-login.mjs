#!/usr/bin/env node
// Capture a signed-in Open edX Studio + LMS browser session into studio.env.
// Opens a visible browser, lets the user sign in themselves, reads the session
// cookies (never a password), verifies them, and writes the gitignored file.
//
//   node studio-login.mjs [--studio URL] [--lms URL] [--lms-app URL] [--out studio.env]
//                         [--profile DIR] [--timeout SECONDS] [--check]
//
// --check verifies an existing studio.env without opening a browser (exit 0 = valid).
import { existsSync, mkdirSync, writeFileSync, readFileSync, appendFileSync, chmodSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const args = parseArgs(process.argv.slice(2));
const OUT = resolve(args.out || 'studio.env');
const existing = readEnv(OUT);
const STUDIO_URL = trim(args.studio || process.env.STUDIO_URL || existing.STUDIO_URL || 'https://studio.learn.iblai.app');
const LMS_URL = trim(args.lms || process.env.LMS_URL || existing.LMS_URL || deriveLms(STUDIO_URL));
const LMS_APP_URL = trim(args['lms-app'] || process.env.LMS_APP_URL || existing.LMS_APP_URL || (new URL(STUDIO_URL).host.endsWith('iblai.org') ? 'https://lms.iblai.org' : 'https://lms.ibl.ai'));
const CACHE = join(homedir(), '.cache', 'iblai-studio');
const PROFILE = args.profile || join(CACHE, 'profile-' + new URL(STUDIO_URL).host);
const TIMEOUT_MS = Number(args.timeout || 300) * 1000;
const JSON_HEADERS = { Accept: 'application/json' };

if (args.check) {
  const ok = await checkEnv(existing);
  process.exit(ok ? 0 : 2);
}

const { chromium } = await loadPlaywright();
const ctx = await launch(chromium);
const page = ctx.pages()[0] || (await ctx.newPage());
await page.goto(STUDIO_URL + '/home').catch(() => {});
console.log(`Sign in to Studio in the browser window (${STUDIO_URL}). Waiting up to ${TIMEOUT_MS / 1000}s…`);

const started = Date.now();
let captured = null;
while (Date.now() - started < TIMEOUT_MS) {
  const cookies = await ctx.cookies([STUDIO_URL, LMS_URL]);
  const studio = cookies.find((c) => c.name === 'studio_session_id');
  const lms = cookies.find((c) => c.name === 'sessionid');
  if (studio && lms) {
    const username = await verify(ctx.request);
    if (username) { captured = { cookies, username, studio, lms }; break; }
  }
  await sleep(1000);
}
await ctx.close().catch(() => {});
if (!captured) { console.error('Timed out waiting for a signed-in Studio session.'); process.exit(1); }

const pick = (name, url) => captured.cookies.find((c) => c.name === name && new URL(url).host.endsWith(c.domain.replace(/^\./, '')))?.value || '';
const studioCsrf = pick('csrftoken', STUDIO_URL);
const lmsCsrf = pick('csrftoken', LMS_URL) || studioCsrf;
const expires = captured.studio.expires > 0 ? new Date(captured.studio.expires * 1000).toISOString() : '';
writeEnv({
  STUDIO_URL, LMS_URL, LMS_APP_URL,
  STUDIO_ORG: existing.STUDIO_ORG || '',
  STUDIO_USERNAME: captured.username,
  STUDIO_SESSION: captured.studio.value, STUDIO_CSRF: studioCsrf,
  LMS_SESSION: captured.lms.value, LMS_CSRF: lmsCsrf,
  STUDIO_SESSION_EXPIRES: expires,
});
ensureGitignore(OUT);
console.log(`connected: ${new URL(STUDIO_URL).host} as ${captured.username} · session ${mask(captured.studio.value)}${expires ? ' · expires ' + expires.slice(0, 10) : ''} → ${OUT}`);

// ---------------------------------------------------------------- helpers

async function verify(request) {
  try {
    const r = await request.get(STUDIO_URL + '/api/contentstore/v2/home/courses', { headers: JSON_HEADERS, maxRedirects: 0 });
    if (r.status() !== 200 || !/json/.test(r.headers()['content-type'] || '')) return null;
    const me = await request.get(LMS_URL + '/api/user/v1/me', { headers: JSON_HEADERS, maxRedirects: 0 });
    if (me.status() !== 200) return null;
    return (await me.json()).username || null;
  } catch { return null; }
}

async function checkEnv(env) {
  const need = ['STUDIO_URL', 'LMS_URL', 'STUDIO_SESSION', 'STUDIO_CSRF', 'LMS_SESSION'];
  const missing = need.filter((k) => !env[k]);
  if (missing.length) { console.error(`studio.env missing ${missing.join(', ')} — run without --check to sign in.`); return false; }
  const get = async (url, cookie) => {
    const r = await fetch(url, { headers: { ...JSON_HEADERS, Cookie: cookie }, redirect: 'manual' });
    return r.status === 200 && /json/.test(r.headers.get('content-type') || '');
  };
  const studioOk = await get(env.STUDIO_URL + '/api/contentstore/v2/home/courses', `studio_session_id=${env.STUDIO_SESSION}; csrftoken=${env.STUDIO_CSRF}`);
  const lmsOk = await get(env.LMS_URL + '/api/user/v1/me', `sessionid=${env.LMS_SESSION}; csrftoken=${env.LMS_CSRF || env.STUDIO_CSRF}`);
  console.log(`studio: ${studioOk ? 'ok' : 'expired'} · lms: ${lmsOk ? 'ok' : 'expired'}${env.STUDIO_SESSION_EXPIRES ? ' · recorded expiry ' + env.STUDIO_SESSION_EXPIRES.slice(0, 10) : ''}`);
  return studioOk && lmsOk;
}

async function loadPlaywright() {
  const unwrap = (m) => (m.chromium ? m : m.default);
  const req = createRequire(join(process.cwd(), 'package.json'));
  for (const name of ['playwright', 'playwright-core']) {
    try { return unwrap(await import(pathToFileURL(req.resolve(name)).href)); } catch {}
  }
  try {
    const root = execSync('npm root -g', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    for (const name of ['playwright', 'playwright-core']) {
      const p = join(root, name, 'index.mjs');
      if (existsSync(p)) return unwrap(await import(pathToFileURL(p).href));
    }
  } catch {}
  const cached = join(CACHE, 'node_modules', 'playwright-core', 'index.mjs');
  if (!existsSync(cached)) {
    mkdirSync(CACHE, { recursive: true });
    console.log(`installing playwright-core into ${CACHE} (one time, no browser download)…`);
    execSync(`npm install --no-audit --no-fund --loglevel=error --prefix "${CACHE}" playwright-core@1`, { stdio: 'inherit' });
  }
  return unwrap(await import(pathToFileURL(cached).href));
}

async function launch(chromium) {
  const base = { headless: false, viewport: null, args: ['--start-maximized'] };
  let last;
  for (const opts of [{ ...base, channel: 'chrome' }, base, { ...base, channel: 'msedge' }]) {
    try { return await chromium.launchPersistentContext(PROFILE, opts); } catch (e) { last = e; }
  }
  throw new Error(`Could not start a browser. Install Google Chrome, or run: npx playwright install chromium\n${last?.message || ''}`);
}

function writeEnv(values) {
  const merged = { ...existing, ...values };
  const quote = (v) => `'${String(v).replace(/'/g, `'\\''`)}'`;
  const lines = [
    `# Written by /iblai-api-studio-auth on ${new Date().toISOString()} — browser session cookies. Never commit; never print.`,
    ...Object.entries(merged).map(([k, v]) => `${k}=${/^[A-Za-z0-9_:\/.\-]*$/.test(v) ? v : quote(v)}`),
    '',
  ];
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, lines.join('\n'), { mode: 0o600 });
  chmodSync(OUT, 0o600);
}

function readEnv(file) {
  if (!existsSync(file)) return {};
  const out = {};
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (v.startsWith("'") && v.endsWith("'")) v = v.slice(1, -1).replace(/'\\''/g, "'");
    else if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

function ensureGitignore(outFile) {
  const dir = dirname(outFile);
  const gi = join(dir, '.gitignore');
  const entry = outFile.slice(dir.length + 1);
  const current = existsSync(gi) ? readFileSync(gi, 'utf8') : '';
  if (current.split('\n').some((l) => l.trim() === entry)) return;
  appendFileSync(gi, (current && !current.endsWith('\n') ? '\n' : '') + entry + '\n');
}

function deriveLms(studio) { return 'https://' + new URL(studio).host.replace(/^studio\./, ''); }
function trim(u) { return u.replace(/\/+$/, ''); }
function mask(v) { return '****' + v.slice(-4); }
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const k = a.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) { out[k] = next; i++; } else out[k] = true;
  }
  return out;
}
