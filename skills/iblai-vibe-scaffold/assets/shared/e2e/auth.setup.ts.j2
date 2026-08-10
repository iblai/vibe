import { test as setup, expect } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({
  path: path.resolve(__dirname, '.env.development'),
});

const APP_HOST = process.env.APP_HOST || 'http://localhost:3000';
const AUTH_HOST = process.env.AUTH_HOST || 'https://login.iblai.app';

setup('authenticate', async ({ page }) => {
  setup.setTimeout(120_000);

  const username = process.env.PLAYWRIGHT_USERNAME || '';
  const password = process.env.PLAYWRIGHT_PASSWORD || '';

  if (!username || !password) {
    throw new Error(
      'PLAYWRIGHT_USERNAME and PLAYWRIGHT_PASSWORD must be set in e2e/.env.development',
    );
  }

  // Navigate to the app — AuthProvider will redirect to the auth SPA
  await page.goto(APP_HOST, { waitUntil: 'domcontentloaded', timeout: 30_000 });

  // Wait for the auth SPA login page — just check for /login and app=agent
  await page.waitForURL(
    (url) => url.href.includes('/login') && url.href.includes('app=agent'),
    { timeout: 60_000 },
  );

  // Click "Continue with Password" to reveal the password fields
  const continueWithPassword = page.getByRole('button', { name: /continue with password/i });
  await expect(continueWithPassword).toBeVisible({ timeout: 30_000 });
  await continueWithPassword.click();

  // Fill in credentials
  await page.getByRole('textbox', { name: /email/i }).fill(username);
  await page.getByRole('textbox', { name: /password/i }).fill(password);

  // Submit
  await page.getByRole('button', { name: /^continue$/i }).click();

  // Wait for redirect back to the app
  await page.waitForURL((url) => url.href.startsWith(APP_HOST), { timeout: 60_000 });

  // Wait for auth tokens to be stored in localStorage
  await page.waitForFunction(() => !!window.localStorage.getItem('axd_token'), {
    timeout: 30_000,
  });

  // Save storage state keyed by project name (e.g., setup-chromium, setup-firefox, setup-webkit)
  const projectName = setup.info().project.name;  // e.g. "setup-chromium"
  const authDir = 'playwright/.auth';
  if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });
  await page.context().storageState({ path: `${authDir}/user-${projectName}.json` });
});
