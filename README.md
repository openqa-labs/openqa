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

**Powered by:** [Claude Code SDK](https://claude.ai/code) • [OpenCode SDK](https://opencode.ai) • [Playwright MCP](https://github.com/microsoft/playwright-mcp) • [Playwright-BDD](https://github.com/vitalets/playwright-bdd) • [Cucumber.js](https://github.com/cucumber/cucumber-js) • [Varlock](https://varlock.dev)

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
4. **Feature files path** — Where feature files live, relative to `.openqa/` (default: `features`)

This scaffolds a `.openqa/` directory in your project containing:
- `playwright.config.ts` or `cucumber.js` — pre-configured and pointing at your feature files
- `steps/steps.ts` (or `.js`) — a single AI step definition that handles all Gherkin steps
- `steps/fixtures.ts` — the Playwright-BDD fixture extension (Playwright-BDD only)
- `features/` — two example feature files to get started (`todomvc.feature`, `getting-started.feature`)
- `.env.example` — copy this to `.env` and fill in your values
- `.env.schema` — committed schema: documents every variable, types, and defaults; secrets are redacted from logs automatically

Then:
```bash
cd .openqa
cp .env.example .env
# Local: run `claude login` or `opencode auth login` — no API key needed
# CI: add the relevant API key to .env
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

## Environment Variables

The `.openqa/` directory uses [varlock](https://varlock.dev) for environment variable management. Variables are defined in `.env.schema` (committed to git) and values go in `.env` (gitignored). Secrets are automatically redacted from logs.

| Variable | Default | Description |
|----------|---------|-------------|
| `BASE_URL` | — | App URL — sets Playwright `baseURL` and is injected into every agent prompt |
| `APP_USERNAME` | — | Username — injected into agent prompt for login steps |
| `APP_PASSWORD` | — | Password — injected into agent prompt; always redacted from logs |
| `OPENQA_VERBOSE` | `true` | Set `false` to suppress step-by-step agent logs |
| `HEADLESS` | `true` | Set `false` to watch the browser |
| `ANTHROPIC_API_KEY` | — | Anthropic API key — only needed for CI (use `claude login` locally) |
| `OPENAI_API_KEY` | — | OpenAI API key — only needed for CI via OpenCode |
| `GOOGLE_API_KEY` | — | Google API key — only needed for CI via OpenCode |

**Adding your own variables** — edit `.openqa/.env.schema` to declare them, then add values to `.env`:

```
# .openqa/.env.schema (add to the bottom)

# @sensitive=false
ENVIRONMENT = staging

# Your test account credentials for the staging environment
STAGING_USER =
# @sensitive
STAGING_PASSWORD =
```

Then use them in your steps or anywhere in the test process via `process.env.ENVIRONMENT`, etc.

---

## Authentication

**No API key needed for local development** — just log in with the CLI once:

```bash
# Claude Code
claude login

# OpenCode (supports GitLab Duo, GitHub Copilot, Anthropic, OpenAI, Google, …)
opencode auth login
```

For CI (or if you prefer an API key), set the relevant key in `.openqa/.env`:

```bash
# Claude Code
ANTHROPIC_API_KEY=your_key

# OpenCode — use whichever provider you're connecting to
ANTHROPIC_API_KEY=your_key
# OPENAI_API_KEY=your_key
# GOOGLE_API_KEY=your_key
```

---

## Customizing Your Setup

`openqa init` creates a working starting point — everything in `.openqa/` is yours to edit. Common customizations:

**Playwright config** — `.openqa/playwright.config.ts` is a standard [Playwright config](https://playwright.dev/docs/test-configuration). Add projects, change timeouts, add reporters, enable retries for CI:

```typescript
// .openqa/playwright.config.ts
export default defineConfig({
  timeout: 120000,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: process.env.BASE_URL,
    locale: 'en-US',
    timezoneId: 'America/New_York',
  },
});
```

**Step definitions** — `.openqa/steps/steps.ts` is a regular [Playwright-BDD](https://playwright-bdd.dev) or [Cucumber.js](https://github.com/cucumber/cucumber-js) step file. Add custom (non-AI) steps alongside the AI step, or add Before/After hooks:

```typescript
// .openqa/steps/steps.ts — add a manual step alongside the AI one
import { createBdd } from 'playwright-bdd';
const { Given } = createBdd();

