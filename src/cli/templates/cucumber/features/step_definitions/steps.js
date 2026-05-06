import { Before, After, defineStep, setDefaultTimeout } from '@cucumber/cucumber';
import { chromium } from '@playwright/test';
import { runAgent, claudeCode } from 'openqa';

setDefaultTimeout(240000); // 4 minutes

let browser;
let context;
let page;

const verbose = process.env.OPENQA_VERBOSE !== 'false';

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
  await runAgent(claudeCode('claude-haiku-4-5'), action, context, { verbose });
});
