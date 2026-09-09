import { test, expect } from '@playwright/test';

/**
 * Admin journey — the admin cluster exists only for org admins in Admin mode:
 * Users (with invitations), Analytics, Billing, Memory, Organization, and the
 * /setup page. Skips cleanly when the test account is a plain member.
 */
const appHost = process.env.APP_HOST || 'http://localhost:3000';

async function isAdmin(page: import('@playwright/test').Page) {
  await page.goto(appHost);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => !!window.localStorage.getItem('tenants'), { timeout: 30_000 });
  return page.evaluate(() => {
    try {
      const tenants = JSON.parse(localStorage.getItem('tenants') ?? '[]');
      const key = localStorage.getItem('app_tenant');
      return !!tenants.find((t: any) => t.key === key)?.is_admin;
    } catch {
      return false;
    }
  });
}

test.describe('admin journey', () => {
  test('admin links appear in Admin mode and disappear in User mode', async ({ page }) => {
    test.skip(!(await isAdmin(page)), 'test account is not an org admin');
    await expect(page.getByRole('link', { name: 'Users' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Organization' })).toBeVisible();
    await page.getByRole('switch', { name: /admin mode/i }).click();
    await expect(page.getByRole('link', { name: 'Users' })).toHaveCount(0);
    await page.getByRole('switch', { name: /admin mode/i }).click();
    await expect(page.getByRole('link', { name: 'Users' })).toBeVisible();
  });

  test('/admin/users hosts the Management surface and the invite actions', async ({ page }) => {
    test.skip(!(await isAdmin(page)), 'test account is not an org admin');
    await page.goto(`${appHost}/admin/users`);
    await expect(page.getByRole('button', { name: 'Invite user' })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: 'Pending invites' })).toBeVisible();
  });

  test('/admin/analytics renders the tab strip', async ({ page }) => {
    test.skip(!(await isAdmin(page)), 'test account is not an org admin');
    await page.goto(`${appHost}/admin/analytics`);
    await expect(page.getByText(/overview/i).first()).toBeVisible({ timeout: 30_000 });
  });

  test('/admin/organization shows the app settings form', async ({ page }) => {
    test.skip(!(await isAdmin(page)), 'test account is not an org admin');
    await page.goto(`${appHost}/admin/organization`);
    await expect(page.getByText('App settings')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByLabel('App name')).toBeVisible();
  });

  test('/setup asks for the app name first', async ({ page }) => {
    test.skip(!(await isAdmin(page)), 'test account is not an org admin');
    await page.goto(`${appHost}/setup`);
    await expect(page.getByRole('heading', { name: /what is this app called/i })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByLabel('App name')).toBeVisible();
  });
});
