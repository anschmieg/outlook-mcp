/**
 * Minimal auth bridge for compatibility.
 * Used by legacy tool modules that `require('../auth')`.
 * In HTTP mode, ensureAuthenticated pulls from a global context set by the worker.
 */

async function ensureAuthenticated() {
  const ctx = global.__httpContext;
  if (ctx && ctx.tokenStorage && typeof ctx.tokenStorage.getValidAccessToken === 'function') {
    const accessToken = await ctx.tokenStorage.getValidAccessToken();
    if (accessToken) return accessToken;
  }
  throw new Error('Authentication required');
}

module.exports = {
  ensureAuthenticated,
};

