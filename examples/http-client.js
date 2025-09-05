/**
 * Example MCP client for testing the HTTP transport
 */

class MCPHTTPClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.requestId = 1;
  }

  async call(method, params = {}) {
    const request = {
      jsonrpc: '2.0',
      method,
      id: this.requestId++,
      params
    };

    const response = await fetch(`${this.baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  }

  async initialize() {
    return await this.call('initialize');
  }

  async listTools() {
    return await this.call('tools/list');
  }

  async callTool(name, args = {}) {
    return await this.call('tools/call', { name, arguments: args });
  }
}

// Example usage
async function example() {
  const client = new MCPHTTPClient('http://localhost:8787');

  try {
    console.log('🔗 Initializing MCP connection...');
    const initResponse = await client.initialize();
    console.log('✅ Connected:', initResponse.result.serverInfo);

    console.log('\n📋 Listing available tools...');
    const toolsResponse = await client.listTools();
    const tools = toolsResponse.result.tools;
    console.log(`Found ${tools.length} tools:`);
    tools.forEach(tool => {
      console.log(`  - ${tool.name}: ${tool.description}`);
    });

    console.log('\n🔐 Checking authentication status...');
    const authResponse = await client.callTool('check-auth-status');
    console.log('Auth status:', authResponse.result.content[0].text);

    console.log('\n🚀 Getting authentication URL...');
    const authenticateResponse = await client.callTool('authenticate');
    console.log('Response:', authenticateResponse.result.content[0].text);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run example if this file is executed directly
if (require.main === module) {
  example();
}

module.exports = { MCPHTTPClient };