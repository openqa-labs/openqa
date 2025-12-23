# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OpenQA is an AI-powered browser test automation framework that uses natural language to write Playwright tests. It integrates with Playwright, Playwright-BDD, Cucumber.js, and YAML-based test definitions. The framework supports multiple AI providers (Claude, OpenAI, Google) through two agent backends: Claude Agent SDK and LangChain.

**Key differentiator:** Uses `@playwright/mcp` with `createConnection()` to share browser context between tests and AI agents, enabling true collaborative automation with shared cookies, session storage, and page state.

## Common Commands

### Development & Testing
```bash
# Install dependencies
npm install

# Run example tests
cd examples/playwright-yaml && npm test
cd examples/playwright-bdd-simple && npm test
cd examples/cucumberjs && npm test

# Generate Playwright tests from YAML
npx openqa generate [paths...]
npx openqa generate --watch  # Watch mode

# Run CLI init command
npx openqa init [framework]  # framework: yaml, playwright-bdd, cucumber

# Test with npm link (before publishing)
npm link                      # In openqa repo
cd ../test-project && npm link openqa

# Test with npm pack (before publishing)
npm pack                      # Creates openqa-x.x.x.tgz
cd ../test-project && npm install /path/to/openqa-x.x.x.tgz
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

# Create GitHub release (manual workflow trigger on GitHub Actions)
```

### Playwright-BDD Specific
```bash
# Generate BDD test files from .feature files
npm run bddgen
npx playwright-bdd generate

# Run BDD tests
npm run bddgen && npm test
```

## Architecture

### Core Agent System

**Two Agent Backends:**

1. **Claude Agent SDK** (`src/agent/ClaudeAgent.js`)
   - Default agent, uses `@anthropic-ai/claude-agent-sdk`
   - Uses `query()` function with custom hooks (PostToolUse, PostToolUseFailure, Stop)
   - Enforces at least one Playwright tool call per step (anti-hallucination mechanism)
   - Session management via WeakMap (browserContext -> sessionId)
   - Supports session resumption across multiple `runAgent()` calls

2. **LangChain Agent** (`src/agent/LangChainAgent.js`)
   - Alternative backend using `@langchain/langgraph`
   - Supports multiple providers: Anthropic, OpenAI, Google
   - Uses `createAgent()` with middleware for error handling
   - MemorySaver for conversation history
   - Compatible with existing MCP tools via `@langchain/mcp-adapters`
    
3. **Google ADK Agent** (`src/agent/GoogleADKAgent.js`)
   - Uses `@google/adk` (Agent Development Kit)
   - Supports Gemini models
   - Uses `LlmAgent` with `InMemorySessionService`
   - Wraps Playwright MCP tools for ADK compatibility

**Configuration & Usage**:

1. **Environment Variables**:
   - `AGENT_TYPE`: Set to `google-adk` to use Google ADK agent globally.
   - `GOOGLE_GENAI_API_KEY` (or `GOOGLE_API_KEY`): Required for Gemini models.

2. **Running Examples**:
   To run existing examples with Google ADK:
   ```bash
   export AGENT_TYPE=google-adk
   export GOOGLE_GENAI_API_KEY=your_key
   npx playwright test examples/todomvc/todomvc.spec.js
   ```

**Unified Interface** (`src/index.js`):
- `runAgent(prompt, pageOrContext, options)` - Routes to appropriate agent
- Agent selection: `options.agentType` > `AGENT_TYPE` env var > default ('claude')
- Supported types: `claude`, `langchain`, `google-adk`
- Accepts both Page and BrowserContext objects
- Returns string result or usage statistics (if `returnUsage: true`)

### Session Management

**ClaudeAgent Sessions** (`src/agent/SessionManager.js`):
- Maps BrowserContext -> sessionId (WeakMap)
- Maps BrowserContext -> MCP connection (WeakMap)
- MCP connection reused across multiple `runAgent()` calls
- Automatic cleanup via FinalizationRegistry when context is GC'd
- `resetSession(browserContext)` to start fresh (closes MCP connection)

**LangChain Sessions** (`src/agent/LangChainAgent.js`):
- Maps BrowserContext -> sessionData (WeakMap with cleanup)
- Includes checkpointer for conversation memory
- Thread ID management for LangGraph

### BDD Integration Layer

**Three Integration Points:**

1. **Playwright-BDD** (`src/bdd/playwright-bdd.js`)
   - Exports `test` fixture extended from `playwright-bdd`
   - Exports `Given`, `When`, `Then`, `Step` from `createBdd(test)`
   - `createAIStep(options)` - Register custom AI step pattern
   - `AIStep` - Pre-configured catch-all step `/^(.*)$/`
   - Auto-registers when imported: `import 'openqa/bdd/playwright-bdd'`

