import { runClaudeAgent } from './agent/index.js';
import { runLangChainAgent } from './agent/index.js';
import { Orchestrator } from './agent/Orchestrator.js';
import { claudeCode } from './agent/providers/claudeCode.js';
import { config } from 'dotenv';

// Load environment variables from project's .env file (where the user runs the tests)
// This will look in the current working directory, not the package directory
config();

/**
 * Run browser agent with configurable backend
 * 
 * New API:
 * @param {object} provider - Agent Provider (e.g. claudeApi('claude-3-5-haiku-20241022'))
 * @param {string} prompt - Natural language instruction
 * @param {Page|BrowserContext} pageOrContext - Playwright page or browser context from test
 * @param {object} options - Optional configuration
 * 
 * Legacy API:
 * @param {string} prompt - Natural language instruction
 * @param {Page|BrowserContext} pageOrContext - Playwright page or browser context from test
 * @param {object} options - Optional configuration
 */
export async function runAgent(...args) {
  // New API signature: runAgent(provider, prompt, pageOrContext, options)
  if (typeof args[0] === 'object' && args[0] !== null && 
     (typeof args[0].execute === 'function' || typeof args[0].buildPrintCommand === 'function')) {
    const [provider, prompt, pageOrContext, options = {}] = args;
    const orchestrator = new Orchestrator(options);
    return orchestrator.run(provider, prompt, pageOrContext);
  }

  // Old API signature: runAgent(prompt, pageOrContext, options)
  const [prompt, pageOrContext, options = {}] = args;

  // Determine which agent to use
  // Priority: options.agentType > AGENT_TYPE env var > default (claude)
  const agentType = options.agentType || process.env.AGENT_TYPE || 'claude';

  const verbose = options.verbose !== false;

  if (verbose) {
    console.log(`🎯 Using legacy agent type: ${agentType}\n`);
  }

  // Route to the appropriate agent
  switch (agentType.toLowerCase()) {
    case 'claude':
      return runClaudeAgent(prompt, pageOrContext, options);

    case 'langchain':
      return runLangChainAgent(prompt, pageOrContext, options);

    default:
      throw new Error(
        `Unsupported agent type: ${agentType}. ` +
        `Supported types are: 'claude', 'langchain'. ` +
        `Set via options.agentType or AGENT_TYPE environment variable.`
      );
  }
}

/**
 * Reset the session for a specific browser context
 * This will reset the session for whichever agent is currently configured
 * @param {BrowserContext} browserContext - The browser context to reset
 * @param {object} options - Optional configuration
 * @param {string} options.agentType - Agent type to reset session for
 * @returns {Promise<string|null>} - The session ID that was reset, or null if none existed
 */
runAgent.resetSession = async function (browserContext, options = {}) {
  const agentType = options.agentType || process.env.AGENT_TYPE || 'claude';

  switch (agentType.toLowerCase()) {
    case 'claude':
      return runClaudeAgent.resetSession(browserContext);

    case 'langchain':
      return runLangChainAgent.resetSession(browserContext);

    default:
      throw new Error(
        `Unsupported agent type: ${agentType}. ` +
        `Supported types are: 'claude', 'langchain'.`
      );
  }
};

// Also export individual agents and providers for direct access
export { runClaudeAgent, runLangChainAgent } from './agent/index.js';
export { Orchestrator };
export { claudeCode } from './agent/providers/claudeCode.js';
