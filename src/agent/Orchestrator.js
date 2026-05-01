import { createConnection } from '@playwright/mcp';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { spawn } from 'child_process';
import net from 'net';
import fs from 'fs/promises';
import path from 'path';
import { Logger } from './Logger.js';

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

        const systemPrompt = `You are a Playwright Test Agent. CRITICAL RULES:
1. You MUST call at least one Playwright MCP tool for EVERY user instruction
2. NEVER respond based on cached or remembered page state
3. For verification steps (should see, verify, check, assert): ALWAYS call browser_verify_text_visible or browser_snapshot
4. For actions (click, type, navigate): ALWAYS call the corresponding browser_* tool
5. The test will FAIL if you respond without calling a Playwright tool`;

        // Combine prompt and system prompt
        const fullPrompt = `${systemPrompt}\n\nUser Instruction: ${prompt}`;

        // 1. Setup MCP Server (in-memory, tied to the Playwright test context)
        const mcpServer = await createConnection(
            { capabilities: ['core', 'testing'] },
            () => Promise.resolve(browserContext)
        );

        // 2. Setup local TCP Server to wrap the MCP Server in StdioServerTransport
        const tcpServer = net.createServer((socket) => {
            const transport = new StdioServerTransport(socket, socket);
            mcpServer.connect(transport);
        });

        await new Promise(resolve => tcpServer.listen(0, '127.0.0.1', resolve));
        const tcpPort = tcpServer.address().port;

        // 3. Create Bridge artifacts for the claude CLI to connect to the TCP socket
        const bridgeScriptPath = path.join(process.cwd(), '.openqa-bridge.js');
        const mcpConfigPath = path.join(process.cwd(), '.openqa-mcp.json');

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
            dangerouslySkipPermissions: true // skip workspace trust prompts in CI/tests
        });

        if (this.verbose) {
            this.logger.log(`🚀 Spawning: ${command}`);
        }

        return new Promise((resolve, reject) => {
            let finalResult = '';
            let stepCount = 0;
            const fullOutput = [];

            // Spawn the subprocess using the shell so that the CLI args parse properly
            const child = spawn(command, {
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
                            if (event.type === 'text') {
                                if (this.verbose) this.logger.log(`💬 Assistant: ${event.text}`);
                            } else if (event.type === 'tool_call') {
                                stepCount++;
                                if (this.verbose) this.logger.log(`🔧 Tool Call: ${event.name}(${event.args})`);
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
                    await fs.unlink(bridgeScriptPath).catch(() => {});
                    await fs.unlink(mcpConfigPath).catch(() => {});
                } catch (e) {
                    // Ignore
                }

                if (code !== 0) {
                    return reject(new Error(`Agent provider exited with code ${code}`));
                }

                const usage = provider.parseSessionUsage?.(fullOutput.join(''));

                if (this.options.returnUsage) {
                    resolve({
                        result: finalResult.trim(),
                        usage: usage || {},
                        steps: stepCount,
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
