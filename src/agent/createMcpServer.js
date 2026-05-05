import { createConnection } from '@playwright/mcp';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { randomUUID } from 'crypto';
import http from 'http';

/**
 * Creates an in-process Playwright MCP server exposed over StreamableHTTP on a random localhost port.
 * Compatible with both Claude Code SDK (type:'http') and OpenCode SDK (type:'remote').
 *
 * @param {import('@playwright/test').BrowserContext} browserContext
 * @returns {Promise<{ url: string, cleanup: () => Promise<void> }>}
 */
export async function createMcpHttpServer(browserContext) {
    // Wrap context with no-op close so MCP server never disposes our externally-managed context
    const contextWithManagedLifecycle = Object.create(browserContext);
    contextWithManagedLifecycle.close = async () => {};

    const mcpServer = await createConnection(
        {
            capabilities: ['core', 'testing'],
            outputMode: 'file',
            saveSession: true,
        },
        () => Promise.resolve(contextWithManagedLifecycle)
    );

    // Stateful transport — generates a session ID on initialize so the client can send it in subsequent requests.
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: () => randomUUID() });
    await mcpServer.connect(transport);

    const httpServer = http.createServer(async (req, res) => {
        await transport.handleRequest(req, res);
    });

    const port = await new Promise((resolve) =>
        httpServer.listen(0, '127.0.0.1', () => resolve(httpServer.address().port))
    );

    return {
        url: `http://127.0.0.1:${port}/mcp`,
        cleanup: async () => {
            httpServer.close();
            await transport.close().catch(() => {});
            await mcpServer.close().catch(() => {});
        },
    };
}
