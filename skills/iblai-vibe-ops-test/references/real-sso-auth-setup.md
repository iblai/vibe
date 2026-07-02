# Real SSO Auth Setup for Playwright

For e2e journeys that need real backend data (live agent list, real
analytics, etc.), use a Playwright `auth.setup.ts` project that drives
a real SSO flow once and reuses the resulting `storageState` across
tests.

The seedAuth helper in [`SKILL.md`](../SKILL.md) is fine for routing /
UI smoke tests, but anything that hits RTK Query will get 401s without
real tokens.

## File layout

```
e2e/
├── playwright.config.ts
├── playwright/.auth/                 # gitignored — storageState lands here
├── auth.setup.ts                     # drives the SSO login once
├── auth-nonadmin.setup.ts            # optional — second user for RBAC tests
└── journeys/
    └── ...spec.ts
```

Add to `.gitignore`:

```
e2e/playwright/.auth/
```

## `e2e/auth.setup.ts`

```typescript
import { expect, test as setup } from '@playwright/test'

const STORAGE_STATE = 'playwright/.auth/user.json'

setup('authenticate', async ({ page }) => {
  const username = process.env.PLAYWRIGHT_USERNAME
  const password = process.env.PLAYWRIGHT_PASSWORD
  if (!username || !password) {
    throw new Error(
      'PLAYWRIGHT_USERNAME and PLAYWRIGHT_PASSWORD must be set in e2e/.env.development'
    )
  }

  await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30_000 })

  // <AuthProvider> redirects to the SSO SPA when no axd_token is in localStorage.
  await page.waitForURL(u => u.href.includes('/login'), { timeout: 60_000 })

  // The SPA defaults to magic-link; switch to password auth.
  await page.getByRole('button', { name: /continue with password/i }).click()

  await page.getByRole('textbox', { name: /email/i }).fill(username)
  await page.getByLabel(/password/i).fill(password)
  await page.getByRole('button', { name: /^continue$/i }).click()

  // Back at the app with tokens in localStorage.
  await page.waitForURL(u => !u.href.includes('/login'), { timeout: 60_000 })
  await page.waitForFunction(
    () => !!localStorage.getItem('axd_token'),
    { timeout: 30_000 },
  )

  await expect(page.locator('body')).toBeVisible()

  await page.context().storageState({ path: STORAGE_STATE })
})
```

## `playwright.config.ts` — projects

Add a setup project and reference its `storageState` in the test
project:

```typescript
import { defineConfig, devices } from '@playwright/test'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.join(__dirname, '.env.development') })
dotenv.config({ path: path.join(__dirname, '..', '.env.local'), override: true })

export default defineConfig({
  testDir: '.',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 4,
  timeout: 60_000,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: process.env.CI ? 'only-on-failure' : 'off',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium',
      testDir: './journeys',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'pnpm dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
})
```

`dependencies: ['setup']` means the setup project runs first; its
`storageState` file is then attached to every browser context in the
test project — no per-test login.

## `e2e/.env.development`

```
PLAYWRIGHT_USERNAME=admin@example.com
PLAYWRIGHT_PASSWORD=actual-password
```

Add to `.gitignore`:

```
e2e/.env.development
```

## Multi-user (RBAC) testing

For tests that need both an admin and a non-admin user, create a
second setup file:

```typescript
// e2e/auth-nonadmin.setup.ts
import { test as setup } from '@playwright/test'

const STORAGE_STATE = 'playwright/.auth/user-nonadmin.json'

setup('authenticate non-admin', async ({ page }) => {
  // ... same flow as auth.setup.ts but reads
  // PLAYWRIGHT_NONADMIN_USERNAME / PLAYWRIGHT_NONADMIN_PASSWORD ...
  await page.context().storageState({ path: STORAGE_STATE })
})
```

Add a second project that depends on it:

```typescript
{
  name: 'setup-nonadmin',
  testMatch: /auth-nonadmin\.setup\.ts/,
  use: { ...devices['Desktop Chrome'] },
},
{
  name: 'chromium-nonadmin',
  testDir: './journeys-nonadmin',
  use: {
    ...devices['Desktop Chrome'],
    storageState: 'playwright/.auth/user-nonadmin.json',
  },
  dependencies: ['setup-nonadmin'],
},
```

## Refreshing tokens between runs

Stored sessions expire. If your test rig runs for hours, drive the
setup once at the start and on every retry:

```typescript
// In playwright.config.ts → use:
use: {
  storageState: 'playwright/.auth/user.json',
  // Force fresh login if state is older than 30 minutes.
  // (Custom; you'd need to delete the state file in a globalSetup hook.)
},
```

Cheaper alternative: delete `playwright/.auth/` from CI before each run.

## When to NOT use this

If your journeys only assert routing, dialog wiring, or visual
presence (not data-bound), stick with the cheaper `seedAuth` helper
from the main skill. It's faster (no SSO round-trip) and doesn't need
real credentials.
