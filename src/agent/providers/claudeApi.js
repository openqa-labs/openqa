import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../../..');
config({ path: join(projectRoot, '.env') });

export function claudeApi(model = 'claude-3-5-haiku-20241022') {
    return {
        name: 'claude-api',
        execute: async function* (prompt, systemPrompt, tools) {
            const apiKey = process.env.ANTHROPIC_API_KEY;
            if (!apiKey) throw new Error("ANTHROPIC_API_KEY environment variable is required.");

            let messages = [{ role: 'user', content: prompt }];
            
            // Format MCP tools for Anthropic
            const anthropicTools = tools.map(t => ({
                name: t.name,
                description: t.description || `Tool ${t.name}`,
                input_schema: t.inputSchema
            }));

            while (true) {
                const response = await fetch('https://api.anthropic.com/v1/messages', {
                    method: 'POST',
                    headers: {
                        'x-api-key': apiKey,
                        'anthropic-version': '2023-06-01',
                        'content-type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: model,
                        max_tokens: 4096,
                        system: systemPrompt,
                        messages: messages,
                        tools: anthropicTools
                    })
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Anthropic API Error: ${response.status} - ${errorText}`);
                }

                const data = await response.json();
                
                // Track the assistant message
                messages.push({ role: 'assistant', content: data.content });
                
                let toolCallRequested = false;
                let toolResults = [];

                for (const block of data.content) {
                    if (block.type === 'text') {
                        yield { type: 'text', text: block.text };
                    } else if (block.type === 'tool_use') {
                        toolCallRequested = true;
                        
                        // Yield to orchestrator, await tool result
                        const result = yield { 
                            type: 'tool_call', 
                            name: block.name, 
                            args: block.input,
                            id: block.id
                        };
                        
                        // Format the MCP tool result for Anthropic
                        toolResults.push({
                            type: 'tool_result',
                            tool_use_id: block.id,
                            content: typeof result.content === 'string' ? result.content : JSON.stringify(result.content),
                            is_error: result.isError || false
                        });
                    }
                }

                if (toolCallRequested) {
                    messages.push({ role: 'user', content: toolResults });
                } else {
                    const finalResult = data.content
                        .filter(c => c.type === 'text')
                        .map(c => c.text)
                        .join('\n');
                        
                    yield { type: 'result', result: finalResult, usage: data.usage };
                    break;
                }
            }
        }
    };
}
