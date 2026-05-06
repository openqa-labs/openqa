import { runAgent, claudeCode } from 'openqa';
import { aistep } from './fixtures';

const verbose = process.env.OPENQA_VERBOSE !== 'false';

// Generic AI step - handles ALL Given/When/Then steps with natural language
aistep(/^(.*)$/, async ({ page }, action: string) => {
    await runAgent(claudeCode('claude-haiku-4-5'), action, page, { verbose });
});
