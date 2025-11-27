#!/usr/bin/env node

/**
 * OpenQA CLI
 *
 * Scaffold new BDD projects with AI-powered test automation
 */

import { Command } from 'commander';
import { init } from '../src/cli/init.js';
import { generate } from '../src/cli/generate.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read package.json for version
const packageJson = JSON.parse(
  readFileSync(join(__dirname, '../package.json'), 'utf-8')
);

const program = new Command();

program
  .name('openqa')
  .description('AI-powered browser automation with OpenQA')
  .version(packageJson.version);

program
  .command('init [framework]')
  .description('Initialize a new OpenQA project')
  .option('-d, --dir <directory>', 'Project directory (default: current directory)')
  .action(async (framework, options) => {
    await init(framework, options);
  });

program
  .command('generate [paths...]')
  .description('Generate Playwright tests from YAML files')
  .option('-w, --watch', 'Watch for changes and regenerate automatically')
  .option('-v, --verbose', 'Verbose output', true)
  .action(async (paths, options) => {
    await generate(paths, options);
  });

program.parse();
