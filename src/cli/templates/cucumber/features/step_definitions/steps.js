import { Before, After, defineStep, setDefaultTimeout } from '@cucumber/cucumber';
import { chromium, Browser, BrowserContext, Page } from '@playwright/test';
import { runAgent, claudeCode } from 'openqa';

setDefaultTimeout(240000); // 4 minutes

let browser: Browser;
let context: BrowserContext;
let page: Page;

Before(async function () {
  const headless = process.env.HEADLESS !== 'false';
  browser = await chromium.launch({ headless });
  context = await browser.newContext();
  page = await context.newPage();
});

After(async function () {
  await page.close();
  await context.close();
  await browser.close();
});

// Generic AI step - handles ALL Given/When/Then steps with natural language
defineStep(/^(.*)$/, async function (action) {
  await runAgent(claudeCode('claude-haiku-4-5'), action, context, { verbose: true });
});
