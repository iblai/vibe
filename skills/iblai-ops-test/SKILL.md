---
name: iblai-ops-test
description: When the user wants to add unit tests (Vitest), e2e tests (Playwright), or get test coverage above 95% for their ibl.ai Next.js app. Also use when the user says "add tests," "write tests," "test this," "increase coverage," "set up Vitest," "set up Playwright," "test my app," "track e2e coverage," "add a coverage checklist," or "verify before showing." Maintains `e2e/COVERAGE.md` + `e2e/coverage.json` for checkpoint-tracked e2e coverage and runs the touch-test screenshot pass before showing work. For app-store screenshots, see iblai-marketing-screenshot.
globs:
alwaysApply: false
metadata:
  version: 2.0.0
---

# /iblai-ops-test

Add Vitest unit tests and Playwright e2e journeys to an ibl.ai Next.js
app and lift coverage above 95%. Also run the touch-test screenshot
pass before showing work to the user.

You MUST run `pnpm build`, `pnpm test`, and the e2e suite green before
presenting any work. Do NOT show untested code.

Use `pnpm` as the default package manager. Fall back to `npm` if pnpm is not installed.

## Step 0: Detect what's already there

```bash
# Is vitest installed?
grep -E '"vitest"' package.json && echo "vitest: present" || echo "vitest: missing"

# Is playwright installed?
grep -E '"@playwright/test"' package.json && echo "playwright: present" || echo "playwright: missing"

# Does the app already have a test config?
ls vitest.config.* e2e/playwright.config.* 2>/dev/null
```

Branch from here:
- **Both present** → skip to Step 3 (write tests, not infra).
- **Missing infra** → Step 1 + Step 2 first.

## Step 1: Vitest infrastructure

### Install

```bash
pnpm add -D vitest @vitejs/plugin-react vite-tsconfig-paths jsdom \
  @testing-library/react @testing-library/jest-dom @testing-library/user-event \
  @vitest/coverage-v8
```

`@vitest/coverage-v8` is required for the `--coverage` flag (and for the
95% thresholds we set below).

### `vitest.config.ts`

Drop this in at the project root. The 95% thresholds make CI fail when
coverage regresses; the `exclude` list keeps Next.js-generated files,
config files, and test fixtures out of the denominator.

```typescript
import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  resolve: {
    alias: [
      // Vitest + Node ESM resolution needs the explicit extension for SDK imports.
      { find: 'next/navigation', replacement: 'next/navigation.js' },
      // The SDK can resolve to a pnpm package-local absolute path that bypasses
      // bare-import aliasing. Normalize to the project-level Next entry.
      {
        find: /\/node_modules\/\.pnpm\/@iblai\+web-containers@[^/]+\/node_modules\/next\/navigation$/,
        replacement: new URL(
          './node_modules/next/navigation.js',
          import.meta.url,
        ).pathname,
      },
    ],
  },
  test: {
    globals: true,
    setupFiles: ['./__tests__/vitest.setup.ts'],
    environment: 'jsdom',
    exclude: [...configDefaults.exclude, 'e2e/**'],
    server: { deps: { inline: true } },
    coverage: {
      provider: 'v8',
      include: [
        'app/**/*.{ts,tsx}',
        'components/**/*.{ts,tsx}',
        'hooks/**/*.{ts,tsx}',
        'lib/**/*.{ts,tsx}',
        'providers/**/*.{ts,tsx}',
        'contexts/**/*.{ts,tsx}',
        'actions/**/*.{ts,tsx}',
      ],
      exclude: [
        'node_modules/**', '.next/**', 'dist/**', 'build/**',
        '**/*.d.ts', '**/*.config.*', '**/__tests__/**', '**/__mocks__/**',
        // Next.js plumbing (covered by e2e, not unit)
        'app/**/loading.tsx', 'app/**/error.tsx', 'app/**/not-found.tsx',
        'instrumentation.ts', 'middleware.ts',
        // Tauri shells, generated UI primitives
        'src-tauri/**', 'components/ui/**',
      ],
      thresholds: {
        lines: 95,
        functions: 95,
        branches: 95,
        statements: 95,
      },
    },
  },
})
```

### `__tests__/vitest.setup.ts`

jsdom is missing several APIs that Radix UI, ibl.ai SDK, and
`next/image` depend on. Polyfill them once globally so individual tests
don't have to:

