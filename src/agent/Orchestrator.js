import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createConnection } from '@playwright/mcp';
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

        // 1. Setup MCP Server
        const mcpServer = await createConnection(
            { capabilities: ['core', 'testing'] },
            () => Promise.resolve(browserContext)
        );

        // 2. Setup MCP Client via InMemoryTransport
        const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
        await mcpServer.connect(serverTransport);

        const mcpClient = new Client(
            { name: 'openqa-orchestrator', version: '1.0.0' },
            { capabilities: {} }
        );
        await mcpClient.connect(clientTransport);

        // 3. Extract Tools
        const toolsResponse = await mcpClient.listTools();
        const tools = toolsResponse.tools;

        if (this.verbose) {
            this.logger.log(`✅ Loaded ${tools.length} Playwright MCP tools\n`);
        }

        const systemPrompt = `You are a Playwright Test Agent. CRITICAL RULES:
1. You MUST call at least one Playwright MCP tool for EVERY user instruction
2. NEVER respond based on cached or remembered page state
3. For verification steps (should see, verify, check, assert): ALWAYS call browser_verify_text_visible or browser_snapshot
4. For actions (click, type, navigate): ALWAYS call the corresponding browser_* tool
5. The test will FAIL if you respond without calling a Playwright tool`;

        // 4. Start execution loop
        const generator = provider.execute(prompt, systemPrompt, tools);
        let nextInput = undefined;
        let finalResult = '';
        let totalUsage = null;
        let stepCount = 0;

        try {
            while (true) {
                const { value: event, done } = await generator.next(nextInput);
                
                if (done) break;

                if (event.type === 'text') {
                    if (this.verbose) {
                        this.logger.logAssistantMessage(event.text);
                    }
                    nextInput = undefined;
                } else if (event.type === 'tool_call') {
                    if (this.verbose) {
                        console.log(`🔧 Calling tool: ${event.name}`);
                    }
                    stepCount++;
                    
                    try {
                        const mcpResult = await mcpClient.callTool({
                            name: event.name,
                            arguments: event.args
                        });
                        
                        nextInput = {
                            content: mcpResult.content.map(c => c.text).join('\n'),
                            isError: mcpResult.isError || false
                        };
                        
                        if (mcpResult.isError && this.verbose) {
                            this.logger.logToolFailure(event.name, nextInput.content);
                        }
                    } catch (err) {
                        if (this.verbose) {
                            this.logger.logToolFailure(event.name, err.message);
                        }
                        nextInput = {
                            content: err.message,
                            isError: true
                        };
                    }
                } else if (event.type === 'result') {
                    finalResult = event.result;
                    totalUsage = event.usage;
                    if (this.verbose) {
                        this.logger.logResult(finalResult);
                    }
                    nextInput = undefined;
                }
            }
            
            if (this.verbose && totalUsage) {
                console.log('\n📊 USAGE SUMMARY');
                console.log(`├─ Steps: ${stepCount}`);
                console.log(`├─ Input tokens: ${totalUsage.input_tokens || 0}`);
                console.log(`├─ Output tokens: ${totalUsage.output_tokens || 0}`);
                console.log(`└─ Provider: ${provider.name}\n`);
            }

        } finally {
            // Cleanup
            try {
                await mcpClient.close();
                await mcpServer.close();
            } catch (e) {
                // Ignore cleanup errors
            }
        }

        if (this.options.returnUsage) {
            return {
                result: finalResult,
                usage: totalUsage,
                steps: stepCount,
                provider: provider.name
            };
        }

        return finalResult;
    }
}
