/**
 * OpenQA BDD Integration for Cucumber.js
 *
 * Provides one-line integration to replace all step definitions with AI-powered steps.
 * Uses playwright-cli for browser automation — no Playwright browser context needed.
 *
 * @example
 * // Simplest usage - just import
 * import 'openqa/bdd/cucumber';
 *
 * @example
 * // With custom options
 * import { createAIStep } from 'openqa/bdd/cucumber';
 * createAIStep({ verbose: false, agentType: 'claude' });
 */

import { Given, When, Then, Before, After, setWorldConstructor, setDefaultTimeout } from '@cucumber/cucumber';
import { runAgent, createSession, closeSession } from '../index.js';

// Set default timeout to 4 minutes for AI-powered browser tests
setDefaultTimeout(240000);

/**
 * Custom World class that holds the playwright-cli session
 */
class OpenQAWorld {
  constructor() {
    this.sessionId = null;
  }
}

setWorldConstructor(OpenQAWorld);

// Session lifecycle: create before each scenario, close after
Before(async function () {
  this.sessionId = createSession();
});

After(async function () {
  if (this.sessionId) {
    await closeSession(this.sessionId);
    this.sessionId = null;
  }
});

/**
 * Creates and registers an AI-powered step that handles all Gherkin steps
 *
 * @param {object} options - Configuration options for the AI agent
 * @param {string} options.agentType - Agent type: 'claude' or 'langchain'
 * @param {boolean} options.verbose - Enable verbose logging (default: true)
 * @param {string} options.provider - AI provider (for langchain)
 * @param {string} options.model - Model name
 * @param {RegExp|string} options.pattern - Custom pattern to match (default: /^(.*)$/)
 * @returns {void}
 */
export function createAIStep(options = {}) {
  const pattern = options.pattern || /^(.*)$/;
  const agentOptions = {
    verbose: options.verbose !== false,
    agentType: options.agentType,
    provider: options.provider,
    model: options.model,
    modelConfig: options.modelConfig,
  };

  Given(pattern, async function (action) {
    if (options.verbose !== false) {
      console.log(`Executing AI step: ${action}`);
    }

    if (!this.sessionId) {
      throw new Error('No session available. Session should be created in Before hook.');
    }

    await runAgent(action, { session: this.sessionId, ...agentOptions });
  });
}

/**
 * Creates AI step with a custom session provider function
 *
 * @param {Function} getSession - Function that returns the session name
 * @param {object} options - Additional options for the AI agent
 */
export function createAIStepWithContext(getSession, options = {}) {
  const pattern = options.pattern || /^(.*)$/;
  const agentOptions = {
    verbose: options.verbose !== false,
    agentType: options.agentType,
    provider: options.provider,
    model: options.model,
    modelConfig: options.modelConfig,
  };

  Given(pattern, async function (action) {
    if (options.verbose !== false) {
      console.log(`Executing AI step: ${action}`);
    }

    const session = getSession ? getSession() : this.sessionId;

    if (!session) {
      throw new Error('No session available.');
    }

    await runAgent(action, { session, ...agentOptions });
  });
}

// Re-export Cucumber helpers for convenience
export { Given, When, Then, Before, After } from '@cucumber/cucumber';

// Auto-register AI step when imported
// This enables the simplest usage: import 'openqa/bdd/cucumber';
createAIStep({ verbose: true });
