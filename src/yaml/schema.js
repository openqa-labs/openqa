/**
 * YAML Schema Validator
 *
 * Validates YAML test definitions to catch errors before code generation.
 * Uses simple checks - no heavy validation library needed.
 */

/**
 * Validate YAML test specification
 * @param {object} spec - Parsed YAML object
 * @throws {Error} - If validation fails
 */
export function validateSpec(spec) {
  const errors = [];

  // Required fields
  if (!spec.name || typeof spec.name !== 'string') {
    errors.push('Missing or invalid "name" field (required, must be string)');
  }

  if (!spec.tests || !Array.isArray(spec.tests)) {
    errors.push('Missing or invalid "tests" field (required, must be array)');
  }

  // Optional fields type checking
  if (spec.url && typeof spec.url !== 'string') {
    errors.push('"url" must be a string');
  }

  if (spec.config) {
    validateConfig(spec.config, errors);
  }

  if (spec.hooks) {
    validateHooks(spec.hooks, errors);
  }

  if (spec.fixtures) {
    validateFixtures(spec.fixtures, errors);
  }

  // Validate each test
  if (spec.tests && Array.isArray(spec.tests)) {
    spec.tests.forEach((test, index) => {
      validateTest(test, index, errors);
    });
  }

  // Throw if any errors
  if (errors.length > 0) {
    throw new Error(`YAML validation failed:\n${errors.map(e => `  - ${e}`).join('\n')}`);
  }
}

/**
 * Validate config section
 * @param {object} config - Config object
 * @param {string[]} errors - Array to collect errors
 */
function validateConfig(config, errors) {
  if (config.baseURL !== undefined && typeof config.baseURL !== 'string') {
    errors.push('config.baseURL must be a string');
  }

  if (config.timeout !== undefined && typeof config.timeout !== 'number') {
    errors.push('config.timeout must be a number');
  }

  if (config.retries !== undefined && typeof config.retries !== 'number') {
    errors.push('config.retries must be a number');
  }

  if (config.parallel !== undefined && typeof config.parallel !== 'boolean') {
    errors.push('config.parallel must be a boolean');
  }
}

/**
 * Validate hooks section
 * @param {object} hooks - Hooks object
 * @param {string[]} errors - Array to collect errors
 */
function validateHooks(hooks, errors) {
  if (hooks.beforeEach && !Array.isArray(hooks.beforeEach)) {
    errors.push('hooks.beforeEach must be an array of strings');
  }

  if (hooks.afterEach && !Array.isArray(hooks.afterEach)) {
    errors.push('hooks.afterEach must be an array of strings');
  }

  // Validate each step is a string
  if (hooks.beforeEach && Array.isArray(hooks.beforeEach)) {
    hooks.beforeEach.forEach((step, index) => {
      if (typeof step !== 'string') {
        errors.push(`hooks.beforeEach[${index}] must be a string`);
      }
    });
  }

  if (hooks.afterEach && Array.isArray(hooks.afterEach)) {
    hooks.afterEach.forEach((step, index) => {
      if (typeof step !== 'string') {
        errors.push(`hooks.afterEach[${index}] must be a string`);
      }
    });
  }
}

/**
 * Validate fixtures section
 * @param {object} fixtures - Fixtures object
 * @param {string[]} errors - Array to collect errors
 */
function validateFixtures(fixtures, errors) {
  if (typeof fixtures !== 'object' || Array.isArray(fixtures)) {
    errors.push('fixtures must be an object');
    return;
  }

  for (const [name, definition] of Object.entries(fixtures)) {
    if (!definition.setup || !Array.isArray(definition.setup)) {
      errors.push(`fixture "${name}" must have a "setup" array`);
    }

    if (definition.setup && Array.isArray(definition.setup)) {
      definition.setup.forEach((step, index) => {
        if (typeof step !== 'string') {
          errors.push(`fixture "${name}".setup[${index}] must be a string`);
        }
      });
    }

    if (definition.teardown && !Array.isArray(definition.teardown)) {
      errors.push(`fixture "${name}".teardown must be an array if present`);
    }
  }
}

/**
 * Validate individual test
 * @param {object} test - Test definition
 * @param {number} index - Test index
 * @param {string[]} errors - Array to collect errors
 */
function validateTest(test, index, errors) {
  const prefix = `tests[${index}]`;

  // Required fields
  if (!test.name || typeof test.name !== 'string') {
    errors.push(`${prefix}: missing or invalid "name" field`);
  }

  if (!test.steps || !Array.isArray(test.steps)) {
    errors.push(`${prefix}: missing or invalid "steps" field (required array)`);
  }

  // Optional fields
  if (test.tags && !Array.isArray(test.tags)) {
    errors.push(`${prefix}.tags must be an array`);
  }

  if (test.use && !Array.isArray(test.use)) {
    errors.push(`${prefix}.use must be an array`);
  }

  if (test.data && !Array.isArray(test.data)) {
    errors.push(`${prefix}.data must be an array for data-driven tests`);
  }

  // Validate steps
  if (test.steps && Array.isArray(test.steps)) {
    test.steps.forEach((step, stepIndex) => {
      if (typeof step !== 'string') {
        errors.push(`${prefix}.steps[${stepIndex}] must be a string`);
      }
    });
  }

  // Validate annotations
  if (test.slow !== undefined && typeof test.slow !== 'boolean') {
    errors.push(`${prefix}.slow must be a boolean`);
  }

  if (test.only !== undefined && typeof test.only !== 'boolean') {
    errors.push(`${prefix}.only must be a boolean`);
  }

  if (test.skip !== undefined && typeof test.skip !== 'string') {
    errors.push(`${prefix}.skip must be a string (reason for skipping)`);
  }
}

/**
 * Get schema documentation as string
 * @returns {string} - Schema documentation
 */
export function getSchemaDoc() {
  return `
YAML Test Schema:

name: string              # Test suite name (required)
url?: string              # Base URL (optional)

config?:                  # Playwright config (optional)
  timeout?: number        # Test timeout in ms
  retries?: number        # Number of retries
  parallel?: boolean      # Run tests in parallel

hooks?:                   # Test hooks (optional)
  beforeEach?: string[]   # Steps before each test
  afterEach?: string[]    # Steps after each test

fixtures?:                # Custom fixtures (optional)
  <fixtureName>:
    setup: string[]       # Setup steps (required)
    teardown?: string[]   # Teardown steps (optional)

tests:                    # Test cases (required)
  - name: string          # Test name (required)
    steps: string[]       # Natural language steps (required)
    tags?: string[]       # Tags for filtering (e.g., ['smoke', 'critical'])
    slow?: boolean        # Mark as slow test
    skip?: string         # Skip with reason
    only?: boolean        # Run only this test
    use?: string[]        # Fixture names to use
    data?: object[]       # Data for parameterized tests
`.trim();
}
