import { runAgent } from 'openqa';
import { aistep } from './fixtures';

// Generic AI step - handles ALL Given/When/Then steps with natural language
// Uses agent configured via AGENT_TYPE env var or defaults to 'claude'
aistep(/^(.*)$/, async ({ openqaSession }, action: string) => {
    console.log(`Executing AI step: ${action}`);
    await runAgent(action, { session: openqaSession, verbose: true });
});
