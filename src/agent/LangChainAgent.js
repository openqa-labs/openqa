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

/**
 * Error handling middleware that logs tool errors and re-throws them
 */
const handleToolErrors = createMiddleware({
    name: "HandleToolErrors",
    wrapToolCall: async (request, handler) => {
        try {
            return await handler(request);
        } catch (error) {
            console.error(`\n❌ TOOL ERROR [${request.toolCall.name}]:`, {
                tool: request.toolCall.name,
                content: request.toolCall.content,
                args: request.toolCall.args,
                error: error.message,
                stack: error.stack
            });

            const match = error.message.match(/MCP tool '.*' on server '.*' returned an error: ### Result\n(.*)/s);
            if (match && match[1]) {
                throw new Error(`Tool '${request.toolCall.name}' failed: ${match[1].trim()}`);
            }

            throw error;
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

            // Create agent
            const agent = createAgent({
                model: chatModel,
                tools,
                systemPrompt: 'You are a helpful browser automation assistant. \
All user requests must be performed using the Playwright MCP server tools only. \
Do not assume or use your own methods. \
Note, The user may provide instructions in gherkin format for browser actions.',
                checkpointer: sessionData.checkpointer,
                middleware: [handleToolErrors]
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
            console.error('❌ Error running LangChain agent:', error.message);
            if (this.verbose && error.stack) {
                console.error('\nStack trace:', error.stack);
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
