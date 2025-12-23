import { test, expect } from '@playwright/test';
import { runAgent } from '../../src/index.js';

test('Google ADK Agent Test', async ({ page }) => {
    await page.goto('https://example.com');

    const result = await runAgent(
        'What is the title of this page?',
        page,
        {
            agentType: 'google-adk',
            model: 'gemini-2.0-flash'
        }
    );

    console.log('Agent Result:', result);
    expect(result).toContain('Example Domain');
});
