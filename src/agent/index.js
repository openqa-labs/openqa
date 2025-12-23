
export { ClaudeAgent } from './ClaudeAgent.js';
export { sessionManager } from './SessionManager.js';
export { Logger } from './Logger.js';
export { LangChainAgent, langChainSessionManager } from './LangChainAgent.js';
export { runGoogleADKAgent } from './GoogleADKAgent.js';

import { ClaudeAgent } from './ClaudeAgent.js';
import { sessionManager } from './SessionManager.js';
import { LangChainAgent, langChainSessionManager } from './LangChainAgent.js';

/**
 * Run Claude agent with a specific browser context and automatic session management
 * @param {string} prompt - Natural language instruction
 * @param {Page|BrowserContext} pageOrContext - Playwright page or browser context from test
 * @param {object} options - Optional configuration
 * @returns {Promise<string>} - The final result
 */
export async function runClaudeAgent(prompt, pageOrContext, options = {}) {
    const agent = new ClaudeAgent(options);
    return agent.run(prompt, pageOrContext);
}

/**
 * Reset the session for a specific browser context
 * Useful for edge cases where you want to start fresh mid-test
 * @param {BrowserContext} browserContext - The browser context to reset
 * @returns {string|null} - The session ID that was reset, or null if none existed
 */
runClaudeAgent.resetSession = function (browserContext) {
    return sessionManager.resetSession(browserContext);
};

/**
 * Run LangChain agent with a specific browser context and automatic session management
 * @param {string} prompt - Natural language instruction
 * @param {Page|BrowserContext} pageOrContext - Playwright page or browser context from test
 * @param {object} options - Optional configuration
 * @returns {Promise<string>} - The final result
 */
export async function runLangChainAgent(prompt, pageOrContext, options = {}) {
    const agent = new LangChainAgent(options);
    return agent.run(prompt, pageOrContext);
}

/**
 * Reset the session for a specific browser context
 * @param {BrowserContext} browserContext - The browser context to reset
 * @returns {Promise<string|null>} - The session ID that was reset, or null if none existed
 */
runLangChainAgent.resetSession = async function (browserContext) {
    return langChainSessionManager.resetSession(browserContext);
};
