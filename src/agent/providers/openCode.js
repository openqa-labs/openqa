import { createOpencode } from '@opencode-ai/sdk';
import { createServer } from 'net';
import { PLAYWRIGHT_SYSTEM_PROMPT } from '../systemPrompt.js';

async function getFreePort() {
    return new Promise((resolve, reject) => {
        const srv = createServer();
        srv.listen(0, '127.0.0.1', () => {
            const { port } = srv.address();
            srv.close(() => resolve(port));
        });
        srv.on('error', reject);
    });
}

export const openCode = (model = 'anthropic/claude-haiku-4-5', options = {}) => {
    // Parse "providerID/modelID" format expected by OpenCode SDK
    const slashIdx = model.indexOf('/');
    const providerID = slashIdx >= 0 ? model.slice(0, slashIdx) : model;
    const modelID = slashIdx >= 0 ? model.slice(slashIdx + 1) : model;

    return {
        name: 'opencode',

        async run(prompt, { mcpUrl, existingSessionId, verbose, logger }) {
            const port = await getFreePort();
            const { client, server } = await createOpencode({
                port,
                config: {
                    mcp: {
                        playwright: { type: 'remote', url: mcpUrl },
                    },
                },
            });

            // subscribe() returns Promise<{ stream: AsyncGenerator }> — await first, then iterate .stream
            const { stream: eventStream } = await client.event.subscribe();

            const sessionResult = existingSessionId
                ? { data: { id: existingSessionId } }
                : await client.session.create({ body: {} });
            const sessionId = sessionResult.data.id;

            if (verbose) {
                if (existingSessionId) {
                    logger.log(`♻️  SESSION: Resuming OpenCode session: ${sessionId}\n`);
                } else {
                    logger.log(`🆕 Started new OpenCode session: ${sessionId}\n`);
                }
            }

            await client.session.promptAsync({
                path: { id: sessionId },
                body: {
                    system: PLAYWRIGHT_SYSTEM_PROMPT,
                    parts: [{ type: 'text', text: prompt }],
                    model: { providerID, modelID },
                },
            });

            let stepCount = 0;
            let finalResult = '';
            let assertionFailed = false;
            let assertionError = '';
            let currentSessionId = sessionId;
            const tokens = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };

            try {
                for await (const event of eventStream) {
                    const { type, properties } = event;

                    if (type === 'session.created') {
                        currentSessionId = properties.info.id;
                    }

                    // Auto-approve all permission requests — equivalent to bypassPermissions
                    if (type === 'permission.updated' && properties.sessionID === currentSessionId) {
                        await client.session.postSessionIdPermissionsPermissionId({
                            path: { id: currentSessionId, permissionID: properties.id },
                            body: { response: 'always' },
                        }).catch(() => {});
                    }

                    if (type === 'message.part.updated' && properties.part) {
                        const { part } = properties;

                        if (part.type === 'tool') {
                            if (part.state.status === 'running') {
                                stepCount++;
                                if (verbose) logger.log(`🔧 Tool Call: ${part.tool}`);
                            }
                            if (part.state.status === 'error') {
                                const errorText = String(part.state.error ?? 'Unknown tool error');
                                if (verbose) logger.log(`❌ Tool Error [${part.tool}]: ${errorText}`);
                                if (part.tool?.includes('browser_verify_')) {
                                    assertionFailed = true;
                                    assertionError = errorText;
                                }
                            }
                            // MCP isError:true is surfaced as ToolStateCompleted with error text in output
                            if (part.state.status === 'completed' && part.tool?.includes('browser_verify_')) {
                                const output = part.state.output ?? '';
                                const isErrorOutput = output.startsWith('### Error') ||
                                    (() => { try { return JSON.parse(output)?.isError === true; } catch { return false; } })();
                                if (isErrorOutput) {
                                    const errorText = output.replace(/^### Error\n?/, '').trim() || output;
                                    if (verbose) logger.log(`❌ Tool Error [${part.tool}]: ${errorText}`);
                                    assertionFailed = true;
                                    assertionError = errorText;
                                }
                            }
                        }

                        if (part.type === 'text' && part.text) {
                            finalResult += part.text;
                            if (verbose) logger.log(`💬 Assistant: ${part.text}`);
                        }

                        if (part.type === 'step-finish') {
                            tokens.input  += part.tokens?.input  ?? 0;
                            tokens.output += part.tokens?.output ?? 0;
                            tokens.cacheRead  += part.tokens?.cache?.read  ?? 0;
                            tokens.cacheWrite += part.tokens?.cache?.write ?? 0;
                        }
                    }

                    if (type === 'session.idle') {
                        break;
                    }

                    if (type === 'session.error') {
                        const msg = properties.error?.data?.message ?? 'OpenCode session error';
                        throw new Error(msg);
                    }
                }
            } finally {
                server.close();
            }

            if (assertionFailed) {
                const summary = finalResult.trim() || assertionError;
                throw new Error(summary);
            }

            // Fallback: agent described a failure in text without calling a verify tool
            if (/\btest\s+fail/i.test(finalResult) || /\bassertion\s+fail/i.test(finalResult)) {
                throw new Error(finalResult.trim());
            }

            if (stepCount === 0) {
                throw new Error('Agent responded without calling any Playwright MCP tools. The step is considered failed.');
            }

            const usage = {
                inputTokens: tokens.input,
                outputTokens: tokens.output,
                cacheReadInputTokens: tokens.cacheRead,
                cacheCreationInputTokens: tokens.cacheWrite,
            };

            return {
                result: finalResult.trim(),
                usage,
                steps: stepCount,
                sessionId: currentSessionId,
            };
        },
    };
};
