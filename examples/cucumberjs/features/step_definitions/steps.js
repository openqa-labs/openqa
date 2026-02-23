import { defineStep, Before, After, setDefaultTimeout } from '@cucumber/cucumber';
import { runAgent, createSession, closeSession } from 'openqa';

// Set default timeout to 3 minutes for AI agent steps
setDefaultTimeout(180000);

Before(async function () {
  this.sessionId = createSession();
});

After(async function () {
  if (this.sessionId) {
    await closeSession(this.sessionId);
    this.sessionId = null;
  }
});

// Generic AI step - handles ALL Given/When/Then steps with natural language
// Uses agent configured via AGENT_TYPE env var or defaults to 'claude'
defineStep(/^(.*)$/, async function (action) {
  await runAgent(action, { session: this.sessionId, verbose: true });
});
