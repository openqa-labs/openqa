# openqa

[![npm version](https://badge.fury.io/js/openqa.svg)](https://www.npmjs.com/package/openqa)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

AI-powered browser automation with shared context using Claude Agent SDK and Playwright MCP.

## Features

- **Zero Step Definitions**: Write BDD tests in pure natural language
- **Shared Browser Context**: Agent and tests share the same browser instance
- **AI-Powered**: Natural language commands for all browser interactions
- **2-Minute Setup**: From zero to running tests with `npx openqa init`

## Quick Start

### Step 1: Setup Provider

**Option 1: Claude Code Agent (Recommended)**

Choose ONE authentication method:

```bash
# A. Claude Code CLI (recommended)
claude login

# B. API Key
export ANTHROPIC_API_KEY=your_key

# C. .env file
echo "ANTHROPIC_API_KEY=your_key" > .env
# OR
echo "CLAUDE_CODE_OAUTH_TOKEN=your_token" > .env
```

**Option 2: Other Providers (OpenAI, Google)**

Create `.env` file:
```bash
AGENT_TYPE=langchain
DEFAULT_PROVIDER=openai  # or 'google', 'anthropic'
OPENAI_API_KEY=your_key  # or GOOGLE_API_KEY, ANTHROPIC_API_KEY

# Optional
OPENAI_MODEL=gpt-4o      # or GOOGLE_MODEL, ANTHROPIC_MODEL
RECURSION_LIMIT=100      # default: 100
```

---

### Step 2: Choose Your Setup

**New Playwright-BDD Project:**
```bash
npx openqa init playwright-bdd
cd my-project
npm test
```

Write `.feature` files in plain English - AI handles everything!

```gherkin
Feature: Shopping
  Scenario: Buy a product
    Given I navigate to "https://shop.example.com"
    When I search for "laptop" and add the first result to cart
    And I proceed to checkout and enter shipping details
    Then I should see "Order confirmed"
```

**Or choose an integration:**

- **[With Existing Playwright-BDD](#with-existing-playwright-bdd)**
- **[With Existing Cucumber.js](#with-existing-cucumberjs)**
- **[With Existing Playwright](#with-existing-playwright)**

---

## With Existing Playwright-BDD

> **Step 1**: [Setup Provider](#step-1-setup-provider) ← Complete this first

**Step 2**: Install OpenQA
```bash
npm install openqa
```

**Step 3**: Replace step definitions
```typescript
// features/steps/steps.ts
import 'openqa/bdd/playwright-bdd';
```

**Step 4**: Run tests
```bash
npm test
```

---

## With Existing Cucumber.js

> **Step 1**: [Setup Provider](#step-1-setup-provider) ← Complete this first

**Step 2**: Install OpenQA
```bash
npm install openqa @playwright/test
```

**Step 3**: Replace step definitions
```javascript
// features/step_definitions/steps.js
import 'openqa/bdd/cucumber';
// Browser setup included automatically!
```

**Step 4**: Run tests
```bash
npm test
```

---

## With Existing Playwright

> **Step 1**: [Setup Provider](#step-1-setup-provider) ← Complete this first

**Step 2**: Install OpenQA
```bash
npm install openqa
```

**Step 3**: Use in your tests
```typescript
import { test } from "@playwright/test";
import { runAgent } from "openqa";

test("AI agent fills form", async ({ page, context }) => {
  await page.goto("https://example.com/form");

  // Agent uses the same browser context
  await runAgent('Fill in the form with test data', context);

  // Verify in the same browser
  await expect(page.locator('input[name="email"]')).toHaveValue("test@example.com");
});
```

**Step 4**: Run tests
```bash
npx playwright test
```

---

## How It Works

The agent uses `@playwright/mcp` with `createConnection()` to share the browser context. This enables:

- Shared cookies and session storage
- Same page state and navigation history
- True collaborative automation between tests and AI

## API Reference

### `runAgent(prompt, browserContext, options?)`

Run AI agent with natural language instruction.

**Parameters:**
- `prompt` (string): Natural language instruction
- `browserContext` (BrowserContext): Playwright browser context
- `options` (object): Optional configuration
  - `verbose` (boolean): Enable logging (default: true)
  - `agentType` (string): 'claude' (default) or 'langchain'
  - `provider` (string): AI provider ('anthropic', 'openai', 'google')
  - `model` (string): Model name
  - `recursionLimit` (number): Max recursion depth (default: 100)

**Returns:** Promise<string>

### BDD Integration

**Playwright-BDD (simple):**
```typescript
import 'openqa/bdd/playwright-bdd';
```

**Playwright-BDD (custom):**
```typescript
import { createAIStep } from 'openqa/bdd/playwright-bdd';

createAIStep({
  verbose: false,
  agentType: 'claude',
});
```

**Cucumber.js:**
```typescript
import 'openqa/bdd/cucumber';
```

## Examples

- [`examples/playwright/`](examples/playwright/) - Standard Playwright tests
- [`examples/playwright-bdd-simple/`](examples/playwright-bdd-simple/) - 1-line BDD integration
- [`examples/playwright-bdd/`](examples/playwright-bdd/) - Manual BDD setup
- [`examples/playwright-bdd-onkernel/`](examples/playwright-bdd-onkernel/) - BDD with OnKernel cloud browsers

## Requirements

- Node.js 18+
- `@playwright/test` ^1.56.0
- Claude Code login, Anthropic API key, or other provider API key

## Links

- **Website:** https://www.auto-browse.com/
- **NPM:** https://www.npmjs.com/package/openqa
- **GitHub:** https://github.com/auto-browse/openqa

## License

MIT
