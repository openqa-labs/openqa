
import { query } from '@anthropic-ai/claude-agent-sdk';
import { Logger } from './Logger.js';
import { sessionManager } from './SessionManager.js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables from project root .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../..');
config({ path: join(projectRoot, '.env') });

export class ClaudeAgent {
    constructor(options = {}) {
        this.options = options;
        this.verbose = options.verbose !== false;
        this.logger = new Logger(this.verbose);
    }

    async run(prompt, options = {}) {
        const returnUsage = this.options.returnUsage || false;
        const sessionName = options.session || this.options.session;

        // Track usage
        const processedMessageIds = new Set();
        const stepUsages = [];
        let totalUsage = null;
        let stepCount = 0;

        if (this.verbose) {
            this.logger.log(`🤖 Running Claude agent: "${prompt}"\n`);
            if (sessionName) {
                this.logger.log(`🔑 Session: ${sessionName}\n`);
            }
        }

        try {
            const existingSessionId = sessionName ? sessionManager.getSession(sessionName) : undefined;
            const abortController = new AbortController();

            if (existingSessionId && this.verbose) {
                this.logger.log(`♻️  SESSION: Resuming session: ${existingSessionId}\n`);
            }

            const queryOptions = this._buildQueryOptions(existingSessionId, abortController, sessionName);

            // Track playwright-cli calls to enforce at least one per step
            let playwrightToolCount = 0;
            let stopRetryCount = 0;
            const MAX_STOP_RETRIES = 2;

            // Hooks for tool tracking and enforcement
            queryOptions.hooks = {
                // Track successful playwright-cli calls
                PostToolUse: [{
                    hooks: [async (input) => {
                        // Count Bash calls that invoke playwright-cli
                        if (input.tool_name === 'Bash' && input.tool_input &&
                            typeof input.tool_input.command === 'string' &&
                            input.tool_input.command.includes('playwright-cli')) {
                            playwrightToolCount++;
                            if (this.verbose) {
                                console.log(`🔧 playwright-cli called (count: ${playwrightToolCount})`);
                            }
                        }
                        return { hookEventName: 'PostToolUse' };
                    }]
                }],

                // Handle tool failures - log but let agent recover
                PostToolUseFailure: [{
                    hooks: [async (input) => {
                        // Count failed playwright-cli calls too (they were still called)
                        if (input.tool_name === 'Bash' && input.tool_input &&
                            typeof input.tool_input.command === 'string' &&
                            input.tool_input.command.includes('playwright-cli')) {
                            playwrightToolCount++;
                        }

                        this.logger.logToolError(input);

                        // Let the agent recover from tool errors (e.g., "browser not open" → run open first)
                        return {
                            hookEventName: 'PostToolUseFailure',
                        };
                    }]
                }],

                // Enforce tool usage - reject responses with no playwright-cli calls
                Stop: [{
                    hooks: [async (input) => {
                        if (playwrightToolCount === 0 && stopRetryCount < MAX_STOP_RETRIES) {
                            stopRetryCount++;
                            if (this.verbose) {
                                console.log(`\n⚠️  No playwright-cli call found! Forcing retry (${stopRetryCount}/${MAX_STOP_RETRIES})...\n`);
                            }
                            const sessionFlag = sessionName ? ` -s=${sessionName}` : '';
                            return {
                                continue: true,
                                systemMessage: `CRITICAL: You MUST call playwright-cli commands (via Bash) to complete this task. Do NOT respond based on cached page state. You have not called any playwright-cli command yet. Call the appropriate command NOW. Example: playwright-cli snapshot${sessionFlag}`
                            };
                        }

                        if (this.verbose && playwrightToolCount > 0) {
                            console.log(`✅ Stop hook: ${playwrightToolCount} playwright-cli call(s) made\n`);
                        }

                        return { continue: false }; // Allow stop
                    }]
                }]
            };

            if (this.verbose) {
                this.logger.log('🔧 Query Options Hooks Keys:', Object.keys(queryOptions.hooks));
            }

            const result = query({
                prompt: prompt,
                options: queryOptions
            });

            if (this.verbose) {
                this.logger.log('📡 Processing messages from Claude Code:\n');
            }

            let finalResult = '';
            let currentSessionId = existingSessionId;

            for await (const message of result) {
                // Log user messages in debug mode
                if (message.type === 'user' && message.message && message.message.content) {
                    this.logger.logUserMessage(message);
                }

                switch (message.type) {
                    case 'system':
                        if (message.subtype === 'init' && message.session_id) {
                            currentSessionId = message.session_id;
                            if (sessionName) {
                                sessionManager.setSession(sessionName, currentSessionId);
                            }
                            this.logger.logSessionStart(currentSessionId, !!existingSessionId, message.mcp_servers);
                        }
                        break;

                    case 'assistant':
                        if (message.usage && message.id && !processedMessageIds.has(message.id)) {
                            processedMessageIds.add(message.id);
                            stepUsages.push(message.usage);
                            stepCount++;
                            this.logger.logStep(stepCount, message.usage);
                        }
                        this.logger.logAssistantMessage(message.message.content);
                        break;

                    case 'result':
                        if (message.subtype === 'success') {
                            finalResult = message.result;
                            totalUsage = message.usage;
                            this.logger.logResult(finalResult);
                        }
                        break;
                }
            }

            this.logger.logUsage(stepCount, totalUsage, currentSessionId);

            if (returnUsage) {
                return {
                    result: finalResult,
                    usage: totalUsage,
                    sessionId: currentSessionId,
                    steps: stepCount,
                    framework: 'claude-agent-sdk'
                };
            }

            return finalResult;

        } catch (error) {
            console.error('\n❌ Error running Claude agent:', error.message);
            if (this.verbose && error.stack) {
                console.error('Stack trace:', error.stack);
            }
            throw error;
        }
    }

    _buildQueryOptions(existingSessionId, abortController, sessionName) {
        const s = sessionName ? ` -s=${sessionName}` : '';
        const defaultOptions = {
            systemPrompt: {
                type: 'preset',
                preset: 'claude_code',
                append: `You are a Playwright Test Agent using playwright-cli. CRITICAL RULES:
1. ALWAYS use session flag in EVERY command: playwright-cli <cmd>${s} [args]
2. If the browser is not open, FIRST run: playwright-cli open${s}
3. NEVER respond based on cached or remembered page state
4. For verification (should see, verify, check, assert): call playwright-cli snapshot${s}
5. For actions (click, type, navigate): call the corresponding playwright-cli command with${s}
6. The test FAILS if you respond without calling a playwright-cli command

Session: ${sessionName || 'default'}
Open: playwright-cli open${s}
Snapshot: playwright-cli snapshot${s}
Click: playwright-cli click${s} <ref>
Type: playwright-cli type${s} <text>
Goto: playwright-cli goto${s} <url>`
            },
            settingSources: ['user', 'project'],
            allowedTools: ['Bash(playwright-cli:*)'],
            cwd: process.cwd(),
            permissionMode: 'bypassPermissions'
        };

        const queryOptions = {
            ...defaultOptions,
            ...this.options,
            signal: abortController.signal
        };

        if (existingSessionId) {
            queryOptions.resume = existingSessionId;
        }

        return queryOptions;
    }
}
