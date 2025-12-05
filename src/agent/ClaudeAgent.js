
import { query } from '@anthropic-ai/claude-agent-sdk';
import { createConnection } from '@playwright/mcp';
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

    async run(prompt, pageOrContext) {
        const returnUsage = this.options.returnUsage || false;

        // Track usage
        const processedMessageIds = new Set();
        const stepUsages = [];
        let totalUsage = null;
        let stepCount = 0;

        // Resolve context
        let browserContext;
        let inputPage = null;
        if (pageOrContext.context && typeof pageOrContext.context === 'function') {
            inputPage = pageOrContext;
            browserContext = pageOrContext.context();
        } else {
            browserContext = pageOrContext;
        }

        if (this.verbose) {
            this.logger.log(`🤖 Running Claude agent with shared context: "${prompt}"\n`);
            this.logger.logContext(browserContext, inputPage);
        }

        try {
            const existingSessionId = sessionManager.getSession(browserContext);
            const abortController = new AbortController();
            let toolFailureError = null;

            if (existingSessionId && this.verbose) {
                this.logger.log(`♻️  SESSION: Resuming session: ${existingSessionId}\n`);
            }

            // Create MCP connection
            const mcpServer = await createConnection(
                { capabilities: ['core', 'testing'] },
                () => Promise.resolve(browserContext)
            );

            const queryOptions = this._buildQueryOptions(mcpServer, existingSessionId, abortController);

            // Hook for system-level tool failures
            queryOptions.hooks = {
                PostToolUseFailure: [{
                    hooks: [async (input) => {
                        this.logger.logToolError(input);

                        const match = input.error.match(/MCP tool '.*' on server '.*' returned an error: ### Result\n(.*)/s);
                        let cleanError = match && match[1] ? match[1].trim() : input.error;

                        // Further clean up - remove any remaining markdown artifacts
                        cleanError = cleanError.replace(/^### Result\n/, '').trim();

                        toolFailureError = new Error(`Tool '${input.tool_name}' failed: ${cleanError}`);

                        if (this.verbose) {
                            console.error(`🛑 Aborting query due to tool failure\n`);
                        }
                        abortController.abort();

                        return {
                            hookEventName: 'PostToolUseFailure',
                            additionalContext: `Tool '${input.tool_name}' failed: ${cleanError}`
                        };
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

            // Track tool calls to map tool_use_id to tool name
            const toolCallMap = new Map();

            for await (const message of result) {
                // Track tool calls from assistant messages
                if (message.type === 'assistant' && message.message && message.message.content) {
                    for (const block of message.message.content) {
                        if (block.type === 'tool_use') {
                            toolCallMap.set(block.id, block.name);
                        }
                    }
                }

                // Check for tool errors in user messages (is_error: true)
                if (message.type === 'user' && message.message && message.message.content) {
                    this.logger.logUserMessage(message);

                    const toolResults = message.message.content.filter(block => block.type === 'tool_result');
                    for (const toolResult of toolResults) {
                        if (toolResult.is_error) {
                            // Extract error text
                            let errorText = typeof toolResult.content === 'string'
                                ? toolResult.content
                                : Array.isArray(toolResult.content)
                                    ? toolResult.content.map(c => c.text).join('\n')
                                    : 'Unknown tool error';

                            // Get tool name from toolCallMap
                            const toolName = toolCallMap.get(toolResult.tool_use_id) || 'unknown';

                            // Try to extract Playwright code context from the error message
                            let playwrightCode = null;
                            const codeMatch = errorText.match(/```(?:js|javascript)\n(.*?)\n```/s);
                            if (codeMatch) {
                                playwrightCode = codeMatch[1].trim();
                            }

                            // Clean the error text
                            errorText = errorText.replace(/^### Result\n/, '').trim();
                            // Remove the code block from error text if it was extracted
                            if (playwrightCode) {
                                errorText = errorText.replace(/### Ran Playwright code\n```(?:js|javascript)\n.*?\n```\n\n/s, '').trim();
                            }

                            // Build comprehensive error message
                            let fullError = errorText;
                            if (playwrightCode) {
                                fullError = `${errorText}\n\nPlaywright code that failed:\n${playwrightCode}`;
                            }

                            this.logger.logToolFailure(toolName, fullError);

                            toolFailureError = new Error(`Tool '${toolName}' failed: ${fullError}`);
                            abortController.abort();
                            throw toolFailureError;
                        }
                    }
                }

                switch (message.type) {
                    case 'system':
                        if (message.subtype === 'init' && message.session_id) {
                            currentSessionId = message.session_id;
                            sessionManager.setSession(browserContext, currentSessionId);
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
            if (error.name === 'AbortError' && toolFailureError) {
                // Don't log again - already logged by logToolFailure
                throw toolFailureError;
            }

            console.error('\n❌ Error running Claude agent:', error.message);
            if (this.verbose && error.stack) {
                console.error('Stack trace:', error.stack);
            }
            throw error;
        }
    }

    _buildQueryOptions(mcpServer, existingSessionId, abortController) {
        const defaultOptions = {
            systemPrompt: {
                type: 'preset',
                preset: 'claude_code',
                append: `All user requests must be performed using the Playwright MCP server tools only, do not use any other methods or assume.`
            },
            mcpServers: {
                playwright: {
                    type: 'sdk',
                    name: 'playwright',
                    instance: mcpServer
                }
            },
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
