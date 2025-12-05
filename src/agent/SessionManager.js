
/**
 * Manages sessions for Claude Agent
 * Associates browser contexts with session IDs
 */
export class SessionManager {
    constructor() {
        /**
         * WeakMap to store session IDs associated with browser contexts
         * Using WeakMap ensures automatic cleanup when contexts are garbage collected
         */
        this.contextSessionMap = new WeakMap();
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
     * Reset the session for a specific browser context
     * @param {BrowserContext} browserContext 
     * @returns {string|null} The removed session ID or null
     */
    resetSession(browserContext) {
        const sessionId = this.contextSessionMap.get(browserContext);
        if (sessionId) {
            this.contextSessionMap.delete(browserContext);
            return sessionId;
        }
        return null;
    }
}

// Export a singleton instance to maintain state across imports
export const sessionManager = new SessionManager();
