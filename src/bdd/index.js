/**
 * OpenQA BDD Integration
 *
 * Main export for BDD integrations across different test frameworks.
 * Provides framework-specific helpers and auto-detection capabilities.
 *
 * @example
 * // Auto-detect and setup
 * import { useBDD } from 'openqa/bdd';
 * useBDD();
 *
 * @example
 * // Framework-specific imports
 * import 'openqa/bdd/playwright-bdd';
 * // or
 * import 'openqa/bdd/cucumber';
 */

/**
 * Auto-detect the BDD framework and set up AI-powered steps
 *
 * @param {string} framework - Framework name or 'auto' for auto-detection
 * @param {object} options - Configuration options for the AI agent
 * @returns {object} The framework-specific module
 */
export function useBDD(framework = 'auto', options = {}) {
  let detectedFramework = framework;

  // Auto-detect framework
  if (framework === 'auto') {
    try {
      require.resolve('playwright-bdd');
      detectedFramework = 'playwright-bdd';
    } catch (e) {
      try {
        require.resolve('@cucumber/cucumber');
        detectedFramework = 'cucumber';
      } catch (e2) {
        throw new Error(
          'No supported BDD framework found. Install one of:\n' +
          '  - playwright-bdd (npm install playwright-bdd)\n' +
          '  - @cucumber/cucumber (npm install @cucumber/cucumber)'
        );
      }
    }
  }

  // Load and setup the appropriate framework
  switch (detectedFramework.toLowerCase()) {
    case 'playwright-bdd':
      const playwrightBdd = require('./playwright-bdd.js');
      if (options.pattern || options.agentType || options.verbose !== undefined) {
        playwrightBdd.createAIStep(options);
      }
      return playwrightBdd;

    case 'cucumber':
    case 'cucumber.js':
    case '@cucumber/cucumber':
      const cucumber = require('./cucumber.js');
      if (options.pattern || options.agentType || options.verbose !== undefined) {
        cucumber.createAIStep(options);
      }
      return cucumber;

    default:
      throw new Error(
        `Unsupported BDD framework: ${detectedFramework}\n` +
        'Supported frameworks: playwright-bdd, cucumber'
      );
  }
}

/**
 * Re-export framework-specific modules for direct imports
 */
export * as playwrightBdd from './playwright-bdd.js';
export * as cucumber from './cucumber.js';

/**
 * Re-export commonly used functions from framework modules
 */
export { createAIStep as createPlaywrightBddAIStep, test, Given, When, Then, Step } from './playwright-bdd.js';
export {
  createAIStep as createCucumberAIStep,
  createAIStepWithContext,
} from './cucumber.js';
