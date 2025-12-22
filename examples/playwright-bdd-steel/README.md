# Playwright BDD with Steel.dev Docker Browser

This example demonstrates using OpenQA with Playwright BDD tests running on a [Steel.dev](https://steel.dev) browser instance in Docker.

## Overview

This example is similar to the standard `playwright-bdd` and `playwright-bdd-onkernel` examples, but instead of running browsers locally or in the cloud, it uses a Steel.dev browser running in Docker on your local machine. This is useful for:

- Running tests with a pre-configured, consistent browser environment
- Avoiding local browser installation and management
- Testing in an isolated, containerized environment
- Accessing Steel.dev's enhanced browser features (stealth mode, etc.)
- Developing and testing locally before deploying to cloud Steel instances

## Prerequisites

1. **Docker**: Install Docker Desktop or Docker Engine
2. **Steel.dev Browser in Docker**: Running locally (see setup below)
3. **Anthropic API Key** (or Claude Code login): Required for the AI agent

## Steel.dev Docker Setup

Start the Steel.dev browser container:

```bash
# Pull and run the latest Steel browser image
docker run --rm -it -p 3000:3000 -p 9223:9223 ghcr.io/steel-dev/steel-browser:latest
```

This will:
- Expose the API on port 3000
- Expose Chrome debugging on port 9223 (CDP endpoint)
- Run the container interactively

Access the Steel UI at `http://localhost:3000/ui` to monitor browser sessions.

For persistent setup with docker-compose, see the [Steel.dev Docker documentation](https://docs.steel.dev/docker-hosting).

## Project Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables:
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and add your key:
   - `ANTHROPIC_API_KEY`: Your Anthropic API key (optional if using `claude login`)

## Running Tests

```bash
# Run all tests (headed mode shows browser UI)
npm test

# Run with Playwright UI mode
npm test:ui

# View test report
npm run test:report
```

## How It Works

### Architecture

```
Local Machine
┌─────────────────────────────────────────────────────┐
│                                                       │
│  ┌─────────────────┐         ┌──────────────────┐  │
│  │ Playwright Test │◄── CDP ─►│ Steel Docker     │  │
│  │ + OpenQA Agent  │ ws:9223  │ Chrome Browser   │  │
│  └─────────────────┘         └──────────────────┘  │
│                                                       │
└─────────────────────────────────────────────────────┘
```

### Key Differences from Other Examples

**vs. `playwright-bdd` (local browser)**:
- Uses Steel Docker browser instead of local Chromium
- Connects via CDP instead of launching browser
- Enhanced browser features (stealth mode, etc.)

**vs. `playwright-bdd-onkernel` (cloud browser)**:
- Connects to local Docker instead of cloud service
- No SDK dependency needed (direct CDP connection)
- No API key required for browser (only for OpenQA agent)
- Faster connection (local network vs. internet)

### Implementation Details

1. **fixtures.ts**: Creates a custom Playwright fixture that:
   - Connects to Steel Docker browser via CDP at `ws://localhost:9223`
   - Uses worker-scoped browser fixture (shared across tests)
   - Lets Playwright create fresh contexts per test (enables recording)
   - Cleans up by closing the CDP connection after tests

2. **playwright.config.ts**:
   - No `projects` section (no local browser launch)
   - `fullyParallel: true` with `workers: 2` for reasonable parallelism
   - Recording enabled: video, trace, screenshots

3. **Everything else stays the same**: Feature files, step definitions, and the OpenQA agent work identically

## File Structure

```
playwright-bdd-steel/
├── package.json              # Dependencies (no Steel SDK needed)
├── playwright.config.ts      # Playwright BDD config (no local browser)
├── .env.example              # Environment variables template
├── README.md                 # This file
└── features/
    ├── todomvc.feature       # BDD feature file (same as other examples)
    └── steps/
        ├── fixtures.ts       # Steel Docker browser fixture integration
        └── steps.ts          # Step definitions using OpenQA
```

## Troubleshooting

### Connection Refused
If you see "Connection refused" errors:
```
Error: connect ECONNREFUSED 127.0.0.1:9223
```

**Solution**: Make sure Steel Docker is running:
```bash
docker run --rm -it -p 3000:3000 -p 9223:9223 ghcr.io/steel-dev/steel-browser:latest
```

### Wrong Port
If you changed the Docker port mappings, update `.env`:
```bash
STEEL_CDP_URL=ws://localhost:YOUR_PORT
```

### API Key Issues
- Verify your Anthropic API key in `.env`
- Or use `claude login` for authentication (no ANTHROPIC_API_KEY needed)

### Browser Timeout
If tests timeout, check:
- Steel Docker container is running: `docker ps`
- Container logs: `docker logs [container_id]`
- UI is accessible: `http://localhost:3000/ui`

## Advanced Configuration

### Custom Docker Ports

If you're running Steel Docker with custom ports:

```bash
docker run --rm -it -p 3005:3000 -p 9224:9223 ghcr.io/steel-dev/steel-browser:latest
```

Update your `.env`:
```bash
STEEL_CDP_URL=ws://localhost:9224
STEEL_UI_URL=http://localhost:3005/ui
```

### Using Docker Compose

Create `docker-compose.yml` for persistent setup:

```yaml
services:
  steel-browser:
    image: ghcr.io/steel-dev/steel-browser:latest
    ports:
      - "3000:3000"
      - "9223:9223"
    volumes:
      - ./.cache:/app/.cache
```

Start: `docker compose up -d`

## Migration to Cloud Steel

When ready to move to cloud Steel.dev:

1. Sign up at [steel.dev](https://steel.dev)
2. Get your Steel API key
3. Change CDP URL to cloud: `wss://connect.steel.dev?apiKey=YOUR_KEY`

Or use the `steel-sdk` package for advanced features (proxy, CAPTCHA solving).

## Learn More

- [Steel.dev Documentation](https://docs.steel.dev)
- [Steel.dev Docker Guide](https://docs.steel.dev/docker-hosting)
- [Steel.dev GitHub](https://github.com/steel-dev/steel-browser)
- [OpenQA Documentation](https://github.com/auto-browse/openqa)
