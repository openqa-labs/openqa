const shellEscape = (s) => "'" + s.replace(/'/g, "'\\''") + "'";

/** Maps allowlisted tool names to the input field containing the display arg */
const TOOL_ARG_FIELDS = {
  Bash: "command",
  WebSearch: "query",
  WebFetch: "url",
  Agent: "description",
};

/**
 * Extract an error message from a parsed JSON error event.
 */
const extractErrorMessage = (obj) => {
  const err = obj.error;
  if (typeof err === "string") return err;
  if (typeof err === "object" && err !== null && typeof err.message === "string") {
    return err.message;
  }
  if (typeof obj.message === "string") return obj.message;
  return undefined;
};

const parseStreamJsonLine = (line, toolNameById) => {
  if (!line.startsWith("{")) return [];
  try {
    const obj = JSON.parse(line);
    if (obj.type === "assistant" && Array.isArray(obj.message?.content)) {
      const events = [];
      const texts = [];
      for (const block of obj.message.content) {
        if (block.type === "text" && typeof block.text === "string") {
          texts.push(block.text);
        } else if (
          block.type === "tool_use" &&
          typeof block.name === "string" &&
          block.input !== undefined
        ) {
          if (texts.length > 0) {
            events.push({ type: "text", text: texts.join("") });
            texts.length = 0;
          }

          // Buffer id→name so tool_error events can carry the tool name
          if (block.id) toolNameById.set(block.id, block.name);

          const argsString = typeof block.input === 'object' ? JSON.stringify(block.input) : block.input;
          events.push({
            type: "tool_call",
            name: block.name,
            args: argsString,
          });
        }
      }
      if (texts.length > 0) {
        events.push({ type: "text", text: texts.join("") });
      }
      return events;
    }
    if (obj.type === "user" && Array.isArray(obj.message?.content)) {
      const events = [];
      for (const block of obj.message.content) {
        if (block.type === "tool_result" && block.is_error) {
          let errorText = typeof block.content === 'string'
              ? block.content
              : Array.isArray(block.content)
                  ? block.content.map(c => c.text || JSON.stringify(c)).join('\\n')
                  : 'Unknown tool error';

          // Clean up section headers (### Error, ### Result) that MCP prepends
          errorText = errorText.replace(/^### (?:Error|Result)\\n/, '').trim();

          events.push({
            type: "tool_error",
            toolName: toolNameById.get(block.tool_use_id) || '',
            error: errorText,
            toolId: block.tool_use_id,
          });
        }
      }
      return events;
    }
    if (obj.type === "result" && typeof obj.result === "string") {
      return [{ type: "result", result: obj.result }];
    }
    if (
      obj.type === "system" &&
      obj.subtype === "init" &&
      typeof obj.session_id === "string"
    ) {
      return [{ type: "session_id", sessionId: obj.session_id }];
    }
  } catch {
    // Not valid JSON — skip
  }
  return [];
};

export const claudeCode = (model = "claude-haiku-4-5", options = {}) => {
  const toolNameById = new Map();

  return {
    name: "claude-code",
    env: options.env ?? {},
    captureSessions: options.captureSessions ?? true,

    buildPrintCommand({ prompt, mcpConfigPath, dangerouslySkipPermissions, resumeSession }) {
      const skipPerms = dangerouslySkipPermissions
        ? " --dangerously-skip-permissions"
        : "";
      const mcpFlag = mcpConfigPath ? ` --mcp-config ${shellEscape(mcpConfigPath)} --strict-mcp-config` : "";
      const resumeFlag = resumeSession ? ` --resume ${shellEscape(resumeSession)}` : "";
      return {
        command: `npx @anthropic-ai/claude-code --print --verbose${skipPerms}${mcpFlag} --output-format stream-json --model ${shellEscape(model)}${resumeFlag} -p -`,
        stdin: prompt,
      };
    },

    parseStreamLine(line) {
      return parseStreamJsonLine(line, toolNameById);
    },

    parseSessionUsage(content) {
      const lines = content.split("\n");
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i];
        if (!line) continue;
        if (!line.startsWith("{")) continue;
        try {
          const obj = JSON.parse(line);
          if (obj.type === "assistant" && obj.message?.usage) {
            const u = obj.message.usage;
            if (
              typeof u.input_tokens === "number" &&
              typeof u.output_tokens === "number"
            ) {
              return {
                inputTokens: u.input_tokens,
                cacheCreationInputTokens: u.cache_creation_input_tokens || 0,
                cacheReadInputTokens: u.cache_read_input_tokens || 0,
                outputTokens: u.output_tokens,
              };
            }
          }
        } catch {
          // Not valid JSON — skip
        }
      }
      return undefined;
    },
  };
};
