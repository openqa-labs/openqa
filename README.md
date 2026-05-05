# OpenQA

### AI Powered Natural Language Browser Test Automation
**No selectors. No flake. Just plain English.**

[![npm version](https://badge.fury.io/js/openqa.svg)](https://www.npmjs.com/package/openqa)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- **🗣️ Write Tests in Plain English** — Describe what you want, not how to find it. "Add laptop to cart" just works.
- **📝 BDD & YAML Support** — Works with Playwright-BDD, Cucumber.js, or simple YAML files.
- **⚡ 2-Minute Setup** — `npx openqa init` scaffolds a fully configured `.openqa/` in your existing project.
- **🔒 No API Keys Required Locally** — Uses your existing `claude login` session (Claude Code) or `opencode auth login` (OpenCode). API keys only needed for CI.

**Powered by:** [Claude Code SDK](https://claude.ai/code) • [OpenCode SDK](https://opencode.ai) • [Playwright MCP](https://github.com/microsoft/playwright-mcp)

---

## Quick Start

Run this from your existing project root:

```bash
npx openqa init
```

The interactive wizard will ask you:
1. **Agent** — Claude Code (`@anthropic-ai/claude-agent-sdk`) or OpenCode (`@opencode-ai/sdk`)
2. **Model** — `claude-haiku-4-5` (default), `claude-sonnet-4-6`, `claude-opus-4-7`, or custom (OpenCode supports `anthropic/...`, `openai/...`, `google/...`)
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

1. Your BDD step definitions call `runAgent(claudeCode('model'), 'natural language step', page)`.
2. OpenQA creates a Playwright MCP server in-process and exposes it over HTTP/SSE on a random localhost port.
3. The chosen AI provider SDK connects to that MCP URL and receives your natural language instruction.
4. The agent drives the real browser using Playwright MCP tools (`browser_navigate`, `browser_click`, etc.).
5. The step passes or fails based on what the agent reports back.

- **True browser sharing** — the agent drives the exact same page object your test holds.
- **Parallel-safe** — each test worker gets its own HTTP port. No shared config files.
- **Session resumption** — within a scenario, the agent resumes its conversation across steps.
- **Multi-provider** — swap `claudeCode` for `openCode` to use any model from OpenAI, Google, Anthropic, etc.

---

## Authentication

**Claude Code** — choose one:
```bash
claude login                              # local dev — no API key needed
export ANTHROPIC_API_KEY=your_key        # env var or .openqa/.env
```

**OpenCode** — choose one:
```bash
opencode auth login                       # local dev — no API key needed
export ANTHROPIC_API_KEY=your_key        # or OPENAI_API_KEY, GOOGLE_API_KEY, etc.
```

For CI, set the relevant API key as a secret.

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

```javascript
import { claudeCode } from 'openqa';
const provider = claudeCode('claude-haiku-4-5'); // default
```

| Model | Description |
|---|---|
| `claude-haiku-4-5` | Fast, cost-efficient (default) |
| `claude-sonnet-4-6` | Balanced performance |
| `claude-opus-4-7` | Most capable |

Requires `@anthropic-ai/claude-agent-sdk` to be installed.

### `openCode(model?)`

```javascript
import { openCode } from 'openqa';
const provider = openCode('anthropic/claude-haiku-4-5'); // default
// or: openCode('openai/gpt-4o'), openCode('google/gemini-2.0-flash')
```

Model format: `provider/model`. Supports any provider configured in your OpenCode setup.

Requires `@opencode-ai/sdk` to be installed.

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

- **Website:** https://openqa.io/
- **NPM:** https://www.npmjs.com/package/openqa
- **GitHub:** https://github.com/openqa-labs/openqa

## License

MIT
