import { createAgent, createMiddleware } from 'langchain';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatOpenAI } from '@langchain/openai';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { MemorySaver } from '@langchain/langgraph';
import { exec } from 'child_process';
import { promisify } from 'util';
import { Logger } from './Logger.js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const execAsync = promisify(exec);

// Load environment variables from project root .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../..');
config({ path: join(projectRoot, '.env') });

/**
 * Error handling middleware that logs tool errors and re-throws them
 */
const handleToolErrors = createMiddleware({
    name: "HandleToolErrors",
    wrapToolCall: async (request, handler) => {
        try {
            return await handler(request);
        } catch (error) {
            const cleanError = error.message;

            if (process.env.AGENT_DEBUG === 'true') {
                console.error(`\n❌ TOOL ERROR [${request.toolCall.name}]:`, {
                    tool: request.toolCall.name,
                    args: request.toolCall.args,
                    error: error.message,
                    stack: error.stack
                });
            } else {
                console.error(`\n❌ Tool '${request.toolCall.name}' failed: ${cleanError}`);
            }

            throw new Error(`Tool '${request.toolCall.name}' failed: ${cleanError}`);
        }
    },
});

/**
 * Session data storage for LangChain agent
 */
class LangChainSessionManager {
    constructor() {
        this.sessionMap = new Map();
    }

    getSession(sessionName) {
        return this.sessionMap.get(sessionName);
    }

    setSession(sessionName, sessionData) {
        this.sessionMap.set(sessionName, sessionData);
    }

    async resetSession(sessionName) {
        const sessionData = this.sessionMap.get(sessionName);
        this.sessionMap.delete(sessionName);
        return sessionData?.sessionId || null;
    }
}

export const langChainSessionManager = new LangChainSessionManager();

/**
 * Create playwright-cli tools for a given session
 */
function createPlaywrightCLITools(sessionName) {
    const sessionFlag = sessionName ? ` -s=${sessionName}` : '';

    return [
        tool(
            async ({ command }) => {
                try {
                    const { stdout, stderr } = await execAsync(command, { timeout: 30000 });
                    return stdout || stderr || 'Command executed successfully';
                } catch (error) {
                    return `Error: ${error.stderr || error.message}`;
                }
            },
            {
                name: 'playwright_cli',
                description: `Execute playwright-cli commands to control the browser. Session: ${sessionName || 'default'}. ` +
                    `Commands: playwright-cli goto${sessionFlag} <url>, ` +
                    `playwright-cli click${sessionFlag} <element>, ` +
                    `playwright-cli type${sessionFlag} <element> <text>, ` +
                    `playwright-cli snapshot${sessionFlag}, ` +
                    `playwright-cli screenshot${sessionFlag}`,
                schema: z.object({
                    command: z.string().describe('The playwright-cli command to execute')
                })
            }
        )
    ];
}

/**
 * LangChain Agent Class
 */
export class LangChainAgent {
    constructor(options = {}) {
        this.options = options;
        this.verbose = options.verbose !== false;
        this.logger = new Logger(this.verbose);
        this.provider = options.provider || process.env.DEFAULT_PROVIDER || 'anthropic';
        this.model = options.model;
        this.modelConfig = options.modelConfig || {};
        this.returnUsage = options.returnUsage || false;

        // Parse recursion limit
        let recursionLimit = 100;
        if (options.recursionLimit) {
            recursionLimit = options.recursionLimit;
        } else if (process.env.RECURSION_LIMIT) {
            const envLimit = parseInt(process.env.RECURSION_LIMIT);
            if (!isNaN(envLimit) && envLimit > 0) {
                recursionLimit = envLimit;
            } else if (this.verbose) {
                console.warn(`⚠️  Invalid RECURSION_LIMIT env var: "${process.env.RECURSION_LIMIT}". Using default: 100\n`);
            }
        }
        this.recursionLimit = recursionLimit;
    }

