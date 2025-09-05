module.exports = {
  testEnvironment: 'node',
  watchman: false,
  testPathIgnorePatterns: [
    '/node_modules/',
    'test/sse-server.test.js',
    'test/auth/oauth-server.test.js',
    'test/auth/token-storage.test.js'
  ],
};
