import { test, expect } from './helpers';

/**
 * Mobile journey — home on a phone-sized viewport (the `mobile` project, a
 * Pixel 7 on the chromium sign-in).
 */
test.describe('mobile journey', () => {
  test('P1 · a phone shows home without sideways overflow', async ({ page }) => {
    const appHost = process.env.APP_HOST || 'http://localhost:3000';
    await page.goto(`${appHost}/`);
    await expect(page).toHaveURL(new RegExp(`^${appHost}`), { timeout: 15_000 });
    // Soft wait: a live chat connection may keep the network busy.
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    const [scroll, client] = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.clientWidth,
    ]);
    expect(scroll, 'home is wider than the viewport').toBeLessThanOrEqual(client);
  });
});
