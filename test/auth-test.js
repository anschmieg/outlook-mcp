/**
 * Test authentication functionality
 */

const worker = require('../src/worker.js');

// Mock environment with the provided test credentials
const mockEnv = {
  CLIENT_ID: 'c06492eb-f296-4168-b554-b084ecaa903a',
  CLIENT_SECRET: 'jiq8Q~B1r2y8Q5Af63hRU25Mb~ZpTZ4.JI_vYbT9',
  TENANT_ID: 'f91d64dc-5dc0-4339-aab4-c3a9c67f1ac7',
  BASE_URL: 'http://localhost:8787',
  OUTLOOK_TOKENS: {
    get: async () => null,
    put: async (key, value) => {
      console.log(`KV PUT: ${key} = ${value.substring(0, 100)}...`);
    },
    delete: async (key) => {
      console.log(`KV DELETE: ${key}`);
    }
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

// Test authenticate tool
async function testAuthenticate() {
  const request = createMockRequest('POST', 'http://localhost:8787/mcp', {
    jsonrpc: '2.0',
    method: 'tools/call',
    id: 3,
    params: {
      name: 'authenticate',
      arguments: {}
    }
  });
  
  const response = await worker.fetch(request, mockEnv, {});
  const responseData = await response.json();
  
  console.log('Authenticate response:', JSON.stringify(responseData, null, 2));
  
  if (responseData.result && responseData.result.content) {
    console.log('✅ Authenticate test passed');
    const content = responseData.result.content[0].text;
    
    // Extract auth URL if present
    if (content.includes('/auth/start')) {
      console.log('🔗 Authentication URL found in response');
    }
  } else {
    console.log('❌ Authenticate test failed');
  }
}

// Test check auth status
async function testCheckAuthStatus() {
  const request = createMockRequest('POST', 'http://localhost:8787/mcp', {
    jsonrpc: '2.0',
    method: 'tools/call',
    id: 4,
    params: {
      name: 'check-auth-status',
      arguments: {}
    }
  });
  
  const response = await worker.fetch(request, mockEnv, {});
  const responseData = await response.json();
  
  console.log('Check auth status response:', JSON.stringify(responseData, null, 2));
  
  if (responseData.result && responseData.result.content) {
    console.log('✅ Check auth status test passed');
  } else {
    console.log('❌ Check auth status test failed');
  }
}

// Test auth start endpoint
async function testAuthStart() {
  const request = createMockRequest('GET', 'http://localhost:8787/auth/start');
  const response = await worker.fetch(request, mockEnv, {});
  
  const responseData = await response.json();
  console.log('Auth start response:', JSON.stringify(responseData, null, 2));
  
  if (responseData.authUrl && responseData.authUrl.includes('login.microsoftonline.com')) {
    console.log('✅ Auth start test passed');
    console.log('🔗 Generated OAuth URL:', responseData.authUrl);
  } else {
    console.log('❌ Auth start test failed');
  }
}

// Run authentication tests
async function runAuthTests() {
  console.log('Testing authentication functionality...\n');
  
  try {
    await testAuthenticate();
    console.log('');
    
    await testCheckAuthStatus();
    console.log('');
    
    await testAuthStart();
    console.log('');
    
    console.log('Authentication tests completed!');
  } catch (error) {
    console.error('Test error:', error);
  }
}

if (require.main === module) {
  runAuthTests();
}

module.exports = { runAuthTests };