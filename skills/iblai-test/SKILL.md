---
name: iblai-test
description: Test your app before showing to the user
globs:
alwaysApply: false
---

# /iblai-test

> **AI Assistant:** You MUST run these checks before presenting any work to
> the user. Do NOT show untested code.

## Step 1: Build

Run the production build to catch TypeScript errors, missing imports, and
config issues:

```bash
npm run build    # or: pnpm build
```

Fix all errors. A failed build means broken code -- do not proceed until
the build passes cleanly.

## Step 2: Touch Test Pages

### If this is an agent app (from `iblai startapp agent`)

The app already has a full Playwright E2E suite in `e2e/`. Use it:

```bash
pnpm test:e2e
```

This runs auth setup + journey tests across Chromium, Firefox, and WebKit.
Configure credentials in `e2e/.env.development` first.

For a single browser:

```bash
npx playwright test --config e2e/playwright.config.ts --project=chromium
```

### If this is a vanilla Next.js app

Install Playwright and a browser:

```bash
npm install -D @playwright/test
npx playwright install --with-deps chromium
```

`--with-deps` installs the browser binary AND system libraries (libatk,
libcups, etc.). Without it the browser may fail to launch on Linux/CI.

For system deps only: `npx playwright install-deps`
For browser binaries only: `npx playwright install`

Start the dev server:

```bash
npm run dev &
```

Wait for http://localhost:3000 to be ready, then screenshot every page
you built:

```bash
npx playwright screenshot http://localhost:3000 /tmp/home.png
npx playwright screenshot http://localhost:3000/sso-login-complete /tmp/sso.png
```

Add every page you created:

```bash
npx playwright screenshot http://localhost:3000/profile /tmp/profile.png
npx playwright screenshot http://localhost:3000/account /tmp/account.png
npx playwright screenshot http://localhost:3000/analytics /tmp/analytics.png
npx playwright screenshot http://localhost:3000/notifications /tmp/notifications.png
```

If any command fails, the page has a render error. Fix it and re-run.

Kill the dev server when done.

## How to Tell Which App Type

- **Agent app**: has `e2e/` directory with `playwright.config.ts` and
  `auth.setup.ts`, and `package.json` has `test:e2e` script
- **Vanilla Next.js app**: no `e2e/` directory, no `test:e2e` script

## Summary

1. `npm run build` (or `pnpm build`) -- must pass with zero errors
2. Touch test every page -- `pnpm test:e2e` for agent apps, or
   `npx playwright screenshot` for vanilla apps
3. Fix any failures before showing work to the user

## Full E2E Reference

For writing custom authenticated journey tests, auth setup, and
multi-browser patterns, see:
https://github.com/iblai/iblai-app-cli/blob/main/skills/testing/iblai-add-test.md
