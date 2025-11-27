/**
 * OpenQA Init Command
 *
 * Scaffolds a new BDD project with OpenQA integration
 */

import inquirer from 'inquirer';
import chalk from 'chalk';
import { existsSync, mkdirSync, writeFileSync, readFileSync, cpSync, readdirSync, unlinkSync } from 'fs';
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
  'playwright-yaml': {
    name: 'Playwright-YAML',
    description: 'Write tests in YAML with natural language',
    dependencies: ['openqa', '@playwright/test'],
    devDependencies: [],
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

  // Prompt for framework (always prompt if not provided, making it truly optional)
  if (!framework) {
    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'framework',
        message: 'Which testing framework would you like to use?',
        choices: [
          {
            name: `${FRAMEWORKS['playwright-bdd'].name} - ${FRAMEWORKS['playwright-bdd'].description}`,
            value: 'playwright-bdd',
          },
          {
            name: `${FRAMEWORKS['playwright-yaml'].name} - ${FRAMEWORKS['playwright-yaml'].description}`,
            value: 'playwright-yaml',
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
  } else if (!FRAMEWORKS[framework]) {
    console.error(chalk.red(`\n❌ Unknown framework: ${framework}`));
    console.log(chalk.yellow('Available frameworks: playwright-bdd, playwright-yaml, cucumber\n'));
    return;
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

  // Rename gitignore to .gitignore (npm excludes .gitignore from packages)
  const gitignoreSrc = join(targetDir, 'gitignore');
  const gitignoreDest = join(targetDir, '.gitignore');
  if (existsSync(gitignoreSrc)) {
    try {
      cpSync(gitignoreSrc, gitignoreDest);
      unlinkSync(gitignoreSrc);
    } catch (error) {
      console.error(chalk.yellow('⚠️  Could not create .gitignore file'));
    }
  }

  // Create package.json if it doesn't exist
  const packageJsonPath = join(targetDir, 'package.json');
  if (!existsSync(packageJsonPath)) {
    let scripts;
    if (framework === 'playwright-bdd') {
      scripts = {
        bddgen: 'bddgen',
        test: 'npm run bddgen && playwright test',
        'test:ui': 'npm run bddgen && playwright test --ui',
        'test:report': 'playwright show-report',
      };
    } else if (framework === 'playwright-yaml') {
      scripts = {
        generate: 'openqa generate',
        test: 'openqa generate && playwright test',
        'test:ui': 'openqa generate && playwright test --ui',
        'test:headed': 'openqa generate && playwright test --headed',
        'test:report': 'playwright show-report',
      };
    } else {
      scripts = {
        test: 'cucumber-js --format html:cucumber-test-results/cucumber-report.html',
        'test:headed': 'HEADLESS=false cucumber-js --format html:cucumber-test-results/cucumber-report.html',
        'test:report': 'open cucumber-test-results/cucumber-report.html',
      };
    }

    const packageJson = {
      name: 'openqa-project',
      version: '1.0.0',
      type: 'module',
      scripts,
      dependencies: {},
      devDependencies: {},
    };

    writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    console.log(chalk.green('✓ package.json created'));
  }

  // Install dependencies
  console.log(chalk.cyan('\n📦 Installing dependencies...\n'));
  const allDeps = [...config.dependencies, ...config.devDependencies];

  let dependenciesInstalled = false;
  try {
    execSync(`npm install ${allDeps.join(' ')}`, {
      cwd: targetDir,
      stdio: 'inherit',
    });
    console.log(chalk.green('\n✓ Dependencies installed'));
    dependenciesInstalled = true;
  } catch (error) {
    console.error(chalk.red('\n❌ Error installing dependencies'));
    console.log(chalk.yellow('\nYou can install them manually with:'));
    console.log(chalk.cyan(`  npm install ${allDeps.join(' ')}\n`));
  }

  // Prompt to install Playwright browsers
  let browsersInstalled = false;
  if (dependenciesInstalled) {
    const { installBrowsers } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'installBrowsers',
        message: 'Install Playwright browsers now? (Chromium, ~150MB download)',
        default: true,
      },
    ]);

    if (installBrowsers) {
      console.log(chalk.cyan('\n📥 Installing Chromium browser...\n'));
      try {
        execSync('npx playwright install chromium', {
          cwd: targetDir,
          stdio: 'inherit',
        });
        console.log(chalk.green('\n✓ Chromium browser installed'));
        browsersInstalled = true;
      } catch (error) {
        console.error(chalk.red('\n❌ Error installing browsers'));
        console.log(chalk.yellow('\nYou can install it manually with:'));
        console.log(chalk.cyan('  npx playwright install chromium\n'));
      }
    }
  }

  // Prompt for AI provider selection
  const { provider } = await inquirer.prompt([
    {
      type: 'list',
      name: 'provider',
      message: 'Which AI provider will you use?',
      choices: [
        {
          name: 'Anthropic (Claude Code, Anthropic API Key)',
          value: 'anthropic',
        },
        {
          name: 'Other Providers (OpenAI, Google, etc.)',
          value: 'other',
        },
      ],
      default: 'anthropic',
    },
  ]);

  // Success message
  console.log(chalk.bold.green('\n🎉 Project created successfully!\n'));
  console.log(chalk.bold('Next steps:\n'));

  if (targetDir !== process.cwd()) {
    console.log(chalk.cyan(`  cd ${targetDir}`));
  }

  // Browser installation instructions (if skipped)
  if (!browsersInstalled && dependenciesInstalled) {
    console.log(chalk.cyan('\n  # Install Playwright browsers:'));
    console.log(chalk.cyan('  npx playwright install chromium\n'));
  }

  // Provider-specific authentication instructions
  console.log(chalk.cyan('  # Set up AI authentication:\n'));

  if (provider === 'anthropic') {
    console.log(chalk.bold('  Choose ONE authentication method:\n'));
    console.log(chalk.cyan('  A. Claude Code CLI (Recommended)'));
    console.log(chalk.cyan('     claude login\n'));
    console.log(chalk.cyan('  B. Anthropic API Key'));
    console.log(chalk.cyan('     cp .env.example .env'));
    console.log(chalk.cyan('     # Edit .env and add: ANTHROPIC_API_KEY=your_key\n'));
    console.log(chalk.cyan('  C. Claude Code OAuth Token'));
    console.log(chalk.cyan('     cp .env.example .env'));
    console.log(chalk.cyan('     # Edit .env and add: CLAUDE_CODE_OAUTH_TOKEN=your_token\n'));
  } else {
    console.log(chalk.cyan('  cp .env.example .env'));
    console.log(chalk.cyan('  # Edit .env file and configure:\n'));
    console.log(chalk.cyan('  AGENT_TYPE=langchain'));
    console.log(chalk.cyan('  DEFAULT_PROVIDER=openai          # or \'google\''));
    console.log(chalk.cyan('  OPENAI_API_KEY=your_key          # or GOOGLE_API_KEY\n'));
    console.log(chalk.gray('  # Optional: OPENAI_MODEL, RECURSION_LIMIT, etc.\n'));
  }

  // Test run instructions
  if (framework === 'playwright-bdd' || framework === 'playwright-yaml') {
    console.log(chalk.cyan('  # Run the example test:'));
    console.log(chalk.cyan('  npm test\n'));
    console.log(chalk.cyan('  # View the test report:'));
    console.log(chalk.cyan('  npm run test:report\n'));
  } else {
    console.log(chalk.cyan('  # Run the example test:'));
    console.log(chalk.cyan('  npm test\n'));
  }

  if (framework === 'playwright-yaml') {
    console.log(chalk.bold('Now you can write your YAML tests and let AI handle the automation!\n'));
  } else {
    console.log(chalk.bold('Now you can write your .feature files and let AI handle the automation!\n'));
  }
  console.log(chalk.gray('📚 Learn more: https://www.auto-browse.com/\n'));
}
