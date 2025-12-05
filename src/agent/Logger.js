
/**
 * Logger for Claude Agent
 * Handles all console output and formatting
 */
export class Logger {
    constructor(verbose = true) {
        this.verbose = verbose;
    }

    log(message) {
        if (this.verbose) {
            console.log(message);
        }
    }

    error(message, ...args) {
        // Always log errors, regardless of verbose setting, unless explicitly suppressed
        // But for this refactor, we'll follow the original pattern where some errors were conditional
        console.error(message, ...args);
    }

    logContext(browserContext, inputPage) {
        if (!this.verbose) return;

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

    logSessionStart(sessionId, isResumed, mcpServers) {
        if (!this.verbose) return;

        if (isResumed) {
            console.log(`✅ SESSION: Session continued successfully (${sessionId})`);
        } else {
            console.log(`🔑 SESSION: New session started: ${sessionId}`);
        }
        console.log('✅ System initialized with shared browser context');
        if (mcpServers) {
            mcpServers.forEach(server => {
                console.log(`   🔌 ${server.name}: ${server.status}`);
            });
        }
        console.log();
    }

    logStep(stepCount, usage) {
        if (!this.verbose) return;
        console.log(`📈 Step ${stepCount}: Input=${usage.input_tokens || 0}, Output=${usage.output_tokens || 0}`);
    }

    logAssistantMessage(content) {
        if (!this.verbose) return;

        const textContent = content
            .filter(block => block.type === 'text')
            .map(block => block.text)
            .join('\n');

        if (textContent.trim()) {
            console.log('💬 Assistant:', textContent.substring(0, 200) +
                (textContent.length > 200 ? '...' : ''));
            console.log();
        }
    }

    logUserMessage(message) {
        if (!this.verbose) return;
        console.log('📨 User Message:', JSON.stringify(message, null, 2));
    }

    logResult(result) {
        if (!this.verbose) return;
        console.log(`✅ Result: ${result.substring(0, 100)}...`);
    }

    logUsage(stepCount, totalUsage, sessionId) {
        if (!this.verbose || !totalUsage) return;

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

        console.log(`└─ Session ID: ${sessionId}\n`);
    }

    logToolFailure(toolName, errorText) {
        if (!this.verbose) return;
        console.error(`\n❌ TOOL FAILURE [${toolName}]:`, errorText);
        console.error(`🛑 Aborting query due to tool failure\n`);
    }

    logToolError(input) {
        if (!this.verbose) return;
        console.error(`\n❌ TOOL ERROR [${input.tool_name}]:`, {
            tool: input.tool_name,
            tool_input: input.tool_input,
            tool_use_id: input.tool_use_id,
            error: input.error,
            is_interrupt: input.is_interrupt
        });
    }
}
