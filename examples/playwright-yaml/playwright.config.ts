import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './.tests-gen',  // Generated test files
  timeout: 180000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],
  use: {
    screenshot: 'on',
    trace: 'on',
    video: 'on',
    headless: process.env.HEADLESS !== 'false',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
