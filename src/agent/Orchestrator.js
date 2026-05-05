import { createMcpHttpServer } from './createMcpServer.js';
import { sessionManager } from './SessionManager.js';
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

        const existingSessionId = sessionManager.getSession(browserContext);
        if (existingSessionId && this.verbose) {
            this.logger.log(`♻️  SESSION: Resuming session: ${existingSessionId}\n`);
        }

        const { url: mcpUrl, cleanup } = await createMcpHttpServer(browserContext);

        try {
            const result = await provider.run(prompt, {
                mcpUrl,
                existingSessionId,
                verbose: this.verbose,
                returnUsage: this.options.returnUsage,
                logger: this.logger,
            });

            if (result.sessionId) {
                sessionManager.setSession(browserContext, result.sessionId);
            }

            return this.options.returnUsage ? result : result.result;
        } finally {
            await cleanup();
        }
    }
}
