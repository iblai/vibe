import { type Page } from '@playwright/test';
import { test, expect } from './helpers';
import fs from 'node:fs';

/**
 * API journey — the app's own /api/admin/* routes, called the way the browser
 * calls them (the session token as `Authorization: Token …`): the admin gets
 * answers, bad input gets 400, a member gets 403. Nothing is created: the only
 * admin POST sends an empty name, which the route refuses before calling the
 * platform.
 */
const appHost = process.env.APP_HOST || 'http://localhost:3000';

/** The signed-in session's token, read from the page; never logged. */
async function headersOf(page: Page) {
  await page.goto(appHost);
  await page.waitForFunction(() => !!localStorage.getItem('dm_token'), { timeout: 30_000 });
  const token = await page.evaluate(() => localStorage.getItem('dm_token'));
  return { Authorization: `Token ${token}` };
}

/** The member's token from the state auth.setup.ts saved, or null without a member account. */
function memberHeaders(browserName: string) {
  const file = `playwright/.auth/member-${browserName}.json`;
  if (!fs.existsSync(file)) return null;
  const state = JSON.parse(fs.readFileSync(file, 'utf8')) as { origins: { origin: string; localStorage: { name: string; value: string }[] }[] };
  const token = state.origins.find((o) => o.origin === appHost)?.localStorage.find((e) => e.name === 'dm_token')?.value;
  return token ? { Authorization: `Token ${token}` } : null;
}

test.describe('api journey', () => {
  test('R1 · the admin lists the agents through /api/admin/agents', async ({ page }) => {
    const res = await page.request.get(`${appHost}/api/admin/agents`, { headers: await headersOf(page) });
    expect(res.status()).toBe(200);
    expect(Array.isArray((await res.json()).agents)).toBe(true);
  });

  test('R2 · creating an agent without a name is refused with 400', async ({ page }) => {
    const res = await page.request.post(`${appHost}/api/admin/agents`, { headers: await headersOf(page), data: { name: '' } });
    expect(res.status()).toBe(400);
  });

  test("R3 · the admin reads a member's metadata through /api/admin/user-metadata", async ({ page }) => {
    const member = (process.env.PLAYWRIGHT_MEMBER_USERNAME || '').split('@')[0];
    test.skip(!member, 'no member account in e2e/.env.development: pnpm e2e:accounts creates one');
    const res = await page.request.get(`${appHost}/api/admin/user-metadata?username=${member}`, { headers: await headersOf(page) });
    expect(res.status()).toBe(200);
    expect(typeof (await res.json())).toBe('object');
  });

  test('R4 · reading metadata without a username is refused with 400', async ({ page }) => {
    const res = await page.request.get(`${appHost}/api/admin/user-metadata`, { headers: await headersOf(page) });
    expect(res.status()).toBe(400);
  });

  test('R5 · a member is refused with 403', async ({ page, browserName }) => {
    const headers = memberHeaders(browserName);
    test.skip(!headers, 'no member session saved by auth.setup.ts');
    const res = await page.request.post(`${appHost}/api/admin/agents`, { headers: headers!, data: { name: 'never created' } });
    expect(res.status()).toBe(403);
  });
});
