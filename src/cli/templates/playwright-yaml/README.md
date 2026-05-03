# OpenQA YAML Tests

Write Playwright tests in YAML using natural language. No JavaScript required!

## Quick Start

1. **Write a YAML test** in `tests/`:

```yaml
name: My Tests
tests:
  - name: Test something
    steps:
      - Navigate to home page
      - Click the login button
      - Verify dashboard is visible
```

2. **Run tests**:

```bash
npm test
```

That's it! Tests auto-generate and run with Playwright.

## How It Works

- ✅ Write tests in **`tests/*.spec.yaml`** (committed to git)
- ✅ Run `npm test` (auto-generates `.tests-gen/*.spec.js`)
- ❌ `.tests-gen/` is gitignored (never commit generated files)

Each YAML step becomes a `test.step()` in Playwright, giving you:
- Beautiful test reports
- Trace viewer integration
- Screenshots and videos
- Full Playwright power

## Workflow

### Development
```bash
# Edit YAML tests
vim tests/login.spec.yaml

# Run (auto-generates + runs)
npm test

# Or run with UI
npm run test:ui
```

### Git
```bash
git add tests/login.spec.yaml   # ✅ Commit YAML (source)
git add .tests-gen/             # ❌ Already gitignored
git commit -m "Add login tests"
```

### CI/CD
```yaml
- run: npm install
- run: npx playwright install chromium
- run: npm test  # Generates + runs
```

## YAML Syntax

```yaml
name: Test Suite Name

config:
  timeout: 180000
  retries: 2

hooks:
  beforeEach:
    - Clear cookies
    - Navigate to home

tests:
  - name: Test name
    tags: [smoke, critical]
    steps:
      - Step in natural language
      - Another step
      - Verify something
```

## Authentication

Choose ONE method in `.env`:

**Option A: Claude Code CLI** (recommended)
```bash
claude login
```

**Option B: API Key**
```bash
cp .env.example .env
# Edit .env and add: ANTHROPIC_API_KEY=your_key
```

**Option C: Other Providers** (OpenAI, Google)
```bash
cp .env.example .env
# Edit .env:
# AGENT_TYPE=langchain
# DEFAULT_PROVIDER=openai
# OPENAI_API_KEY=your_key
```

## Learn More

- [OpenQA Documentation](https://openqa.io/)
- [Playwright Documentation](https://playwright.dev)
