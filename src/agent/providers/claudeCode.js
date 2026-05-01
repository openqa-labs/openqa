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

const parseStreamJsonLine = (line) => {
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
          
          // In Sandcastle they only exposed certain tools. 
          // For Playwright MCP, we log the tool and its stringified args.
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

export const claudeCode = (model = "claude-3-5-haiku-20241022", options = {}) => ({
  name: "claude-code",
  env: options.env ?? {},
  captureSessions: options.captureSessions ?? true,

  buildPrintCommand({ prompt, dangerouslySkipPermissions }) {
    const skipPerms = dangerouslySkipPermissions
      ? " --dangerously-skip-permissions"
      : "";
    return {
      command: `npx @anthropic-ai/claude-code --print --verbose${skipPerms} --output-format stream-json --model ${shellEscape(model)} -p -`,
      stdin: prompt,
    };
  },

  parseStreamLine(line) {
    return parseStreamJsonLine(line);
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
});