```typescript
import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// Blob URL helpers (file upload tests)
if (typeof URL.createObjectURL === 'undefined') {
  URL.createObjectURL = vi.fn(() => 'blob:mock-url')
}
if (typeof URL.revokeObjectURL === 'undefined') {
  URL.revokeObjectURL = vi.fn()
}

// localStorage mock — class-backed so tests can spy on prototype methods.
class LocalStorageMock implements Storage {
  private store: Record<string, string> = {}
  get length() { return Object.keys(this.store).length }
  clear() { this.store = {} }
  getItem(k: string) { return this.store[k] ?? null }
  key(i: number) { return Object.keys(this.store)[i] ?? null }
  removeItem(k: string) { delete this.store[k] }
  setItem(k: string, v: string) { this.store[k] = v }
}
Object.defineProperty(window, 'localStorage', { value: new LocalStorageMock(), writable: true })

// Radix UI in jsdom requires pointer-capture polyfills.
if (typeof Element.prototype.hasPointerCapture === 'undefined') {
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.setPointerCapture = () => {}
  Element.prototype.releasePointerCapture = () => {}
}

// matchMedia + ResizeObserver stubs (shadcn / Radix primitives).
if (typeof window.matchMedia === 'undefined') {
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: false, media: q, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  }))
}
if (typeof window.ResizeObserver === 'undefined') {
  // @ts-expect-error
  window.ResizeObserver = class { observe(){} unobserve(){} disconnect(){} }
}
```

### `package.json` scripts

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

## Step 2: Playwright infrastructure

### Install

```bash
pnpm add -D @playwright/test
pnpm exec playwright install chromium
```

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
instead — see [references/real-sso-auth-setup.md](references/real-sso-auth-setup.md).

### `package.json` script

```json
{
  "scripts": {
    "test:e2e": "playwright test --config=e2e/playwright.config.ts"
  }
}
```

## Step 3: Write unit tests

**Coverage target: ≥95% lines/functions/branches/statements** on the
`include` paths from `vitest.config.ts`. To hit it, you typically need
tests in five buckets. Examples below — see
[references/test-patterns.md](references/test-patterns.md) for the
expanded recipes.

### 3a. Lib utilities (highest leverage, fastest)

```typescript
// lib/iblai/__tests__/tenant.test.ts
import { afterEach, describe, expect, it } from 'vitest'
import { resolveAppTenant } from '../tenant'

describe('resolveAppTenant', () => {
  afterEach(() => localStorage.clear())

  it('returns "" when localStorage.tenant is unset', () => {
    expect(resolveAppTenant()).toBe('')
  })

  it('returns the raw key string', () => {
    localStorage.setItem('tenant', 'gwu')
    expect(resolveAppTenant()).toBe('gwu')
  })
})
```

### 3b. Hooks (mock `next/navigation` + SDK queries)

```typescript
// lib/iblai/__tests__/use-url-context.test.tsx
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const params = vi.hoisted(() => ({ current: {} as Record<string, string | undefined> }))
vi.mock('next/navigation', () => ({ useParams: () => params.current }))

import { useUrlContext } from '../use-url-context'

describe('useUrlContext', () => {
  afterEach(() => {
    localStorage.clear()
    params.current = {}
  })

  it('prefers URL params over localStorage', async () => {
    localStorage.setItem('tenant', 'fallback')
    params.current = { tenantId: 'from-url', mentorId: 'm1' }
    const { result } = renderHook(() => useUrlContext())
    await waitFor(() => expect(result.current.ready).toBe(true))
    expect(result.current.tenantKey).toBe('from-url')
    expect(result.current.mentorId).toBe('m1')
  })
})
```

### 3c. Components (mock SDK + provider, then assert rendered DOM)

```typescript
// components/__tests__/account-dropdown.test.tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@iblai/iblai-js/data-layer', () => ({
  useGetUserMetadataQuery: () => ({ data: { display_name: 'Jane' } }),
}))
vi.mock('@/lib/iblai/use-url-context', () => ({
  useUrlContext: () => ({ tenantKey: 'gwu', username: 'jane', ready: true }),
}))

import { AccountDropdown } from '@/components/account-dropdown'

describe('AccountDropdown', () => {
  it('shows the user display name', () => {
    render(<AccountDropdown />)
    expect(screen.getByText('Jane')).toBeInTheDocument()
  })
})
```

### 3d. Providers + contexts and 3e. Data definitions

- **Providers/contexts**: mock `<AuthProvider>` and `<TenantProvider>` (they hit network); assert the provider passes the right value to children.
- **Pure data** (e.g. tab-definition arrays): pin the exact shape so a silent reordering or removal trips a test. See [references/test-patterns.md](references/test-patterns.md) for both recipes.

## Step 4: Write e2e journeys

Cover the **golden paths** your app actually has. Each route gets at
least one journey. Example structure:

```
e2e/journeys/
├── 01-home-redirect.spec.ts        # / mounts, redirects work
├── 02-sidebar-navigation.spec.ts   # nav links route correctly
├── 03-explore-agents.spec.ts       # search + click flow
├── 04-edit-mentor-dialog.spec.ts   # dialog open + tab switching
└── 05-analytics-tabs.spec.ts       # every analytics route mounts cleanly
```

### Journey template

```typescript
import { expect, test } from '@playwright/test'
import { seedAuth } from '../utils/seed-auth'

test.describe('Home redirect', () => {
  test('home page mounts without JS error', async ({ page }) => {
    await seedAuth(page)
    const res = await page.goto('/')
    expect(res?.ok()).toBeTruthy()
    // Next.js dev-mode error overlay
    await expect(page.locator('nextjs-portal')).toHaveCount(0)
  })

  test('explore-agents mounts the AgentSearch container', async ({ page }) => {
    await seedAuth(page)
    await page.goto('/explore-agents')
    await expect(page.getByRole('heading', { name: 'Explore Agents' })).toBeVisible({ timeout: 15_000 })
  })
})
```

