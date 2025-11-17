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

## Examples

### Playwright Tests
See [`examples/playwright/`](examples/playwright/) for standard Playwright test examples:

- Basic context sharing
- Cookie sharing between test and agent
- Agent filling forms with test verification
- Collaborative workflows

### Playwright BDD
See [`examples/playwright-bdd/`](examples/playwright-bdd/) for BDD examples with Gherkin syntax:

- Writing scenarios in Given/When/Then format
- AI-powered When steps with natural language
- Cucumber HTML reports

## API

### `runAgent(prompt, browserContext, options?)`

Run an AI agent with a specific Playwright browser context.

**Parameters:**
- `prompt` (string): Natural language instruction for the agent
- `browserContext` (BrowserContext): Playwright browser context from test
- `options` (object): Optional configuration
  - `verbose` (boolean): Enable detailed logging (default: true)

**Returns:** Promise<string> - Agent's response

## Requirements

- Node.js 18+
- An Anthropic API key configured for Claude Agent SDK
- `@playwright/test` ^1.56.0

## Website

https://www.auto-browse.com/

## License

MIT
