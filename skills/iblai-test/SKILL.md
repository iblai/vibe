---
name: iblai-test
description: Test your app before showing to the user
globs:
alwaysApply: false
---

# /iblai-test

You MUST run these checks before presenting any work to
the user. Do NOT show untested code.

Use `pnpm` as the default package manager. Fall back to `npm` if pnpm
is not installed.

## Step 1: Build

Run the production build to catch TypeScript errors, missing imports, and
config issues:

```bash
pnpm build
```

Fix all errors. A failed build means broken code -- do not proceed until
the build passes cleanly.

## Step 2: Run Unit Tests

```bash
pnpm test
```

This runs vitest to verify:
- All `@source` paths in CSS files resolve to existing directories
- The `lib/iblai/sdk` symlink is valid and targets the SDK dist
- `lib/iblai/sdk/web-containers/source` contains compiled JS for
  Tailwind class generation

If tests fail, the SDK symlink may be broken. Run `ls -la lib/iblai/sdk`
to check. If it's missing, run `iblai add auth` again to recreate it.

## Step 3: Get Test Credentials

Before running E2E tests or authenticated screenshots, **ask the user**
for their ibl.ai login credentials:

1. **Email** -- the ibl.ai account email
2. **Password** -- the account password

Store them in `e2e/.env.development` (create the file if it doesn't exist):

```
PLAYWRIGHT_USERNAME=user@example.com
PLAYWRIGHT_PASSWORD=their-password
```

If the user declines to provide credentials, skip authenticated page
screenshots and only test unauthenticated pages (home, SSO callback).

## Step 4: Touch Test Pages

### If this is an agent app (from `iblai startapp agent`)

The app already has a full Playwright E2E suite in `e2e/`. Use it:

```bash
pnpm test:e2e
```

This runs auth setup + journey tests across Chromium, Firefox, and WebKit.

For a single browser:

```bash
npx playwright test --config e2e/playwright.config.ts --project=chromium
```

### If this is a vanilla Next.js app

Install Playwright and a browser:

```bash
pnpm add -D @playwright/test
npx playwright install --with-deps chromium
```

`--with-deps` installs the browser binary AND system libraries (libatk,
libcups, etc.). Without it the browser may fail to launch on Linux/CI.

Start the dev server:

```bash
pnpm dev &
```

Wait for http://localhost:3000 to be ready.

#### Login with Playwright before taking screenshots

Most pages require authentication. Write and run a Playwright script that
logs in through the ibl.ai Auth SPA and saves the browser state, then
takes screenshots of every page with a 10-second wait:

```typescript
// e2e/visual-test.ts
import { chromium } from '@playwright/test';

const APP = 'http://localhost:3000';
const AUTH = 'https://login.iblai.app';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // --- Login ---
  await page.goto(APP, { waitUntil: 'domcontentloaded', timeout: 30000 });

  // AuthProvider redirects to the auth SPA
  await page.waitForURL(url => url.href.includes('/login'), { timeout: 60000 });

  // Click "Continue with Password"
  const pwdBtn = page.getByRole('button', { name: /continue with password/i });
  await pwdBtn.waitFor({ timeout: 30000 });
  await pwdBtn.click();

  // Fill credentials from env
  await page.getByRole('textbox', { name: /email/i }).fill(process.env.PLAYWRIGHT_USERNAME!);
  await page.getByLabel(/password/i).fill(process.env.PLAYWRIGHT_PASSWORD!);
  await page.getByRole('button', { name: /^continue$/i }).click();

  // Wait for redirect back to the app with auth tokens
  await page.waitForURL(url => url.href.startsWith(APP), { timeout: 60000 });
  await page.waitForFunction(() => !!localStorage.getItem('axd_token'), { timeout: 30000 });

  // --- Screenshot every page (10s wait each) ---
  const pages = [
    ['/', '/tmp/home.png'],
    ['/profile', '/tmp/profile.png'],
    ['/account', '/tmp/account.png'],
    ['/analytics', '/tmp/analytics.png'],
    ['/notifications', '/tmp/notifications.png'],
  ];

  for (const [path, file] of pages) {
    await page.goto(`${APP}${path}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(10000);
    await page.screenshot({ path: file, fullPage: true });
  }

  await browser.close();
})();
```

Run it:

```bash
npx dotenv -e e2e/.env.development -- npx tsx e2e/visual-test.ts
```

If `dotenv-cli` is not installed, run:
```bash
pnpm add -D dotenv-cli tsx
```

Add every page you created to the `pages` array. If any screenshot shows
an error page, fix it and re-run.

Kill the dev server when done.

## Step 5: Review Screenshots for Design Issues

After taking screenshots, **read every screenshot image** and inspect for:

- **Broken layouts** -- elements overlapping, overflowing containers,
  misaligned columns, collapsed sections with zero height
- **Missing content** -- blank pages, empty cards, "Loading..." stuck
  forever, placeholder text not replaced
- **Style problems** -- wrong colors (brand blue is `#0058cc`), unstyled
  raw HTML, missing icons, broken images, invisible text on same-color
  backgrounds
- **Responsive issues** -- horizontal scrollbar, content cut off, elements
  too small or too large
- **SDK component issues** -- components rendering outside their white
  wrapper, no border/rounding on SDK cards, SDK styles breaking page layout
- **Navigation problems** -- navbar not visible, active tab not highlighted
- **Typography** -- text too small, headings same size as body, missing
  spacing between sections

For each issue found, fix it in the code and re-screenshot to verify.
Do NOT present work to the user with visible design problems.

## How to Tell Which App Type

- **Agent app**: has `e2e/` directory with `playwright.config.ts` and
  `auth.setup.ts`, and `package.json` has `test:e2e` script
- **Vanilla Next.js app**: no `e2e/` directory, no `test:e2e` script

## Summary

1. `pnpm build` -- must pass with zero errors
2. `pnpm test` -- vitest must pass
3. Ask the user for test credentials (email + password)
4. Touch test every page -- `pnpm test:e2e` for agent apps, or the
   Playwright login + screenshot script for vanilla apps (10s wait per page)
5. Read every screenshot and fix any design issues
6. Fix any failures before showing work to the user

## Full E2E Reference

For writing custom authenticated journey tests, auth setup, and
multi-browser patterns, see:
https://github.com/iblai/iblai-app-cli/blob/main/skills/testing/iblai-add-test.md

**Brand guidelines**: [BRAND.md](https://github.com/iblai/vibe/blob/main/BRAND.md)
