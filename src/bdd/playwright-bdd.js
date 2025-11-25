/**
 * OpenQA BDD Integration for Playwright-BDD
 *
 * Provides one-line integration to replace all step definitions with AI-powered steps.
 *
 * @example
 * // Simplest usage - just import and you're done
 * import 'openqa/bdd/playwright-bdd';
 *
 * @example
 * // With custom options
 * import { createAIStep } from 'openqa/bdd/playwright-bdd';
 * createAIStep({ verbose: false, agentType: 'claude' });
 *
 * @example
 * // Manual usage with more control
 * import { test, AIStep } from 'openqa/bdd/playwright-bdd';
 * export { test };
 * // AIStep is automatically registered
 */

import { test as base, createBdd } from 'playwright-bdd';
import { runAgent } from '../index.js';

/**
 * Extended Playwright test with BDD support
 * Users can extend this further if needed
 */
export const test = base.extend({
  // Custom fixtures can be added here if needed in the future
});

/**
 * BDD step helpers (Given, When, Then, Step)
 * Re-exported for convenience
 */
const { Given, When, Then, Step } = createBdd(test);
export { Given, When, Then, Step };

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

  Step(pattern, async ({ context }, action) => {
    if (options.verbose !== false) {
      console.log(`Executing AI step: ${action}`);
    }
    await runAgent(action, context, agentOptions);
  });
}

/**
 * Pre-configured AI step that catches all Gherkin steps
 * Automatically registered when this module is imported
 */
export const AIStep = Step(/^(.*)$/, async ({ context }, action) => {
  console.log(`Executing AI step: ${action}`);
  await runAgent(action, context, { verbose: true });
});

// Auto-register the AI step when module is imported
// This enables the simplest usage: import 'openqa/bdd/playwright-bdd';
// The AIStep is already exported above, so it's registered immediately
