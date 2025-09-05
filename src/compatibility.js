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
      // Create a mock of the old interface for backward compatibility
      const mockAuth = {
        ensureAuthenticated: async () => {
          const accessToken = await context.tokenStorage.getValidAccessToken();
          if (!accessToken) {
            throw new Error('Authentication required');
          }
          return accessToken;
        }
      };

      // Create a mock graph API that uses the new context
      const mockGraphAPI = {
        callGraphAPI: async (accessToken, method, path, data, queryParams) => {
          return await callGraphAPIWithContext(context, method, path, data, queryParams);
        }
      };

      // Temporarily replace the required modules in the global scope
      const originalRequire = require;
      require = function(modulePath) {
        if (modulePath === '../auth') {
          return mockAuth;
        }
        if (modulePath === '../utils/graph-api') {
          return mockGraphAPI;
        }
        return originalRequire(modulePath);
      };

      // Call the original handler
      const result = await originalHandler(args);

      // Restore original require
      require = originalRequire;

      return result;
    } catch (error) {
      console.error('Error in compatibility adapter:', error);
      return {
        content: [{
          type: "text",
          text: `Error: ${error.message}`
        }]
      };
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