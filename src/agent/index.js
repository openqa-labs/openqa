
export { ClaudeAgent } from './ClaudeAgent.js';
export { sessionManager } from './SessionManager.js';
export { Logger } from './Logger.js';
export { LangChainAgent, langChainSessionManager } from './LangChainAgent.js';

import { ClaudeAgent } from './ClaudeAgent.js';
import { sessionManager } from './SessionManager.js';
import { LangChainAgent, langChainSessionManager } from './LangChainAgent.js';

/**
 * Run Claude agent with session-based browser management
 * @param {string} prompt - Natural language instruction
 * @param {object} options - Optional configuration
 * @param {string} options.session - playwright-cli session name
 * @returns {Promise<string>} - The final result
 */
export async function runClaudeAgent(prompt, options = {}) {
    const agent = new ClaudeAgent(options);
    return agent.run(prompt, options);
}

/**
 * Reset the session for a specific session name
 * @param {string} sessionName - The playwright-cli session name to reset
 * @returns {string|null} - The session ID that was reset, or null if none existed
 */
runClaudeAgent.resetSession = function (sessionName) {
    return sessionManager.resetSession(sessionName);
};

/**
 * Run LangChain agent with session-based browser management
 * @param {string} prompt - Natural language instruction
 * @param {object} options - Optional configuration
 * @param {string} options.session - playwright-cli session name
 * @returns {Promise<string>} - The final result
 */
export async function runLangChainAgent(prompt, options = {}) {
    const agent = new LangChainAgent(options);
    return agent.run(prompt, options);
}

/**
 * Reset the session for a specific session name
 * @param {string} sessionName - The playwright-cli session name to reset
 * @returns {Promise<string|null>} - The session ID that was reset, or null if none existed
 */
runLangChainAgent.resetSession = async function (sessionName) {
    return langChainSessionManager.resetSession(sessionName);
};
