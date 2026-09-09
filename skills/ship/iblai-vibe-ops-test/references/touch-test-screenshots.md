# Touch Test + Screenshot Review

Final manual pass before showing work to the user. Even with 95%
unit + e2e coverage, look at the running app — automated tests
don't catch broken layouts, missing icons, or invisible text.

Even with 95% unit + e2e coverage, you should still look at the running
app before declaring done.

### Get credentials

Ask the user for their ibl.ai login (email + password). Store them in
`e2e/.env.development`:

```
PLAYWRIGHT_USERNAME=user@example.com
PLAYWRIGHT_PASSWORD=their-password
```

If they decline, only screenshot unauthenticated pages (home, SSO
callback, public landing).

### Run the screenshot script

```typescript
// e2e/visual-test.ts
import { chromium } from '@playwright/test'

const APP  = 'http://localhost:3000'
const AUTH = 'https://login.iblai.app'

;(async () => {
  const browser = await chromium.launch()
  const ctx     = await browser.newContext()
  const page    = await ctx.newPage()

  await page.goto(APP, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  await page.waitForURL(u => u.href.includes('/login'), { timeout: 60_000 })

  await page.getByRole('button', { name: /continue with password/i }).click()
  await page.getByRole('textbox', { name: /email/i }).fill(process.env.PLAYWRIGHT_USERNAME!)
  await page.getByLabel(/password/i).fill(process.env.PLAYWRIGHT_PASSWORD!)
  await page.getByRole('button', { name: /^continue$/i }).click()

  await page.waitForURL(u => u.href.startsWith(APP), { timeout: 60_000 })
  await page.waitForFunction(() => !!localStorage.getItem('axd_token'), { timeout: 30_000 })

  const pages: Array<[string, string]> = [
    ['/',              '/tmp/home.png'],
    ['/profile',       '/tmp/profile.png'],
    ['/account',       '/tmp/account.png'],
    ['/analytics',     '/tmp/analytics.png'],
    ['/notifications', '/tmp/notifications.png'],
  ]

  for (const [path, file] of pages) {
    await page.goto(`${APP}${path}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(10_000)
    await page.screenshot({ path: file, fullPage: true })
  }

  await browser.close()
})()
```

```bash
pnpm dev &
npx dotenv -e e2e/.env.development -- npx tsx e2e/visual-test.ts
```

Add every page you created to `pages`. Kill the dev server when done.

### Review every screenshot

Read each `.png`, look for:

- **Broken layouts** — overlapping elements, overflow, collapsed (0px) sections
- **Missing content** — blank cards, stuck `Loading…`, placeholder text
- **Style problems** — wrong brand color (primary is `#0058cc`), unstyled raw HTML, invisible text
- **Responsive** — horizontal scrollbar, content cut off
- **SDK component issues** — rendering outside their white card wrapper, missing borders/rounding
- **Navigation** — navbar absent, active tab not highlighted
- **Typography** — text too small, headings same size as body

Fix → re-screenshot → re-review. Don't ship visible design problems.
