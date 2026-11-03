import { type Page } from '@playwright/test';
import { test, expect } from './helpers';

/**
 * Pages journey — every page the other journeys do not open, as the admin
 * (who starts in Admin mode): each stays on its route and shows the SDK panel
 * it mounts. One checkpoint per page, so `pnpm e2e:coverage` sees them all.
 */
const appHost = process.env.APP_HOST || 'http://localhost:3000';

async function open(page: Page, path: string) {
  await page.goto(`${appHost}${path}`);
  await expect(page).toHaveURL((url) => url.pathname === path, { timeout: 15_000 });
}

test.describe('pages journey', () => {
  test('K1 · /account shows the organization settings', async ({ page }) => {
    await open(page, '/account');
    await expect(page.locator('nav[aria-label="Organization settings"]')).toBeVisible({ timeout: 30_000 });
  });

  test('K2 · /notifications shows the notification center', async ({ page }) => {
    await open(page, '/notifications');
    await expect(page.getByText('Loading notifications...')).toHaveCount(0, { timeout: 30_000 });
    await expect(page.locator('.rounded-lg.border').getByText(/notification/i).first()).toBeVisible({ timeout: 30_000 });
  });

  test('K3 · /admin/analytics/users opens inside the analytics tab strip', async ({ page }) => {
    await open(page, '/admin/analytics/users');
    await expect(page.getByText('Transcripts').first()).toBeVisible({ timeout: 30_000 });
  });

  test('K4 · /admin/analytics/topics opens inside the analytics tab strip', async ({ page }) => {
    await open(page, '/admin/analytics/topics');
    await expect(page.getByText('Transcripts').first()).toBeVisible({ timeout: 30_000 });
  });

  test('K5 · /admin/analytics/transcripts opens inside the analytics tab strip', async ({ page }) => {
    await open(page, '/admin/analytics/transcripts');
    await expect(page.getByText('Topics').first()).toBeVisible({ timeout: 30_000 });
  });

  test('K6 · /admin/analytics/financial opens inside the analytics tab strip', async ({ page }) => {
    await open(page, '/admin/analytics/financial');
    await expect(page.getByText('Transcripts').first()).toBeVisible({ timeout: 30_000 });
  });

  test('K7 · /admin/analytics/reports opens inside the analytics tab strip', async ({ page }) => {
    await open(page, '/admin/analytics/reports');
    await expect(page.getByText('Transcripts').first()).toBeVisible({ timeout: 30_000 });
  });

  test('K8 · /admin/billing mounts the account panel', async ({ page }) => {
    await open(page, '/admin/billing');
    // The SDK shows its Billing tab (Plan & Credits) only to organizations with
    // billing enabled; elsewhere the panel opens on Organization.
    await expect(page.locator('nav[aria-label="Organization settings"]')).toBeVisible({ timeout: 30_000 });
  });

  test('K9 · /admin/memory shows the memory panel', async ({ page }) => {
    await open(page, '/admin/memory');
    await expect(page.getByText(/global memories|shared memory/i).first()).toBeVisible({ timeout: 30_000 });
  });
});
