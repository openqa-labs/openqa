import 'dotenv/config';
import { defineConfig } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

const testDir = defineBddConfig({
  features: 'features/*.feature',
  steps: 'features/steps/*.ts',
});

export default defineConfig({
  testDir,
  timeout: 240000, // 4 minutes for AI agent processing
  fullyParallel: true,
  reporter: [['html', { open: 'never' }]],
  use: {
    headless: process.env.HEADLESS !== 'false',
    baseURL: process.env.BASE_URL,
    screenshot: 'on',
    trace: 'on',
    video: 'on',
  },
  projects: [
    {
      name: 'chromium',
      use: {},
    },
  ],
});
