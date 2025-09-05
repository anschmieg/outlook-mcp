/**
 * Compatibility adapter for existing MCP tools to work with HTTP context
 */

const { callGraphAPIWithContext } = require('./utils/http-graph-api');

/**
 * Create a compatibility wrapper for existing tool handlers
 * @param {Function} originalHandler - The original tool handler
 * @returns {Function} - HTTP-compatible handler
 */
function createHttpCompatibleHandler(originalHandler) {
  return async function(args, context) {
    try {
      // Expose HTTP context so legacy modules can resolve auth/graph via a bridge
      global.__httpContext = context;

      // Call the original handler
      const result = await originalHandler(args);

      return result;
    } catch (error) {
      console.error('Error in compatibility adapter:', error);
      return {
        content: [{
          type: "text",
          text: `Error: ${error.message}`
        }]
      };
    } finally {
      // Cleanup context
      try { delete global.__httpContext; } catch (_) {}
    }
  };
}

/**
 * Wrap all tools in an array to make them HTTP-compatible
 * @param {Array} toolsArray - Array of tool definitions
 * @returns {Array} - HTTP-compatible tools
 */
function wrapToolsForHttp(toolsArray) {
  return toolsArray.map(tool => ({
    ...tool,
    handler: createHttpCompatibleHandler(tool.handler)
  }));
}

module.exports = {
  createHttpCompatibleHandler,
  wrapToolsForHttp
};
