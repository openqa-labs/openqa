# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OpenQA is an AI-powered browser test automation framework that uses natural language to write Playwright tests. It integrates with Playwright-BDD, Cucumber.js, and YAML-based test definitions.

**Key architecture:** Uses a **CLI-bridge pattern** — the AI agent runs as a subprocess (`npx @anthropic-ai/claude-code`), communicating with a live Playwright browser context via a local TCP bridge wrapping `@playwright/mcp`. This avoids heavy SDK imports inside the test process.

## Common Commands

### Development & Testing
```bash
# Install dependencies
npm install

# Run example tests
cd examples/playwright-bdd && npm test
cd examples/cucumberjs && npm test
cd examples/playwright-yaml && npm test

# Run CLI init wizard
node src/cli/bin.js init

# Generate Playwright tests from YAML
npx openqa generate [paths...]
npx openqa generate --watch  # Watch mode

# Test with local file link (before publishing)
cd .openqa && npm install file:..
```

### Publishing & Release
```bash
# Version bump (automatically commits and tags)
npm version patch   # 0.0.x -> 0.0.(x+1)
npm version minor   # 0.x.0 -> 0.(x+1).0
npm version major   # x.0.0 -> (x+1).0.0

# Publish to npm
git push && git push --tags
npm publish
```

### Playwright-BDD Specific
```bash
# Generate BDD test files from .feature files
npm run bddgen

# Run BDD tests
npm run bddgen && npm test
```

## Architecture

### Core Agent System

**Single Agent Backend: Orchestrator** (`src/agent/Orchestrator.js`)

The `Orchestrator` is the central agent execution engine. It:
1. Accepts a `provider` (e.g. `claudeCode('claude-haiku-4-5')`), a natural language `prompt`, and a Playwright `Page` or `BrowserContext`.
2. Wraps the live browser context with a no-op `.close()` to prevent the MCP server from disposing it.
3. Creates an in-memory `@playwright/mcp` server via `createConnection()`.
4. Spins up a local **TCP server** and connects the MCP server to it via `StdioServerTransport`.
5. Writes a per-run ephemeral `.mcp.json` to a unique `/tmp/openqa-mcp-<uuid>/` directory.
6. Spawns the **Claude Code CLI** subprocess pointing at that `.mcp.json`.
7. Parses the `stream-json` output from the subprocess to monitor tool calls, errors, and session IDs.
8. On `tool_error`, immediately kills the subprocess and rejects the Promise (fails the BDD step).
9. Cleans up all temp files and TCP sockets when the subprocess exits.

**Unified Interface** (`src/index.js`):
- `runAgent(provider, prompt, pageOrContext, options)` — main entry point
- `runAgent.resetSession(browserContext)` — resets Claude Code session for a given context
- `claudeCode(model?)` — creates a provider configuration object

### Provider System

**`claudeCode` provider** (`src/agent/providers/claudeCode.js`):
- Default model: `claude-haiku-4-5`
- `buildPrintCommand({ prompt, mcpConfigPath, dangerouslySkipPermissions, resumeSession })` — constructs the full `npx @anthropic-ai/claude-code` command string
- `parseStreamLine(line)` — parses one line of `stream-json` output into typed events (`session_id`, `text`, `tool_call`, `tool_error`, `result`)
- `parseSessionUsage(fullOutput)` — extracts token usage stats from the full output

### Session Management

**`SessionManager`** (`src/agent/SessionManager.js`):
- Maps `BrowserContext` → `sessionId` using a `WeakMap`.
- `getSession(browserContext)` — returns the active session ID for context resumption.
- `setSession(browserContext, sessionId)` — stores a new session ID after a `system_init` event.
- `resetSession(browserContext)` — deletes the session, forcing a fresh conversation next time.

### CLI System (`src/cli/`)

**Commands:**
- `openqa init` — Interactive setup wizard using `@clack/prompts`. Scaffolds `.openqa/` directory.
- `openqa generate [paths...]` — Converts YAML test files to Playwright `.spec.js` files.

