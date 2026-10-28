import { test, expect, type Page } from "@playwright/test";

/**
 * House journeys — the first-run paths of an ibl.ai official app
 * (/iblai-vibe-house-journeys): a user whose only organization is the
 * community one (H1–H2), a visitor on an organization they do not belong to
 * (H3–H4), an admin's first run (H5–H6) and a member's (H7–H8).
 * Organization-wide state is served with page.route and never written; the
 * accounts' own metadata writes are answered by the route, so they stay fresh.
 * Signed in through auth.setup.ts; the member tests skip until
 * `pnpm e2e:accounts` has created the member account.
 */
const appHost = process.env.APP_HOST || "http://localhost:3000";
const MAIN = process.env.NEXT_PUBLIC_MAIN_TENANT_KEY || "main";
const stamp = Date.now().toString(36);
const noMember = !process.env.PLAYWRIGHT_MEMBER_USERNAME || !process.env.PLAYWRIGHT_MEMBER_PASSWORD;
const NO_MEMBER = "no member account in e2e/.env.development (PLAYWRIGHT_MEMBER_*): pnpm e2e:accounts creates one";

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const home = (org: string) => new RegExp(`/platform/${esc(org)}/?(\\?|#|$)`);
const onboarding = (org: string) => new RegExp(`/platform/${esc(org)}/onboarding(/|\\?|#|$)`);

