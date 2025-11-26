import { runClaudeAgent } from './claude-agent.js';
import { runLangChainAgent } from './langchain-agent.js';
import { runDeepAgentsAgent } from './deepagents-agent.js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables from root .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
config({ path: join(rootDir, '.env') });

/**
 * Unified Browser Agent Interface
 *
 * Provides a single interface to run any of the three supported agents:
 * - Claude Agent SDK (claude)
 * - LangChain Agent (langchain)
 * - DeepAgents (deepagents)
 *
 * Configuration:
 * - Via environment variable: AGENT_TYPE=claude|langchain|deepagents
 * - Via options: options.agentType='claude'|'langchain'|'deepagents'
 * - Priority: options.agentType > AGENT_TYPE env var > default (claude)
 */

/**
 * Run browser agent with configurable backend
 * @param {string} prompt - Natural language instruction
 * @param {BrowserContext} browserContext - Playwright browser context from test
 * @param {object} options - Optional configuration
 * @param {string} options.agentType - Agent type: 'claude' or 'langchain'
 * @param {string} options.provider - AI provider (for langchain): 'anthropic', 'openai', or 'google'
 * @param {string} options.model - Model name (provider-specific)
 * @param {boolean} options.verbose - Enable verbose logging (default: true)
 * @param {boolean} options.returnUsage - Return usage statistics (default: false)
 * @param {object} options.modelConfig - Additional model configuration
 * @returns {Promise<string|object>} - The final result or result with usage data
 */
export async function runAgent(prompt, browserContext, options = {}) {
  // Determine which agent to use
  // Priority: options.agentType > AGENT_TYPE env var > default (claude)
  const agentType = options.agentType || process.env.AGENT_TYPE || 'claude';

  const verbose = options.verbose !== false;

  if (verbose) {
    console.log(`🎯 Using agent type: ${agentType}\n`);
  }

  // Route to the appropriate agent
  switch (agentType.toLowerCase()) {
    case 'claude':
      return runClaudeAgent(prompt, browserContext, options);

    case 'langchain':
      return runLangChainAgent(prompt, browserContext, options);

    case 'deepagents':
      return runDeepAgentsAgent(prompt, browserContext, options);

    default:
      throw new Error(
        `Unsupported agent type: ${agentType}. ` +
        `Supported types are: 'claude', 'langchain', 'deepagents'. ` +
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
runAgent.resetSession = async function(browserContext, options = {}) {
  const agentType = options.agentType || process.env.AGENT_TYPE || 'claude';

  switch (agentType.toLowerCase()) {
    case 'claude':
      return runClaudeAgent.resetSession(browserContext);

    case 'langchain':
      return runLangChainAgent.resetSession(browserContext);

    case 'deepagents':
      return runDeepAgentsAgent.resetSession(browserContext);

    default:
      throw new Error(
        `Unsupported agent type: ${agentType}. ` +
        `Supported types are: 'claude', 'langchain', 'deepagents'.`
      );
  }
};

// Also export individual agents for direct access
export { runClaudeAgent } from './claude-agent.js';
export { runLangChainAgent } from './langchain-agent.js';
export { runDeepAgentsAgent } from './deepagents-agent.js';
