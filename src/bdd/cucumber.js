/**
 * OpenQA BDD Integration for Cucumber.js
 *
 * Provides one-line integration to replace all step definitions with AI-powered steps.
 *
 * @example
 * // Simplest usage - just import
 * import 'openqa/bdd/cucumber';
 *
 * @example
 * // With custom options
 * import { createAIStep } from 'openqa/bdd/cucumber';
 * createAIStep({ verbose: false, agentType: 'claude' });
 *
 * @example
 * // Manual browser setup
 * import { createAIStepWithContext } from 'openqa/bdd/cucumber';
 * import { chromium } from 'playwright';
 *
 * let context;
 * Before(async function() {
 *   const browser = await chromium.launch();
 *   context = await browser.newContext();
 * });
 *
 * createAIStepWithContext(() => context);
 */

import { Given, When, Then, Before, After, setWorldConstructor } from '@cucumber/cucumber';
import { chromium } from 'playwright';
import { runAgent } from '../index.js';

let browser, context, page;

/**
 * Custom World class that holds the browser context
 */
class OpenQAWorld {
  constructor() {
    this.context = null;
    this.page = null;
    this.browser = null;
  }
}

setWorldConstructor(OpenQAWorld);

/**
 * Setup browser before each scenario (if auto-setup is enabled)
 */
let autoSetupEnabled = false;

/**
 * Enable automatic browser setup/teardown
 * Call this before creating AI steps if you want OpenQA to manage the browser
 */
export function enableAutoBrowserSetup(options = {}) {
  autoSetupEnabled = true;
  const browserOptions = options.browserOptions || { headless: true };

  Before(async function() {
    browser = await chromium.launch(browserOptions);
    context = await browser.newContext();
    page = await context.newPage();

    // Store in World for access in steps
    this.browser = browser;
    this.context = context;
    this.page = page;
  });

  After(async function() {
    if (page) await page.close();
    if (context) await context.close();
    if (browser) await browser.close();
  });
}

/**
 * Creates and registers an AI-powered step that handles all Gherkin steps
 * Uses the browser context from World
 *
 * @param {object} options - Configuration options for the AI agent
 * @param {string} options.agentType - Agent type: 'claude' or 'langchain'
 * @param {boolean} options.verbose - Enable verbose logging (default: true)
 * @param {string} options.provider - AI provider (for langchain)
 * @param {string} options.model - Model name
 * @param {RegExp|string} options.pattern - Custom pattern to match (default: /^(.*)$/)
 * @param {Function} options.getContext - Function that returns the browser context
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

  // Register a generic step that matches everything
  Given(pattern, async function(action) {
    if (options.verbose !== false) {
      console.log(`Executing AI step: ${action}`);
    }

    // Get context from World or provided function
    const ctx = options.getContext ? options.getContext() : (this.context || context);

    if (!ctx) {
      throw new Error(
        'No browser context available. Either:\n' +
        '1. Call enableAutoBrowserSetup() before createAIStep(), or\n' +
        '2. Provide getContext function, or\n' +
        '3. Set up context in Before() hook and store in World (this.context)'
      );
    }

    await runAgent(action, ctx, agentOptions);
  });
}

/**
 * Creates AI step with a custom context provider function
 *
 * @param {Function} getContext - Function that returns the browser context
 * @param {object} options - Additional options for the AI agent
 */
export function createAIStepWithContext(getContext, options = {}) {
  return createAIStep({ ...options, getContext });
}

// Re-export Cucumber helpers for convenience
export { Given, When, Then, Before, After } from '@cucumber/cucumber';

// Auto-register AI step with auto browser setup when imported
// This enables the simplest usage: import 'openqa/bdd/cucumber';
enableAutoBrowserSetup();
createAIStep({ verbose: true });
