import { test, expect, type Page } from '@playwright/test';
import { APP_SLUG } from '../../lib/iblai/metadata-core';

/**
 * Chat journey — `?new=` starts a fresh chat and `?session=<id>` reopens one.
 * The home page seeds or clears the SDK's cached-session map under the SDK's own
 * key (`sessionCacheKey(org, agent)`) before <Chat> mounts, so the proof is
 * which session's history the chat then asks the platform for. No message is
 * sent: a session without one is still minted, cached and asked for. Also the
 * tab title, the app's name as saved on /setup (set in the browser by AppTitle).
 */
const appHost = process.env.APP_HOST || 'http://localhost:3000';
const NO_AGENT = 'no agent yet: set NEXT_PUBLIC_DEFAULT_AGENT_ID or pick one on /setup';

/**
 * A few seconds after first load the app makes a one-time re-auth round trip
 * through the auth SPA. Navigate during it and you are bounced back to the home
 * page mid-assertion, so wait until the URL has held still on the app first.
 */
async function settleAuth(page: Page) {
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

/** Home, settled: true with the chat composer, false on "No agent yet". */
async function openChat(page: Page): Promise<boolean> {
  await page.goto(appHost);
  await settleAuth(page);
  const composer = page.getByRole('textbox').first();
  await expect(composer.or(page.getByRole('heading', { name: /no agent yet/i }))).toBeVisible({
    timeout: 30_000,
  });
  return composer.isVisible();
}

/** localStorage `session_id`: the SDK's map of sessionCacheKey(org, agent) → session id. */
async function sessionMap(page: Page): Promise<Record<string, string>> {
  // waitForFunction rather than evaluate: the service worker can reload the page.
  const handle = await page.waitForFunction(() => {
    try {
      return { map: JSON.parse(localStorage.getItem('session_id') ?? '{}') };
    } catch {
      return { map: {} };
    }
  });
  return (await handle.jsonValue()).map;
}

/** From an empty cache the chat mints one session, cached under this organization. */
async function firstSession(page: Page) {
  await page.evaluate(() => localStorage.removeItem('session_id'));
  await page.reload();
  await expect(page.getByRole('textbox').first()).toBeVisible({ timeout: 30_000 });
  const org = await page.evaluate(() => localStorage.getItem('app_tenant') ?? '');
  let entry: [string, string] = ['', ''];
  await expect
    .poll(
      async () => {
        const mine = Object.entries(await sessionMap(page)).filter(([k, v]) => k.startsWith(`${org}:`) && !!v);
        if (mine.length === 1) entry = mine[0];
        return mine.length;
      },
      { timeout: 30_000, message: 'the chat caches one session for this organization' },
    )
    .toBe(1);
  return { key: entry[0], id: entry[1] };
}

/** Wait until `key` holds a session other than `old`. */
async function replaced(page: Page, key: string, old: string) {
  await expect
    .poll(
      async () => {
        const id = (await sessionMap(page))[key];
        return !!id && id !== old;
      },
      { timeout: 30_000, message: 'a new session cached for this agent' },
    )
    .toBe(true);
}

/** Is `r` the page at `marker` asking for session `id`'s history (`…/sessions/<id>/`)? */
const asksFor = (page: Page, marker: string, id: string) => (r: { url(): string }) =>
  page.url().includes(marker) && r.url().includes(`/sessions/${id}/`);

test.describe('chat journey', () => {
  // Each test loads the chat two or three times after the re-auth trip.
  test.describe.configure({ timeout: 90_000 });

  test('C1 ?new= starts a fresh chat instead of reopening the cached one', async ({ page }) => {
    test.skip(!(await openChat(page)), NO_AGENT);
    const { key, id: first } = await firstSession(page);
    const marker = `new=${Date.now()}`;
    const asked: string[] = [];
    page.on('request', (r) => {
      if (asksFor(page, marker, first)(r)) asked.push(r.url());
    });
    await page.goto(`${appHost}/?${marker}`);
    await replaced(page, key, first);
    expect(asked.length, 'the new chat must not load the previous session').toBe(0);
  });

  test('C2 ?session=<id> reopens that chat', async ({ page }) => {
    test.skip(!(await openChat(page)), NO_AGENT);
    const { key, id: first } = await firstSession(page);
    await page.goto(`${appHost}/?new=${Date.now()}`);
    await replaced(page, key, first);
    const marker = `session=${first}`;
    const reopened = page.waitForRequest(asksFor(page, marker, first), { timeout: 30_000 });
    await page.goto(`${appHost}/?${marker}`);
    await reopened;
  });

  test('C3 the tab carries the name saved on /setup', async ({ page }) => {
    // The org's real metadata with a name under this app's slug: nothing is written.
    await page.route(/\/api\/core\/orgs\/[^/]+\/metadata\/?(\?|$)/, async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      const apps = { ...body?.metadata?.apps };
      apps[APP_SLUG] = { ...apps[APP_SLUG], appName: 'C3 Title Check' };
      await route.fulfill({ response, json: { ...body, metadata: { ...body?.metadata, apps } } });
    });
    await page.goto(appHost);
    await settleAuth(page);
    await expect(page).toHaveTitle('C3 Title Check', { timeout: 30_000 });
  });
});
