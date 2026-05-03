/**
 * OpenQA Init Command
 *
 * Scaffolds a new BDD project with OpenQA integration into a .openqa directory
 */

import * as clack from '@clack/prompts';
import chalk from 'chalk';
import { existsSync, mkdirSync, writeFileSync, readFileSync, cpSync, readdirSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CLAUDE_HOOKS_SETTINGS = {
  hooks: {
    PostToolUseFailure: [
      {
        matcher: 'browser_verify_',
        hooks: [
          {
            type: 'prompt',
            prompt: 'A Playwright assertion tool just failed. Hook input:\n$ARGUMENTS\n\nThis is a definitive test failure — the browser verification confirmed the expected condition was NOT met.\n\nReturn this JSON:\n{"decision": "block", "reason": "Assertion failed", "hookSpecificOutput": {"hookEventName": "PostToolUseFailure", "additionalContext": "ASSERTION FAILED. Do NOT call any more browser tools. Write a clear 1-2 sentence failure summary explaining what was expected vs what was actually found on the page, then stop."}}',
            model: 'claude-haiku-4-5',
            timeout: 30,
          },
        ],
      },
    ],
    Stop: [
      {
        hooks: [
          {
            type: 'prompt',
            prompt: 'You are validating a Playwright test agent\'s final output. Hook context:\n$ARGUMENTS\n\nCheck the tool_calls array. If none of them are browser_verify_* tools, return {"ok": true} immediately — no assertion was involved.\n\nIf there were browser_verify_* tool calls, inspect the output field. Does it contain a clear failure summary stating what was expected and what was actually found on the page? If yes: {"ok": true}. If the output is absent or too vague: {"ok": false, "reason": "Please write a clear 1-2 sentence failure summary: what the test expected to see, and what was actually on the page."}',
            model: 'claude-haiku-4-5',
            timeout: 30,
          },
        ],
      },
    ],
  },
};

// Read CLI's own package.json to detect version
const cliPackageJson = JSON.parse(
  readFileSync(join(__dirname, '../../package.json'), 'utf-8')
);
const cliVersion = cliPackageJson.version;

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

export async function init(cliFramework, options) {
  clack.intro(chalk.bgCyan.black(' 🤖 OpenQA Initialization '));

  const targetDir = resolve(process.cwd(), '.openqa');

  // Agent Selection
  const agent = await clack.select({
    message: 'Which AI agent would you like to use?',
    options: [
      { value: 'claudeCode', label: 'Claude Code (Anthropic)' },
    ],
  });
  if (clack.isCancel(agent)) return clack.cancel('Operation cancelled.');

  // Model Selection
  let model = await clack.select({
    message: 'Which model would you like to use?',
    options: [
      { value: 'claude-haiku-4-5', label: 'claude-haiku-4-5 (Default)' },
      { value: 'claude-sonnet-4-6', label: 'claude-sonnet-4-6' },
      { value: 'claude-opus-4-7', label: 'claude-opus-4-7' },
      { value: 'custom', label: 'Custom (enter manually)' },
    ],
  });
  if (clack.isCancel(model)) return clack.cancel('Operation cancelled.');

  if (model === 'custom') {
    model = await clack.text({
      message: 'Enter the model name manually:',
      placeholder: 'e.g. claude-3-5-sonnet-20241022',
      validate: (value) => {
        if (!value) return 'Please enter a model name.';
      }
    });
    if (clack.isCancel(model)) return clack.cancel('Operation cancelled.');
  }

  // Framework Selection
  let framework = cliFramework;
  if (!framework || !FRAMEWORKS[framework]) {
    framework = await clack.select({
      message: 'Which framework do you want to use?',
      options: [
        { value: 'playwright-bdd', label: 'Playwright-BDD' },
        { value: 'cucumber', label: 'CucumberJS' },
      ],
    });
    if (clack.isCancel(framework)) return clack.cancel('Operation cancelled.');
  }

  // Feature files path
  let featuresPath = await clack.text({
    message: 'What is the relative path to your feature files from the project root?',
    initialValue: 'features/',
    placeholder: 'features/',
  });
  if (clack.isCancel(featuresPath)) return clack.cancel('Operation cancelled.');
  
  // Normalize path format
  if (featuresPath.endsWith('/')) featuresPath = featuresPath.slice(0, -1);
  if (featuresPath.startsWith('./')) featuresPath = featuresPath.slice(2);

  // Check if directory exists
  if (existsSync(targetDir)) {
    const files = readdirSync(targetDir);
    if (files.length > 0 && !files.every(f => f.startsWith('.'))) {
      const confirmOverride = await clack.confirm({
        message: `Directory .openqa is not empty. Overwrite and re-initialize?`,
        initialValue: false,
      });
      if (clack.isCancel(confirmOverride) || !confirmOverride) {
        return clack.cancel('Aborted by user.');
      }
    }
  } else {
    mkdirSync(targetDir, { recursive: true });
  }

  const spinner = clack.spinner();
  spinner.start(`Scaffolding ${FRAMEWORKS[framework].name} into .openqa...`);

  const templateDir = join(__dirname, 'templates', framework);

  try {
    // Write Claude Code hooks settings — enables PostToolUseFailure and Stop hooks
    // that replace the hard-coded kill logic and provide meaningful failure reports
    const claudeDir = join(targetDir, '.claude');
    mkdirSync(claudeDir, { recursive: true });
    writeFileSync(join(claudeDir, 'settings.json'), JSON.stringify(CLAUDE_HOOKS_SETTINGS, null, 2));

    const toCopy = ['gitignore', 'package.json', 'README.md', '.env.example'];
    
    if (framework === 'playwright-bdd') {
      toCopy.push('playwright.config.ts');
      mkdirSync(join(targetDir, 'steps'), { recursive: true });
      cpSync(join(templateDir, 'features/steps/fixtures.ts'), join(targetDir, 'steps/fixtures.ts'));
      cpSync(join(templateDir, 'features/steps/steps.ts'), join(targetDir, 'steps/steps.ts'));
    } else if (framework === 'cucumber') {
      toCopy.push('cucumber.js');
      mkdirSync(join(targetDir, 'steps'), { recursive: true });
      cpSync(join(templateDir, 'features/step_definitions/steps.js'), join(targetDir, 'steps/steps.js'));
    }

    for (const file of toCopy) {
      if (existsSync(join(templateDir, file))) {
        cpSync(join(templateDir, file), join(targetDir, file === 'gitignore' ? '.gitignore' : file));
      }
    }

    // Rewrite configuration files to point to parent features directory
    if (framework === 'playwright-bdd') {
      const pConfigPath = join(targetDir, 'playwright.config.ts');
      let content = readFileSync(pConfigPath, 'utf8');
      content = content.replace(
        "features: 'features/*.feature',",
        `featuresRoot: '../${featuresPath}',\n  features: '../${featuresPath}/**/*.feature',`
      );
      content = content.replace("'features/steps/*.ts'", `'steps/*.ts'`);
      writeFileSync(pConfigPath, content);
    }

    if (framework === 'cucumber') {
      const cConfigPath = join(targetDir, 'cucumber.js');
      let content = readFileSync(cConfigPath, 'utf8');
      content = content.replace("'features/**/*.feature'", `'../${featuresPath}/**/*.feature'`);
      content = content.replace("'features/step_definitions/**/*.js'", `'steps/**/*.js'`);
      writeFileSync(cConfigPath, content);
    }

    // Replace the default model in steps files
    const stepsPath = framework === 'playwright-bdd' 
      ? join(targetDir, 'steps/steps.ts') 
      : join(targetDir, 'steps/steps.js');
    
    if (existsSync(stepsPath)) {
      let content = readFileSync(stepsPath, 'utf8');
      content = content.replace(/claudeCode\(['"][^'"]+['"]\)/g, `claudeCode('${model}')`);
      writeFileSync(stepsPath, content);
    }

    // Add scripts to package.json
    const packageJsonPath = join(targetDir, 'package.json');
    if (existsSync(packageJsonPath)) {
      const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
      if (framework === 'playwright-bdd') {
        pkg.scripts = {
          bddgen: 'bddgen',
          test: 'npm run bddgen && playwright test',
          'test:ui': 'npm run bddgen && playwright test --ui',
          'test:headed': 'npm run bddgen && playwright test --headed',
          'test:report': 'playwright show-report'
        };
      } else {
        pkg.scripts = {
          test: 'cucumber-js --format html:cucumber-test-results/cucumber-report.html',
          'test:headed': 'HEADLESS=false cucumber-js --format html:cucumber-test-results/cucumber-report.html',
          'test:report': 'open cucumber-test-results/cucumber-report.html'
        };
      }
      writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2));
    }

    spinner.stop('✓ Project files created successfully.');
  } catch (error) {
    spinner.stop('❌ Error creating files.');
    console.error(chalk.red(error.message));
    return;
  }

  // Install dependencies
  spinner.start('📦 Installing dependencies (this may take a minute)...');
  
  const config = FRAMEWORKS[framework];
  const openqaVersion = cliVersion.includes('beta') || cliVersion.includes('alpha') || cliVersion.includes('rc')
    ? `openqa@${cliVersion}`
    : 'openqa@latest';
  
  const allDeps = [...config.dependencies, ...config.devDependencies].map(dep =>
    dep === 'openqa' ? openqaVersion : dep
  );

  let dependenciesInstalled = false;
  try {
    execSync(`npm install ${allDeps.join(' ')}`, {
      cwd: targetDir,
      stdio: 'ignore',
    });
    spinner.stop('✓ Dependencies installed');
    dependenciesInstalled = true;
  } catch (error) {
    spinner.stop('❌ Error installing dependencies');
    console.error(chalk.red('You will need to run `npm install` manually inside .openqa'));
  }

  // Install Browsers
  if (dependenciesInstalled) {
    const installBrowsers = await clack.confirm({
      message: 'Install Playwright browsers now? (Chromium, ~150MB)',
      initialValue: true,
    });
    
    if (clack.isCancel(installBrowsers)) return clack.cancel('Operation cancelled.');

    if (installBrowsers) {
      spinner.start('📥 Installing Chromium...');
      try {
        execSync('npx playwright install chromium', { cwd: targetDir, stdio: 'ignore' });
        spinner.stop('✓ Chromium installed');
      } catch (error) {
        spinner.stop('❌ Error installing Chromium');
      }
    }
  }

  clack.note(
    `1. cd .openqa\n` +
    `2. cp .env.example .env\n` +
    `3. Add ANTHROPIC_API_KEY or CLAUDE_CODE_OAUTH_TOKEN to the .env file\n` +
    `4. npm run test:headed`,
    'Next Steps'
  );

  clack.outro(chalk.bold.green('🎉 .openqa scaffolding complete!'));
}
