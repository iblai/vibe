import { test, expect } from '@playwright/test';

/**
 * Admin journey — the admin cluster exists only for org admins in Admin mode:
 * Users (with invitations), Analytics, Billing, Memory, Organization, and the
 * /setup page. Skips cleanly when the test account is a plain member.
 */
const appHost = process.env.APP_HOST || 'http://localhost:3000';

/**
 * A few seconds after first load the app makes a one-time re-auth round trip
 * through the auth SPA. Navigate during it and you are bounced back to the home
 * page mid-assertion, so wait until the URL has held still on the app first.
 */
async function settleAuth(page: import('@playwright/test').Page) {
  const deadline = Date.now() + 40_000;
  let last = page.url();
  let stableSince = Date.now();
  while (Date.now() < deadline) {
    await page.waitForTimeout(500);
    const now = page.url();
    if (now !== last || !now.startsWith(appHost)) {
      last = now;
      stableSince = Date.now();
    } else if (Date.now() - stableSince > 5_000) {
      return;
    }
  }
}

async function isAdmin(page: import('@playwright/test').Page) {
  await page.goto(appHost);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => !!window.localStorage.getItem('tenants'), { timeout: 30_000 });
  await settleAuth(page);
  // waitForFunction rather than evaluate: the service worker can still reload
  // the page here, and a bare evaluate dies with "execution context destroyed".
  const result = await page.waitForFunction(
    () => {
      try {
        const tenants = JSON.parse(localStorage.getItem('tenants') ?? '[]');
        const key = localStorage.getItem('app_tenant');
        return { value: !!tenants.find((t: any) => t.key === key)?.is_admin };
      } catch {
        return { value: false };
      }
    },
    { timeout: 30_000 },
  );
  return (await result.jsonValue()).value;
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
    // Those two buttons are ours, so they prove nothing about the SDK panel —
    // assert on what <Account targetTab="management"> itself renders. Passing
    // `enableRbac` without `rbacPermissions` silently empties this whole panel
    // while the buttons above stay green (see components/admin/account-panel.tsx).
    await expect(page.getByRole('tab', { name: 'Users' })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('tab', { name: 'Roles' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Email' })).toBeVisible();
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
