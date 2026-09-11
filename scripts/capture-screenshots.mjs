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
// `playwright` is only a transitive dependency of `@playwright/test`, and pnpm's
// isolated linker never symlinks transitives into the root — import the direct
// dependency, which re-exports the same browser entry points.
const { chromium } = await import(join(STARTER, "node_modules", "@playwright", "test", "index.mjs"));
const browser = await chromium.launch();
const context = await browser.newContext({ storageState, viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, colorScheme: "light" });
const page = await context.newPage();

/** Shots that came out wrong. Reported together at the end; the run exits non-zero. */
const problems = [];

/** Does this text render somewhere OUTSIDE the composer, i.e. as a real bubble? */
const bubbleExists = (t) => {
  const form = document.querySelector("#chat-input-textarea")?.closest("form");
  return [...document.querySelectorAll("div,p,span")].some((e) => e.textContent?.trim() === t && !form?.contains(e));
};

/**
 * Send one message so the home shot shows a conversation rather than an empty
 * composer — its caption promises "chatting with your agent".
 *
 * Two traps, both learned the hard way: locator.fill() sets the DOM value
 * without notifying React, so `inputValue` stays empty and the send button
 * stays disabled; and Enter does not submit this composer. Type real keys and
 * click the button.
 */
const seedChat = async (text) => {
  const box = page.locator("#chat-input-textarea");
  const send = page.getByRole("button", { name: /send message/i });
  if ((await box.count()) === 0) {
    problems.push("03-starter-home-chat: no chat composer on / — is a default agent configured?");
    return;
  }
  await box.click();
  await box.pressSequentially(text, { delay: 15 });
  if (await send.isDisabled()) {
    problems.push("03-starter-home-chat: the send button stayed disabled — the message was never sent");
    return;
  }
  await send.click();
  try {
    await page.waitForFunction(bubbleExists, text, { timeout: 25_000 });
  } catch {
    problems.push("03-starter-home-chat: the message never rendered as a bubble — the hero shows an empty chat");
    return;
  }
  // Wait for the reply to FINISH. Neither a fixed sleep nor "the transcript
  // stopped growing" works: both happily pass while the agent sits on its
  // "Just a sec…" placeholder. The composer swaps Send for "Stop streaming"
  // while generating, and the per-message actions only mount once a reply is
  // complete — so "Copy to Clipboard" is the positive done signal.
  const done = await page
    .getByRole("button", { name: /copy to clipboard/i })
    .first()
    .waitFor({ state: "visible", timeout: 90_000 })
    .then(() => true)
    .catch(() => false);
  if (!done) {
    problems.push("03-starter-home-chat: the agent never finished replying — the hero is stuck mid-response");
    return;
  }
  await page.waitForTimeout(5000); // the guided follow-up prompts mount last
};

/** Scroll the innermost real scroller to its bottom (the page's own, not <main>). */
const scrollToBottom = () =>
  page.evaluate(() => {
    const s = [...document.querySelectorAll("*")].find(
      (e) => e.scrollHeight > e.clientHeight + 20 && /auto|scroll/.test(getComputedStyle(e).overflowY),
    );
    if (s) s.scrollTop = s.scrollHeight;
    return !!s;
  });

