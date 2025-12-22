/**
 * OpenQA Generate Command
 *
 * Generates Playwright .spec.js files from YAML test definitions.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, mkdirSync } from 'fs';
import { join, dirname, basename, extname, relative, resolve } from 'path';
import chalk from 'chalk';
import yaml from 'js-yaml';
import { generateTest } from '../yaml/generator.js';
import { validateSpec } from '../yaml/schema.js';
import { watch } from 'fs';

/**
 * Generate Playwright tests from YAML files
 * @param {string|string[]} paths - File path(s) or glob pattern
 * @param {object} options - Command options
 * @param {boolean} options.watch - Watch for changes
 * @param {boolean} options.verbose - Verbose output
 */
export async function generate(paths, options = {}) {
  const verbose = options.verbose !== false;

  if (verbose) {
    console.log(chalk.bold.cyan('\n🤖 OpenQA Test Generator\n'));
  }

  // Resolve paths
  let yamlFiles = [];

  if (!paths || paths.length === 0) {
    // Find all .spec.yaml files in current directory and subdirectories
    yamlFiles = findYamlFiles(process.cwd());
  } else {
    // Use provided paths
    for (const path of Array.isArray(paths) ? paths : [paths]) {
      if (existsSync(path)) {
        const stat = statSync(path);
        if (stat.isDirectory()) {
          yamlFiles.push(...findYamlFiles(path));
        } else if (path.endsWith('.spec.yaml') || path.endsWith('.spec.yml')) {
          yamlFiles.push(path);
        }
      } else {
        console.error(chalk.red(`❌ File not found: ${path}`));
      }
    }
  }

  if (yamlFiles.length === 0) {
    console.log(chalk.yellow('⚠️  No .spec.yaml files found'));
    console.log(chalk.gray('\nCreate a YAML test file like:\n'));
    console.log(chalk.cyan('tests/example.spec.yaml'));
    return;
  }

  if (verbose) {
    console.log(chalk.gray(`Found ${yamlFiles.length} YAML test file(s)\n`));
  }

  // Generate tests
  let successCount = 0;
  let errorCount = 0;

  for (const yamlFile of yamlFiles) {
    try {
      await generateSingleFile(yamlFile, { verbose });
      successCount++;
    } catch (error) {
      errorCount++;
      console.error(chalk.red(`\n❌ Error in ${yamlFile}:`));
      console.error(chalk.red(`   ${error.message}\n`));
    }
  }

  // Summary
  if (verbose) {
    console.log(chalk.bold('\n📊 Summary:'));
    console.log(chalk.green(`  ✓ ${successCount} file(s) generated`));
    if (errorCount > 0) {
      console.log(chalk.red(`  ✗ ${errorCount} file(s) failed`));
    }
    console.log();
  }

  // Watch mode
  if (options.watch) {
    console.log(chalk.cyan('👀 Watching for changes... (Ctrl+C to stop)\n'));

    for (const yamlFile of yamlFiles) {
      watch(yamlFile, { persistent: true }, async (eventType) => {
        if (eventType === 'change') {
          console.log(chalk.gray(`\n🔄 ${basename(yamlFile)} changed, regenerating...\n`));
          try {
            await generateSingleFile(yamlFile, { verbose: false });
            console.log(chalk.green(`✓ ${basename(yamlFile)} regenerated successfully\n`));
          } catch (error) {
            console.error(chalk.red(`❌ Error: ${error.message}\n`));
          }
        }
      });
    }

    // Keep process alive
    await new Promise(() => {});
  }
}

/**
 * Generate single test file
 * @param {string} yamlFile - Path to YAML file
 * @param {object} options - Options
 */
async function generateSingleFile(yamlFile, options = {}) {
  const verbose = options.verbose !== false;

  if (verbose) {
    console.log(chalk.cyan(`Generating ${basename(yamlFile)}...`));
  }

  // Read and parse YAML
  const yamlContent = readFileSync(yamlFile, 'utf8');
  let spec;

  try {
    spec = yaml.load(yamlContent);
  } catch (error) {
    throw new Error(`YAML parsing error: ${error.message}`);
  }

  // Validate
  try {
    validateSpec(spec);
  } catch (error) {
    throw new Error(`Validation error: ${error.message}`);
  }

  // Generate code
  const absoluteYamlPath = resolve(yamlFile);
  const jsCode = generateTest(yamlContent, basename(yamlFile), absoluteYamlPath);

  // Determine output path: Output to .tests-gen/ directory
  const outputFile = getOutputPath(yamlFile);

  // Auto-create output directory if missing
  const outputDir = dirname(outputFile);
  mkdirSync(outputDir, { recursive: true });

  // Write file
  writeFileSync(outputFile, jsCode, 'utf8');

  if (verbose) {
    console.log(chalk.green(`  ✓ Generated ${basename(outputFile)}\n`));
  }
}

/**
 * Determine output path for generated test file
 * @param {string} yamlFile - Path to YAML file
 * @returns {string} - Path to output JS file in .tests-gen/
 */
function getOutputPath(yamlFile) {
  // Convert: tests/auth/login.spec.yaml → .tests-gen/auth/login.spec.js

  // Convert absolute path to relative path from cwd
  let relativePath = yamlFile;
  if (join(yamlFile).startsWith(process.cwd())) {
    relativePath = relative(process.cwd(), yamlFile);
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
 * Find all .spec.yaml files in a directory recursively
 * @param {string} dir - Directory to search
 * @returns {string[]} - Array of file paths
 */
function findYamlFiles(dir) {
  const results = [];

  try {
    const items = readdirSync(dir);

    for (const item of items) {
      const fullPath = join(dir, item);

      try {
        const stat = statSync(fullPath);

        if (stat.isDirectory()) {
          // Skip node_modules and hidden directories
          if (!item.startsWith('.') && item !== 'node_modules') {
            results.push(...findYamlFiles(fullPath));
          }
        } else if (item.endsWith('.spec.yaml') || item.endsWith('.spec.yml')) {
          results.push(fullPath);
        }
      } catch (error) {
        // Skip files we can't access
        continue;
      }
    }
  } catch (error) {
    // Skip directories we can't read
  }

  return results;
}
