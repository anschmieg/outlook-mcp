/**
 * HTTP-compatible Microsoft Graph API helper functions for Cloudflare Workers
 */

const GRAPH_API_ENDPOINT = 'https://graph.microsoft.com/v1.0/';
const logger = require('./log');

/**
 * Makes a request to the Microsoft Graph API using fetch
 * @param {string} accessToken - The access token for authentication
 * @param {string} method - HTTP method (GET, POST, etc.)
 * @param {string} path - API endpoint path
 * @param {object} data - Data to send for POST/PUT requests
 * @param {object} queryParams - Query parameters
 * @returns {Promise<object>} - The API response
 */
async function callGraphAPI(accessToken, method, path, data = null, queryParams = {}) {
  try {
    // Reduced logging: suppress info-level Graph call logs
    
    // Build query string from parameters with special handling for OData filters
    let queryString = '';
    if (Object.keys(queryParams).length > 0) {
      // Handle $filter parameter specially to ensure proper URI encoding
      const filter = queryParams.$filter;
      if (filter) {
        delete queryParams.$filter; // Remove from regular params
      }
      
      // Build query string with proper encoding for regular params
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(queryParams)) {
        params.append(key, value);
      }
      
      queryString = params.toString();
      
      // Add filter parameter separately with proper encoding
      if (filter) {
        if (queryString) {
          queryString += `&$filter=${encodeURIComponent(filter)}`;
        } else {
          queryString = `$filter=${encodeURIComponent(filter)}`;
        }
      }
      
      if (queryString) {
        queryString = '?' + queryString;
      }
      
      // Optional debug for query string
      logger.debug(`Graph query: ${queryString || '(none)'}`);
    }
    
    const url = `${GRAPH_API_ENDPOINT}${path}${queryString}`;
    logger.debug(`Graph request: ${method} ${url}`);
    
    const requestOptions = {
      method: method,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    };
    
    if (data && (method === 'POST' || method === 'PATCH' || method === 'PUT')) {
      requestOptions.body = JSON.stringify(data);
    }
    
    const response = await fetch(url, requestOptions);
    
    if (response.ok) {
      const responseText = await response.text();
      return responseText ? JSON.parse(responseText) : {};
    } else if (response.status === 401) {
      // Token expired or invalid
      throw new Error('UNAUTHORIZED');
    } else {
      const errorText = await response.text();
      throw new Error(`API call failed with status ${response.status}: ${errorText}`);
    }
  } catch (error) {
    console.error('Error calling Graph API:', error);
    throw error;
  }
}

/**
 * Enhanced API call that handles token refresh automatically
 * @param {object} context - Context containing tokenStorage, env, etc.
 * @param {string} method - HTTP method
 * @param {string} path - API endpoint path
 * @param {object} data - Data to send
 * @param {object} queryParams - Query parameters
 * @returns {Promise<object>} - The API response
 */
async function callGraphAPIWithContext(context, method, path, data = null, queryParams = {}) {
  const { tokenStorage } = context;
  
  try {
    // Get a valid access token (this handles refresh automatically)
    const accessToken = await tokenStorage.getValidAccessToken();
    
    if (!accessToken) {
      throw new Error('No valid access token available. Please authenticate first.');
    }
    
    return await callGraphAPI(accessToken, method, path, data, queryParams);
  } catch (error) {
    if (error.message === 'UNAUTHORIZED') {
      // Token might be invalid, try to get a fresh one
      try {
        const tokens = await tokenStorage.loadTokens();
        if (tokens && tokens.refresh_token) {
          // Implement token refresh here
          const { refreshAccessToken } = require('../auth/oauth-handler');
          const newTokens = await refreshAccessToken(tokens.refresh_token, context.env);
          await tokenStorage.saveTokens(newTokens);
          
          // Retry the API call with new token
          return await callGraphAPI(newTokens.access_token, method, path, data, queryParams);
        }
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
      }
      
      throw new Error('Authentication failed. Please re-authenticate using the authenticate tool.');
    }
    
    throw error;
  }
}

module.exports = {
  callGraphAPI,
  callGraphAPIWithContext
};
