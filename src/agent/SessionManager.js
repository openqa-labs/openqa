
/**
 * Manages sessions for Claude Agent
 * Associates browser contexts with session IDs and MCP connections
 */
export class SessionManager {
    constructor() {
        /**
         * WeakMap to store session IDs associated with browser contexts
         * Using WeakMap ensures automatic cleanup when contexts are garbage collected
         */
        this.contextSessionMap = new WeakMap();

        /**
         * WeakMap to store MCP connections associated with browser contexts
         * Each connection contains: { mcpServer, cleanup }
         */
        this.mcpConnections = new WeakMap();

        /**
         * FinalizationRegistry to clean up MCP connections when browser contexts are GC'd
         */
        this.registry = new FinalizationRegistry((heldValue) => {
            if (heldValue.cleanup) {
                heldValue.cleanup().catch(() => {}); // Ignore cleanup errors
            }
        });
    }

    /**
     * Get the session ID for a browser context
     * @param {BrowserContext} browserContext 
     * @returns {string|undefined}
     */
    getSession(browserContext) {
        return this.contextSessionMap.get(browserContext);
    }

    /**
     * Set the session ID for a browser context
     * @param {BrowserContext} browserContext
     * @param {string} sessionId
     */
    setSession(browserContext, sessionId) {
        this.contextSessionMap.set(browserContext, sessionId);
    }

    /**
     * Get the MCP connection for a browser context
     * @param {BrowserContext} browserContext
     * @returns {Object|undefined} Connection object with mcpServer and cleanup function
     */
    getMcpConnection(browserContext) {
        return this.mcpConnections.get(browserContext);
    }

    /**
     * Set the MCP connection for a browser context
     * Registers cleanup via FinalizationRegistry for when context is GC'd
     * @param {BrowserContext} browserContext
     * @param {Object} connection - Object containing mcpServer and cleanup function
     */
    setMcpConnection(browserContext, connection) {
        this.mcpConnections.set(browserContext, connection);
        // Register cleanup when browser context is garbage collected
        this.registry.register(browserContext, connection);
    }

    /**
     * Reset the session for a specific browser context
     * Also cleans up MCP connection if present
     * @param {BrowserContext} browserContext
     * @returns {string|null} The removed session ID or null
     */
    resetSession(browserContext) {
        const sessionId = this.contextSessionMap.get(browserContext);

        // Clean up MCP connection
        const connection = this.mcpConnections.get(browserContext);
        if (connection?.cleanup) {
            connection.cleanup().catch(() => {}); // Ignore cleanup errors
        }

        // Remove from maps
        this.contextSessionMap.delete(browserContext);
        this.mcpConnections.delete(browserContext);

        return sessionId || null;
    }
}

// Export a singleton instance to maintain state across imports
export const sessionManager = new SessionManager();