    async run(prompt, options = {}) {
        // Track usage
        let totalInputTokens = 0;
        let totalOutputTokens = 0;
        let stepCount = 0;

        const sessionName = options.session || this.options.session;

        if (this.verbose) {
            this.logger.log(`🤖 Running LangChain agent (${this.provider}): "${prompt}"\n`);
            if (sessionName) {
                this.logger.log(`🔑 Session: ${sessionName}\n`);
            }
        }

        try {
            let sessionData = sessionName ? langChainSessionManager.getSession(sessionName) : null;
            const existingSessionId = sessionData?.sessionId;

            if (existingSessionId && this.verbose) {
                this.logger.log(`♻️  SESSION: Resuming session: ${existingSessionId}\n`);
            }

            // Create model
            const chatModel = this._createModel();

            if (this.verbose) {
                this.logger.log(`📡 Initializing ${this.provider} model: ${chatModel.model || chatModel.modelName}\n`);
            }

            // Create or reuse session data
            if (!sessionData) {
                const tools = createPlaywrightCLITools(sessionName);

                sessionData = {
                    sessionId: `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
                    checkpointer: new MemorySaver(),
                    tools
                };

                if (sessionName) {
                    langChainSessionManager.setSession(sessionName, sessionData);
                }

                if (this.verbose) {
                    this.logger.log(`🔑 SESSION: New session started: ${sessionData.sessionId}\n`);
                    this.logger.log(`✅ Loaded ${tools.length} playwright-cli tool(s)\n`);
                }
            } else {
                if (this.verbose) {
                    this.logger.log(`♻️  Reusing playwright-cli tools for session: ${sessionName}\n`);
                }
            }

            const { tools, checkpointer } = sessionData;

            // Track tool calls for this execution
            let toolCallCount = 0;
            let retryCount = 0;
            const MAX_RETRIES = 2;

            // Middleware to enforce tool usage
            const enforceToolUseMiddleware = createMiddleware({
                name: "EnforceToolUse",
                wrapModelCall: async (request, handler) => {
                    let response = await handler(request);

                    if (response.tool_calls && response.tool_calls.length > 0) {
                        toolCallCount += response.tool_calls.length;
                        return response;
                    }

                    if (toolCallCount === 0 && retryCount < MAX_RETRIES) {
                        retryCount++;
                        if (this.verbose) {
                            console.log(`\n⚠️  Model tried to respond without tools. Forcing retry (${retryCount}/${MAX_RETRIES})...\n`);
                        }

                        const sessionFlag = sessionName ? ` -s=${sessionName}` : '';
                        const newMessages = [
                            ...request.messages,
                            {
                                role: 'user',
                                content: `CRITICAL: You MUST call playwright-cli commands to complete this task. Do NOT respond based on cached page state. Call a tool NOW. Example: playwright-cli snapshot${sessionFlag}`
                            }
                        ];

                        const newRequest = { ...request, messages: newMessages };
                        return await handler(newRequest);
                    }

                    return response;
                }
            });

            // Create agent
            const agent = createAgent({
                model: chatModel,
                tools,
                systemPrompt: `You are a Playwright Test Agent. CRITICAL RULES:
1. You MUST call playwright-cli commands for EVERY user instruction
2. NEVER respond based on cached or remembered page state
3. For verification steps (should see, verify, check, assert): ALWAYS call playwright-cli snapshot or playwright-cli evaluate
4. For actions (click, type, navigate): ALWAYS call the corresponding playwright-cli command
5. The test will FAIL if you respond without calling a playwright-cli command`,
                checkpointer: sessionData.checkpointer,
                middleware: [handleToolErrors, enforceToolUseMiddleware]
            });

            const config = {
                configurable: {
                    thread_id: sessionData.sessionId
                },
                recursionLimit: this.recursionLimit
            };

            if (this.verbose) {
                this.logger.log(`📡 Processing messages from LangChain agent (recursion limit: ${this.recursionLimit}):\n`);
            }

            // Stream execution
            const stream = await agent.stream(
                { messages: [{ role: 'user', content: prompt }] },
                { ...config, streamMode: 'values' }
            );

            let finalResult = '';
            let lastState = null;

            for await (const chunk of stream) {
                lastState = chunk;
                stepCount++;

                const latestMessage = chunk.messages?.at(-1);

                if (latestMessage) {
                    if (latestMessage.usage_metadata) {
                        totalInputTokens += latestMessage.usage_metadata.input_tokens || 0;
                        totalOutputTokens += latestMessage.usage_metadata.output_tokens || 0;
                    }

                    if (this.verbose) {
                        if (latestMessage.content) {
                            const content = typeof latestMessage.content === 'string'
                                ? latestMessage.content
                                : JSON.stringify(latestMessage.content);

                            if (content.trim()) {
                                console.log('💬 Assistant:', content.substring(0, 200) +
                                    (content.length > 200 ? '...' : ''));
                                console.log();
                            }
                        }

                        if (latestMessage.tool_calls && latestMessage.tool_calls.length > 0) {
                            const toolNames = latestMessage.tool_calls.map(tc => tc.name).join(', ');
                            console.log(`🔧 Calling tools: ${toolNames}\n`);
                        }
                    }
                }
            }

            // Extract final result
            if (lastState?.messages) {
                const lastAssistantMessage = [...lastState.messages]
                    .reverse()
                    .find(m => m.constructor.name === 'AIMessage' || m._getType?.() === 'ai');

                if (lastAssistantMessage) {
                    finalResult = typeof lastAssistantMessage.content === 'string'
                        ? lastAssistantMessage.content
                        : JSON.stringify(lastAssistantMessage.content);
                }
            }

            // Log usage
            if (this.verbose) {
                console.log('\n📊 USAGE SUMMARY');
                console.log(`├─ Steps: ${stepCount}`);
                console.log(`├─ Input tokens: ${totalInputTokens}`);
                console.log(`├─ Output tokens: ${totalOutputTokens}`);
                console.log(`├─ Provider: ${this.provider}`);
                console.log(`└─ Session ID: ${sessionData.sessionId}\n`);
            }

            if (this.returnUsage) {
                return {
                    result: finalResult,
                    usage: {
                        input_tokens: totalInputTokens,
                        output_tokens: totalOutputTokens
                    },
                    sessionId: sessionData.sessionId,
                    steps: stepCount,
                    provider: this.provider,
                    framework: 'langchain'
                };
            }

            return finalResult;

        } catch (error) {
            const friendlyMessage = error.message.replace(/^Error in middleware "HandleToolErrors": /, '');

            console.error('\n❌ Error running LangChain agent:', friendlyMessage);
            if (this.verbose && error.stack) {
                console.error('Stack trace:', error.stack);
            }
            throw error;
        }
    }

    _createModel() {
        const defaultConfig = {
            temperature: 0.1,
            ...this.modelConfig
        };

        switch (this.provider.toLowerCase()) {
            case 'anthropic':
                return new ChatAnthropic({
                    model: this.model || process.env.ANTHROPIC_MODEL || process.env.DEFAULT_MODEL || 'claude-sonnet-4-5',
                    apiKey: process.env.ANTHROPIC_API_KEY,
                    ...defaultConfig
                });

            case 'openai':
                return new ChatOpenAI({
                    model: this.model || process.env.OPENAI_MODEL || process.env.DEFAULT_MODEL || 'gpt-4o',
                    apiKey: process.env.OPENAI_API_KEY,
                    ...defaultConfig
                });

            case 'google':
                return new ChatGoogleGenerativeAI({
                    model: this.model || process.env.GOOGLE_MODEL || process.env.DEFAULT_MODEL || 'gemini-2.5-flash',
                    apiKey: process.env.GOOGLE_API_KEY,
                    ...defaultConfig
                });

            default:
                throw new Error(`Unsupported provider: ${this.provider}. Supported providers are: anthropic, openai, google`);
        }
    }
}
