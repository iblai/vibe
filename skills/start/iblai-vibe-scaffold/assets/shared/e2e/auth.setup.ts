import { test as setup, type Locator, type Page } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.resolve(__dirname, '.env.development') });

const APP_HOST = process.env.APP_HOST || 'http://localhost:3000';
const AUTH_DIR = 'playwright/.auth';

// The login page is found by structure, not by its copy: a password field, a
// button named like "password" that reveals it, an email field, a submit
// button. When the page changes, these four rules are what to update.
const PASSWORD_FIELD = 'input[type="password"]';
const PASSWORD_BUTTON = /password/i;
const EMAIL_FIELD = 'input[type="email"], input[name="email"], input[name="username"]';
const SUBMIT_BUTTON = /^(continue|sign in|log in)$/i;

setup.setTimeout(120_000);

const visible = (locator: Locator, timeout: number) =>
  locator.waitFor({ state: 'visible', timeout }).then(() => true, () => false);

/** The page's controls, for the error that says the login page changed. */
async function controls(page: Page) {
  const tree = await page.locator('body').ariaSnapshot().catch(() => '');
  return tree.split('\n').slice(0, 60).join('\n');
}

export async function signIn(page: Page, email: string, password: string, file: string) {
  await page.goto(APP_HOST, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  // AuthProvider sends a signed-out visitor to the login page.
  await page.waitForURL((url) => !url.href.startsWith(APP_HOST), { timeout: 60_000 });

  const passwordBox = page.locator(PASSWORD_FIELD).first();
  if (!(await visible(passwordBox, 5_000))) {
    const reveal = page.getByRole('button', { name: PASSWORD_BUTTON }).first();
    if (await visible(reveal, 30_000)) await reveal.click();
  }
  if (!(await visible(passwordBox, 15_000))) {
    throw new Error(
      `The login page offers no password sign-in I recognise. Its controls:\n${await controls(page)}\n` +
        '— update the four resolver rules at the top of e2e/auth.setup.ts, or ask your ibl.ai ' +
        'operator if the page now needs a code or CAPTCHA.',
    );
  }
  const emailBox = page
    .locator(EMAIL_FIELD)
    .or(page.getByRole('textbox', { name: /email|username/i }))
    .first();
  await emailBox.fill(email);
  await passwordBox.fill(password);
  await passwordBox.press('Enter');
  // A form that ignores Enter still has a submit button.
  const submitted = await passwordBox.waitFor({ state: 'hidden', timeout: 3_000 }).then(() => true, () => false);
  if (!submitted) {
    await page.getByRole('button', { name: SUBMIT_BUTTON }).first().click({ timeout: 5_000 }).catch(() => {});
  }

  try {
    await page.waitForURL((url) => url.href.startsWith(APP_HOST), { timeout: 60_000 });
  } catch {
    const refused =
      (await passwordBox.isVisible().catch(() => false)) ||
      (await page.getByText(/invalid|incorrect|wrong|not match/i).first().isVisible().catch(() => false));
    if (refused) {
      throw new Error(
        `Sign-in refused for ${email}. If pnpm e2e:accounts just created this account, the platform ` +
          'did not store its password: ask your ibl.ai operator to let the user API set passwords.',
      );
    }
    const { origin, pathname } = new URL(page.url());
    throw new Error(
      `Sign-in did not return to ${APP_HOST} (stopped at ${origin}${pathname}). Add ${APP_HOST} to the ` +
        "organization's allowed redirect origins: /iblai-vibe-connect does, or ask your ibl.ai operator.",
    );
  }
  await page.waitForFunction(() => !!(localStorage.getItem('axd_token') || localStorage.getItem('dm_token')), {
    timeout: 30_000,
  });
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  await page.context().storageState({ path: `${AUTH_DIR}/${file}` });
}

setup('authenticate', async ({ page }) => {
  const email = process.env.PLAYWRIGHT_USERNAME || '';
  const password = process.env.PLAYWRIGHT_PASSWORD || '';
  if (!email || !password) {
    throw new Error(
      'PLAYWRIGHT_USERNAME and PLAYWRIGHT_PASSWORD must be set in e2e/.env.development: run pnpm e2e:accounts',
    );
  }
  // Keyed by project name (setup-chromium, …): the journeys and scripts/capture-screenshots.mjs read it.
  await signIn(page, email, password, `user-${setup.info().project.name}.json`);
});

setup('authenticate the member', async ({ page, browserName }) => {
  const email = process.env.PLAYWRIGHT_MEMBER_USERNAME || '';
  const password = process.env.PLAYWRIGHT_MEMBER_PASSWORD || '';
  setup.skip(!email || !password, 'no member account in e2e/.env.development: pnpm e2e:accounts creates one');
  await signIn(page, email, password, `member-${browserName}.json`);
});
