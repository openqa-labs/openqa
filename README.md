# OpenQA

### AI Powered Natural Language Browser Test Automation
**No selectors. No flake. Just plain English.**

[![npm version](https://badge.fury.io/js/openqa.svg)](https://www.npmjs.com/package/openqa)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- **🗣️ Write Tests in Plain English** — Describe what you want, not how to find it. "Add laptop to cart" just works.
- **📝 BDD & YAML Support** — Works with Playwright-BDD, Cucumber.js, or simple YAML files. Zero step definitions needed.
- **🔌 Any LLM Provider** — Claude, OpenAI, or Gemini. Use the model that fits your budget and needs.
- **⚡ 2-Minute Setup** — `npx openqa init` and you're running tests. No complex configuration.

**Powered by:** [Claude Agent SDK](https://platform.claude.com/docs/en/agent-sdk/overview) • [LangChain](https://js.langchain.com/) • [Playwright MCP](https://github.com/microsoft/playwright-mcp)

## Quick Start

**New Project (YAML, Playwright-BDD, or Cucumber.js):**

```bash
npx openqa init
```

This single command will:
1. Prompt for framework selection (YAML, Playwright-BDD, or Cucumber.js)
2. Install dependencies and Playwright browsers
3. Prompt for AI provider (Anthropic or Other)
4. Show tailored setup instructions

Write tests in YAML or `.feature` files - AI handles everything!

```yaml
name: Shopping Tests
tests:
  - name: Buy a product
    steps:
      - Navigate to "https://shop.example.com"
      - Search for "laptop" and add the first result to cart
      - Proceed to checkout and enter shipping details
      - Verify "Order confirmed" appears on the page
```

---

**Integrations with Existing Projects:**

- **[With Existing Playwright](#with-existing-playwright)**
- **[With Existing Playwright-BDD](#with-existing-playwright-bdd)**
- **[With Existing Cucumber.js](#with-existing-cucumberjs)**

---

## With Existing Playwright-BDD

**Step 1**: Install OpenQA
```bash
npm install openqa
```

**Step 2**: Setup authentication

Choose ONE method:
```bash
# A. Claude Code CLI (recommended)
claude login

# B. API Key
export ANTHROPIC_API_KEY=your_key

# C. .env file
echo "ANTHROPIC_API_KEY=your_key" > .env
```

For OpenAI/Google, create `.env`:
```bash
AGENT_TYPE=langchain
DEFAULT_PROVIDER=openai  # or 'google'
OPENAI_API_KEY=your_key
```

**Step 3**: Replace step definitions
```typescript
// features/steps/steps.ts
export { test } from 'openqa/bdd/playwright-bdd';
```

**Step 4**: Run tests
```bash
npm test
```

---

## With Existing Cucumber.js

**Step 1**: Install OpenQA
```bash
npm install openqa @playwright/test
```

**Step 2**: Setup authentication

Choose ONE method:
```bash
# A. Claude Code CLI (recommended)
claude login

# B. API Key
export ANTHROPIC_API_KEY=your_key

# C. .env file
echo "ANTHROPIC_API_KEY=your_key" > .env
```

For OpenAI/Google, create `.env`:
```bash
AGENT_TYPE=langchain
DEFAULT_PROVIDER=openai  # or 'google'
OPENAI_API_KEY=your_key
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

**Step 1**: Install OpenQA
```bash
npm install openqa
```

**Step 2**: Setup authentication

Choose ONE method:
```bash
# A. Claude Code CLI (recommended)
claude login

# B. API Key
export ANTHROPIC_API_KEY=your_key

# C. .env file
echo "ANTHROPIC_API_KEY=your_key" > .env
```

For OpenAI/Google, create `.env`:
```bash
AGENT_TYPE=langchain
DEFAULT_PROVIDER=openai  # or 'google'
OPENAI_API_KEY=your_key
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
// features/steps/steps.ts
export { test } from 'openqa/bdd/playwright-bdd';
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

- [`examples/playwright-yaml/`](examples/playwright-yaml/) - YAML tests with natural language
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
