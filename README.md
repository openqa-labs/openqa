# openqa

[![npm version](https://badge.fury.io/js/openqa.svg)](https://www.npmjs.com/package/openqa)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

AI-powered browser automation with shared context using Claude Agent SDK and Playwright MCP.

## Features

- **Shared Browser Context**: Agent and tests share the same browser instance, cookies, and session
- **AI-Powered Automation**: Natural language commands for browser interactions
- **Playwright Integration**: Seamless integration with Playwright tests
- **True Collaboration**: Test navigates, agent interacts, test verifies - all in the same browser

## Installation

```bash
npm install openqa @playwright/test
```

## Setup

OpenQA works seamlessly with Claude Code credentials - no API key needed if you're already logged in!

**Option 1: Use Claude Code credentials (Recommended)**

If you have [Claude Code](https://claude.com/claude-code) installed, just run:

```bash
claude login
```

OpenQA will automatically use your Claude Code session - no additional setup required.

**Option 2: Use Anthropic API key**

Set your API key via export (not needed if you logged in to claude code):

```bash
export ANTHROPIC_API_KEY=your_api_key_here
```

Or create a `.env` file:

```
ANTHROPIC_API_KEY=your_api_key_here
```

## Quick Start

```javascript
import { test } from "@playwright/test";
import { runAgent } from "openqa";

test("AI agent fills form", async ({ page, context }) => {
  await page.goto("https://example.com/form");

  // Agent uses the same browser context
  await runAgent(
    'Fill in the form with test data',
    context
  );

  // Verify in the same browser
  await expect(page.locator('input[name="email"]')).toHaveValue("test@example.com");
});
```

## How It Works

The agent uses `@playwright/mcp` with `createConnection()` to share the browser context programmatically. This enables:

- Shared cookies and session storage
- Same page state and navigation history
- Agent sees test's pages and vice versa
- True collaborative automation

## BDD Integration (New! 🎉)

Replace all your step definitions with **just 1 line of code**:

```typescript
// features/steps/steps.ts
import 'openqa/bdd/playwright-bdd';
```

That's it! Now write your `.feature` files and the AI handles everything:

```gherkin
Feature: Shopping Cart
  Scenario: Add items to cart
    Given I navigate to "https://shop.example.com"
    When I search for "laptop" and add the first result to cart
    Then I should see "1 item" in the cart badge
```

### Supported Frameworks

- **Playwright-BDD**: `import 'openqa/bdd/playwright-bdd'`
- **Cucumber.js**: `import 'openqa/bdd/cucumber'`
- More coming soon!

See [`examples/playwright-bdd-simple/`](examples/playwright-bdd-simple/) for a complete working example.

## Examples

### Playwright Tests
See [`examples/playwright/`](examples/playwright/) for standard Playwright test examples:

- Basic context sharing
- Cookie sharing between test and agent
- Agent filling forms with test verification
- Collaborative workflows

### Playwright BDD (Simplified)
See [`examples/playwright-bdd-simple/`](examples/playwright-bdd-simple/) for the **1-line integration**:

- Zero step definitions needed
- Pure Gherkin feature files
- AI handles all automation

### Playwright BDD (Manual)
See [`examples/playwright-bdd/`](examples/playwright-bdd/) for manual step definition examples:

- Writing scenarios in Given/When/Then format
- AI-powered When steps with natural language
- Cucumber HTML reports

## API

### Core API

#### `runAgent(prompt, browserContext, options?)`

Run an AI agent with a specific Playwright browser context.

**Parameters:**
- `prompt` (string): Natural language instruction for the agent
- `browserContext` (BrowserContext): Playwright browser context from test
- `options` (object): Optional configuration
  - `verbose` (boolean): Enable detailed logging (default: true)
  - `agentType` (string): 'claude' or 'langchain' (default: 'claude')
  - `provider` (string): AI provider for langchain ('anthropic', 'openai', 'google')
  - `model` (string): Model name

**Returns:** Promise<string> - Agent's response

### BDD API

#### Playwright-BDD

**Simple usage (auto-registers AI step):**
```typescript
import 'openqa/bdd/playwright-bdd';
```

**Custom configuration:**
```typescript
import { createAIStep } from 'openqa/bdd/playwright-bdd';

createAIStep({
  verbose: false,
  agentType: 'claude',
  pattern: /^(.*)$/  // Custom regex pattern
});
```

#### Cucumber.js

**Simple usage (auto-setup with browser):**
```typescript
import 'openqa/bdd/cucumber';
```

**Custom configuration:**
```typescript
import { createAIStep, enableAutoBrowserSetup } from 'openqa/bdd/cucumber';

enableAutoBrowserSetup({ headless: true });
createAIStep({ verbose: false });
```

**With manual browser setup:**
```typescript
import { createAIStepWithContext, Before, After } from 'openqa/bdd/cucumber';
import { chromium } from 'playwright';

let context;

Before(async function() {
  const browser = await chromium.launch();
  context = await browser.newContext();
});

createAIStepWithContext(() => context);
```

## Requirements

- Node.js 18+
- An Anthropic API key configured for Claude Agent SDK
- `@playwright/test` ^1.56.0

## Website

https://www.auto-browse.com/

## License

MIT