const shot = async (file, path, { wait = "domcontentloaded", settle = 2500, skillCopy, scrollTo, scrollBottom, waitFor, before } = {}) => {
  await page.goto(`${APP}${path}`, { waitUntil: wait });
  await page.waitForTimeout(settle);
  // SDK panels fetch their own data; without a real wait the shot catches an
  // empty shell that still looks plausible.
  if (waitFor) {
    try {
      await page.locator(waitFor).first().waitFor({ state: "visible", timeout: 30_000 });
    } catch {
      problems.push(`${file}: "${waitFor}" never appeared — the panel is probably empty in this shot`);
    }
  }
  if (before) await before();
  // Several routes stack a self-scrolling SDK panel above the starter's own
  // card, so a viewport shot frames the panel and misses the card entirely.
  // scrollIntoViewIfNeeded scrolls minimally and leaves the card clipped at the
  // bottom edge — centre it instead.
  if (scrollTo) {
    const centred = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      el.scrollIntoView({ block: "center", behavior: "instant" });
      return true;
    }, scrollTo);
    if (!centred) problems.push(`${file}: "${scrollTo}" not found — the framing is wrong`);
    await page.waitForTimeout(1200);
  }
  // Where the card is the last thing on a page with nested scrollers,
  // scrollIntoView leaves it clipped at the bottom edge — go to the end instead.
  if (scrollBottom) {
    if (!(await scrollToBottom())) problems.push(`${file}: nothing scrollable — the framing may be wrong`);
    await page.waitForTimeout(1200);
  }
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
  // The app does a one-time re-auth round trip through the auth SPA a few
  // seconds after first load, and the service worker takes control and reloads.
  // Capture before both have settled and /admin/* bounces back to / mid-shot.
  console.log("• letting the first-load re-auth and service worker settle …");
  await page.waitForTimeout(20_000);
  // Fail loudly: a swallowed timeout here reports "a member" and silently skips
  // six of the nine captures, which reads as a successful run.
  await page.waitForFunction(() => !!localStorage.getItem("tenants"), null, { timeout: 30_000 }).catch(() => {
    throw new Error(
      "`tenants` never appeared in localStorage — the session did not finish loading.\n" +
        "  Fix that before capturing; otherwise every admin shot is skipped without an error.",
    );
  });
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

await shot("03-starter-home-chat.png", "/", {
  settle: 5000,
  waitFor: "#chat-input-textarea",
  before: () => seedChat("What can you help me with?"),
  skillCopy: ["iblai-vibe-ops-init", "iblai-vibe-ops-init-1-home.png"],
});
await shot("05-starter-agents.png", "/agents", { settle: 6000, skillCopy: ["iblai-vibe-agent-search", "iblai-vibe-agent-search.png"] });
// The App preferences card sits below the SDK <Profile> panel; frame the card.
await shot("06-starter-profile-preferences.png", "/profile", {
  settle: 5000,
  waitFor: "text=App preferences",
  scrollBottom: true,
  skillCopy: ["iblai-vibe-user-metadata", "iblai-vibe-user-metadata-1-preferences.png"],
});

if (isAdmin) {
  // The member list must actually render; the panel header alone is not the shot.
  await shot("07-admin-users.png", "/admin/users", {
    settle: 8000,
    waitFor: "table, [role='table'], [role='tablist']",
    skillCopy: ["iblai-vibe-admin", "iblai-vibe-admin-3-users.png"],
  });
  await shot("08-admin-analytics.png", "/admin/analytics", { settle: 6000 });
  // The App settings form sits below the SDK <Account> panel; frame the form.
  await shot("09-admin-organization.png", "/admin/organization", {
    settle: 5000,
    waitFor: "#support-url",
    scrollTo: "#support-url",
    skillCopy: ["iblai-vibe-org-metadata", "iblai-vibe-org-metadata-1-settings.png"],
  });
  await shot("04-starter-setup.png", "/setup?step=agent", {
    settle: 5000,
    waitFor: "#agent-name, fieldset",
    skillCopy: ["iblai-vibe-agent-create", "iblai-vibe-agent-create-1-dialog.png"],
  });
  // Admin mode (navbar with the cluster) …
  await shot("02x-admin-mode.png", "/", { settle: 5000, waitFor: "#chat-input-textarea", skillCopy: ["iblai-vibe-admin", "iblai-vibe-admin-2-admin-mode.png"] });
  // … then User mode.
  await page.getByRole("switch", { name: /admin mode/i }).click();
  await page.waitForTimeout(1000);
  const target = join(OUT, "10-user-mode.png");
  await page.screenshot({ path: target });
  copyFileSync(target, join(skillDir("iblai-vibe-admin"), "iblai-vibe-admin-1-user-mode.png"));
  console.log("  wrote", target);
}

await browser.close();

if (problems.length) {
  console.error(`\n✗ ${problems.length} shot(s) came out wrong — do NOT commit these:`);
  for (const p of problems) console.error("   -", p);
  console.error("\nFix the cause and re-run; a bad screenshot looks plausible enough to ship by accident.");
  process.exit(1);
}
console.log("done — review, sanitize (no real emails/keys), compress (<400 KB), then commit.");
