import { query } from '@anthropic-ai/claude-agent-sdk';
import { createConnection } from '@playwright/mcp';

/**
 * Claude Agent SDK Browser Agent with Automatic Session Management
 *
 * This implementation follows the VSCode pattern:
 * Pass the test's browser context directly to the MCP server programmatically.
 *
 * Session Management:
 * - Each BrowserContext automatically gets its own session
 * - Multiple calls within the same test share the same session
 * - Different tests get isolated sessions
 * - No manual session ID management required
 */

/**
 * WeakMap to store session IDs associated with browser contexts
 * Using WeakMap ensures automatic cleanup when contexts are garbage collected
 */
const contextSessionMap = new WeakMap();

/**
 * Run Claude agent with a specific browser context and automatic session management
 * @param {string} prompt - Natural language instruction
 * @param {Page|BrowserContext} pageOrContext - Playwright page or browser context from test
 * @param {object} options - Optional configuration
 * @returns {Promise<string>} - The final result
 */
export async function runClaudeAgent(prompt, pageOrContext, options = {}) {
  const verbose = options.verbose !== false;
  const returnUsage = options.returnUsage || false;

  // Track usage for this specific agent call
  const processedMessageIds = new Set();
  const stepUsages = [];
  let totalUsage = null;
  let stepCount = 0;

  // Handle both Page and Context inputs
  let browserContext;
  let inputPage = null;
  if (pageOrContext.context && typeof pageOrContext.context === 'function') {
    // It's a Page object - extract the context
    inputPage = pageOrContext;
    browserContext = pageOrContext.context();
  } else {
    // It's already a BrowserContext
    browserContext = pageOrContext;
  }

  if (verbose) {
    console.log(`🤖 Running Claude agent with shared context: "${prompt}"\n`);

    // Log page management details
    const pages = browserContext.pages();
    console.log(`📄 PAGE CONTEXT INFO:`);
    console.log(`├─ Input type: ${inputPage ? 'Page' : 'BrowserContext'}`);
    console.log(`├─ Pages in context: ${pages.length}`);
    if (inputPage) {
      const inputPageUrl = inputPage.url();
      const inputPageIndex = pages.indexOf(inputPage);
      console.log(`├─ Input page URL: ${inputPageUrl}`);
      console.log(`├─ Input page index in context: ${inputPageIndex}`);
    }
    pages.forEach((p, i) => {
      console.log(`├─ Page ${i}: ${p.url()}`);
    });
    console.log(`└─ MCP will detect ${pages.length} existing page(s)\n`);
  }

  try {
    // Check if this context already has a session
    const existingSessionId = contextSessionMap.get(browserContext);

    if (existingSessionId && verbose) {
      console.log(`♻️  SESSION: Resuming session: ${existingSessionId}\n`);
    }

    // Create MCP connection programmatically with the browser context
    const mcpServer = await createConnection(
      { capabilities: ['core', 'testing'] },
      () => Promise.resolve(browserContext)
    );

    const defaultOptions = {
      systemPrompt: {
        type: 'preset',
        preset: 'claude_code',
        append: 'You are a Playwright Test Agent tasked with running playwright tests. All user requests must be performed using the Playwright MCP server tools only, do not use any other methods or assume or use your own methods. You should always report accurate test execution results. When the instruction is about to check, verify or assert you must run the verification or assertion tools and throw the exception if step failed'
      },
      // Use the programmatic MCP server instead of CLI-based one
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

    // Add resume option if we have an existing session
    const queryOptions = {
      ...defaultOptions,
      ...options
    };

    if (existingSessionId) {
      queryOptions.resume = existingSessionId;
    }

    // Add tool error handling hook (similar to langchain-agent.js middleware)
    queryOptions.hooks = {
      PostToolUseFailure: [{
        hooks: [async (input, toolUseID, options) => {
          // Track this failure to throw after query completes
          toolFailures.push({
            tool_name: input.tool_name,
            error: input.error,
            tool_input: input.tool_input
          });

          // Log the complete error for analysis (matching langchain-agent.js behavior)
          if (verbose) {
            console.error(`\n❌ TOOL ERROR [${input.tool_name}]:`, {
              tool: input.tool_name,
              tool_input: input.tool_input,
              tool_use_id: input.tool_use_id,
              error: input.error,
              is_interrupt: input.is_interrupt
            });
          }

          // Try to extract cleaner error message from MCP tool error
          // Format: "MCP tool 'tool_name' on server 'server_name' returned an error: ### Result\nError message"
          const match = input.error.match(/MCP tool '.*' on server '.*' returned an error: ### Result\n(.*)/s);

          let additionalContext = '';
          if (match && match[1]) {
            const cleanError = match[1].trim();
            additionalContext = `Tool '${input.tool_name}' failed: ${cleanError}`;

            if (verbose) {
              console.error(`\n📝 Cleaned error message: ${cleanError}\n`);
            }
          }

          // Return hook output with additional context
          return {
            hookEventName: 'PostToolUseFailure',
            additionalContext: additionalContext || undefined
          };
        }]
      }]
    };

    const result = query({
      prompt: prompt,
      options: queryOptions
    });

    if (verbose) {
      console.log('📡 Processing messages from Claude Code:\n');
    }

    let finalResult = '';
    let currentSessionId = existingSessionId;
    let toolFailures = [];  // Track tool failures to throw after query completes

    for await (const message of result) {
      switch (message.type) {
        case 'system':
          if (message.subtype === 'init') {
            // Capture the session ID from the init message
            if (message.session_id) {
              currentSessionId = message.session_id;
              // Store the session ID for this context
              contextSessionMap.set(browserContext, currentSessionId);

              if (verbose) {
                if (existingSessionId) {
                  console.log(`✅ SESSION: Session continued successfully (${currentSessionId})`);
                } else {
                  console.log(`🔑 SESSION: New session started: ${currentSessionId}`);
                }
                console.log('✅ System initialized with shared browser context');
                if (message.mcp_servers) {
                  message.mcp_servers.forEach(server => {
                    console.log(`   🔌 ${server.name}: ${server.status}`);
                  });
                }
                console.log();
              }
            }
          }
          break;

        case 'assistant':
          // Track usage for this step (avoid duplicates by message ID)
          if (message.usage && message.id && !processedMessageIds.has(message.id)) {
            processedMessageIds.add(message.id);
            stepUsages.push(message.usage);
            stepCount++;

            if (verbose) {
              console.log(`📈 Step ${stepCount}: Input=${message.usage.input_tokens || 0}, Output=${message.usage.output_tokens || 0}`);
            }
          }

          if (verbose) {
            const textContent = message.message.content
              .filter(block => block.type === 'text')
              .map(block => block.text)
              .join('\n');

            if (textContent.trim()) {
              console.log('💬 Assistant:', textContent.substring(0, 200) +
                         (textContent.length > 200 ? '...' : ''));
              console.log();
            }
          }
          break;

        case 'result':
          if (message.subtype === 'success') {
            finalResult = message.result;
            totalUsage = message.usage; // Authoritative total usage

            if (verbose) {
              console.log(`✅ Result: ${finalResult.substring(0, 100)}...`);
            }
          }
          break;
      }
    }

    // Log usage summary
    if (verbose && totalUsage) {
      console.log('\n📊 USAGE SUMMARY');
      console.log(`├─ Steps: ${stepCount}`);
      console.log(`├─ Input tokens: ${totalUsage.input_tokens || 0}`);
      console.log(`├─ Output tokens: ${totalUsage.output_tokens || 0}`);

      if (totalUsage.cache_read_input_tokens) {
        console.log(`├─ Cache read tokens: ${totalUsage.cache_read_input_tokens}`);
      }

      if (totalUsage.cache_creation_input_tokens) {
        console.log(`├─ Cache creation tokens: ${totalUsage.cache_creation_input_tokens}`);
      }

      console.log(`└─ Session ID: ${currentSessionId}\n`);
    }

    // Throw if any tool failures occurred (matching langchain-agent.js behavior)
    if (toolFailures.length > 0) {
      const firstFailure = toolFailures[0];

      // Try to extract clean error message
      const match = firstFailure.error.match(/MCP tool '.*' on server '.*' returned an error: ### Result\n(.*)/s);
      const cleanError = match && match[1] ? match[1].trim() : firstFailure.error;

      throw new Error(`Tool '${firstFailure.tool_name}' failed: ${cleanError}`);
    }

    // Return based on returnUsage option
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
    console.error('❌ Error running Claude agent:', error.message);
    if (verbose && error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    throw error;
  }
}

/**
 * Reset the session for a specific browser context
 * Useful for edge cases where you want to start fresh mid-test
 * @param {BrowserContext} browserContext - The browser context to reset
 * @returns {string|null} - The session ID that was reset, or null if none existed
 */
runClaudeAgent.resetSession = function(browserContext) {
  const sessionId = contextSessionMap.get(browserContext);
  if (sessionId) {
    contextSessionMap.delete(browserContext);
    return sessionId;
  }
  return null;
};