Given('I am on the home page', async ({ page }) => {
  await page.goto(process.env.BASE_URL!);
});
```

---

## Writing Feature Files

`openqa init` places two example feature files in `.openqa/features/` — `todomvc.feature` (2 scenarios) and `getting-started.feature` (1 scenario). Edit or replace them with your own.

Feature files use standard Gherkin syntax. We recommend using `*` (asterisk) for steps instead of `Given`/`When`/`Then` — it reads more naturally for AI-driven tests:

```gherkin
Feature: TodoMVC

  Scenario: Add a todo item
    * I navigate to "https://demo.playwright.dev/todomvc/"
    * I add a new todo item "Buy groceries"
    * I should see "Buy groceries" in the todo list

  Scenario: Filter completed todos
    * I navigate to "https://demo.playwright.dev/todomvc/"
    * I add three todo items: "Task 1", "Task 2", and "Task 3"
    * I mark the first todo as completed
    * I click the Active filter
    * I should see 2 active todos
```

You can still use `Given`/`When`/`Then` — both work identically.

**Moving feature files elsewhere** — if your feature files live outside `.openqa/` (e.g. `features/` in the project root), update the path in your config:

For Playwright-BDD, edit `.openqa/playwright.config.ts`:
```typescript
const testDir = defineBddConfig({
  featuresRoot: '../features',
  features: '../features/**/*.feature',
  steps: 'steps/*.ts',
});
```

For Cucumber.js, edit `.openqa/cucumber.js`:
```js
paths: ['../features/**/*.feature'],
```

---

## Changing Model or Provider

After running `openqa init`, your model is set in one line inside `.openqa/steps/steps.ts` (or `steps.js` for Cucumber.js). Open that file and edit the provider call:

**Change the Claude Code model:**
```typescript
// .openqa/steps/steps.ts
import { runAgent, claudeCode } from 'openqa';

// Before
await runAgent(claudeCode('claude-haiku-4-5'), action, page);

// After — switch to a more capable model
await runAgent(claudeCode('claude-sonnet-4-6'), action, page);
```

**Switch from Claude Code to OpenCode (GitLab Duo, GitHub Copilot, etc.):**
```typescript
// .openqa/steps/steps.ts
import { runAgent, openCode } from 'openqa';  // swap the import

// GitLab Duo
await runAgent(openCode('gitlab/duo-chat-haiku-4-5'), action, page);

// GitHub Copilot
await runAgent(openCode('github-copilot/gpt-5.4'), action, page);

// Anthropic via OpenCode
await runAgent(openCode('anthropic/claude-sonnet-4-6'), action, page);

// OpenAI
await runAgent(openCode('openai/gpt-4o'), action, page);

// Google
await runAgent(openCode('google/gemini-2.0-flash'), action, page);
```

That's the only change needed — one import swap and one string update.

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
const provider = openCode('gitlab/duo-chat-haiku-4-5'); // GitLab Duo (default in init)
// or: openCode('github-copilot/gpt-5.4')
// or: openCode('anthropic/claude-haiku-4-5'), openCode('openai/gpt-4o'), openCode('google/gemini-2.0-flash')
```

Model format: `provider/model`. Supports any provider configured in your OpenCode installation.

| Model | Provider |
|-------|----------|
| `gitlab/duo-chat-haiku-4-5` | GitLab Duo (default) |
| `github-copilot/gpt-5.4` | GitHub Copilot |
| `anthropic/claude-haiku-4-5` | Anthropic |
| `openai/gpt-4o` | OpenAI |
| `google/gemini-2.0-flash` | Google |

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

- **openqa library:** Node.js 18+
- **Scaffolded `.openqa/` project:** Node.js 22+ (required by varlock)
- `@playwright/test` ^1.57.0
- One of: `@anthropic-ai/claude-agent-sdk` (for `claudeCode`) or `@opencode-ai/sdk` (for `openCode`)

---

## Links

- **Website:** https://openqa.io/
- **NPM:** https://www.npmjs.com/package/openqa
- **GitHub:** https://github.com/openqa-labs/openqa

## License

MIT
