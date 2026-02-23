import { test as base, createBdd } from 'playwright-bdd';
import { chromium, Browser } from '@playwright/test';
import Kernel from '@onkernel/sdk';
import { createSession, closeSession } from 'openqa';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables from root .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '../../../../.env') });

/**
 * OnKernel Browser Fixtures with Video Recording
 *
 * This setup connects to OnKernel cloud browsers via Chrome DevTools Protocol (CDP)
 * and enables video recording by letting Playwright manage contexts and pages.
 *
 * Architecture:
 * - Overrides only the browser fixture (connects to OnKernel via CDP)
 * - Uses Playwright's default context/page fixtures (enables video recording)
 * - Each test gets a fresh context with video recording enabled
 * - Parallel execution controlled by 'workers' setting in playwright.config.ts
 *
 * Benefits:
 * - Full test isolation (fresh context per test)
 * - Video/screenshot/trace recording functional
 * - Standard Playwright behavior (mirrors examples/playwright-bdd/)
 *
 * Trade-off: Slightly more overhead than reusing contexts, but proper isolation + recording
 */

type KernelBrowserType = { browser: Browser; sessionId: string; kernel: Kernel };

type KernelWorkerFixtures = {
  browser: Browser;
  kernelBrowser: KernelBrowserType;
};

type KernelTestFixtures = {
  openqaSession: string;
};

export const test = base.extend<KernelTestFixtures, KernelWorkerFixtures>({
  openqaSession: async ({}, use) => {
    const session = createSession();
    await use(session);
    await closeSession(session);
  },

  // Override browser to connect to OnKernel cloud browser
  // Scope: 'worker' - one browser per worker, shared across tests
  browser: [async ({}, use) => {
    const kernel = new Kernel();

    console.log('Creating OnKernel browser...');
    const kernelBrowserInstance = await kernel.browsers.create({
      stealth: true,
      headless: false,
      timeout_seconds: 120
    } as any); // 'as any' needed due to SDK type definition mismatch
    console.log(`OnKernel browser created with session ID: ${kernelBrowserInstance.session_id}`);

    // Connect to the kernel browser via CDP
    const browser = await chromium.connectOverCDP(kernelBrowserInstance.cdp_ws_url);
    console.log('Connected to OnKernel browser via CDP');

    await use(browser);

    // Cleanup: close browser connection
    // OnKernel automatically deletes browser sessions after timeout when CDP connection closes
    console.log('Closing browser connection...');
    await browser.close();
    console.log('Browser connection closed');
  }, { scope: 'worker' }],

  // Expose kernel browser info (optional, for debugging)
  kernelBrowser: [async ({ browser }, use) => {
    // Note: We don't have direct access to kernel/sessionId here anymore
    // This is just for compatibility - browser is already connected
    await use({
      browser,
      sessionId: 'unknown', // Would need to refactor to expose this
      kernel: new Kernel(),
    });
  }, { scope: 'worker' }],

  // DON'T override context - let Playwright's default create contexts with recordVideo
  // DON'T override page - let Playwright's default create fresh pages
});

export const { Step: aistep } = createBdd(test);
