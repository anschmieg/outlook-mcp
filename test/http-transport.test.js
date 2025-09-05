/**
 * Jest tests for HTTP transport functionality
 */

let worker;
beforeAll(async () => {
  worker = (await import('../src/worker.js')).default;
});

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

// Mock request helper
function createMockRequest(method, url, body = null) {
  return {
    method,
    url,
    json: async () => body,
    headers: new Map()
  };
}

describe('HTTP Transport', () => {
  test('GET /health returns healthy status', async () => {
    const request = createMockRequest('GET', 'http://localhost:8787/health');
    const response = await worker.fetch(request, mockEnv, {});
    const payload = await response.json();
    expect(response.status || 200).toBe(200);
    expect(payload).toHaveProperty('status', 'healthy');
    expect(payload).toHaveProperty('server');
    expect(payload).toHaveProperty('version');
  });

  test('POST /mcp initialize returns capabilities', async () => {
    const request = createMockRequest('POST', 'http://localhost:8787/mcp', {
      jsonrpc: '2.0',
      method: 'initialize',
      id: 1,
      params: {}
    });
    const response = await worker.fetch(request, mockEnv, {});
    const payload = await response.json();
    expect(payload).toHaveProperty('result');
    expect(payload.result).toHaveProperty('capabilities');
    expect(payload.result.capabilities).toHaveProperty('tools');
  });

  test('POST /mcp tools/list returns non-empty tools', async () => {
    const request = createMockRequest('POST', 'http://localhost:8787/mcp', {
      jsonrpc: '2.0',
      method: 'tools/list',
      id: 2,
      params: {}
    });
    const response = await worker.fetch(request, mockEnv, {});
    const payload = await response.json();
    expect(payload).toHaveProperty('result');
    expect(payload.result).toHaveProperty('tools');
    expect(Array.isArray(payload.result.tools)).toBe(true);
    expect(payload.result.tools.length).toBeGreaterThan(0);
  });
});
