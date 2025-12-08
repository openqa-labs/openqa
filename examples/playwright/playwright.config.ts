import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Test Configuration
 *
 * Note: This config is for running Playwright tests that use the agent.
 * The agent itself uses Playwright MCP which launches its own browser.
 *
 * Current Limitation:
 * - Playwright test browser context cannot be directly shared with Playwright MCP
 * - The agent creates its own browser instance via MCP server
 * - Tests can use agent commands, but they operate in a separate browser
 */

export default defineConfig({
  testDir: './tests',

  // Run tests in files in parallel
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Reporter to use
  reporter: 'html',

  timeout: 120_000,

  // Shared settings for all the projects below
  use: {
    // Base URL to use in actions like `await page.goto('/')`
    baseURL: 'https://demo.playwright.dev/todomvc/',

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'on',
    fullPage: true,
    video: 'on',
    trace: 'on'
  },

  // Configure projects for major browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Run your local dev server before starting the tests
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://127.0.0.1:3000',
  //   reuseExistingServer: !process.env.CI,
  // },
});
