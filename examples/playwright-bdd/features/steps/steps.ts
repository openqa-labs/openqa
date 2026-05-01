import { expect } from '@playwright/test';
import { runAgent, claudeApi } from 'openqa';
//import { Given, When, Then } from './fixtures';
import { aistep } from './fixtures';

// Generic AI step - handles ALL Given/When/Then steps with natural language
// Uses agent configured via AGENT_TYPE env var or defaults to 'claude'
aistep(/^(.*)$/, async ({ page, context }, action: string) => {
    console.log(`Executing AI step: ${action}`);
    await runAgent(claudeApi('claude-3-5-haiku-20241022'), action, page, { verbose: true });
});
