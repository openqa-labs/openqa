import { Orchestrator } from './agent/Orchestrator.js';
import { claudeCode } from './agent/providers/claudeCode.js';
import { config } from 'dotenv';
import { sessionManager } from './agent/SessionManager.js';

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables from project's .env file (where the user runs the tests)
config();

// Fallback for monorepo/examples: load from package root if not found in cwd
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '..', '.env') });

/**
 * Run browser agent with configurable backend
 * 
 * @param {object} provider - Agent Provider (e.g. claudeCode('claude-haiku-4-5'))
 * @param {string} prompt - Natural language instruction
 * @param {Page|BrowserContext} pageOrContext - Playwright page or browser context from test
 * @param {object} options - Optional configuration
 */
export async function runAgent(provider, prompt, pageOrContext, options = {}) {
  const orchestrator = new Orchestrator(options);
  return orchestrator.run(provider, prompt, pageOrContext);
}

/**
 * Reset the session for a specific browser context
 * @param {BrowserContext} browserContext - The browser context to reset
 * @returns {string|null} - The session ID that was reset, or null if none existed
 */
runAgent.resetSession = function (browserContext) {
  return sessionManager.resetSession(browserContext);
};

export { Orchestrator };
export { claudeCode } from './agent/providers/claudeCode.js';
export { openCode } from './agent/providers/openCode.js';
