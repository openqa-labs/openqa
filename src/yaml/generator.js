/**
 * YAML to Playwright Test Generator
 *
 * Converts YAML test definitions into Playwright .spec.js files.
 * Each YAML step becomes a test.step() wrapping runAgent() call.
 *
 * Design Philosophy:
 * - Keep it simple: Just string templates
 * - No complex logic: Focus on AI agent, not framework
 * - Transparent: Generated code should be readable
 * - Session managed: playwright-cli session per test, shared across steps
 */

import yaml from 'js-yaml';
import { readFileSync } from 'fs';
import { resolve, relative, dirname, join } from 'path';

/**
 * Generate Playwright test code from YAML definition
 * @param {string} yamlContent - YAML file content
 * @param {string} sourceFile - Source YAML filename (for comments)
 * @param {string} yamlFilePath - Absolute path to YAML file (for fixture resolution)
 * @returns {string} - Generated JavaScript test code
 */
export function generateTest(yamlContent, sourceFile = 'test.yaml', yamlFilePath = null) {
  const spec = yaml.load(yamlContent);

  let code = '';

  // Header comment
  code += `// Auto-generated from ${sourceFile}\n`;
  code += `// DO NOT EDIT - changes will be overwritten on next generate\n`;
  code += `// Edit the YAML file instead and run: npx openqa generate\n\n`;

  // Imports
  if (spec.fixtureFile && yamlFilePath) {
    // Custom fixture file: compute relative path from output to fixture
    const fixtureImportPath = resolveFixtureImportPath(yamlFilePath, spec.fixtureFile);
    code += `import { test } from '${fixtureImportPath}';\n`;
  } else {
    // Default: use @playwright/test
    code += `import { test } from '@playwright/test';\n`;
  }
  code += `import { runAgent, createSession, closeSession } from 'openqa';\n\n`;

  // Start describe block
  code += `test.describe('${spec.name}', () => {\n`;

  // Session management: one session per test
  code += `  let _openqaSession;\n`;
  code += `  test.beforeEach(async () => { _openqaSession = createSession(); });\n`;
  code += `  test.afterEach(async () => { await closeSession(_openqaSession); });\n\n`;

  // Add hooks if present
  if (spec.hooks) {
    if (spec.hooks.beforeEach) {
      code += generateHook('beforeEach', spec.hooks.beforeEach);
    }
    if (spec.hooks.afterEach) {
      code += generateHook('afterEach', spec.hooks.afterEach);
    }
  }

  // Generate fixtures if present
  if (spec.fixtures) {
    code += generateFixtures(spec.fixtures);
  }

  // Generate tests
  for (const testDef of spec.tests) {
    code += generateTestCase(testDef);
  }

  // Close describe block
  code += `});\n`;

  return code;
}

/**
 * Generate hook code (beforeEach/afterEach)
 * @param {string} hookType - 'beforeEach' or 'afterEach'
 * @param {string[]} steps - Array of natural language steps
 * @returns {string} - Generated hook code
 */
function generateHook(hookType, steps) {
  let code = `  test.${hookType}(async () => {\n`;

  for (const step of steps) {
    code += `    await test.step('${escapeString(step)}', async () => {\n`;
    code += `      await runAgent('${escapeString(step)}', { session: _openqaSession, verbose: true });\n`;
    code += `    });\n`;
  }

  code += `  });\n\n`;
  return code;
}

/**
 * Generate fixtures code
 * @param {object} fixtures - Fixtures object from YAML
 * @returns {string} - Generated fixtures code
 */
function generateFixtures(fixtures) {
  let code = '';

  code += `  // Fixtures\n`;
  for (const [name, definition] of Object.entries(fixtures)) {
    code += `  // Fixture: ${name}\n`;
    if (definition.setup) {
      code += `  test.beforeEach(async () => {\n`;
      for (const step of definition.setup) {
        code += `    await test.step('[Fixture ${name}] ${escapeString(step)}', async () => {\n`;
        code += `      await runAgent('${escapeString(step)}', { session: _openqaSession, verbose: true });\n`;
        code += `    });\n`;
      }
      code += `  });\n\n`;
    }
  }

  return code;
}

/**
 * Generate test case code
 * @param {object} testDef - Test definition from YAML
 * @returns {string} - Generated test code
 */
