import { createConnection } from '@playwright/mcp';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { spawn } from 'child_process';
import net from 'net';
import fs from 'fs/promises';
import path from 'path';
import { Logger } from './Logger.js';
import { sessionManager } from './SessionManager.js';

export class Orchestrator {
    constructor(options = {}) {
        this.options = options;
        this.verbose = options.verbose !== false;
        this.logger = new Logger(this.verbose);
    }

    async run(provider, prompt, pageOrContext) {
        let browserContext;
        let inputPage = null;

        if (pageOrContext.context && typeof pageOrContext.context === 'function') {
            inputPage = pageOrContext;
            browserContext = pageOrContext.context();
        } else {
            browserContext = pageOrContext;
        }

        if (this.verbose) {
            this.logger.log(`🤖 Running Orchestrator with provider: ${provider.name}\n`);
            this.logger.logContext(browserContext, inputPage);
        }

        const existingSessionId = sessionManager.getSession(browserContext);
        if (existingSessionId && this.verbose) {
            this.logger.log(`♻️  SESSION: Resuming session: ${existingSessionId}\n`);
        }

        const systemPrompt = `You are a Playwright Test Agent. CRITICAL RULES:
1. You MUST call at least one Playwright MCP tool for EVERY user instruction.
2. NEVER respond based on cached or remembered page state — always interact with the live browser.
3. For ACTION steps (navigate, click, type, scroll, select, hover, drag):
   You need element refs from a snapshot before interacting with any element.
   Each action tool response automatically includes a snapshot of the resulting page state.
   REUSE THAT SNAPSHOT — if the most recent tool output contains a [Snapshot](path/to/file.yml)
   link, read that file to get current element refs. Only call browser_snapshot explicitly when
   no recent snapshot file is available.
   Each interactive element in the snapshot YAML has a [ref=eXX] tag:
     Example snapshot line:  textbox "What needs to be done?" [ref=e10]
     Example snapshot line:  checkbox "Toggle Todo" [ref=e42]
     Example snapshot line:  link "Active" [ref=f1e7]   ← inside an iframe: prefix "f1"
   Use ONLY the bare ref (e.g. "e10", "f1e7") as the "target" parameter in the action tool.
   NEVER use the accessible name, role text, or any CSS selector you construct as "target".
   If an action tool returns an error after using the correct ref, read the new snapshot file
   from that action's output (page may have changed) and retry with the updated ref.
4. For VERIFICATION/ASSERTION steps ("should see", "verify", "check", "assert", "confirm", "visible", "equal", "contains", "count"):
   ALWAYS try built-in verify tools first — they handle most assertions without custom code:
   - browser_verify_text_visible    → text is visible anywhere on the page
   - browser_verify_element_visible → an element with a specific role/name is visible
   - browser_verify_list_visible    → a list contains specific named items
   - browser_verify_value           → an input element's value matches expected

   For COUNT assertions ("should see N items"): use browser_verify_list_visible with the
   actual item names rather than writing DOM query code. If you don't yet know the item
   names, read the latest snapshot file first to discover them, then call
   browser_verify_list_visible with those exact names.

   ONLY use browser_evaluate when the built-in tools genuinely cannot express the assertion
   (e.g. DOM attribute value, computed CSS, URL, page title). Throw to fail, return to pass:
      Example: () => {
        const items = document.querySelectorAll('.todo-item');
        if (items.length !== 3) throw new Error('Expected 3 todo items, found ' + items.length);
        return items.length;
      }

   C) Use browser_run_code_unsafe for Playwright-level assertions (page URL, network state,
      locator assertions) OR when a step requires SOFT ASSERTIONS — checking multiple conditions
      and reporting all failures together instead of stopping at the first:
      Example (soft assertions):
      async (page) => {
        const failures = [];
        if (!await page.getByText('Order Complete').isVisible())
          failures.push('"Order Complete" not visible');
        if (!await page.getByRole('button', { name: 'Download' }).isEnabled())
          failures.push('"Download" button not enabled');
        if (failures.length) throw new Error('Assertion failures:\n' + failures.join('\n'));
        return 'All checks passed';
      }
      Use soft assertions when the test scenario needs to verify multiple independent
      conditions and report ALL failures at once (e.g. validating a results page has
      correct status, correct count, and correct items).

   HARD vs SOFT decision:
   - Hard (stop on first failure): use verify tools or browser_evaluate for a single critical
     condition where the rest of the test is meaningless if it fails.
   - Soft (collect all): use browser_run_code_unsafe with the failures[] pattern when multiple
     independent conditions should all be checked and reported together.

   ON ANY ASSERTION FAILURE (hard or soft): write a concise failure report (what was expected
   vs. what was actually found), then stop. Do NOT call any more tools.
5. The test will FAIL if you respond without calling a Playwright tool.`;

        // Combine prompt and system prompt
        const fullPrompt = `${systemPrompt}\n\nUser Instruction: ${prompt}`;

        // Create MCP connection with a custom context getter
        // The context getter wraps the browser context with a no-op close function
        // This prevents the MCP server from disposing our externally-managed browser context
        const contextWithManagedLifecycle = Object.create(browserContext);
        contextWithManagedLifecycle.close = async () => {
            // No-op: browser context is managed externally by Playwright test fixtures
        };

        // 1. Setup MCP Server (in-memory, tied to the Playwright test context)
        const mcpServer = await createConnection(
            {
                capabilities: ['core', 'testing'],
                // Write console/network/snapshot logs to .playwright-mcp/ files instead of
                // stdout. The response includes a [Snapshot](path.yml) link the agent can read
                // for element refs, keeping the full YAML tree out of the context window.
                outputMode: 'file',
                // Persist the MCP session state to .playwright-mcp/ so it can be resumed
                // across steps without re-establishing browser context from scratch.
                saveSession: true,
            },
            () => Promise.resolve(contextWithManagedLifecycle)
        );

        // 2. Setup local TCP Server to wrap the MCP Server in StdioServerTransport
        const tcpServer = net.createServer((socket) => {
            const transport = new StdioServerTransport(socket, socket);
            mcpServer.connect(transport);
        });

        await new Promise(resolve => tcpServer.listen(0, '127.0.0.1', resolve));
        const tcpPort = tcpServer.address().port;

        // 3. Create unique Bridge artifacts for the claude CLI to connect to the TCP socket
        // We must use a unique directory for each run so parallel tests don't overwrite each other's .mcp.json
        const crypto = await import('crypto');
        const os = await import('os');
        const runId = crypto.randomUUID();
        const tempDir = path.join(os.tmpdir(), `openqa-mcp-${runId}`);
        await fs.mkdir(tempDir, { recursive: true });

        const bridgeScriptPath = path.join(tempDir, '.openqa-bridge.js');
        const mcpConfigPath = path.join(tempDir, '.mcp.json');

        await fs.writeFile(bridgeScriptPath, `
import net from 'net';
const socket = net.createConnection(${tcpPort}, () => {
    process.stdin.pipe(socket);
    socket.pipe(process.stdout);
});
socket.on('error', () => process.exit(1));
        `.trim());

        await fs.writeFile(mcpConfigPath, JSON.stringify({
            mcpServers: {
                playwright: {
                    command: 'node',
                    args: [bridgeScriptPath]
                }
            }
        }, null, 2));

        // 4. Build and spawn the Print Command
        const { command, stdin } = provider.buildPrintCommand({
            prompt: fullPrompt,
            mcpConfigPath: mcpConfigPath,
            dangerouslySkipPermissions: true, // skip workspace trust prompts in CI/tests
            resumeSession: existingSessionId
        });

        if (this.verbose) {
            this.logger.log(`🚀 Spawning: ${command}`);
        }

        return new Promise((resolve, reject) => {
            let finalResult = '';
            let stepCount = 0;
            const fullOutput = [];
            let currentSessionId = existingSessionId;
            let lastToolName = '';
            let assertionFailed = false;
            let assertionError = '';

            // Spawn the subprocess using the shell so that the CLI args parse properly
            const child = spawn(command, {
                cwd: process.cwd(), // <-- Run from project root so conversation history (.claude) is found!
                shell: true,
                stdio: ['pipe', 'pipe', 'inherit']
            });

            // If provider specified stdin, write it
            if (stdin) {
                child.stdin.write(stdin);
                child.stdin.end();
            }

            // Stream parsing
            let buffer = '';
            child.stdout.on('data', (data) => {
                const chunk = data.toString('utf-8');
                fullOutput.push(chunk);
                buffer += chunk;

                let newlineIndex;
                while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
                    const line = buffer.slice(0, newlineIndex).trim();
                    buffer = buffer.slice(newlineIndex + 1);

                    if (line) {
                        const events = provider.parseStreamLine(line);
                        for (const event of events) {
                            if (event.type === 'session_id') {
                                currentSessionId = event.sessionId;
                                sessionManager.setSession(browserContext, currentSessionId);
                                if (!existingSessionId && this.verbose) {
                                    this.logger.log(`🆕 Started new session: ${currentSessionId}\n`);
                                }
                            } else if (event.type === 'text') {
                                if (this.verbose) this.logger.log(`💬 Assistant: ${event.text}`);
                            } else if (event.type === 'tool_call') {
                                stepCount++;
                                lastToolName = event.name || '';
                                if (this.verbose) this.logger.log(`🔧 Tool Call: ${event.name}(${event.args})`);
                            } else if (event.type === 'tool_error') {
                                if (this.verbose) this.logger.log(`❌ Tool Error: ${event.error}`);
                                if (lastToolName.includes('browser_verify_')) {
                                    // Assertion tool failed — flag it but do NOT kill the subprocess.
                                    // The PostToolUseFailure hook blocks further tool calls and instructs
                                    // Claude to write a failure summary before stopping gracefully.
                                    assertionFailed = true;
                                    assertionError = event.error;
                                }
                                // Action tool failed → log but let Claude retry with a different approach
                            } else if (event.type === 'result') {
                                finalResult += event.result + '\n';
                                if (this.verbose) this.logger.log(`✅ Result: ${event.result}`);
                            }
                        }
                    }
                }
            });

            child.on('close', async (code) => {
                // Cleanup
                try {
                    await mcpServer.close();
                    tcpServer.close();
                    await fs.unlink(bridgeScriptPath).catch(() => { });
                    await fs.unlink(mcpConfigPath).catch(() => { });
                    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => { });
                } catch (e) {
                    // Ignore
                }

                if (assertionFailed) {
                    // Prefer Claude's own summary (written after the PostToolUseFailure hook fired)
                    // over the raw tool error string
                    const summary = finalResult.trim() || assertionError;
                    return reject(new Error(summary));
                }

                if (code !== 0) {
                    return reject(new Error(`Agent provider exited with code ${code}`));
                }

                const usage = provider.parseSessionUsage?.(fullOutput.join(''));

                if (stepCount === 0) {
                    return reject(new Error("Agent responded without calling any Playwright MCP tools. The step is considered failed."));
                }

                if (this.options.returnUsage) {
                    resolve({
                        result: finalResult.trim(),
                        usage: usage || {},
                        steps: stepCount,
                        sessionId: currentSessionId,
                        provider: provider.name
                    });
                } else {
                    resolve(finalResult.trim());
                }
            });

            child.on('error', (err) => {
                tcpServer.close();
                reject(err);
            });
        });
    }
}
