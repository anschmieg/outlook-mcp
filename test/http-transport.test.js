/**
 * Basic test for HTTP transport functionality
 */

const workerModule = require('../src/worker.js');
const worker = workerModule;

// Mock environment
const mockEnv = {
  CLIENT_ID: 'test-client-id',
  CLIENT_SECRET: 'test-client-secret',
  TENANT_ID: 'test-tenant-id',
  BASE_URL: 'http://localhost:8787',
  OUTLOOK_TOKENS: {
    get: async () => null,
    put: async () => {},
    delete: async () => {}
  }
};

// Mock request
function createMockRequest(method, url, body = null) {
  return {
    method,
    url,
    json: async () => body,
    headers: new Map()
  };
}

// Test basic health check
async function testHealthCheck() {
  const request = createMockRequest('GET', 'http://localhost:8787/health');
  const response = await worker.fetch(request, mockEnv, {});
  
  const responseData = await response.json();
  console.log('Health check response:', responseData);
  
  if (responseData.status === 'healthy') {
    console.log('✅ Health check passed');
  } else {
    console.log('❌ Health check failed');
  }
}

// Test JSON-RPC initialize
async function testInitialize() {
  const request = createMockRequest('POST', 'http://localhost:8787/mcp', {
    jsonrpc: '2.0',
    method: 'initialize',
    id: 1,
    params: {}
  });
  
  const response = await worker.fetch(request, mockEnv, {});
  const responseData = await response.json();
  
  console.log('Initialize response:', JSON.stringify(responseData, null, 2));
  
  if (responseData.result && responseData.result.capabilities) {
    console.log('✅ Initialize test passed');
  } else {
    console.log('❌ Initialize test failed');
  }
}

// Test tools/list
async function testToolsList() {
  const request = createMockRequest('POST', 'http://localhost:8787/mcp', {
    jsonrpc: '2.0',
    method: 'tools/list',
    id: 2,
    params: {}
  });
  
  const response = await worker.fetch(request, mockEnv, {});
  const responseData = await response.json();
  
  console.log('Tools list response:', JSON.stringify(responseData, null, 2));
  
  if (responseData.result && responseData.result.tools && responseData.result.tools.length > 0) {
    console.log(`✅ Tools list test passed (${responseData.result.tools.length} tools found)`);
  } else {
    console.log('❌ Tools list test failed');
  }
}

// Run tests
async function runTests() {
  console.log('Running HTTP transport tests...\n');
  
  try {
    await testHealthCheck();
    console.log('');
    
    await testInitialize();
    console.log('');
    
    await testToolsList();
    console.log('');
    
    console.log('All tests completed!');
  } catch (error) {
    console.error('Test error:', error);
  }
}

if (require.main === module) {
  runTests();
}

module.exports = { runTests };