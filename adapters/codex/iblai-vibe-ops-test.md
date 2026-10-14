# iblai-vibe-ops-test

> Test an ibl.ai Next.js app before showing it or saying done — pnpm build, pnpm test, then a touch test that drives the running app in a real browser (Claude in Chrome or the Chrome DevTools MCP) through every control you added, reads the console and the failed requests, and checks the phone width; the user signs in by hand, never with a password. Also sets up Vitest and Playwright journeys, lifts coverage above 95%, and keeps e2e/COVERAGE.md + coverage.json. Use when the user says "is it done", "show me", "test this", "touch test", "add tests", "write tests", "increase coverage", "set up Vitest", "set up Playwright", or "track e2e coverage". For the deployed URL see /iblai-vibe-ops-deploy.

# /iblai-vibe-ops-test

Two jobs. **Before you say "done"** — every change, a feature or a whole app:
`pnpm build`, `pnpm test`, then the touch test below, which drives the running
app in a real browser. **When the user asks for tests or coverage**: Steps 0–5
set up Vitest and Playwright journeys and lift coverage above 95%.

Never ask for a password. The touch test lets the user sign in by hand in the
browser window; `pnpm test:e2e` signs in with `e2e/.env.development`, which only
the user fills in. Use `pnpm`; fall back to `npm` if it is not installed.

> **Common setup (brand, conventions, env files, verification):** see [docs/skill-setup.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/docs/skill-setup.md).

## Before you say "done"

1. `pnpm build` — zero errors.
2. `pnpm test` — green.
3. The touch test below, on every route the change touched.
4. `pnpm test:e2e` when `e2e/.env.development` is filled in (it reuses the
   running dev server). Never ask for those credentials.

A change with no screen (a script, a server route nothing renders yet) reports
"no screen to touch" in place of step 3. Never say "done", "ready" or
"complete" without the touch-test report.

## Touch test in the browser

Tests prove the code; this proves the screen. Drive the running app in a real
browser, use what you built, read the console. It can fail — when it does, fix
the code and run it again.

1. **Pick the tool** from your tool list (Claude Code may list MCP tools as
   deferred; load them with ToolSearch):
   - `mcp__claude-in-chrome__*` — Claude in Chrome, the user's own signed-in
     Chrome (they started `claude --chrome`, or turned it on under `/chrome`).
   - else `mcp__chrome-devtools__*` — the Chrome DevTools MCP: vibe-starter and
     the scaffold ship it in `.mcp.json`; its Chrome keeps its own profile, so
     the sign-in survives between runs.
   - else `mcp__playwright__*` — the Playwright MCP older scaffolds ship.
   - else **stop** and say: "I can't touch test without a browser tool. Restart
     with `claude --chrome`, or turn on the `chrome-devtools` server (`/mcp`; I
     can add it to `.mcp.json`)." Codex and Cursor entries:
     [references/browser-touch-test.md](references/browser-touch-test.md). No
     screenshot script instead, no password, and never report the touch test as
     run.

   The tool names below are the DevTools MCP's; the others have a matching
   tool — `/mcp` lists Claude in Chrome's. Never guess a name.
2. **One dev server.** `curl -s -o /dev/null -w '%{http_code}' http://localhost:3000`
   prints anything but `000` → a server is up; if it is this app, reuse it.
   Otherwise start `pnpm dev` in the background and wait for `Ready`. Never a
   second one: Next moves to port 3001, which the organization's allowed
   redirect origins may not list.
3. **Open the route.** `list_pages`, then `navigate_page` to
   `http://localhost:3000/<route>`. Landed on the sign-in page? Say "Sign in in
   the browser window I opened, then tell me", and wait. Never type the user's
   credentials. A sign-in that never comes back means `localhost:3000` is not an
   allowed redirect origin — say so. Give the first load a few seconds (one
   re-auth round trip, one service-worker reload) before you navigate on.
