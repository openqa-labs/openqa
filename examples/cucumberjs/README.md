# CucumberJS Example

This example demonstrates using `autobrowse-agent` with CucumberJS and Playwright for BDD testing.

## Setup

```bash
npm install
```

## Run Tests

```bash
npm test              # Run tests in headless mode
npm run test:headed   # Run with visible browser
npm run test:report   # Generate HTML report
```

## What's Demonstrated

This example shows how to:

1. **Write BDD scenarios** in Gherkin syntax
2. **Use AI agent** in Cucumber step definitions
3. **Share browser context** with Playwright and the AI agent
4. **Generate HTML reports** from test execution

## Project Structure

```
cucumberjs/
├── features/
│   ├── playwright-home.feature       # Gherkin feature files
│   └── step_definitions/
│       └── steps.js                  # Step definitions with agent
├── cucumber.js                       # Cucumber configuration
└── package.json
```

## Feature File Example

```gherkin
Feature: Playwright Home Page

  Scenario: Check title
    Given I navigate to "https://playwright.dev/"
    When I click link "Get started"
    Then I should see "Installation" in the title
```

## Step Definitions

The key innovation is using a **single generic step** that handles ALL steps with AI:

```javascript
import { defineStep, Before, After } from '@cucumber/cucumber';
import { chromium } from 'playwright';
import { runAgentWithContext } from 'autobrowse-agent';

Before(async function () {
  browser = await chromium.launch({ headless: true });
  context = await browser.newContext();
  page = await context.newPage();
});

After(async function () {
  await page.close();
  await context.close();
  await browser.close();
});

// Generic AI step - handles ALL Given/When/Then steps
defineStep(/^(.*)$/, async function (action) {
  await runAgentWithContext(action, context, { verbose: false });
});
```

**That's it!** One generic step definition handles all scenarios. No need to write individual step definitions for each Given/When/Then.

## How It Works

1. **Before hook** sets up browser, context, and page
2. **Generic step** (`defineStep(/^(.*)$/, ...)`) matches ALL Given/When/Then
3. **ALL steps** are handled by AI agent using natural language
4. **After hook** cleans up browser resources
5. **Browser context is shared** between Playwright and agent
6. **No code required** - just write scenarios and run tests!

## Benefits

- **Zero code**: Write tests in pure natural language
- **One generic step**: Single `defineStep` handles ALL Given/When/Then
- **Standard CucumberJS**: Uses vanilla `@cucumber/cucumber`
- **Before/After hooks**: Manage browser lifecycle
- **HTML reports**: Generate detailed test reports
- **Shared context**: Agent and Playwright see the same browser state

## Reports

After running tests, view the HTML report:

```bash
open reports/cucumber-report.html
```

The report includes:
- Scenario pass/fail status
- Step-by-step execution details
- Execution time

## Configuration

The `cucumber.js` file configures:
- Feature file paths
- Step definition paths
- Report formats and output
- Default settings

## Differences from playwright-bdd

Unlike the playwright-bdd example, this uses:
- Vanilla CucumberJS (not playwright-bdd wrapper)
- Manual browser setup in Before/After hooks
- Direct Playwright API usage
- Standard Cucumber configuration

Both approaches are valid - choose based on your team's preference and existing setup.
