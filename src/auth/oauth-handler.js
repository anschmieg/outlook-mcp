/**
 * OAuth handler for Cloudflare Workers environment
 */

const { KVTokenStorage } = require('./kv-token-storage');

/**
 * Generate OAuth authorization URL
 * @param {object} env - Environment variables
 * @returns {string} - Authorization URL
 */
function generateAuthUrl(env) {
  const params = new URLSearchParams({
    client_id: env.CLIENT_ID,
    response_type: 'code',
    redirect_uri: `${getBaseUrl(env)}/auth/callback`,
    scope: 'offline_access User.Read Mail.Read Mail.ReadWrite Mail.Send Calendars.Read Calendars.ReadWrite',
    response_mode: 'query',
    state: generateState()
  });

  const tenantId = env.TENANT_ID || 'common';
  return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${params.toString()}`;
}

/**
 * Handle OAuth callback
 * @param {Request} request - The callback request
 * @param {object} env - Environment variables
 * @returns {Response} - Response to the callback
 */
async function handleOAuthCallback(request, env) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  const state = url.searchParams.get('state');

  if (error) {
    return new Response(createErrorHtml(error), {
      headers: { 'Content-Type': 'text/html' }
    });
  }

  if (!code) {
    return new Response(createErrorHtml('No authorization code received'), {
      headers: { 'Content-Type': 'text/html' }
    });
  }

  try {
    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code, env);
    
    // Save tokens to KV store
    const tokenStorage = new KVTokenStorage(env.OUTLOOK_TOKENS);
    await tokenStorage.saveTokens(tokens);

    return new Response(createSuccessHtml(), {
      headers: { 'Content-Type': 'text/html' }
    });
  } catch (error) {
    console.error('OAuth callback error:', error);
    return new Response(createErrorHtml(error.message), {
      status: 500,
      headers: { 'Content-Type': 'text/html' }
    });
  }
}

/**
 * Exchange authorization code for tokens
 * @param {string} code - Authorization code
 * @param {object} env - Environment variables
 * @returns {object} - Token response
 */
async function exchangeCodeForTokens(code, env) {
  const params = new URLSearchParams({
    client_id: env.CLIENT_ID,
    client_secret: env.CLIENT_SECRET,
    code: code,
    grant_type: 'authorization_code',
    redirect_uri: `${getBaseUrl(env)}/auth/callback`
  });

  const tenantId = env.TENANT_ID || 'common';
  const response = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params.toString()
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Token exchange failed: ${response.status} ${errorData}`);
  }

  return await response.json();
}

/**
 * Refresh access token using refresh token
 * @param {string} refreshToken - The refresh token
 * @param {object} env - Environment variables
 * @returns {object} - New token response
 */
async function refreshAccessToken(refreshToken, env) {
  const params = new URLSearchParams({
    client_id: env.CLIENT_ID,
    client_secret: env.CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: 'refresh_token'
  });

  const tenantId = env.TENANT_ID || 'common';
  const response = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params.toString()
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Token refresh failed: ${response.status} ${errorData}`);
  }

  return await response.json();
}

/**
 * Get base URL for the worker
 * @param {object} env - Environment variables
 * @returns {string} - Base URL
 */
function getBaseUrl(env) {
  // In production, this would be the worker's URL
  // For development, might need to be configurable
  return env.BASE_URL || 'https://outlook-mcp.your-domain.workers.dev';
}

/**
 * Generate a random state parameter
 * @returns {string} - Random state string
 */
function generateState() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

/**
 * Create success HTML page
 * @returns {string} - HTML content
 */
function createSuccessHtml() {
  return `
<!DOCTYPE html>
<html>
<head>
    <title>Authentication Successful</title>
    <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
        .success { color: green; }
        .container { max-width: 600px; margin: 0 auto; }
    </style>
</head>
<body>
    <div class="container">
        <h1 class="success">✅ Authentication Successful!</h1>
        <p>You have successfully authenticated with Microsoft Outlook.</p>
        <p>You can now close this window and use the MCP server.</p>
    </div>
</body>
</html>
  `;
}

/**
 * Create error HTML page
 * @param {string} error - Error message
 * @returns {string} - HTML content
 */
function createErrorHtml(error) {
  return `
<!DOCTYPE html>
<html>
<head>
    <title>Authentication Error</title>
    <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
        .error { color: red; }
        .container { max-width: 600px; margin: 0 auto; }
    </style>
</head>
<body>
    <div class="container">
        <h1 class="error">❌ Authentication Error</h1>
        <p>There was an error during authentication:</p>
        <p><strong>${error}</strong></p>
        <p>Please try again or contact support if the problem persists.</p>
    </div>
</body>
</html>
  `;
}

module.exports = {
  generateAuthUrl,
  handleOAuthCallback,
  exchangeCodeForTokens,
  refreshAccessToken
};