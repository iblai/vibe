import { expect, test as base, type Page } from '@playwright/test';

export const appHost = process.env.APP_HOST || 'http://localhost:3000';

/**
 * auth.setup.ts saves each session after the SDK's one-time re-auth round trip,
 * so a journey's first load only pays the service-worker reload: wait for the
 * worker to take control, then for the URL to hold still.
 */
export async function settleAuth(page: Page) {
  await page.goto(appHost);
  await page.waitForFunction(() => !!(localStorage.getItem('axd_token') || localStorage.getItem('dm_token')), {
    timeout: 30_000,
  });
  await page.waitForFunction(() => !!navigator.serviceWorker?.controller, { timeout: 5_000 }).catch(() => {});
  const deadline = Date.now() + 15_000;
  let last = page.url();
  let stableSince = Date.now();
  while (Date.now() < deadline) {
    await page.waitForTimeout(250);
    const now = page.url();
    if (now !== last || !now.startsWith(appHost)) {
      last = now;
      stableSince = Date.now();
    } else if (Date.now() - stableSince > 2_000) {
      return;
    }
  }
}

/** Every journey test starts on a settled, signed-in home page. */
export const test = base.extend<{ settled: void }>({
  settled: [
    async ({ page }, use) => {
      await settleAuth(page);
      await use();
    },
    { auto: true },
  ],
});

export { expect };