4. **Use what you built.** `take_snapshot` — the page as an accessibility tree
   with `uid`s — then every control the change added or touched: tabs, buttons,
   menus, toggles, forms, dialogs. `click`, `fill`, `fill_form`, `press_key` by
   uid, and `take_snapshot` again after each. Expect content (no stuck
   `Loading…`, no empty SDK panel), each control doing what its label says,
   dialogs that open and close, a saved value that survives a reload. Use
   harmless values; ask before deleting data or sending an invite, an email or a
   payment. A combobox's rows (cmdk) do not show in the snapshot — read them
   from a screenshot or with `evaluate_script`.
5. **Read the console and the network.** `list_console_messages` (errors,
   warnings) and `list_network_requests` (4xx, 5xx; `get_network_request` for a
   body). An error the change caused is a failure. Quote URLs and status codes
   only: headers and `localStorage` carry tokens.
6. **Phone width.** `emulate` with viewport `412x915x2,mobile,touch`, reload,
   then `evaluate_script` with
   `() => document.documentElement.scrollWidth <= document.documentElement.clientWidth`
   — it must return `true`. `take_snapshot` to check the controls are still
   reachable, then clear the viewport (`emulate` with `""`). `resize_page` stops
   near 850 px, so it is not a phone. No viewport tool? Report "phone: not
   checked".
7. **Evidence, then the report.** `take_screenshot` of the end state on desktop
   and phone — evidence for the user, not the test; never into the repository.
   Then:

   ```text
   Touch test: /<route> (Chrome DevTools MCP)
   Touched: <control> → <what happened>; …
   Console: clean | <errors>. Network: clean | <url → status>
   Phone 412 px: no sideways scroll | <what overflowed>
   Not touched: <control>, <why>
   ```

Something broke: fix it, run `pnpm build` and `pnpm test` again, touch test
again. After a deploy, run the same on the live URL — `/iblai-vibe-ops-deploy`
says when.

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

vibe-starter ships it: `e2e/playwright.config.ts`, the real sign-in in
`e2e/auth.setup.ts` (it reads `e2e/.env.development`, which the user fills in),
auth, member and admin journeys, and `e2e/COVERAGE.md`; run `pnpm test:e2e`
against a running `pnpm dev`. `playwright/.auth/` holds live tokens: keep
`/playwright/` gitignored and never `git add -A` after a run.

Not from vibe-starter: `pnpm add -D @playwright/test` and
`pnpm exec playwright install chromium`, then take the config, the `seedAuth`
localStorage stub for UI-only journeys and the `test:e2e` script from
[references/playwright-setup.md](references/playwright-setup.md); for journeys
that need real data, [references/real-sso-auth-setup.md](references/real-sso-auth-setup.md).

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

In vibe-starter drop `seedAuth`: journeys inherit the signed-in state from
`auth.setup.ts`. Elsewhere it lives in references/playwright-setup.md.

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

## Common pitfalls

| Symptom | Fix |
|---------|-----|
| `Cannot read properties of undefined (reading 'matches')` | Add `matchMedia` polyfill to setup file (already covered above) |
| Radix dialog crashes in jsdom | Pointer-capture polyfill — already covered above |
| RTK Query hook returns `undefined` in tests | Module-mock the hook: `vi.mock('@iblai/iblai-js/data-layer', () => ({ useFooQuery: () => ({ data: ... }) }))` |
| `next/navigation` errors in hook tests | `vi.mock('next/navigation', () => ({ useParams: () => ({}) }))` |
| Coverage < 95% on `app/**` | Either add an e2e journey for that route OR move the route under the exclude list (it's pure routing glue) |
| Playwright timeouts on first run | `pnpm exec playwright install chromium --with-deps` (Linux needs system libs) |
| Tests pass locally but fail in CI | Set `workers: process.env.CI ? 1 : 4` and `retries: process.env.CI ? 2 : 0` — see references/playwright-setup.md |
| Coverage report missing | Install `@vitest/coverage-v8` (not bundled with vitest) |
| Browser tool says "No page found" | Its Chrome restarted: `list_pages`, then navigate again |
| Sign-in never comes back to the app | The origin (port included) is missing from the organization's allowed redirect origins |

**Brand guidelines**: [BRAND.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/BRAND.md)