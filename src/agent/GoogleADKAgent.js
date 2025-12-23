import {
    LlmAgent,
    InMemorySessionService,
    BaseTool,
    BaseToolset,
    InMemoryRunner
} from '@google/adk';
import { Type } from '@google/genai';
import { createConnection } from '@playwright/mcp';
import { sessionManager } from './SessionManager.js';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

// Map GOOGLE_API_KEY to GOOGLE_GENAI_API_KEY if not set
if (process.env.GOOGLE_API_KEY && !process.env.GOOGLE_GENAI_API_KEY) {
    process.env.GOOGLE_GENAI_API_KEY = process.env.GOOGLE_API_KEY;
}

async function getOrCreateConnection(browserContext) {
    let connection = sessionManager.getMcpConnection(browserContext);
    if (!connection) {
        // Create MCP connection with a custom context getter
        const contextWithManagedLifecycle = Object.create(browserContext);
        contextWithManagedLifecycle.close = async () => {
            // No-op: browser context is managed externally by Playwright test fixtures
        };

        // This returns an MCP Server instance (not connected to any transport)
        const mcpServer = await createConnection(
            { capabilities: ['core', 'testing'] },
            () => Promise.resolve(contextWithManagedLifecycle)
        );

        // Create a linked pair of in-memory transports
        const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

        // Connect the server to one end
        await mcpServer.connect(serverTransport);

        // Create and connect the client to the other end
        const client = new Client(
            { name: "google-adk-agent", version: "1.0.0" },
            { capabilities: {} }
        );
        await client.connect(clientTransport);

        connection = {
            mcpServer: client, // We return the client as the "connection" for the agent to use
            cleanup: async () => {
                await client.close();
                await mcpServer.close();
            }
        };
        sessionManager.setMcpConnection(browserContext, connection);
    }
    return connection.mcpServer;
}

// --- Schema Conversion Utility (from adk-js-main/core/src/utils/gemini_schema_util.ts) ---

function toGeminiType(mcpType) {
    switch (mcpType.toLowerCase()) {
        case 'text':
        case 'string':
            return Type.STRING;
        case 'number':
            return Type.NUMBER;
        case 'boolean':
            return Type.BOOLEAN;
        case 'integer':
            return Type.INTEGER;
        case 'array':
            return Type.ARRAY;
        case 'object':
            return Type.OBJECT;
        default:
            return Type.TYPE_UNSPECIFIED;
    }
}

function toGeminiSchema(mcpSchema) {
    if (!mcpSchema) {
        return undefined;
    }

    function recursiveConvert(mcp) {
        const geminiType = toGeminiType(mcp.type);
        const geminiSchema = { type: geminiType, description: mcp.description };

        if (geminiType === Type.OBJECT) {
            geminiSchema.properties = {};
            if (mcp.properties) {
                for (const name in mcp.properties) {
                    geminiSchema.properties[name] =
                        recursiveConvert(mcp.properties[name]);
                }
            }
            geminiSchema.required = mcp.required;
        } else if (geminiType === Type.ARRAY) {
            if (mcp.items) {
                geminiSchema.items = recursiveConvert(mcp.items);
            }
        }
        return geminiSchema;
    }
    return recursiveConvert(mcpSchema);
}

// --- Playwright Tool Wrapper ---

class PlaywrightTool extends BaseTool {
    constructor(mcpTool, client) {
        super({ name: mcpTool.name, description: mcpTool.description || '' });
        this.mcpTool = mcpTool;
        this.client = client;
    }

    _getDeclaration() {
        return {
            name: this.mcpTool.name,
            description: this.mcpTool.description,
            parameters: toGeminiSchema(this.mcpTool.inputSchema),
            // response: toGeminiSchema(this.mcpTool.outputSchema), // Optional
        };
    }

    async runAsync(request) {
        const result = await this.client.callTool({
            name: this.mcpTool.name,
            arguments: request.args,
        });
        return result;
    }
}

// --- Playwright Toolset ---

class PlaywrightToolset extends BaseToolset {
    constructor(client) {
        super();
        this.client = client;
    }

    async getTools(context) {
        // Try to find listTools or equivalent
        if (typeof this.client.listTools === 'function') {
            const listResult = await this.client.listTools();
            return listResult.tools.map((tool) => new PlaywrightTool(tool, this.client));
        } else {
            // Fallback to raw request
            const listResult = await this.client.request({ method: 'tools/list' }, { schema: { result: { tools: [] } } });
            // The SDK might return the result directly or wrap it.
            // Usually client.request returns the result object.
            return listResult.tools.map((tool) => new PlaywrightTool(tool, this.client));
        }
    }
}

// --- Session Management ---

const adkContexts = new WeakMap(); // Stores { runner, sessionId }

// --- Google ADK Agent Runner ---

export async function runGoogleADKAgent(prompt, pageOrContext, options = {}) {
    // 1. Get Playwright MCP Connection
    let browserContext;
    if (pageOrContext.context && typeof pageOrContext.context === 'function') {
        browserContext = pageOrContext.context();
    } else {
        browserContext = pageOrContext;
    }

    const connection = await getOrCreateConnection(browserContext);

    // 2. Get or Create Runner and Session
    let contextData = adkContexts.get(browserContext);
    if (!contextData) {
        // Initialize Agent
        const agent = new LlmAgent({
            name: 'google_adk_agent',
            model: options.model || 'gemini-2.0-flash',
            tools: [new PlaywrightToolset(connection)],
        });

        // Initialize Runner (which creates its own session service)
        const runner = new InMemoryRunner({ agent, appName: 'google_adk_agent' });

        // Create Session
        const session = await runner.sessionService.createSession({ appName: 'google_adk_agent', userId: 'user' });

        contextData = { runner, sessionId: session.id };
        adkContexts.set(browserContext, contextData);
    }

    const { runner, sessionId } = contextData;

    // 3. Run Agent
    const newMessage = { role: 'user', parts: [{ text: prompt }] };

    let lastResponseText = "No response from agent.";

    // runner.runAsync returns an async generator of events
    try {
        for await (const event of runner.runAsync({ sessionId, newMessage, userId: 'user' })) {
            if (event.errorCode) {
                return `Error ${event.errorCode}: ${event.errorMessage}`;
            }
            if (event.content && event.content.parts) {
                const textParts = event.content.parts.filter(p => p.text).map(p => p.text).join('');
                if (textParts) {
                    lastResponseText = textParts;
                }
            }
        }
    } catch (e) {
        console.error('Error in agent run:', e);
        return `Error: ${e.message}`;
    }

    return lastResponseText;
}

runGoogleADKAgent.resetSession = async function (browserContext) {
    if (adkContexts.has(browserContext)) {
        adkContexts.delete(browserContext);
        return "Session reset";
    }
    return null;
};
