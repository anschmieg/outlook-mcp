/**
 * HTTP-compatible authentication tools for the Outlook MCP server
 */

/**
 * About tool handler
 * @param {object} args - Tool arguments
 * @param {object} context - Context containing env, tokenStorage, etc.
 * @returns {object} - MCP response
 */
async function handleAbout(args, context) {
  return {
    content: [{
      type: "text",
      text: `📧 Outlook Assistant MCP Server (HTTP) v2.0.0 📧\n\nProvides access to Microsoft Outlook email, calendar, and contacts through Microsoft Graph API.\nImplemented as a Cloudflare Worker with HTTP transport for Model Context Protocol.`
    }]
  };
}

/**
 * Authentication tool handler
 * @param {object} args - Tool arguments
 * @param {object} context - Context containing env, tokenStorage, etc.
 * @returns {object} - MCP response
 */
async function handleAuthenticate(args, context) {
  const { tokenStorage, env } = context;
  const force = args && args.force === true;
  
  try {
    // Check if already authenticated (unless force is true)
    if (!force) {
      const hasValidTokens = await tokenStorage.hasValidTokens();
      if (hasValidTokens) {
        return {
          content: [{
            type: "text",
            text: 'Already authenticated with Microsoft Graph API. Use force=true to re-authenticate.'
          }]
        };
      }
    }
    
    // Generate auth URL
    const baseUrl = env.BASE_URL || 'https://outlook-mcp.your-domain.workers.dev';
    const authUrl = `${baseUrl}/auth/start`;
    
    return {
      content: [{
        type: "text",
        text: `Authentication required. Please visit the following URL to authenticate with Microsoft:\n\n${authUrl}\n\nAfter authentication, you will be redirected back and can use the MCP tools.`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text", 
        text: `Authentication error: ${error.message}`
      }]
    };
  }
}

/**
 * Check authentication status tool handler
 * @param {object} args - Tool arguments
 * @param {object} context - Context containing env, tokenStorage, etc.
 * @returns {object} - MCP response
 */
async function handleCheckAuthStatus(args, context) {
  const { tokenStorage } = context;
  
  try {
    const hasValidTokens = await tokenStorage.hasValidTokens();
    
    if (hasValidTokens) {
      const tokens = await tokenStorage.loadTokens();
      const expiresAt = new Date(tokens.expires_at).toISOString();
      
      return {
        content: [{
          type: "text",
          text: `✅ Authenticated and ready\nToken expires: ${expiresAt}`
        }]
      };
    } else {
      return {
        content: [{
          type: "text",
          text: "❌ Not authenticated. Use the 'authenticate' tool to get started."
        }]
      };
    }
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error checking authentication status: ${error.message}`
      }]
    };
  }
}

// Tool definitions
const httpAuthTools = [
  {
    name: "about",
    description: "Returns information about this Outlook Assistant server",
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    },
    handler: handleAbout
  },
  {
    name: "authenticate",
    description: "Authenticate with Microsoft Graph API to access Outlook data",
    inputSchema: {
      type: "object",
      properties: {
        force: {
          type: "boolean",
          description: "Force re-authentication even if already authenticated"
        }
      },
      required: []
    },
    handler: handleAuthenticate
  },
  {
    name: "check-auth-status",
    description: "Check the current authentication status with Microsoft Graph API",
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    },
    handler: handleCheckAuthStatus
  }
];

module.exports = {
  httpAuthTools,
  handleAbout,
  handleAuthenticate,
  handleCheckAuthStatus
};