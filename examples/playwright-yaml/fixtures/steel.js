import { test as base } from '@playwright/test';
import { chromium } from '@playwright/test';

/**
 * Steel Docker Browser Fixture
 * Connects to local Steel browser via CDP
 *
 * Usage in YAML:
 * ```yaml
 * name: My Tests
 * fixtureFile: ../fixtures/steel.js
 *
 * tests:
 *   - name: Test with Steel browser
 *     steps:
 *       - Navigate to https://example.com
 * ```
 *
 * Setup:
 * 1. Run Steel Docker container: docker run -p 3000:3000 steel/browser
 * 2. Set STEEL_CDP_URL environment variable (optional, defaults to ws://localhost:3000)
 */
export const test = base.extend({
  browser: [async ({}, use) => {
    // Append API key if provided
    const apiKey = process.env.STEEL_API_KEY;
    const cdpUrl = apiKey ? `${process.env.STEEL_CDP_URL}?apiKey=${apiKey}` : process.env.STEEL_CDP_URL || 'ws://localhost:3000';

    console.log(`Connecting to Steel browser at ${cdpUrl}...`);

    try {
      const browser = await chromium.connectOverCDP(cdpUrl);
      console.log('Connected to Steel browser');

      await use(browser);

      await browser.close();
      console.log('Browser closed');
    } catch (error) {
      console.error('Failed to connect to Steel browser:', error.message);
      console.error('Make sure Steel is running: docker run -p 3000:3000 steel/browser');
      throw error;
    }
  }, { scope: 'worker' }],
});
