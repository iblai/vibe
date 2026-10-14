# Playwright setup for an app that is not vibe-starter

vibe-starter ships its own `e2e/` (config, real-SSO `auth.setup.ts`, journeys,
`COVERAGE.md`). For any other app, drop these three files in.

### `e2e/playwright.config.ts`

```typescript
import { defineConfig, devices } from '@playwright/test'
import dotenv from 'dotenv'
import path from 'path'

const root = path.resolve(__dirname, '..')
dotenv.config({ path: path.join(root, '.env.local'), override: true })
dotenv.config({ path: path.join(root, '.env') })

// Honour Next's basePath so spec files can use bare paths.
const rawBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ''
const basePath = rawBasePath
  ? (rawBasePath.startsWith('/') ? rawBasePath : `/${rawBasePath}`)
  : ''
const origin = process.env.E2E_BASE_URL || 'http://localhost:3000'

export default defineConfig({
  testDir: './journeys',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 4,
  timeout: 60_000,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: `${origin}${basePath}`,
    headless: true,
    trace: 'retain-on-failure',
    screenshot: process.env.CI ? 'only-on-failure' : 'off',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
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

### `e2e/utils/seed-auth.ts`

For most journeys you don't need real SSO — stub the localStorage shape
that `<TenantProvider>` + `useUrlContext` expect:

```typescript
import type { Page } from '@playwright/test'

export interface SeedAuthOptions {
  tenantKey?: string
  username?: string
  expiresAt?: string  // future-dated so token-validity checks pass
}

export async function seedAuth(page: Page, opts: SeedAuthOptions = {}) {
  const tenantKey = opts.tenantKey ?? 'main'
  const username  = opts.username  ?? 'tester'
  const expiresAt = opts.expiresAt ?? '2099-01-01T00:00:00.000Z'

  await page.addInitScript(({ tenantKey, username, expiresAt }) => {
    const tenant = {
      user_id: 1, username, email: `${username}@example.com`,
      user_active: true, key: tenantKey, org: tenantKey,
      platform_name: 'Test', is_admin: true, is_staff: true, active: true,
    }
    localStorage.setItem('tenant', tenantKey)              // raw key string
    localStorage.setItem('current_tenant', JSON.stringify(tenant)) // full object
    localStorage.setItem('tenants', JSON.stringify([tenant]))
    localStorage.setItem('userData', JSON.stringify({
      user_id: 1, user_nicename: username, username,
      email: `${username}@example.com`,
    }))
    localStorage.setItem('axd_token', 'stub-axd-token')
    localStorage.setItem('axd_token_expires', expiresAt)
    localStorage.setItem('dm_token', 'stub-dm-token')
    localStorage.setItem('dm_token_expires', expiresAt)
  }, { tenantKey, username, expiresAt })
}
```

For journeys that need real backend data, use a real-SSO setup file
instead — see [references/real-sso-auth-setup.md](real-sso-auth-setup.md).

### `package.json` script

```json
{
  "scripts": {
    "test:e2e": "playwright test --config=e2e/playwright.config.ts"
  }
}
```
