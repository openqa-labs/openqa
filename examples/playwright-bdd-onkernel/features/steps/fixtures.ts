import { test as base, createBdd } from 'playwright-bdd';
import { chromium, Browser, BrowserContext, Page } from '@playwright/test';
import Kernel from '@onkernel/sdk';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables from root .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '../../../../.env') });

type KernelFixtures = {
  kernelBrowser: { browser: Browser; sessionId: string; kernel: Kernel };
  context: BrowserContext;
  page: Page;
};

export const test = base.extend<KernelFixtures>({
  // Create and manage the OnKernel browser connection
  kernelBrowser: async ({}, use) => {
    const kernel = new Kernel();

    console.log('Creating OnKernel browser...');
    const kernelBrowserInstance = await kernel.browsers.create({
      headless: true, // Use headless mode for faster execution and lower cost
    });
    console.log(`OnKernel browser created with session ID: ${kernelBrowserInstance.session_id}`);

    // Connect to the kernel browser via CDP
    const browser = await chromium.connectOverCDP(kernelBrowserInstance.cdp_ws_url);
    console.log('Connected to OnKernel browser via CDP');

    await use({
      browser,
      sessionId: kernelBrowserInstance.session_id,
      kernel,
    });

    // Cleanup: close browser connection
    // OnKernel automatically deletes browser sessions after timeout when CDP connection closes
    console.log('Closing browser connection...');
    await browser.close();
    console.log('Browser connection closed');
  },

  // Override context to use the kernel browser's existing context
  context: async ({ kernelBrowser }, use) => {
    const { browser } = kernelBrowser;
    // OnKernel browsers launch with a default context - use it if available
    const context = browser.contexts()[0] || await browser.newContext();
    await use(context);
  },

  // Override page to use the kernel browser's existing page
  page: async ({ context }, use) => {
    // OnKernel browsers launch with a default page - use it if available
    const page = context.pages()[0] || await context.newPage();
    await use(page);
  },
});

export const { Step: aistep } = createBdd(test);
