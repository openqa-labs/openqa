import { defineStep, Before, After, setDefaultTimeout } from '@cucumber/cucumber';
import { chromium } from 'playwright';
import { runAgent, claudeCode } from 'openqa';

// Set default timeout to 3 minutes for AI agent steps
setDefaultTimeout(180000);

// Browser and context setup
let browser;
let context;
let page;

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
