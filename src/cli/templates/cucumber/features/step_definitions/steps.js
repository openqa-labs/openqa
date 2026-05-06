import { Before, After, defineStep, setDefaultTimeout } from '@cucumber/cucumber';
import { chromium } from '@playwright/test';
import { runAgent, claudeCode } from 'openqa';

setDefaultTimeout(240000); // 4 minutes

let browser;
let context;
let page;

const verbose = process.env.OPENQA_VERBOSE !== 'false';

// Build context header from env vars so the agent knows the app URL and credentials
function buildEnvContext() {
    const lines = [];
    if (process.env.BASE_URL)     lines.push(`Application base URL: ${process.env.BASE_URL}`);
    if (process.env.APP_USERNAME) lines.push(`App username: ${process.env.APP_USERNAME}`);
    if (process.env.APP_PASSWORD) lines.push(`App password: ${process.env.APP_PASSWORD}`);
    return lines.length > 0 ? `[Context]\n${lines.join('\n')}\n\n` : '';
}

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
  await runAgent(claudeCode('claude-haiku-4-5'), `${buildEnvContext()}${action}`, context, { verbose });
});
