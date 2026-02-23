# Playwright BDD Example

This example demonstrates using `openqa` with Playwright BDD (Behavior-Driven Development) tests written in Gherkin syntax.

## Setup

Install dependencies:

```bash
npm install
```

**Authentication:**

Use Claude Code credentials (recommended):
```bash
claude login
```

Or set your Anthropic API key (not needed if you logged in to claude code):
```bash
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY
```

## Run Tests

```bash
npm test              # Generate and run all tests
npm run test:headed   # Run with visible browser
npm run test:ui       # Open Playwright UI
npm run bddgen        # Only generate tests from features
```

## What's Demonstrated

This example shows how to:

1. **Write BDD scenarios** in Gherkin syntax (features/*.feature)
2. **Use AI agent** in BDD step definitions
3. **Share browser context** between regular steps and AI-powered steps
4. **Generate Cucumber HTML reports** from test execution

## Project Structure

```
playwright-bdd/
├── features/
│   ├── playwright-home.feature    # Gherkin feature files
│   └── steps/
│       ├── fixtures.ts            # BDD test setup and helpers
│       └── steps.ts               # Step definitions with agent
├── playwright.config.ts           # BDD-specific config
└── package.json
```

## Feature File Example

```gherkin
Feature: Playwright Home Page

  Scenario: Check title
    Given navigate to 'https://playwright.dev/'
    When click link "Get started"
    Then Verify in title "Installation"
```

## Step Definitions

The key innovation is using a **single generic AI step** that handles ALL steps:

```typescript
import { runAgent } from 'openqa';
import { aistep } from './fixtures';

// Generic AI-powered step - handles ANY step with natural language
aistep(/^(.*)$/, async ({ openqaSession }, action: string) => {
  await runAgent(action, { session: openqaSession, verbose: false });
});
```

**fixtures.ts:**
```typescript
import { test as base, createBdd } from 'playwright-bdd';

export const test = base.extend({});

// Export 'Step' as 'aistep' - matches any Given/When/Then
export const { Step: aistep } = createBdd(test);
```

**That's it!** No need to write individual step definitions. The AI agent handles everything based on the natural language in your feature files.

## How It Works

1. **Write scenarios** in Gherkin (Given/When/Then)
2. **Run `bddgen`** to generate test files from features
3. **ALL steps** are handled by AI agent using natural language
4. **Browser context is shared** between all steps
5. **No code required** - just write scenarios and run tests!

## Benefits

- **Zero code**: Write tests in pure natural language
- **One generic step**: Handles ALL Given/When/Then steps automatically
- **Same browser session**: Shared context across all steps
- **BDD syntax**: Business-readable test scenarios
- **AI flexibility**: Adapts to any web interaction
- **Cucumber reports**: HTML reports with screenshots and videos

## Reports

After running tests, view the report:

```bash
npx playwright show-report
```

The report includes:
- Scenario pass/fail status
- Step-by-step execution
- Screenshots and videos (on failure)
- Execution time
