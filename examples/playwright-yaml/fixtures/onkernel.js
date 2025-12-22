import { test as base } from '@playwright/test';
import { chromium } from '@playwright/test';
import Kernel from '@onkernel/sdk';
import { config } from 'dotenv';

// Load environment variables
config({ path: '../../.env' });

/**
 * OnKernel Cloud Browser Fixture
 * Connects to OnKernel cloud browsers via CDP
 *
 * Usage in YAML:
 * ```yaml
 * name: My Tests
 * fixtureFile: ../fixtures/onkernel.js
 *
 * tests:
 *   - name: Test with cloud browser
 *     steps:
 *       - Navigate to https://example.com
 * ```
 */
export const test = base.extend({
  browser: [async ({}, use) => {
    const kernel = new Kernel();

    console.log('Creating OnKernel browser...');
    const kernelBrowserInstance = await kernel.browsers.create({
      stealth: true,
      headless: false,
      timeout_seconds: 120
    });
    console.log(`OnKernel browser created: ${kernelBrowserInstance.session_id}`);

    const browser = await chromium.connectOverCDP(kernelBrowserInstance.cdp_ws_url);
    console.log('Connected to OnKernel browser via CDP');

    await use(browser);

    console.log('Closing browser connection...');
    await browser.close();
    console.log('Browser closed');
  }, { scope: 'worker' }],
});
