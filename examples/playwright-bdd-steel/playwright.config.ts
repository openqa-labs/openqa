import { defineConfig } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

const testDir = defineBddConfig({
  features: 'features/*.feature',
  steps: 'features/steps/*.ts',
});

export default defineConfig({
  testDir,
  timeout: 240000,
  fullyParallel: true,

  // Control parallel execution: number of workers using the Steel Docker browser
  // workers: 2 = up to 2 tests run in parallel on the same browser instance
  // Steel Docker can handle multiple CDP connections simultaneously
  workers: 2,

  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ['html', { open: 'never' }],
  ],
  use: {
    // Video/trace/screenshot recording enabled and functional
    // Works because we let Playwright create fresh contexts per test
    screenshot: 'on',
    trace: 'on',
    video: 'on',
  },
  // No projects defined - we use Steel Docker browser via CDP connection
});