2. **Cucumber.js** (`src/bdd/cucumber.js`)
   - `enableAutoBrowserSetup(options)` - Auto browser lifecycle (Before/After hooks)
   - `createAIStep(options)` - Registers AI step with context from World
   - `createAIStepWithContext(getContext, options)` - Custom context provider
   - Auto-setup on import: `import 'openqa/bdd/cucumber'`

3. **YAML** (`src/yaml/`)
   - Schema validation (`src/yaml/schema.js`)
   - Test generator (`src/yaml/generator.js`) - Converts YAML to `.spec.js`
   - Supports: tests, hooks (beforeEach/afterEach), fixtures (in progress)
   - Generated tests use `test.step()` wrapping `runAgent()` calls

### CLI (`src/cli/`)

**Commands:**
- `openqa init [framework]` - Scaffold new project (YAML, Playwright-BDD, Cucumber)
- `openqa generate [paths...]` - Convert YAML to Playwright tests

**Templates:**
- `src/cli/templates/playwright-yaml/` - YAML test project template
- `src/cli/templates/playwright-bdd/` - Playwright-BDD template
- `src/cli/templates/cucumber/` - Cucumber.js template

### Export Structure

**Main exports** (`package.json`):
- `.` → `src/index.js` - `runAgent()`, `runClaudeAgent()`, `runLangChainAgent()`
- `./bdd` → `src/bdd/index.js` - `useBDD()`, re-exports from both integrations
- `./bdd/playwright-bdd` → `src/bdd/playwright-bdd.js`
- `./bdd/cucumber` → `src/bdd/cucumber.js`

**Peer Dependencies:**
- `@playwright/test` ^1.57.0 (required)
- `playwright-bdd` ^8.0.0 (optional)
- `@cucumber/cucumber` ^11.0.0 (optional)

## Critical Implementation Details

### Tool Enforcement (ClaudeAgent)

The ClaudeAgent uses a Stop hook to enforce at least one Playwright tool call per step:

```javascript
// In ClaudeAgent.js
hooks: {
  Stop: [{
    hooks: [async (input) => {
      if (playwrightToolCount === 0 && stopRetryCount < MAX_STOP_RETRIES) {
        return {
          continue: true,
          systemMessage: "CRITICAL: You MUST call a Playwright MCP tool..."
        };
      }
      return { continue: false };
    }]
  }]
}
```

**Why:** Prevents agent from responding based on cached/remembered page state instead of actual browser state.

### Context Resolution

Both Page and BrowserContext are accepted. Resolution logic:

```javascript
let browserContext;
let inputPage = null;
if (pageOrContext.context && typeof pageOrContext.context === 'function') {
  inputPage = pageOrContext;
  browserContext = pageOrContext.context();
} else {
  browserContext = pageOrContext;
}
```

### Environment Variable Loading

Multiple strategies for flexibility:
1. User's project `.env` (CWD) - loaded by `config()` in `src/index.js`
2. OpenQA package `.env` - loaded in agent files with explicit path
3. Environment variables (ANTHROPIC_API_KEY, AGENT_TYPE, DEFAULT_PROVIDER, etc.)

### Playwright-BDD Custom Fixtures

**Current branch: `feature/support-custom-fixtures-in-yaml`**

YAML fixtures generate test.extend() code with proper setup/teardown:
- Setup steps run before each test
- Teardown steps run after (in try/finally blocks)
- Fixtures are injected into test signature

## Examples Directory

Each example demonstrates different integration patterns:
- `playwright/` - Direct Playwright integration with `runAgent()`
- `playwright-yaml/` - YAML-based tests, generate via `npx openqa generate`
- `playwright-bdd/` - Manual Playwright-BDD setup with `createAIStep()`
- `playwright-bdd-simple/` - One-line integration: `export { test } from 'openqa/bdd/playwright-bdd'`
- `playwright-bdd-onkernel/` - Cloud browser integration (OnKernel)
- `playwright-bdd-steel/` - Steel browser integration
- `cucumberjs/` - Cucumber.js integration

All examples use `"openqa": "file:../.."` dependency for local development.

## Testing Strategy

Before any release:
1. Test in examples: `cd examples/[name] && npm test`
2. Test CLI init: `npx openqa init playwright-bdd` in temp directory
3. Test npm pack: `npm pack && cd ../test-project && npm install ../openqa/openqa-x.x.x.tgz`
4. Test npm link: `npm link && cd ../test-project && npm link openqa`
5. Verify all peer dependencies work (Playwright, Playwright-BDD, Cucumber)

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
4. **Don't hardcode agent type:** Always respect user configuration (env var or options)
5. **Don't create new fixtures without extend():** YAML fixtures must use proper Playwright fixture system
