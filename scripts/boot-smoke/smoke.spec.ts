import { test, expect } from '@playwright/test';

// Routes that render client-side without authentication. The scaffolded app
// mounts its React tree here before any client-side auth redirect, so a broken
// provider, layout, or hook surfaces as a render-breaking error even when
// unauthenticated.
const ROUTES = ['/setup'];

// Patterns that mean the APP broke — not the dummy backend rejecting us. Network
// failures, 401s, and CSP reports are expected when booting with a fake key and
// must never fail the smoke; only render-breaking errors do.
const FATAL = [
  /Minified React error/i,
  /Hydration failed/i,
  /Element type is invalid/i,
  /Cannot read propert(y|ies) of (undefined|null)/i,
  /is not a function/i,
  /Maximum update depth exceeded/i,
  /Objects are not valid as a React child/i,
  /Rendered (more|fewer) hooks/i,
  /Text content does not match/i,
];

for (const route of ROUTES) {
  test(`boots and mounts ${route}`, async ({ page, baseURL }) => {
    const errors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

    // Hold the document: an unauthenticated visit redirects to the sign-in site
    // within seconds, and a 204 on a cross-origin navigation keeps the page.
    const origin = new URL(baseURL ?? 'http://127.0.0.1').origin;
    await page.route('**/*', (r) => {
      const req = r.request();
      if (req.isNavigationRequest() && !req.url().startsWith(origin)) return r.fulfill({ status: 204 });
      return r.continue();
    });

    const resp = await page.goto(route, { waitUntil: 'load' });
    expect(resp?.status() ?? 599, `HTTP status for ${route}`).toBeLessThan(500);

    // The tree mounted (not a blank document).
    await expect(page.locator('body')).not.toBeEmpty();
    await page.waitForTimeout(1500); // let hydration and first effects run

    // The house style renders: Open Sans on body, the brand blue, semibold one step
    // lighter. Painted values, not the raw token: the minifier rewrites oklch() to lab().
    const style = await page.evaluate(() => {
      const probe = (cls: string) => {
        const d = document.createElement('div');
        d.className = cls;
        document.body.appendChild(d);
        const cs = getComputedStyle(d);
        const out = { bg: cs.backgroundColor, weight: cs.fontWeight };
        d.remove();
        return out;
      };
      return {
        font: getComputedStyle(document.body).fontFamily,
        primary: probe('bg-primary').bg,
        weight: probe('font-semibold').weight,
      };
    });
    expect(style.font, `body font-family on ${route}`).toMatch(/open[ _]?sans/i);
    expect(style.primary, `bg-primary on ${route}`).toBe('rgb(0, 88, 204)');
    expect(style.weight, `font-semibold weight on ${route}`).toBe('500');

    const fatal = errors.filter((e) => FATAL.some((re) => re.test(e)));
    expect(fatal, `render-breaking errors on ${route}:\n${fatal.join('\n')}`).toEqual([]);
  });
}
