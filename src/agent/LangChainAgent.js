import { createAgent, createMiddleware } from 'langchain';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatOpenAI } from '@langchain/openai';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createConnection } from '@playwright/mcp';
import { loadMcpTools } from '@langchain/mcp-adapters';
import { MemorySaver } from '@langchain/langgraph';
import { Logger } from './Logger.js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

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
            // Extract and clean error message
            const match = error.message.match(/MCP tool '.*' on server '.*' returned an error: ### Result\n(.*)/s);
            let cleanError = match && match[1] ? match[1].trim() : error.message;

            // Further clean up - remove any remaining markdown artifacts
            cleanError = cleanError.replace(/^### Result\n/, '').trim();

            // Log cleaner error (only in debug mode for full details)
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

            // Throw cleaner error
            throw new Error(`Tool '${request.toolCall.name}' failed: ${cleanError}`);
        }
    },
});

/**
 * Session data storage for LangChain agent
 */
class LangChainSessionManager {
    constructor() {
        this.contextSessionMap = new WeakMap();
        this.cleanupRegistry = new FinalizationRegistry((cleanup) => {
            if (cleanup) {
                cleanup().catch(() => { });
            }
        });
    }

    getSession(browserContext) {
        return this.contextSessionMap.get(browserContext);
    }

    setSession(browserContext, sessionData) {
        this.contextSessionMap.set(browserContext, sessionData);
        if (sessionData.cleanup) {
            this.cleanupRegistry.register(browserContext, sessionData.cleanup);
        }
    }

    async resetSession(browserContext) {
        const sessionData = this.contextSessionMap.get(browserContext);
        if (sessionData) {
            if (sessionData.cleanup) {
                try {
                    await sessionData.cleanup();
                } catch (error) {
                    // Ignore cleanup errors
                }
            }
            this.contextSessionMap.delete(browserContext);
            return sessionData.sessionId;
        }
        return null;
    }
}

export const langChainSessionManager = new LangChainSessionManager();

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

    async run(prompt, pageOrContext) {
        // Track usage
        let totalInputTokens = 0;
        let totalOutputTokens = 0;
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
            this.logger.log(`🤖 Running LangChain agent (${this.provider}) with shared context: "${prompt}"\n`);
            this.logger.logContext(browserContext, inputPage);
        }

        try {
            let sessionData = langChainSessionManager.getSession(browserContext);
            const existingSessionId = sessionData?.sessionId;

            if (existingSessionId && this.verbose) {
                this.logger.log(`♻️  SESSION: Resuming session: ${existingSessionId}\n`);
            }

            // Create model
            const chatModel = this._createModel();

            if (this.verbose) {
                this.logger.log(`📡 Initializing ${this.provider} model: ${chatModel.model || chatModel.modelName}\n`);
            }

            // Create or reuse MCP tools and session data
            if (!sessionData) {
                const { tools, cleanup } = await this._createPlaywrightTools(browserContext);

                sessionData = {
                    sessionId: `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
                    checkpointer: new MemorySaver(),
                    tools,
                    cleanup
                };

                langChainSessionManager.setSession(browserContext, sessionData);

                if (this.verbose) {
                    this.logger.log(`🔑 SESSION: New session started: ${sessionData.sessionId}\n`);
                    this.logger.log(`✅ Loaded ${tools.length} Playwright MCP tools\n`);
                }
            } else {
                if (this.verbose) {
                    this.logger.log(`♻️  MCP: Reusing ${sessionData.tools.length} Playwright MCP tools\n`);
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
                    // Call the model
                    let response = await handler(request);

                    // Check if tools were called in this response
                    if (response.tool_calls && response.tool_calls.length > 0) {
                        toolCallCount += response.tool_calls.length;
                        return response;
                    }

                    // If no tools called yet and model tries to finish, force retry
                    if (toolCallCount === 0 && retryCount < MAX_RETRIES) {
                        retryCount++;
                        if (this.verbose) {
                            console.log(`\n⚠️  Model tried to respond without tools. Forcing retry (${retryCount}/${MAX_RETRIES})...\n`);
                        }

                        // Create a new request with explicit instruction
                        const newMessages = [
                            ...request.messages,
                            {
                                role: 'user',
                                content: "CRITICAL: You MUST call a Playwright MCP tool (like browser_verify_text_visible) to complete this task. Do NOT respond based on cached page state. Call a tool NOW."
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
1. You MUST call at least one Playwright MCP tool for EVERY user instruction
2. NEVER respond based on cached or remembered page state
3. For verification steps (should see, verify, check, assert): ALWAYS call browser_verify_text_visible or browser_snapshot
4. For actions (click, type, navigate): ALWAYS call the corresponding browser_* tool
5. The test will FAIL if you respond without calling a Playwright tool`,
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
            // Extract friendly error message if it's a middleware error
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

    async _createPlaywrightTools(browserContext) {
        const mcpServer = await createConnection(
            { capabilities: ['core', 'testing'] },
            () => Promise.resolve(browserContext)
        );

        const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
        await mcpServer.connect(serverTransport);

        const mcpClient = new Client(
            {
                name: 'langchain-playwright-client',
                version: '1.0.0'
            },
            {
                capabilities: {}
            }
        );

        await mcpClient.connect(clientTransport);
        const tools = await loadMcpTools('playwright', mcpClient);

        return {
            tools,
            mcpClient,
            mcpServer,
            cleanup: async () => {
                try {
                    await mcpClient.close();
                    await mcpServer.close();
                } catch (error) {
                    // Ignore cleanup errors
                }
            }
        };
    }
}
