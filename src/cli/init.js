/**
 * OpenQA Init Command
 *
 * Scaffolds a new BDD project with OpenQA integration
 */

import inquirer from 'inquirer';
import chalk from 'chalk';
import { existsSync, mkdirSync, writeFileSync, readFileSync, cpSync, readdirSync } from 'fs';
import { join, resolve } from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FRAMEWORKS = {
  'playwright-bdd': {
    name: 'Playwright-BDD',
    description: 'Playwright with Gherkin/Cucumber syntax',
    dependencies: ['openqa', 'playwright-bdd', '@playwright/test', 'typescript'],
    devDependencies: ['@cucumber/cucumber'],
  },
  'cucumber': {
    name: 'Cucumber.js',
    description: 'Standalone Cucumber with Playwright',
    dependencies: ['openqa', '@cucumber/cucumber', '@playwright/test', 'typescript'],
    devDependencies: [],
  },
};

export async function init(framework, options) {
  console.log(chalk.bold.cyan('\n🤖 OpenQA Project Initialization\n'));

  // Prompt for framework if not provided
  if (!framework || !FRAMEWORKS[framework]) {
    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'framework',
        message: 'Which BDD framework would you like to use?',
        choices: [
          {
            name: `${FRAMEWORKS['playwright-bdd'].name} - ${FRAMEWORKS['playwright-bdd'].description}`,
            value: 'playwright-bdd',
          },
          {
            name: `${FRAMEWORKS['cucumber'].name} - ${FRAMEWORKS['cucumber'].description}`,
            value: 'cucumber',
          },
        ],
        default: 'playwright-bdd',
      },
    ]);
    framework = answers.framework;
  }

  const config = FRAMEWORKS[framework];
  const targetDir = options.dir ? resolve(options.dir) : process.cwd();

  // Check if directory exists and is empty
  if (existsSync(targetDir)) {
    const files = readdirSync(targetDir);
    if (files.length > 0 && !files.every(f => f.startsWith('.'))) {
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: `Directory ${targetDir} is not empty. Continue anyway?`,
          default: false,
        },
      ]);
      if (!confirm) {
        console.log(chalk.yellow('\n❌ Aborted\n'));
        return;
      }
    }
  } else {
    mkdirSync(targetDir, { recursive: true });
  }

  console.log(chalk.green(`\n✓ Creating ${config.name} project in ${targetDir}\n`));

  // Copy template files
  const templateDir = join(__dirname, 'templates', framework);

  try {
    cpSync(templateDir, targetDir, { recursive: true });
    console.log(chalk.green('✓ Project files created'));
  } catch (error) {
    console.error(chalk.red('❌ Error copying template files:'), error.message);
    return;
  }

  // Create package.json if it doesn't exist
  const packageJsonPath = join(targetDir, 'package.json');
  if (!existsSync(packageJsonPath)) {
    const packageJson = {
      name: 'openqa-project',
      version: '1.0.0',
      type: 'module',
      scripts:
        framework === 'playwright-bdd'
          ? {
              bddgen: 'bddgen',
              test: 'npm run bddgen && playwright test',
              'test:ui': 'npm run bddgen && playwright test --ui',
              'test:report': 'playwright show-report',
            }
          : {
              test: 'cucumber-js',
              'test:report': 'cucumber-js --format html:cucumber-report.html',
            },
      dependencies: {},
      devDependencies: {},
    };

    writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    console.log(chalk.green('✓ package.json created'));
  }

  // Install dependencies
  console.log(chalk.cyan('\n📦 Installing dependencies...\n'));
  const allDeps = [...config.dependencies, ...config.devDependencies];

  try {
    execSync(`npm install ${allDeps.join(' ')}`, {
      cwd: targetDir,
      stdio: 'inherit',
    });
    console.log(chalk.green('\n✓ Dependencies installed'));
  } catch (error) {
    console.error(chalk.red('\n❌ Error installing dependencies'));
    console.log(chalk.yellow('\nYou can install them manually with:'));
    console.log(chalk.cyan(`  npm install ${allDeps.join(' ')}\n`));
  }

  // Success message
  console.log(chalk.bold.green('\n🎉 Project created successfully!\n'));
  console.log(chalk.bold('Next steps:\n'));

  if (targetDir !== process.cwd()) {
    console.log(chalk.cyan(`  cd ${targetDir}`));
  }

  console.log(chalk.cyan('  # Set up authentication:'));
  console.log(chalk.cyan('  # 1. Copy .env.example to .env'));
  console.log(chalk.cyan('  cp .env.example .env'));
  console.log(chalk.cyan('  # 2. Choose authentication method (see .env file)'));
  console.log(chalk.cyan('  claude login                 # OR edit .env\n'));

  if (framework === 'playwright-bdd') {
    console.log(chalk.cyan('  # Run the example test:'));
    console.log(chalk.cyan('  npm test\n'));
    console.log(chalk.cyan('  # View the test report:'));
    console.log(chalk.cyan('  npm run test:report\n'));
  } else {
    console.log(chalk.cyan('  # Run the example test:'));
    console.log(chalk.cyan('  npm test\n'));
  }

  console.log(chalk.bold('Now you can write your .feature files and let AI handle the automation!\n'));
  console.log(chalk.gray('📚 Learn more: https://www.auto-browse.com/\n'));
}