### What to cover

| Layer | Test |
|-------|------|
| Routing | Every page mounts without the dev error overlay |
| Navigation | Each sidebar / navbar link goes where it should |
| Forms / dialogs | Open → fill → submit happy path; cancel closes; required fields gate submit |
| Authenticated content | At least one journey that drives the real SSO `auth.setup.ts` |
| Edge cases | 404 fallback, empty states ("No workflows yet"), error toasts |

### Track checkpoints in `e2e/COVERAGE.md` + `e2e/coverage.json`

E2E coverage isn't lines — it's **user behaviours**. Maintain two
sibling files in `e2e/`:

- `COVERAGE.md` — journey-by-journey checklist with `[x]` markers (humans)
- `coverage.json` — same checkpoints in JSON, statuses `covered` / `uncovered` / `deprecated` (machines / CI)

Every time you ship a new page, dialog, button, or distinct user flow:
add a checkpoint to the relevant journey, write the spec, flip to
`[x]` + `covered`. Compute `summary.percent = covered / (total - deprecated) * 100`.
Target ≥95% before merging user-facing changes.

**Templates, the JSON shape, and a minimum CI gate that reads
`e2e/coverage.json` and fails when `summary.percent < 95`:**
see [references/e2e-coverage-tracking.md](references/e2e-coverage-tracking.md).

## Step 5: Run coverage + iterate to ≥95%

```bash
pnpm test:coverage
```

`@vitest/coverage-v8` prints a per-file report. Sort low → high and add
tests to whatever's red. Three patterns close coverage gaps fast:

1. **Untested branch in a hook** — add a test that triggers the
   opposite condition (e.g. `username === null` vs set).
2. **Uncovered error handler** — mock the mutation to reject and
   assert `toast.error` was called.
3. **Uncovered conditional render** — pass the prop that toggles it
   and assert the alternate output.

If you can't get past ~90% without testing trivial wrappers, lower the
threshold to 90 temporarily — but flag it so it doesn't quietly stick.

## Step 6: Touch test + screenshot review (before showing the user)

Even with 95% unit + e2e coverage, look at the running app before
declaring done — automated tests don't catch broken layouts, invisible
text, or missing icons.

1. Ask the user for their ibl.ai login (email + password). Put them in
   `e2e/.env.development` (gitignored). If they decline, only
   screenshot unauthenticated pages.
2. Run a Playwright login + screenshot script that hits every page
   with a 10s wait and a `fullPage: true` capture.
3. Read every `.png` for layout breaks, missing content, wrong brand
   color (`#0058cc`), responsive issues, missing icons, etc. Fix in
   code, re-screenshot, re-review.

**Full script, env setup, and the review checklist:**
see [references/touch-test-screenshots.md](references/touch-test-screenshots.md).

## Common pitfalls

| Symptom | Fix |
|---------|-----|
| `Cannot read properties of undefined (reading 'matches')` | Add `matchMedia` polyfill to setup file (already covered above) |
| Radix dialog crashes in jsdom | Pointer-capture polyfill — already covered above |
| RTK Query hook returns `undefined` in tests | Module-mock the hook: `vi.mock('@iblai/iblai-js/data-layer', () => ({ useFooQuery: () => ({ data: ... }) }))` |
| `next/navigation` errors in hook tests | `vi.mock('next/navigation', () => ({ useParams: () => ({}) }))` |
| Coverage < 95% on `app/**` | Either add an e2e journey for that route OR move the route under the exclude list (it's pure routing glue) |
| Playwright timeouts on first run | `pnpm exec playwright install chromium --with-deps` (Linux needs system libs) |
| Tests pass locally but fail in CI | Set `workers: process.env.CI ? 1 : 4` and `retries: process.env.CI ? 2 : 0` — already covered above |
| Coverage report missing | Install `@vitest/coverage-v8` (not bundled with vitest) |

## Summary

1. **Install** vitest + @vitest/coverage-v8 + @testing-library/* + jsdom; install @playwright/test + chromium.
2. **Write configs** — `vitest.config.ts` with 95% thresholds + exclude list; `__tests__/vitest.setup.ts` with the four jsdom polyfills; `e2e/playwright.config.ts` with `baseURL` honouring `NEXT_PUBLIC_BASE_PATH`.
3. **Author unit tests** for lib utilities, hooks, components, providers, and pure data definitions until `pnpm test:coverage` reports ≥95% across all four metrics.
4. **Author e2e journeys** for each route (mounts cleanly, links navigate, dialogs open, golden-path forms submit). Track them as checkpoints in `e2e/COVERAGE.md` + `e2e/coverage.json` — keep `summary.percent` ≥95%.
5. **Run** `pnpm build && pnpm test:coverage && pnpm test:e2e` — all green.
6. **Touch-test** every page with the screenshot script, read each image, fix any visual issues.

**Brand guidelines**: [BRAND.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/BRAND.md)
