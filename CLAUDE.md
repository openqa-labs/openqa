# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OpenQA is an AI-powered browser test automation framework that uses natural language to write Playwright tests. It integrates with Playwright-BDD, Cucumber.js, and YAML-based test definitions.

**Key architecture:** Uses a **unified SDK architecture** — both `claudeCode` and `openCode` providers expose Playwright MCP over HTTP/SSE and implement a single `provider.run()` interface. The Orchestrator is a thin coordinator (~50 lines) that wires MCP to the provider.

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
npm run bddgen        # Generate BDD test files from .feature files
npm run bddgen && npm test
```

## Architecture

```
runAgent(provider, prompt, page/context)
  └─ Orchestrator.run()
       ├─ createMcpHttpServer(browserContext) → { url, cleanup }
       │    Playwright MCP exposed over HTTP/SSE on a random localhost port
       ├─ provider.run(prompt, { mcpUrl, existingSessionId, ... })
       │    ├─ claudeCode → @anthropic-ai/claude-agent-sdk query()
       │    └─ openCode   → @opencode-ai/sdk createOpencode()
       ├─ sessionManager.setSession(browserContext, result.sessionId)
       └─ cleanup()
```

### Core Files

**`src/agent/Orchestrator.js`** — thin coordinator: resolves browser context, creates MCP server, calls `provider.run()`, stores session ID, runs cleanup.

**`src/agent/createMcpServer.js`** — creates a Playwright MCP server (`@playwright/mcp`) and exposes it over HTTP/SSE on a random `127.0.0.1` port. Wraps the browser context with a no-op `.close()` so MCP never disposes it. Returns `{ url, cleanup }`.

**`src/agent/systemPrompt.js`** — shared Playwright agent system prompt constant. Imported by both providers to ensure identical agent instructions regardless of backend.

**`src/agent/providers/claudeCode.js`** — uses `@anthropic-ai/claude-agent-sdk` `query()`. MCP config: `{ type: 'http', url: mcpUrl }`. Has a `Stop` hook to enforce at least one Playwright tool call per step. Detects assertion failures from `tool_result` blocks with `is_error: true`.

**`src/agent/providers/openCode.js`** — uses `@opencode-ai/sdk` `createOpencode()`. MCP config: `{ type: 'remote', url: mcpUrl }`. Calls `promptAsync()` (fire-and-forget) then iterates the SSE event stream, processing `message.part.updated`, `session.idle`, `session.error`. Auto-approves permission events. Detects assertion failures from both `ToolStateError` and `ToolStateCompleted` with `### Error` output (MCP `isError:true` maps to the latter).

**`src/agent/SessionManager.js`** — `WeakMap<BrowserContext, sessionId>`. Enables session resumption across steps within the same scenario.

### Provider Interface

```js
{
  name: string,
  run(prompt, { mcpUrl, existingSessionId, verbose, returnUsage, logger })
    → Promise<{ result, usage?, steps, sessionId }>
}
```

### CLI System (`src/cli/`)

- `openqa init` — Interactive wizard: Agent → Model → Framework → Feature path. Scaffolds `.openqa/`, installs the chosen agent SDK, optionally installs Playwright browsers.
- `openqa generate [paths...]` — Converts YAML test files to Playwright `.spec.js`.

Templates at `src/cli/templates/<framework>/`.

### Export Structure

```js
export { runAgent }       // main entry point
export { claudeCode }     // @anthropic-ai/claude-agent-sdk provider
export { openCode }       // @opencode-ai/sdk provider
export { Orchestrator }
```

**Peer Dependencies** (all optional except `@playwright/test`):
- `@anthropic-ai/claude-agent-sdk` >=0.2 — required for `claudeCode`
- `@opencode-ai/sdk` >=1.14 — required for `openCode`
- `@playwright/test` ^1.57.0 (required)
- `playwright-bdd` ^8.0.0, `@cucumber/cucumber` ^11.0.0 (optional)

## Critical Implementation Details

### Parallel-Safe Execution

Each `runAgent()` call creates its own HTTP server on a random `127.0.0.1` port. Parallel test workers get separate ports — no shared state, no config files.

### Tool Enforcement

Both providers reject any step where the agent made **zero Playwright tool calls**. Prevents hallucinated responses without browser interaction.

### Context Resolution

Both `Page` and `BrowserContext` are accepted:
```javascript
if (pageOrContext.context && typeof pageOrContext.context === 'function') {
  browserContext = pageOrContext.context();   // Page → extract context
} else {
  browserContext = pageOrContext;             // already a BrowserContext
}
```

### Environment Variable Loading

1. `.openqa/.env` — loaded by `dotenv`
2. Parent project `.env` (`../.env`) — fallback for monorepo setups
3. Shell environment — `ANTHROPIC_API_KEY` (claudeCode) or provider API key (openCode)

### Feature File Step Syntax

The step definition uses `/^(.*)$/` to match any step text. Both `Given`/`When`/`Then` and `*` (asterisk) work identically.

## Examples Directory

- `playwright-bdd/` — Playwright-BDD with `.feature` files
- `playwright-yaml/` — YAML-based tests via `npx openqa generate`
- `cucumberjs/` — Cucumber.js integration

All examples use `"openqa": "file:../.."` for local development and require the relevant agent SDK installed alongside (e.g. `npm install @anthropic-ai/claude-agent-sdk`).

## Testing Strategy

Before any release:
1. `cd examples/playwright-bdd && npm test`
2. `node src/cli/bin.js init` in a temp directory
3. `cd .openqa && npm install file:..`
4. Verify `npm pack` includes only `src/`, `README.md`, `LICENSE`

## Module System

**ES Modules only** (`"type": "module"`). All imports require `.js` extensions. No CommonJS.

## Anti-Patterns to Avoid

1. **Don't skip tool calls** — both providers enforce at least one Playwright tool per step
2. **Don't break session continuity** — session reuse is critical for multi-step scenarios
3. **Don't dispose the browser context in MCP** — the no-op `.close()` wrapper in `createMcpServer.js` is critical
4. **Don't add a new provider without the uniform interface** — every provider must implement `run(prompt, options) → { result, steps, sessionId }`
5. **Don't use `session.prompt()` in openCode** — use `promptAsync()`. `prompt()` blocks until the full response is ready; `session.idle` fires while you're blocked so the event is missed and the loop hangs indefinitely.
6. **Don't assume MCP `isError:true` maps to `ToolStateError`** — OpenCode maps it to `ToolStateCompleted` with the error text in `part.state.output` starting with `### Error`. Check both states when detecting assertion failures.
