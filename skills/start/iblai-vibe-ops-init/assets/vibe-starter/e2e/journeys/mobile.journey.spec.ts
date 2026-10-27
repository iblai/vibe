import { test, expect, type Page } from '@playwright/test';

/**
 * Mobile journey — the app on a phone-sized viewport (the `mobile` project, a
 * Pixel 7 on the chromium sign-in). Runs as the admin, who starts in Admin mode.
 */
const appHost = process.env.APP_HOST || 'http://localhost:3000';

const PAGES = ['/', '/agents', '/profile', '/admin/users', '/admin/analytics', '/admin/organization', '/setup'];

/** The document is never wider than the phone: nothing scrolls sideways. */
async function expectNoSidewaysOverflow(page: Page) {
  // Soft wait: a live chat connection may keep the network busy.
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  const [scroll, client] = await page.evaluate(() => [
    document.documentElement.scrollWidth,
    document.documentElement.clientWidth,
  ]);
  expect(scroll, `${page.url()} is wider than the viewport`).toBeLessThanOrEqual(client);
}

test.describe('mobile journey', () => {
  test('P1 · a phone shows home, agents, profile and the admin pages without sideways overflow', async ({ page }) => {
    test.setTimeout(120_000);
    for (const path of PAGES) {
      await page.goto(`${appHost}${path}`);
      await expect(page).toHaveURL((url) => url.pathname === path, { timeout: 15_000 });
      await expectNoSidewaysOverflow(page);
    }
  });

  test('P2 · the drawer reaches Agents', async ({ page }) => {
    await page.goto(appHost);
    await page.getByRole('button', { name: 'Open sidebar' }).click();
    await page.getByRole('dialog').getByRole('link', { name: 'Agents' }).click();
    await expect(page).toHaveURL((url) => url.pathname === '/agents', { timeout: 15_000 });
  });
});
