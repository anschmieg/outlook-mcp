/**
 * Cloudflare Worker entry point for Outlook MCP Server
 * 
 * Implements HTTP transport for Model Context Protocol
 */

// Import new HTTP-specific modules
const { KVTokenStorage } = require('./auth/kv-token-storage');
const { handleOAuthCallback, generateAuthUrl } = require('./auth/oauth-handler');
const { httpAuthTools } = require('./auth/http-auth-tools');
const { wrapToolsForHttp } = require('./compatibility');

// Import existing modules (we'll adapt these to work with HTTP context)
const { calendarTools } = require('../calendar');
const { emailTools } = require('../email');
const { folderTools } = require('../folder');
const { rulesTools } = require('../rules');

// Combine all tools, wrapping the existing ones for HTTP compatibility
const TOOLS = [
  ...httpAuthTools,
  ...wrapToolsForHttp(calendarTools),
  ...wrapToolsForHttp(emailTools),
  ...wrapToolsForHttp(folderTools),
  ...wrapToolsForHttp(rulesTools)
];

// Server configuration
const SERVER_CONFIG = {
  name: "outlook-assistant-http",
  version: "2.0.0",
  protocolVersion: "2024-11-05"
};

/**
 * Handle JSON-RPC 2.0 request
 */
async function handleJsonRpcRequest(request, env) {
  try {
    const { method, params, id } = request;
    
    console.log(`JSON-RPC Request: ${method} [${id}]`);
    
    // Initialize the KV token storage
    const tokenStorage = new KVTokenStorage(env.OUTLOOK_TOKENS);
    
    switch (method) {
      case 'initialize':
        return {
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: SERVER_CONFIG.protocolVersion,
            capabilities: { 
              tools: TOOLS.reduce((acc, tool) => {
                acc[tool.name] = {};
                return acc;
              }, {})
            },
            serverInfo: { 
              name: SERVER_CONFIG.name, 
              version: SERVER_CONFIG.version 
            }
          }
        };
        
      case 'tools/list':
        return {
          jsonrpc: '2.0',
          id,
          result: {
            tools: TOOLS.map(tool => ({
              name: tool.name,
              description: tool.description,
              inputSchema: tool.inputSchema
            }))
          }
        };
        
      case 'tools/call':
        const { name, arguments: args = {} } = params || {};
        
        // Find the tool handler
        const tool = TOOLS.find(t => t.name === name);
        
        if (tool && tool.handler) {
          // Create a context with environment variables and token storage
          const context = {
            env,
            tokenStorage,
            clientId: env.CLIENT_ID,
            clientSecret: env.CLIENT_SECRET,
            tenantId: env.TENANT_ID
          };
          
          const result = await tool.handler(args, context);
          return {
            jsonrpc: '2.0',
            id,
            result
          };
        } else {
          return {
            jsonrpc: '2.0',
            id,
            error: {
              code: -32601,
              message: `Tool not found: ${name}`
            }
          };
        }
        
      case 'resources/list':
        return {
          jsonrpc: '2.0',
          id,
          result: { resources: [] }
        };
        
      case 'prompts/list':
        return {
          jsonrpc: '2.0',
          id,
          result: { prompts: [] }
        };
        
      default:
        return {
          jsonrpc: '2.0',
          id,
          error: {
            code: -32601,
            message: `Method not found: ${method}`
          }
        };
    }
  } catch (error) {
    console.error('Error handling JSON-RPC request:', error);
    return {
      jsonrpc: '2.0',
      id: request.id,
      error: {
        code: -32603,
        message: `Internal error: ${error.message}`
      }
    };
  }
}

/**
 * Main Cloudflare Worker fetch handler
 */
module.exports = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    try {
      // OAuth callback endpoint
      if (url.pathname === '/auth/callback' && request.method === 'GET') {
        return await handleOAuthCallback(request, env);
      }
      
      // OAuth start endpoint
      if (url.pathname === '/auth/start' && request.method === 'GET') {
        const authUrl = generateAuthUrl(env);
        return new Response(JSON.stringify({ authUrl }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // MCP JSON-RPC endpoint
      if (url.pathname === '/mcp' && request.method === 'POST') {
        const requestBody = await request.json();
        const response = await handleJsonRpcRequest(requestBody, env);
        
        return new Response(JSON.stringify(response), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // Health check
      if (url.pathname === '/health') {
        return new Response(JSON.stringify({ 
          status: 'healthy', 
          server: SERVER_CONFIG.name,
          version: SERVER_CONFIG.version 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // Default response
      return new Response(JSON.stringify({ 
        error: 'Not found',
        endpoints: {
          mcp: '/mcp (POST)',
          auth: {
            start: '/auth/start (GET)',
            callback: '/auth/callback (GET)'
          },
          health: '/health (GET)'
        }
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
      
    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};