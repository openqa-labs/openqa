import { runAgent, claudeCode } from 'openqa';
import { aistep } from './fixtures';

// Generic AI step - handles ALL Given/When/Then steps with natural language
aistep(/^(.*)$/, async ({ page, context }, action: string) => {
    console.log(`Executing AI step: ${action}`);
    await runAgent(claudeCode('claude-haiku-4-5'), action, page, { verbose: true });
});
