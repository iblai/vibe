#!/usr/bin/env node
// Capture the vibe-starter screenshot set (docs/screenshots/README.md).
//
//   node scripts/capture-screenshots.mjs --app http://localhost:3000 \
//     --starter skills/start/iblai-vibe-ops-init/assets/vibe-starter
//
// Runs the starter's Playwright auth setup (real SSO, credentials from
// <starter>/e2e/.env.development) to obtain a storage state, then walks the
// routes in Admin and User mode and writes the journey + per-skill PNGs.
// The account must be an org admin for the admin captures; member-only
// accounts still produce the member set.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, copyFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { ROOT, skillDir } from "./lib/skills.mjs";
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(name);
  return i === -1 ? def : args[i + 1];
};
const APP = opt("--app", "http://localhost:3000");
const STARTER = resolve(opt("--starter", "skills/start/iblai-vibe-ops-init/assets/vibe-starter"));
const OUT = join(ROOT, "docs", "screenshots", "journey");
mkdirSync(OUT, { recursive: true });

if (!existsSync(join(STARTER, "e2e", ".env.development"))) {
  console.error(`Missing ${join(STARTER, "e2e/.env.development")} — copy the .example and fill in an admin's credentials.`);
  process.exit(1);
}

// 1. Sign in once via the starter's own setup project (chromium only).
console.log("• signing in via e2e/auth.setup.ts …");
execFileSync("npx", ["playwright", "test", "--config", "e2e/playwright.config.ts", "--project", "setup-chromium"], {
  cwd: STARTER,
  stdio: "inherit",
  env: { ...process.env, APP_HOST: APP },
});
const storageState = join(STARTER, "playwright", ".auth", "user-setup-chromium.json");

// 2. Walk the routes.
const { chromium } = await import(join(STARTER, "node_modules", "playwright", "index.mjs"));
const browser = await chromium.launch();
const context = await browser.newContext({ storageState, viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, colorScheme: "light" });
const page = await context.newPage();

const shot = async (file, path, { wait = "domcontentloaded", settle = 2500, skillCopy } = {}) => {
  await page.goto(`${APP}${path}`, { waitUntil: wait });
  await page.waitForTimeout(settle);
  const target = join(OUT, file);
  await page.screenshot({ path: target, fullPage: false });
  console.log("  wrote", target);
  if (skillCopy) {
    const dest = join(skillDir(skillCopy[0]), skillCopy[1]);
    copyFileSync(target, dest);
    console.log("  copied →", dest);
  }
};

const isAdmin = await (async () => {
  await page.goto(APP, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!localStorage.getItem("tenants"), null, { timeout: 30_000 }).catch(() => {});
  return page.evaluate(() => {
    try {
      const t = JSON.parse(localStorage.getItem("tenants") ?? "[]");
      return !!t.find((x) => x.key === localStorage.getItem("app_tenant"))?.is_admin;
    } catch {
      return false;
    }
  });
})();
console.log(`• signed in as ${isAdmin ? "an org admin" : "a member"}`);

await shot("03-starter-home-chat.png", "/", { settle: 5000, skillCopy: ["iblai-vibe-ops-init", "iblai-vibe-ops-init-1-home.png"] });
await shot("05-starter-agents.png", "/agents", { settle: 4000, skillCopy: ["iblai-vibe-agent-search", "iblai-vibe-agent-search.png"] });
await shot("06-starter-profile-preferences.png", "/profile", { settle: 4000, skillCopy: ["iblai-vibe-user-metadata", "iblai-vibe-user-metadata-1-preferences.png"] });

if (isAdmin) {
  await shot("07-admin-users.png", "/admin/users", { settle: 5000, skillCopy: ["iblai-vibe-admin", "iblai-vibe-admin-3-users.png"] });
  await shot("08-admin-analytics.png", "/admin/analytics", { settle: 6000 });
  await shot("09-admin-organization.png", "/admin/organization", { settle: 4000, skillCopy: ["iblai-vibe-org-metadata", "iblai-vibe-org-metadata-1-settings.png"] });
  await shot("04-starter-setup.png", "/setup?step=agent", { settle: 4000, skillCopy: ["iblai-vibe-agent-create", "iblai-vibe-agent-create-1-dialog.png"] });
  // Admin mode (navbar with the cluster) …
  await shot("02x-admin-mode.png", "/", { settle: 4000, skillCopy: ["iblai-vibe-admin", "iblai-vibe-admin-2-admin-mode.png"] });
  // … then User mode.
  await page.getByRole("switch", { name: /admin mode/i }).click();
  await page.waitForTimeout(1000);
  const target = join(OUT, "10-user-mode.png");
  await page.screenshot({ path: target });
  copyFileSync(target, join(skillDir("iblai-vibe-admin"), "iblai-vibe-admin-1-user-mode.png"));
  console.log("  wrote", target);
}

await browser.close();
console.log("done — review, sanitize (no real emails/keys), compress (<400 KB), then commit.");
