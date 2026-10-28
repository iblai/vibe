import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

const APP_HOST = process.env.APP_HOST || 'http://localhost:3000';
const ENV_FILE = path.resolve(__dirname, '.env.development');

/** Before any project runs: the app must answer, and the two test accounts must exist. */
export default async function globalSetup() {
  try {
    await fetch(APP_HOST, { redirect: 'manual' });
  } catch {
    throw new Error(`Nothing answers at ${APP_HOST}: start pnpm dev (or pnpm build && pnpm start) and run pnpm test:e2e again.`);
  }
  const missing = (user: string, pass: string) => !process.env[user] || !process.env[pass];
  if (missing('PLAYWRIGHT_USERNAME', 'PLAYWRIGHT_PASSWORD') || missing('PLAYWRIGHT_MEMBER_USERNAME', 'PLAYWRIGHT_MEMBER_PASSWORD')) {
    console.log('Creating the e2e test accounts (pnpm e2e:accounts)…');
    const run = spawnSync(process.execPath, [path.resolve(__dirname, 'create-accounts.mjs')], { stdio: 'inherit' });
    if (run.status !== 0) throw new Error('pnpm e2e:accounts failed: see its message above.');
    // The config read .env.development before the accounts existed; the workers inherit this process's env.
    if (fs.existsSync(ENV_FILE)) dotenv.config({ path: ENV_FILE, override: true });
  }
}
