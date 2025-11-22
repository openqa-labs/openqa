# Playwright BDD with OnKernel Cloud Browsers

This example demonstrates using OpenQA with Playwright BDD tests running on [OnKernel](https://www.onkernel.com) cloud browsers.

## Overview

This example is similar to the standard `playwright-bdd` example, but instead of running browsers locally, it uses OnKernel's cloud browser infrastructure. This is useful for:

- Running tests in CI/CD environments without browser dependencies
- Accessing browsers from environments where local browser installation is not possible
- Scaling test execution with cloud browser instances

## Prerequisites

1. **OnKernel Account**: Sign up at [onkernel.com](https://www.onkernel.com) and get your API key
2. **Anthropic API Key** (or Claude Code login): Required for the AI agent

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables:
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and add your keys:
   - `KERNEL_API_KEY`: Your OnKernel API key
   - `ANTHROPIC_API_KEY`: Your Anthropic API key (optional if using `claude login`)

## Running Tests

```bash
# Run all tests
npm test

# Run with UI mode (note: browser runs in cloud, UI shows test progress)
npm test:ui

# View test report
npm run test:report
```

## How It Works

### Architecture

```
Local Machine                    OnKernel Cloud
┌─────────────────┐             ┌─────────────────┐
│ Playwright Test │◄──── CDP ───►│ Chrome Browser  │
│ + OpenQA Agent  │  WebSocket   │   Instance      │
└─────────────────┘             └─────────────────┘
```

### Key Differences from Local Browser Example

1. **fixtures.ts**: Creates a custom Playwright fixture that:
   - Initializes the OnKernel SDK
   - Creates a cloud browser instance via `kernel.browsers.create()`
   - Connects via Chrome DevTools Protocol (CDP)
   - Cleans up by deleting the browser session after tests

2. **playwright.config.ts**:
   - No `projects` section (no local browser needed)
   - `fullyParallel: false` to avoid overwhelming browser quota

3. **Everything else stays the same**: Feature files, step definitions, and the OpenQA agent work identically

## File Structure

```
playwright-bdd-onkernel/
├── package.json              # Dependencies including @onkernel/sdk
├── playwright.config.ts      # Playwright BDD config (no local browser)
├── .env.example              # Environment variables template
├── README.md                 # This file
└── features/
    ├── todomvc.feature       # BDD feature file (same as local example)
    └── steps/
        ├── fixtures.ts       # OnKernel browser fixture integration
        └── steps.ts          # Step definitions using OpenQA
```

## Troubleshooting

### Browser Timeout
If you see timeout errors, check that your `KERNEL_API_KEY` is correctly set. OnKernel browsers have a default 60-second idle timeout.

### CDP Connection Issues
Ensure your network allows WebSocket connections to OnKernel's infrastructure.

### API Key Issues
- Verify your OnKernel API key is valid at [onkernel.com](https://www.onkernel.com)
- For Anthropic, ensure you have API credits or use `claude login` for authentication