/** The organization the session lands on: the segment after /platform/. */
async function landedOrg(page: Page): Promise<string> {
  await page.goto(`${appHost}/`);
  await page.waitForURL(/\/platform\/[^/?#]+/, { timeout: 30_000 });
  return decodeURIComponent(new URL(page.url()).pathname.split("/")[2]);
}

const memberState = async ({ browserName }: { browserName: string }, use: (state: string) => Promise<void>) => {
  await use(`playwright/.auth/member-${browserName}.json`);
};

test.describe("a user whose only organization is the community one", () => {
  test.skip(noMember, NO_MEMBER);
  test.use({ storageState: memberState });
  // The member account's session, told it belongs to the community organization
  // only — in storage and by the platform's membership list, which the SDK
  // re-reads on every load.
  test.beforeEach(async ({ page }) => {
    const entry = { key: MAIN, org: MAIN, platform_name: "ibl.ai", is_admin: false, show_paywall: true };
    await page.route(/\/api\/ibl\/users\/manage\/platform\//, (route) => route.fulfill({ json: [entry] }));
    await page.addInitScript((only: typeof entry) => {
      localStorage.setItem("tenants", JSON.stringify([only]));
      localStorage.setItem("tenant", only.key);
      localStorage.setItem("current_tenant", JSON.stringify(only));
      localStorage.setItem("app_tenant", only.key);
    }, entry);
  });

  test("H1 · lands on the community organization inside the shell, with the admin cluster shown", async ({ page }) => {
    await page.goto(`${appHost}/`);
    await expect(page).toHaveURL(home(MAIN), { timeout: 30_000 });
    await expect(page.getByRole("button", { name: "Management" })).toBeVisible({ timeout: 30_000 });
  });

  test("H2 · a trial-gated click opens the SDK upgrade dialog, and Escape closes it", async ({ page }) => {
    await page.goto(`${appHost}/platform/${encodeURIComponent(MAIN)}`);
    await page.getByRole("button", { name: "Management" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Upgrade for free", { timeout: 15_000 });
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  });
});

test.describe("a visitor on an organization they do not belong to", () => {
  test.skip(noMember, NO_MEMBER);
  test.use({ storageState: memberState });
  const stranger = `e2e-nowhere-${stamp}`;

  test("H3 · the organization is previewed, and Join goes to the auth page's join for it", async ({ page }) => {
    let joinUrl = "";
    await page.route(/\/join\?tenant=/, (route) => {
      joinUrl = route.request().url();
      return route.fulfill({ status: 204, body: "" });
    });
    await page.goto(`${appHost}/platform/${stranger}`);
    const preview = page.getByTestId("organization-preview");
    await expect(preview).toBeVisible({ timeout: 30_000 });
    await expect(preview).toContainText(stranger);
    await preview.getByRole("button", { name: `Join ${stranger}` }).click();
    await expect.poll(() => joinUrl).toContain(`tenant=${stranger}`);
    expect(new URL(joinUrl).searchParams.get("redirect-to")).toContain(`/platform/${stranger}`);
  });

  test("H4 · Create your own organization is ibl.ai's $0 sign-up with this app nested in the return address", async ({
    page,
  }) => {
    let checkout = "";
    await page.route(/credits-free-plan/, (route) => {
      checkout = route.request().url();
      return route.fulfill({ status: 204, body: "" });
    });
    await page.goto(`${appHost}/platform/${stranger}`);
    await page
      .getByTestId("organization-preview")
      .getByRole("button", { name: "Create your own organization" })
      .click();
    await expect.poll(() => checkout).toContain("/api/service/stripe/checkout/redirect/credits-free-plan/");
    const back = new URL(checkout).searchParams.get("redirect_url") ?? "";
    expect(new URL(back).searchParams.get("redirect-to")).toBe(appHost);
  });
});

test.describe("an admin's first run", () => {
  test("H5 · an admin who has not finished the setup flow is sent to it once: organization, sector, team, done", async ({
    page,
  }) => {
    await page.addInitScript(() => sessionStorage.removeItem("house_setup_sent"));
    await page.route(/\/api\/core\/users\/platform-metadata\//, (route) => {
      const done = { username: "", platform_key: "", metadata: { onboarding: { completed: true } } };
      if (route.request().method() === "GET") {
        return route.fulfill({ json: { username: "", platform_key: "", metadata: {} } });
      }
      return route.fulfill({ json: done });
    });
    const org = await landedOrg(page);
    await expect(page).toHaveURL(onboarding(org), { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: /^Welcome to/ })).toBeVisible({ timeout: 30_000 });
    await page.getByLabel("Organization name").fill("E2E School");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("radio", { name: "Higher Education" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Invite your team")).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByTestId("onboarding-final-step")).toContainText("all set", { timeout: 15_000 });
    await page.getByRole("button", { name: "Complete" }).click();
    await expect(page).toHaveURL(home(org), { timeout: 30_000 });
  });

  test("H6 · an admin who finished it stays home", async ({ page }) => {
    await page.addInitScript(() => sessionStorage.removeItem("house_setup_sent"));
    await page.route(/\/api\/core\/users\/platform-metadata\//, (route) =>
      route.request().method() === "GET"
        ? route.fulfill({ json: { username: "", platform_key: "", metadata: { onboarding: { completed: true } } } })
        : route.continue(),
    );
    const org = await landedOrg(page);
    await expect(page).toHaveURL(home(org), { timeout: 30_000 });
    await expect(page.locator("main")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId("onboarding-page")).toHaveCount(0);
  });
});

test.describe("a member's first run", () => {
  test.skip(noMember, NO_MEMBER);
  test.use({ storageState: memberState });

  test("H7 · a member is sent to the organization's form, answers it, sees the final step and lands home", async ({
    page,
  }) => {
    const form = {
      version: 1,
      enabled: true,
      title: "Welcome",
      sections: [
        { key: "about", title: "About you", fields: [{ key: "role", type: "text", label: "Your role", required: true }] },
      ],
      agents: [],
    };
    // The organization's metadata, with the form added on every read and the
    // member's answers kept once written — nothing reaches the platform.
    let written: Record<string, unknown> = {};
    await page.route(/\/api\/core\/orgs\/[^/]+\/metadata\//, async (route) => {
      const req = route.request();
      if (req.method() === "GET") {
        const res = await route.fetch();
        const body = (await res.json()) as { metadata?: Record<string, unknown> };
        return route.fulfill({
          response: res,
          json: { ...body, metadata: { ...body.metadata, ...written, user_onboarding_form: form } },
        });
      }
      const sent = req.postDataJSON() as { metadata?: Record<string, unknown> } | null;
      written = sent?.metadata ?? sent ?? {};
      return route.fulfill({ json: { metadata: written } });
    });
    const org = await landedOrg(page);
    await expect(page).toHaveURL(onboarding(org), { timeout: 30_000 });
    await page.getByLabel("Your role").fill("Student");
    await page.getByRole("button", { name: /^(Submit|Continue)$/ }).click();
    await expect(page.getByTestId("onboarding-final-step")).toContainText("all set", { timeout: 15_000 });
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(home(org), { timeout: 30_000 });
  });

  test("H8 · with nothing configured, /onboarding says so and Continue goes home", async ({ page }) => {
    const org = await landedOrg(page);
    await page.goto(`${appHost}/platform/${encodeURIComponent(org)}/onboarding`);
    const empty = page.getByTestId("user-onboarding-empty");
    await expect(empty).toBeVisible({ timeout: 30_000 });
    await empty.getByRole("button").click();
    await expect(page).toHaveURL(home(org), { timeout: 30_000 });
  });
});