function generateTestCase(testDef) {
  // Build test name with tags
  const tags = testDef.tags ? ' ' + testDef.tags.map(t => `@${t}`).join(' ') : '';
  const testName = `${testDef.name}${tags}`;

  let code = `  test('${escapeString(testName)}', async () => {\n`;

  // Add annotations
  if (testDef.slow) {
    code += `    test.slow();\n`;
  }
  if (testDef.skip) {
    code += `    test.skip(true, '${escapeString(testDef.skip)}');\n`;
  }
  if (testDef.only) {
    code += `    test.only();\n`;
  }

  // Handle data-driven tests
  if (testDef.data) {
    return generateDataDrivenTest(testDef);
  }

  // Generate steps
  for (const step of testDef.steps) {
    code += `    await test.step('${escapeString(step)}', async () => {\n`;
    code += `      await runAgent('${escapeString(step)}', { session: _openqaSession, verbose: true });\n`;
    code += `    });\n`;
  }

  code += `  });\n\n`;
  return code;
}

/**
 * Generate data-driven test code
 * @param {object} testDef - Test definition with data property
 * @returns {string} - Generated test code with data loop
 */
function generateDataDrivenTest(testDef) {
  let code = '';

  // Create data array
  code += `  const testData_${sanitizeName(testDef.name)} = ${JSON.stringify(testDef.data, null, 2)};\n\n`;

  // Loop through data
  code += `  for (const data of testData_${sanitizeName(testDef.name)}) {\n`;

  // Generate test with interpolated name
  const testNameTemplate = testDef.name.replace(/\{\{(\w+)\}\}/g, '${data.$1}');
  const tags = testDef.tags ? ' ' + testDef.tags.map(t => `@${t}`).join(' ') : '';

  code += `    test(\`${testNameTemplate}${tags}\`, async () => {\n`;

  // Add annotations
  if (testDef.slow) {
    code += `      test.slow();\n`;
  }

  // Generate steps with variable interpolation
  for (const step of testDef.steps) {
    const interpolatedStep = step.replace(/\{\{(\w+)\}\}/g, '${data.$1}');
    code += `      await test.step(\`${interpolatedStep}\`, async () => {\n`;
    code += `        await runAgent(\`${interpolatedStep}\`, { session: _openqaSession, verbose: true });\n`;
    code += `      });\n`;
  }

  code += `    });\n`;
  code += `  }\n\n`;

  return code;
}

/**
 * Escape string for safe inclusion in generated code
 * @param {string} str - String to escape
 * @returns {string} - Escaped string
 */
function escapeString(str) {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

/**
 * Sanitize name for use as variable name
 * @param {string} name - Original name
 * @returns {string} - Sanitized name
 */
function sanitizeName(name) {
  return name
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/^[0-9]/, '_$&');
}

/**
 * Resolve fixture file import path for generated test
 * @param {string} yamlFilePath - Absolute path to YAML file
 * @param {string} fixtureFile - Relative fixture path from YAML
 * @returns {string} - Relative import path from generated .js file to fixture
 */
function resolveFixtureImportPath(yamlFilePath, fixtureFile) {
  // Step 1: Resolve fixture file relative to YAML file directory
  const yamlDir = dirname(yamlFilePath);
  const absoluteFixturePath = resolve(yamlDir, fixtureFile);

  // Step 2: Determine output file path (.tests-gen/...)
  const outputPath = getOutputPath(yamlFilePath);
  const outputDir = dirname(outputPath);

  // Step 3: Compute relative path from output to fixture
  let relativePath = relative(outputDir, absoluteFixturePath);

  // Step 4: Ensure Unix-style separators and ./ prefix
  relativePath = relativePath.replace(/\\/g, '/');
  if (!relativePath.startsWith('.')) {
    relativePath = './' + relativePath;
  }

  return relativePath;
}

/**
 * Get output path for generated test (needed by resolveFixtureImportPath)
 * Note: This duplicates logic from generate.js - consider refactoring
 * @param {string} yamlFilePath - Absolute path to YAML file
 * @returns {string} - Path to output JS file in .tests-gen/
 */
function getOutputPath(yamlFilePath) {
  // Convert absolute path to relative path from cwd
  let relativePath = yamlFilePath;
  if (resolve(yamlFilePath).startsWith(process.cwd())) {
    relativePath = relative(process.cwd(), yamlFilePath);
  }

  // Replace extension
  let jsFile = relativePath.replace(/\.spec\.ya?ml$/, '.spec.js');

  // If starts with tests/, strip that prefix
  if (jsFile.startsWith('tests/')) {
    jsFile = jsFile.substring(6);  // Remove 'tests/'
  }

  // Prepend .tests-gen/
  return join('.tests-gen', jsFile);
}

/**
 * Generate test file from YAML file
 * @param {string} yamlFilePath - Path to YAML file
 * @returns {string} - Generated JavaScript code
 */
export function generateTestFromFile(yamlFilePath) {
  const yamlContent = readFileSync(yamlFilePath, 'utf8');
  const sourceFile = yamlFilePath.split('/').pop();
  const absoluteYamlPath = resolve(yamlFilePath);
  return generateTest(yamlContent, sourceFile, absoluteYamlPath);
}
