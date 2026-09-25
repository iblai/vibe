import { defineConfig, devices } from '@playwright/test';

// Boot smoke config — no auth, no storage state (unlike the starter's journey
// config). Playwright's webServer boots `next start` against the pre-built app
// and tears it down; the spec asserts the app mounts without render-breaking
// errors. Copied into the scratch app by scripts/test-skills-boot.mjs.
const PORT = process.env.SMOKE_PORT || '3999';
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: '.',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  timeout: 60_000,
  use: { baseURL, trace: 'off', screenshot: 'only-on-failure' },
  webServer: {
    command: `pnpm start -p ${PORT}`,
    url: baseURL,
    timeout: 120_000,
    reuseExistingServer: false,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
