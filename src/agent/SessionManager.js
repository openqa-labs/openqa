
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Manages sessions for Claude Agent
 * Associates playwright-cli session names with Claude session IDs
 */
export class SessionManager {
    constructor() {
        /**
         * Map to store Claude session IDs associated with playwright-cli session names
         * Maps sessionName -> claudeSessionId
         */
        this.sessionMap = new Map();
    }

    /**
     * Get the Claude session ID for a session name
     * @param {string} sessionName
     * @returns {string|undefined}
     */
    getSession(sessionName) {
        return this.sessionMap.get(sessionName);
    }

    /**
     * Set the Claude session ID for a session name
     * @param {string} sessionName
     * @param {string} claudeSessionId
     */
    setSession(sessionName, claudeSessionId) {
        this.sessionMap.set(sessionName, claudeSessionId);
    }

    /**
     * Reset the session for a specific session name (removes mapping, does not close browser)
     * @param {string} sessionName
     * @returns {string|null} The removed Claude session ID or null
     */
    resetSession(sessionName) {
        const claudeSessionId = this.sessionMap.get(sessionName);
        this.sessionMap.delete(sessionName);
        return claudeSessionId || null;
    }

    /**
     * Close a playwright-cli browser session and clean up
     * @param {string} sessionName - Session name to close
     * @returns {Promise<void>}
     */
    async closeSession(sessionName) {
        this.sessionMap.delete(sessionName);
        try {
            await execAsync(`playwright-cli close -s=${sessionName}`);
        } catch (error) {
            // Ignore close errors - session may already be closed
        }
    }
}

// Export a singleton instance to maintain state across imports
export const sessionManager = new SessionManager();
