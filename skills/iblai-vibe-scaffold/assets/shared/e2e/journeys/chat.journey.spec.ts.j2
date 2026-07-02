import { test, expect } from '@playwright/test';

/**
 * Chat journey — verifies the ChatWidget (mentor-ai) renders correctly.
 *
 * Requires auth.setup.ts to have run first (via the "setup" dependency).
 */
test.describe('chat journey', () => {
  test('ChatWidget renders the mentor-ai web component', async ({ page }) => {
    const appHost = process.env.APP_HOST || 'http://localhost:3000';

    await page.goto(appHost);

    // Wait for the page to load and the ChatWidget to dynamically import
    // @iblai/iblai-web-mentor and register the <mentor-ai> element
    const chatWidget = page.locator('mentor-ai');
    await expect(chatWidget).toBeVisible({ timeout: 30_000 });

    // Verify the web component has the expected attributes
    await expect(chatWidget).toHaveAttribute('authrelyonhost', 'true');
    await expect(chatWidget).toHaveAttribute('extraparams', 'hide-navbar=1');
  });

  test('mentor-ai iframe loads', async ({ page }) => {
    const appHost = process.env.APP_HOST || 'http://localhost:3000';

    await page.goto(appHost);

    // Wait for the mentor-ai element
    await page.waitForSelector('mentor-ai', { timeout: 30_000 });

    // The web component creates an iframe inside its shadow DOM
    const iframe = await page.evaluateHandle(() => {
      const mentorEl = document.querySelector('mentor-ai');
      return mentorEl?.shadowRoot?.querySelector('iframe') ?? null;
    });

    expect(iframe).not.toBeNull();
  });
});
