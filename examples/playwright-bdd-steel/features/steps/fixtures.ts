import { test as base, createBdd } from 'playwright-bdd';
import { chromium, Browser } from '@playwright/test';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables from root .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '../../../../.env') });

/**
 * Steel Docker Browser Fixtures with Video Recording
 *
 * This setup connects to a local Steel.dev browser running in Docker
 * via Chrome DevTools Protocol (CDP) and enables video recording.
 *
 * Architecture:
 * - Overrides only the browser fixture (connects to Steel Docker via CDP)
 * - Uses Playwright's default context/page fixtures (enables video recording)
 * - Each test gets a fresh context with video recording enabled
 * - Parallel execution controlled by 'workers' setting in playwright.config.ts
 *
 * Prerequisites:
 * - Steel.dev browser running in Docker: docker run -p 3000:3000 -p 9223:9223 ghcr.io/steel-dev/steel-browser:latest
 * - UI available at http://localhost:3001/ui (or 3000/ui depending on setup)
 * - Chrome debugging port at ws://localhost:9223
 *
 * Benefits:
 * - Full test isolation (fresh context per test)
 * - Video/screenshot/trace recording functional
 * - Standard Playwright behavior (mirrors examples/playwright-bdd/)
 * - No SDK dependencies needed (direct CDP connection)
 */

type SteelWorkerFixtures = {
  browser: Browser;
};

export const test = base.extend<{}, SteelWorkerFixtures>({
  // Override browser to connect to Steel Docker browser
  // Scope: 'worker' - one browser connection per worker, shared across tests
  browser: [async ({}, use) => {
    // Get CDP URL from environment or use default
    const cdpUrl = process.env.STEEL_CDP_URL || 'ws://localhost:3000';

    console.log(`Connecting to Steel Docker browser at ${cdpUrl}...`);

    try {
      // Connect to the Steel Docker browser via CDP
      const browser = await chromium.connectOverCDP(cdpUrl);
      console.log('Connected to Steel Docker browser via CDP');

      await use(browser);

      // Cleanup: close browser connection
      console.log('Closing browser connection...');
      await browser.close();
      console.log('Browser connection closed');
    } catch (error) {
      console.error('Failed to connect to Steel Docker browser:', error);
      console.error(`Make sure Steel Docker is running: docker run -p 3000:3000 -p 9223:9223 ghcr.io/steel-dev/steel-browser:latest`);
      throw error;
    }
  }, { scope: 'worker' }],

  // DON'T override context - let Playwright's default create contexts with recordVideo
  // DON'T override page - let Playwright's default create fresh pages
});

export const { Step: aistep } = createBdd(test);
