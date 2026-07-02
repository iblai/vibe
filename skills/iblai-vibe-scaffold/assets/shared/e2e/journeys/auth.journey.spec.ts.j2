import { test, expect } from '@playwright/test';

/**
 * Auth journey — verifies the SSO authentication flow.
 *
 * Requires auth.setup.ts to have run first (via the "setup" dependency).
 * The setup saves browser storage state so the user is already logged in.
 */
test.describe('auth journey', () => {
  test('authenticated user lands on the home page', async ({ page }) => {
    const appHost = process.env.APP_HOST || 'http://localhost:3000';

    await page.goto(appHost);

    // User should reach the home page without being redirected to auth SPA
    await page.waitForURL((url) => url.href.startsWith(appHost + '/'), {
      timeout: 15_000,
    });
    await expect(page).toHaveURL(new RegExp(`^${appHost}`));
  });

  test('auth tokens are stored in localStorage', async ({ page }) => {
    const appHost = process.env.APP_HOST || 'http://localhost:3000';

    await page.goto(appHost);

    // Wait for the app to finish loading (avoid networkidle — WebKit keeps connections open)
    await page.waitForLoadState('domcontentloaded', { timeout: 15_000 });
    // Give the app a moment to restore localStorage from storage state
    await page.waitForFunction(() => !!window.localStorage.getItem('axd_token'), {
      timeout: 10_000,
    });

    // ibl.ai auth tokens should be present after login
    const axdToken = await page.evaluate(() =>
      window.localStorage.getItem('axd_token'),
    );
    expect(axdToken).toBeTruthy();

    const userData = await page.evaluate(() =>
      window.localStorage.getItem('userData'),
    );
    expect(userData).toBeTruthy();

    const parsed = JSON.parse(userData!);
    expect(parsed).toHaveProperty('user_nicename');
  });
});
