/**
 * Jest tests for authentication-related endpoints and tools
 */

let worker;
beforeAll(async () => {
  worker = (await import('../src/worker.js')).default;
});

// Load environment variables from .env (optional)
try { require('dotenv').config(); } catch (_) {}

// Mock environment using environment variables
const mockEnv = {
  CLIENT_ID: process.env.CLIENT_ID || 'test-client-id',
  CLIENT_SECRET: process.env.CLIENT_SECRET || 'test-client-secret',
  TENANT_ID: process.env.TENANT_ID || 'common',
  BASE_URL: process.env.BASE_URL || 'http://localhost:8787',
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

describe('Auth Tools and Endpoints (HTTP)', () => {
  test('tools/call authenticate returns an auth message with URL', async () => {
    const request = createMockRequest('POST', 'http://localhost:8787/mcp', {
      jsonrpc: '2.0',
      method: 'tools/call',
      id: 3,
      params: { name: 'authenticate', arguments: {} }
    });
    const response = await worker.fetch(request, mockEnv, {});
    const payload = await response.json();
    expect(payload).toHaveProperty('result');
    const text = payload.result?.content?.[0]?.text || '';
    expect(typeof text).toBe('string');
    expect(text.length).toBeGreaterThan(0);
  });

  test('tools/call check-auth-status returns a status message', async () => {
    const request = createMockRequest('POST', 'http://localhost:8787/mcp', {
      jsonrpc: '2.0',
      method: 'tools/call',
      id: 4,
      params: { name: 'check-auth-status', arguments: {} }
    });
    const response = await worker.fetch(request, mockEnv, {});
    const payload = await response.json();
    expect(payload).toHaveProperty('result');
    const text = payload.result?.content?.[0]?.text || '';
    expect(typeof text).toBe('string');
  });

  test('GET /auth/start returns a valid authUrl', async () => {
    const request = createMockRequest('GET', 'http://localhost:8787/auth/start');
    const response = await worker.fetch(request, mockEnv, {});
    const payload = await response.json();
    expect(payload).toHaveProperty('authUrl');
    expect(typeof payload.authUrl).toBe('string');
    expect(payload.authUrl.includes('login.microsoftonline.com')).toBe(true);
  });
});
