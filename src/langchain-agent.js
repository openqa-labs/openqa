import { createAgent, createMiddleware } from 'langchain';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatOpenAI } from '@langchain/openai';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createConnection } from '@playwright/mcp';
import { loadMcpTools } from '@langchain/mcp-adapters';
import { MemorySaver } from '@langchain/langgraph';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables from root .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
config({ path: join(rootDir, '.env') });

/**
 * Error handling middleware that logs tool errors and re-throws them
 * This allows for error analysis while maintaining error propagation
 */
const handleToolErrors = createMiddleware({
  name: "HandleToolErrors",
  wrapToolCall: async (request, handler) => {
    try {
      return await handler(request);
    } catch (error) {
      // Log the complete error for analysis
      console.error(`\n❌ TOOL ERROR [${request.toolCall.name}]:`, {
        tool: request.toolCall.name,
        args: request.toolCall.args,
        error: error.message,
        stack: error.stack
      });
      
      // Re-throw to allow upstream error handling and analysis
      throw error;
    }
  },
});

/**
 * LangChain-based Browser Agent with Multi-Provider Support
 *
 * This implementation uses LangChain SDK to provide:
 * - Multi-provider support (Anthropic, OpenAI, Google)
 * - Automatic session management per browser context
 * - MCP tool integration with Playwright
 * - Usage tracking and verbose logging
 */

/**
 * WeakMap to store session data including IDs, checkpointers, tools, and cleanup functions
 * Using WeakMap ensures automatic cleanup when contexts are garbage collected
 */
const contextSessionMap = new WeakMap();

/**
 * FinalizationRegistry to cleanup MCP connections when contexts are garbage collected
 */
const cleanupRegistry = new FinalizationRegistry((cleanup) => {
  if (cleanup) {
    cleanup().catch(() => {
      // Ignore cleanup errors during garbage collection
    });
  }
});

/**
 * Create a model instance based on provider and model name
 * @param {string} provider - Provider name: 'anthropic', 'openai', or 'google'
 * @param {string} model - Model name (e.g., 'claude-sonnet-4-5', 'gpt-4o', 'gemini-pro')
 * @param {object} modelConfig - Additional model configuration
 * @returns {ChatModel} - The initialized chat model
 */
function createModel(provider, model, modelConfig = {}) {
  const defaultConfig = {
    temperature: 0.1,
    ...modelConfig
  };

  switch (provider.toLowerCase()) {
    case 'anthropic':
      return new ChatAnthropic({
        model: model || process.env.ANTHROPIC_MODEL || process.env.DEFAULT_MODEL || 'claude-sonnet-4-5',
        apiKey: process.env.ANTHROPIC_API_KEY,
        ...defaultConfig
      });

    case 'openai':
      return new ChatOpenAI({
        model: model || process.env.OPENAI_MODEL || process.env.DEFAULT_MODEL || 'gpt-4o',
        apiKey: process.env.OPENAI_API_KEY,
        ...defaultConfig
      });

    case 'google':
      return new ChatGoogleGenerativeAI({
        model: model || process.env.GOOGLE_MODEL || process.env.DEFAULT_MODEL || 'gemini-2.5-flash',
        apiKey: process.env.GOOGLE_API_KEY,
        ...defaultConfig
      });

    default:
      throw new Error(`Unsupported provider: ${provider}. Supported providers are: anthropic, openai, google`);
  }
}

/**
 * Create MCP tools from Playwright connection
 * @param {BrowserContext} browserContext - Playwright browser context
 * @returns {Promise<Object>} - Object containing tools array and cleanup functions
 */