**Interactive Init Wizard** (`src/cli/init.js`):
1. Prompts: Agent → Model → Framework → Feature files path
2. Creates `.openqa/` directory in CWD
3. Copies template files from `src/cli/templates/<framework>/`
4. Rewrites `playwright.config.ts` or `cucumber.js` to use the user's relative features path
5. Injects `featuresRoot` into `playwright.config.ts` to prevent out-of-bounds path errors
6. Rewrites `steps.ts`/`steps.js` to use the chosen model
7. Runs `npm install` and optionally `playwright install chromium`

**Templates** (`src/cli/templates/`):
- `playwright-bdd/` — Playwright-BDD template with `playwright.config.ts`, `steps.ts`, `fixtures.ts`
- `cucumber/` — Cucumber.js template with `cucumber.js`, `steps.js`

### YAML System (`src/yaml/`)

- `schema.js` — Zod schema for YAML test file validation
- `generator.js` — Converts YAML to Playwright `.spec.js` files using `runAgent(claudeCode(...), step, page)`

### Export Structure

**Main exports** (`package.json`):
- `.` → `src/index.js` — `runAgent()`, `claudeCode()`

**Peer Dependencies:**
- `@playwright/test` ^1.57.0 (required)
- `playwright-bdd` ^8.0.0 (optional)
- `@cucumber/cucumber` ^11.0.0 (optional)

## Critical Implementation Details

### Parallel-Safe Execution

Each `runAgent()` call creates a **unique temp directory** (`/tmp/openqa-mcp-<uuid>/`) containing:
- `.openqa-bridge.js` — a tiny Node.js TCP client that proxies stdio ↔ the TCP socket
- `.mcp.json` — MCP config pointing Claude Code CLI at the bridge script

This ensures parallel test workers never overwrite each other's MCP configuration.

### Tool Enforcement

The Orchestrator rejects any step where the subprocess exits but made **zero Playwright tool calls**. This prevents the agent from hallucinating responses without actually touching the browser.

```javascript
if (stepCount === 0) {
  return reject(new Error("Agent responded without calling any Playwright MCP tools."));
}
```

### Context Resolution

Both `Page` and `BrowserContext` are accepted. Resolution logic in `Orchestrator.js`:

```javascript
if (pageOrContext.context && typeof pageOrContext.context === 'function') {
  inputPage = pageOrContext;
  browserContext = pageOrContext.context();
} else {
  browserContext = pageOrContext;
}
```

### Environment Variable Loading

Multiple strategies for flexibility:
1. `.openqa/.env` — loaded by `dotenv` when running from the `.openqa/` directory
2. Parent project `.env` (`../.env`) — fallback for monorepo setups
3. Shell environment — `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN`

### Feature File Step Syntax

Feature files support the `*` (asterisk) bullet syntax in addition to standard `Given`/`When`/`Then`. The step definition uses `/^(.*)$/` to match any step text regardless of keyword.

## Examples Directory

Each example demonstrates a different integration pattern:
- `playwright-bdd/` — Playwright-BDD with `.feature` files and natural language steps
- `playwright-yaml/` — YAML-based tests, generate via `npx openqa generate`
- `cucumberjs/` — Cucumber.js integration

All examples use `"openqa": "file:../.."` for local development.

## Testing Strategy

Before any release:
1. Test examples: `cd examples/[name] && npm test`
2. Test CLI wizard: `node src/cli/bin.js init` in a temp directory
3. Test with `.openqa/` install: `cd .openqa && npm install file:..`
4. Verify `npm pack` output includes only `src/`, `README.md`, `LICENSE`

## Module System

**ES Modules Only** (`"type": "module"` in package.json)
- All files use `.js` extension with ESM syntax
- Import statements require `.js` extensions
- `import.meta.url` for file paths
- No CommonJS support

## Anti-Patterns to Avoid

1. **Don't skip tool calls:** Never let agents respond without calling Playwright tools
2. **Don't break session continuity:** Session reuse is critical for multi-step workflows
3. **Don't expose raw MCP errors:** Clean error messages before showing to users
4. **Don't share `.mcp.json`:** Each test run must use a unique temp directory for parallel safety
5. **Don't dispose the browser context in MCP:** The no-op `.close()` wrapper is critical
