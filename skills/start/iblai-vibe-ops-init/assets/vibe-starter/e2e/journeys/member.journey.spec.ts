import { test, expect } from '@playwright/test';

/**
 * Member journey — what everyone sees after sign-in: the home page (a chat
 * with the app's agent, or the honest empty state), the agents browser, and
 * the profile with its app preferences. Never an admin link.
 *
 * Requires auth.setup.ts (pre-authenticated storage state).
 */
const appHost = process.env.APP_HOST || 'http://localhost:3000';

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

  test('a member in User mode never sees admin links', async ({ page }) => {
    await page.goto(appHost);
    await page.waitForLoadState('domcontentloaded');
    const isAdmin = await page.evaluate(() => {
      try {
        const tenants = JSON.parse(localStorage.getItem('tenants') ?? '[]');
        const key = localStorage.getItem('app_tenant');
        return !!tenants.find((t: any) => t.key === key)?.is_admin;
      } catch {
        return false;
      }
    });
    if (isAdmin) {
      // Flip to User mode first: the switch is what makes an admin a member.
      await page.getByRole('switch', { name: /admin mode/i }).click();
    }
    await expect(page.getByRole('link', { name: 'Users' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Billing' })).toHaveCount(0);
    await page.goto(`${appHost}/admin/users`);
    await page.waitForURL((url) => url.pathname === '/', { timeout: 15_000 });
  });
});