async function createPlaywrightTools(browserContext) {
  // Create Playwright MCP Server with the browser context
  const mcpServer = await createConnection(
    { capabilities: ['core', 'testing'] },
    () => Promise.resolve(browserContext)
  );

  // Create in-memory transport to bridge Client and Server
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  // Connect the server to the server-side transport
  await mcpServer.connect(serverTransport);

  // Create MCP Client and connect it to the client-side transport
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

  // Use LangChain's loadMcpTools to convert MCP tools to LangChain format
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

/**
 * Run LangChain agent with a specific browser context and automatic session management
 * @param {string} prompt - Natural language instruction
 * @param {BrowserContext} browserContext - Playwright browser context from test
 * @param {object} options - Optional configuration
 * @param {string} options.provider - AI provider: 'anthropic', 'openai', or 'google'
 *                                    Priority: options.provider > DEFAULT_PROVIDER env var > 'anthropic'
 * @param {string} options.model - Model name (provider-specific)
 *                                Priority: options.model > ANTHROPIC_MODEL/OPENAI_MODEL/GOOGLE_MODEL env var > DEFAULT_MODEL env var > hardcoded default
 * @param {boolean} options.verbose - Enable verbose logging (default: true)
 * @param {boolean} options.returnUsage - Return usage statistics (default: false)
 * @param {number} options.recursionLimit - Maximum recursion depth to prevent infinite loops
 *                                          Priority: options.recursionLimit > RECURSION_LIMIT env var > 100 (default)
 *                                          NOTE: Must be passed as camelCase 'recursionLimit' to LangGraph config
 * @param {object} options.modelConfig - Additional model configuration
 * @returns {Promise<string|object>} - The final result or result with usage data
 *
 * Environment Variables:
 * - RECURSION_LIMIT: Default recursion limit for all invocations (default: 100)
 *                    Set higher values (e.g., 200) for complex multi-step tasks
 * - DEFAULT_MODEL: Default model for all providers (overrides hardcoded defaults)
 * - ANTHROPIC_MODEL: Default model for Anthropic (e.g., 'claude-sonnet-4-5')
 * - OPENAI_MODEL: Default model for OpenAI (e.g., 'gpt-4o')
 * - GOOGLE_MODEL: Default model for Google (e.g., 'gemini-2.5-flash')
 */
export async function runLangChainAgent(prompt, browserContext, options = {}) {
  const provider = options.provider || process.env.DEFAULT_PROVIDER || 'anthropic';
  const model = options.model;
  const verbose = options.verbose !== false;
  const returnUsage = options.returnUsage || false;
  
  // Parse recursion limit with validation
  let recursionLimit = 100; // default
  if (options.recursionLimit) {
    recursionLimit = options.recursionLimit;
  } else if (process.env.RECURSION_LIMIT) {
    const envLimit = parseInt(process.env.RECURSION_LIMIT);
    if (!isNaN(envLimit) && envLimit > 0) {
      recursionLimit = envLimit;
    } else if (verbose) {
      console.warn(`⚠️  Invalid RECURSION_LIMIT env var: "${process.env.RECURSION_LIMIT}". Using default: 100\n`);
    }
  }
  
  const modelConfig = options.modelConfig || {};

  // Track usage for this specific agent call
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let stepCount = 0;

  if (verbose) {
    console.log(`🤖 Running LangChain agent (${provider}) with shared context: "${prompt}"\n`);
  }

  try {
    // Check if this context already has a session
    let sessionData = contextSessionMap.get(browserContext);
    const existingSessionId = sessionData?.sessionId;

    if (existingSessionId && verbose) {
      console.log(`♻️  SESSION: Resuming session: ${existingSessionId}\n`);
    }

    // Create the model instance
    const chatModel = createModel(provider, model, modelConfig);

    if (verbose) {
      console.log(`📡 Initializing ${provider} model: ${chatModel.model || chatModel.modelName}\n`);
    }

    // Create or reuse MCP tools and session data
    if (!sessionData) {
      // First call for this context - create everything
      const { tools, cleanup } = await createPlaywrightTools(browserContext);

      sessionData = {
        sessionId: `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        checkpointer: new MemorySaver(),
        tools,
        cleanup
      };

      contextSessionMap.set(browserContext, sessionData);

      // Register cleanup for when context is garbage collected
      cleanupRegistry.register(browserContext, cleanup);

      if (verbose) {
        console.log(`🔑 SESSION: New session started: ${sessionData.sessionId}\n`);
        console.log(`✅ Loaded ${tools.length} Playwright MCP tools\n`);
      }
    } else {
      // Reusing existing session and MCP connection
      if (verbose) {
        console.log(`♻️  MCP: Reusing ${sessionData.tools.length} Playwright MCP tools\n`);
      }
    }

    const { tools, checkpointer } = sessionData;

    // Create the LangChain agent
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

    // Configure session for this invocation
    // IMPORTANT: LangGraph expects 'recursionLimit' in camelCase, not 'recursion_limit'
    const config = {
      configurable: {
        thread_id: sessionData.sessionId
      },
      recursionLimit: recursionLimit  // ✅ camelCase required by LangGraph
    };

    if (verbose) {
      console.log(`📡 Processing messages from LangChain agent (recursion limit: ${recursionLimit}):\n`);
    }

    // Stream the agent execution
    const stream = await agent.stream(
      {
        messages: [{ role: 'user', content: prompt }]
      },
      { ...config, streamMode: 'values' }
    );

    let finalResult = '';
    let lastState = null;

    for await (const chunk of stream) {
      lastState = chunk;
      stepCount++;

      const latestMessage = chunk.messages?.at(-1);

      if (latestMessage) {
        // Track token usage if available
        if (latestMessage.usage_metadata) {
          totalInputTokens += latestMessage.usage_metadata.input_tokens || 0;
          totalOutputTokens += latestMessage.usage_metadata.output_tokens || 0;
        }

        if (verbose) {
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

    // Extract final result from the last assistant message
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

    // Log usage summary
    if (verbose) {
      console.log('\n📊 USAGE SUMMARY');
      console.log(`├─ Steps: ${stepCount}`);
      console.log(`├─ Input tokens: ${totalInputTokens}`);
      console.log(`├─ Output tokens: ${totalOutputTokens}`);
      console.log(`├─ Provider: ${provider}`);
      console.log(`└─ Session ID: ${sessionData.sessionId}\n`);
    }

    // Note: MCP connections are NOT cleaned up here
    // They will be reused for subsequent calls with the same context
    // Cleanup happens automatically when the context is garbage collected
    // or when explicitly reset via runLangChainAgent.resetSession()

    // Return based on returnUsage option
    if (returnUsage) {
      return {
        result: finalResult,
        usage: {
          input_tokens: totalInputTokens,
          output_tokens: totalOutputTokens
        },
        sessionId: sessionData.sessionId,
        steps: stepCount,
        provider
      };
    }

    return finalResult;

  } catch (error) {
    console.error('❌ Error running LangChain agent:', error.message);
    if (verbose && error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    throw error;
  }
}

/**
 * Reset the session for a specific browser context
 * Useful for edge cases where you want to start fresh mid-test
 * This will cleanup MCP connections and remove the session from the map
 * @param {BrowserContext} browserContext - The browser context to reset
 * @returns {Promise<string|null>} - The session ID that was reset, or null if none existed
 */
runLangChainAgent.resetSession = async function(browserContext) {
  const sessionData = contextSessionMap.get(browserContext);
  if (sessionData) {
    // Cleanup MCP connections
    if (sessionData.cleanup) {
      try {
        await sessionData.cleanup();
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    contextSessionMap.delete(browserContext);
    return sessionData.sessionId;
  }
  return null;
};
