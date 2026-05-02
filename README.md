# OpenQA

### AI Powered Natural Language Browser Test Automation
**No selectors. No flake. Just plain English.**

[![npm version](https://badge.fury.io/js/openqa.svg)](https://www.npmjs.com/package/openqa)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- **🗣️ Write Tests in Plain English** — Describe what you want, not how to find it. "Add laptop to cart" just works.
- **📝 BDD & YAML Support** — Works with Playwright-BDD, Cucumber.js, or simple YAML files.
- **⚡ 2-Minute Setup** — `npx openqa init` scaffolds a fully configured `.openqa/` in your existing project.
- **🔒 No API Keys Required Locally** — Uses your existing `claude login` session. API keys only needed for CI.

**Powered by:** [Claude Code CLI](https://claude.ai/code) • [Playwright MCP](https://github.com/microsoft/playwright-mcp)

---

## Quick Start

Run this from your existing project root:

```bash
npx openqa init
```

The interactive wizard will ask you:
1. **Agent** — Claude Code (the only agent today)
2. **Model** — `claude-haiku-4-5` (default), `claude-sonnet-4-6`, `claude-opus-4-7`, or custom
3. **Framework** — Playwright-BDD or Cucumber.js
4. **Feature files path** — Relative path to your `.feature` files (default: `features/`)

This scaffolds a `.openqa/` directory in your project containing:
- `playwright.config.ts` or `cucumber.js` — pre-configured and pointing at your feature files
- `steps/steps.ts` (or `.js`) — a single AI step definition that handles all Gherkin steps
- `steps/fixtures.ts` — the Playwright-BDD fixture extension (Playwright-BDD only)
- `.env.example` — template for required environment variables

Then:
```bash
cd .openqa
cp .env.example .env
# Add ANTHROPIC_API_KEY or CLAUDE_CODE_OAUTH_TOKEN to .env (or use `claude login` locally)
npm run test:headed
```

---

## How It Works

OpenQA uses a **CLI-bridge architecture**:

1. Your BDD step definitions call `runAgent(claudeCode('model'), 'natural language step', page)`.
2. `runAgent` spawns a **Claude Code CLI subprocess** (`npx @anthropic-ai/claude-code`) with a dynamically generated `.mcp.json`.
3. The `.mcp.json` points the CLI to a local TCP bridge server that wraps **your existing Playwright browser context** via `@playwright/mcp`.
4. Claude Code drives the real browser using Playwright MCP tools (`browser_navigate`, `browser_click`, etc.).
5. The step passes or fails based on what Claude reports back.

This means:
- **Zero SDK imports** — the heavy AI SDK runs as a subprocess, not in your test process.
- **True browser sharing** — Claude drives the exact same page object your test holds.
- **Parallel-safe** — each test worker gets its own ephemeral TCP port and `.mcp.json`.
- **Session resumption** — multi-step scenarios resume the same Claude Code conversation.

---

## Authentication

Choose **one** method:

```bash
# A. Claude Code CLI login (recommended for local development — no API key needed!)
claude login

# B. Environment variable
export ANTHROPIC_API_KEY=your_key

# C. .env file inside .openqa/
echo "ANTHROPIC_API_KEY=your_key" > .openqa/.env
```

For CI environments, set `ANTHROPIC_API_KEY` (or `CLAUDE_CODE_OAUTH_TOKEN`) as a secret.

---

## Writing Feature Files

Feature files use standard Gherkin syntax. We recommend using `*` (asterisk) for steps instead of `Given`/`When`/`Then` — it reads more naturally for AI-driven tests:

```gherkin
Feature: TodoMVC Automation

  Scenario: Add todo item
    * I navigate to "https://demo.playwright.dev/todomvc/"
    * I add a new todo item "Buy groceries"
    * I should see "Buy groceries" in the todo list

  Scenario: Filter todos
    * I navigate to "https://demo.playwright.dev/todomvc/"
    * I add three todo items: "Task 1", "Task 2", and "Task 3"
    * I mark the first todo as completed
    * I click the Active filter
    * I should see 2 active todos
```

You can still use `Given`/`When`/`Then` — both work identically.

---

## Using `runAgent` Directly

For custom Playwright tests (without BDD):

```typescript
import { test } from "@playwright/test";
import { runAgent, claudeCode } from "openqa";

test("AI agent fills form", async ({ page }) => {
  await page.goto("https://example.com/form");

  await runAgent(claudeCode('claude-haiku-4-5'), "Fill in the form with test data", page, { verbose: true });

  await expect(page.locator('input[name="email"]')).toHaveValue("test@example.com");
});
```

---

## API Reference

### `runAgent(provider, prompt, pageOrContext, options?)`

Runs the AI agent with a natural language instruction.

| Parameter | Type | Description |
|---|---|---|
| `provider` | `object` | Agent provider, e.g. `claudeCode('claude-haiku-4-5')` |
| `prompt` | `string` | Natural language instruction |
| `pageOrContext` | `Page \| BrowserContext` | Playwright page or browser context |
| `options.verbose` | `boolean` | Enable logging (default: `true`) |
| `options.returnUsage` | `boolean` | Return token usage stats (default: `false`) |

**Returns:** `Promise<string>` — the agent's final response.

### `claudeCode(model?)`

Creates a Claude Code provider configuration.

```javascript
import { claudeCode } from 'openqa';

const provider = claudeCode('claude-haiku-4-5'); // default model
```

| Model | Description |
|---|---|
| `claude-haiku-4-5` | Fast, cost-efficient (default) |
| `claude-sonnet-4-6` | Balanced performance |
| `claude-opus-4-7` | Most capable |

### `runAgent.resetSession(browserContext)`

Resets the Claude Code conversation session for a specific browser context. Useful when you want to start a fresh conversation mid-test.

---

## Examples

- [`examples/playwright-bdd/`](examples/playwright-bdd/) — Playwright-BDD with natural language steps
- [`examples/playwright-yaml/`](examples/playwright-yaml/) — YAML-based tests
- [`examples/cucumberjs/`](examples/cucumberjs/) — Cucumber.js integration

---

## Requirements

- Node.js 18+
- `@playwright/test` ^1.57.0
- Claude Code (`npm install -g @anthropic-ai/claude-code`) or `ANTHROPIC_API_KEY`

---

## Links

- **Website:** https://www.auto-browse.com/
- **NPM:** https://www.npmjs.com/package/openqa
- **GitHub:** https://github.com/auto-browse/openqa

## License

MIT
