import { test, expect } from '@playwright/test';

/**
 * Member journey — what everyone sees after sign-in: the home page (a chat
 * with the app's agent, or the honest empty state), the agents browser, and
 * the profile with its app preferences. Never an admin link.
 *
 * Signed in as the member test account (auth.setup.ts, "authenticate the member").
 */
const appHost = process.env.APP_HOST || 'http://localhost:3000';

test.skip(
  !process.env.PLAYWRIGHT_MEMBER_USERNAME || !process.env.PLAYWRIGHT_MEMBER_PASSWORD,
  'no member account in e2e/.env.development: pnpm e2e:accounts creates one',
);
// The member's session, saved per browser by auth.setup.ts.
test.use({
  storageState: async ({ browserName }, use) => {
    await use(`playwright/.auth/member-${browserName}.json`);
  },
});

test.describe('member journey', () => {
  test('home shows a chat or the "No agent yet" state, never a crash', async ({ page }) => {
    await page.goto(appHost);
    await page.waitForLoadState('domcontentloaded');
    const chatOrEmpty = page
      .getByRole('heading', { name: /no agent yet/i })
      .or(page.getByRole('textbox').first());
    await expect(chatOrEmpty).toBeVisible({ timeout: 30_000 });
  });

  test('the agents page lists agents', async ({ page }) => {
    await page.goto(`${appHost}/agents`);
    await expect(page.getByRole('link', { name: 'Agents' })).toBeVisible({ timeout: 30_000 });
    // The SDK browser renders a search box once loaded.
    await expect(page.getByRole('textbox').first()).toBeVisible({ timeout: 30_000 });
  });

  test('the profile page carries the app preferences card', async ({ page }) => {
    await page.goto(`${appHost}/profile`);
    await expect(page.getByText('App preferences')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('switch').first()).toBeVisible();
  });

  test('a member never sees admin links or the Admin mode switch', async ({ page }) => {
    await page.goto(appHost);
    await expect(page.getByRole('link', { name: 'Agents' })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('switch', { name: /admin mode/i })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Users' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Billing' })).toHaveCount(0);
    await page.goto(`${appHost}/admin/users`);
    await page.waitForURL((url) => url.pathname === '/', { timeout: 15_000 });
  });

  test('/setup tells a member only admins can set it up', async ({ page }) => {
    await page.goto(`${appHost}/setup`);
    await expect(page.getByText('Only organization admins can set up this app.')).toBeVisible({ timeout: 30_000 });
  });
});
