# Playwright-BDD Simple Example

This example demonstrates the **1-line integration** of OpenQA with Playwright-BDD.

## The Magic

Look at `features/steps/steps.ts`:

```typescript
import 'openqa/bdd/playwright-bdd';
```

**That's it!** One line replaces all your step definitions. The AI agent now handles every Gherkin step.

## How It Works

1. You write your `.feature` files with natural language Gherkin steps
2. OpenQA intercepts ALL steps with a catch-all pattern `/^(.*)$/`
3. Each step text is passed to the AI agent
4. The agent interprets and executes the step using the shared browser context

## Comparison

### Before (Manual Step Definitions)
```typescript
// features/steps/fixtures.ts
import { test as base, createBdd } from 'playwright-bdd';
export const test = base.extend({});
export const { Given, When, Then } = createBdd(test);

// features/steps/steps.ts
import { Given, When, Then } from './fixtures';

Given('I navigate to {string}', async ({ page }, url) => {
  await page.goto(url);
});

When('I add a new todo item {string} on the web page', async ({ page }, text) => {
  await page.fill('.new-todo', text);
  await page.press('.new-todo', 'Enter');
});

Then('I should see {string} in the todo list', async ({ page }, text) => {
  await expect(page.locator('.todo-list li')).toContainText(text);
});

// ... hundreds more step definitions
```

### After (OpenQA 1-Line Integration)
```typescript
// features/steps/steps.ts
import 'openqa/bdd/playwright-bdd';
```

## Setup

```bash
npm install
npm test
```

## Advanced Usage

If you want to customize the AI agent:

```typescript
// features/steps/steps.ts
import { createAIStep } from 'openqa/bdd/playwright-bdd';

createAIStep({
  verbose: false,
  agentType: 'claude',
  // ... other options
});
```

## Benefits

- ✅ **Zero step definitions** - AI handles everything
- ✅ **Natural language** - Write steps exactly how you think
- ✅ **Self-healing** - AI adapts to UI changes
- ✅ **Fast onboarding** - No Playwright API to learn
- ✅ **Maintainability** - Change UI, keep the same tests
