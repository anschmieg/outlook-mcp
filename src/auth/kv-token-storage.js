/**
 * Cloudflare KV-based token storage for OAuth tokens
 */

class KVTokenStorage {
  constructor(kvNamespace) {
    this.kv = kvNamespace;
    this.defaultUserId = 'default_user'; // For now, using a single user
  }

  /**
   * Save tokens to KV store
   * @param {object} tokens - Token object containing access_token, refresh_token, etc.
   * @param {string} userId - User identifier (optional, uses default)
   */
  async saveTokens(tokens, userId = this.defaultUserId) {
    try {
      const tokenData = {
        ...tokens,
        expires_at: tokens.expires_in ? Date.now() + (tokens.expires_in * 1000) : tokens.expires_at,
        updated_at: Date.now()
      };

      await this.kv.put(`tokens:${userId}`, JSON.stringify(tokenData));
      console.log(`Tokens saved for user: ${userId}`);
      return true;
    } catch (error) {
      console.error('Error saving tokens to KV:', error);
      throw error;
    }
  }

  /**
   * Load tokens from KV store
   * @param {string} userId - User identifier (optional, uses default)
   * @returns {object|null} - Token object or null if not found/expired
   */
  async loadTokens(userId = this.defaultUserId) {
    try {
      const tokenData = await this.kv.get(`tokens:${userId}`, 'json');
      
      if (!tokenData) {
        console.log(`No tokens found for user: ${userId}`);
        return null;
      }

      // Check if token has expired
      const now = Date.now();
      if (tokenData.expires_at && now > tokenData.expires_at) {
        console.log(`Tokens expired for user: ${userId}`);
        return null;
      }

      console.log(`Tokens loaded for user: ${userId}`);
      return tokenData;
    } catch (error) {
      console.error('Error loading tokens from KV:', error);
      return null;
    }
  }

  /**
   * Get a valid access token, refreshing if necessary
   * @param {string} userId - User identifier (optional, uses default)
   * @returns {string|null} - Valid access token or null
   */
  async getValidAccessToken(userId = this.defaultUserId) {
    try {
      const tokens = await this.loadTokens(userId);
      
      if (!tokens) {
        return null;
      }

      // If token expires soon (within 5 minutes), try to refresh
      const fiveMinutesFromNow = Date.now() + (5 * 60 * 1000);
      if (tokens.expires_at && tokens.expires_at < fiveMinutesFromNow && tokens.refresh_token) {
        console.log('Token expires soon, attempting refresh...');
        
        try {
          // We'll need the environment for token refresh, but it's not available here
          // This will be handled by the compatibility layer
          return tokens.access_token;
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError);
          // Return current token if refresh fails, might still be valid
          return tokens.access_token;
        }
      }

      return tokens.access_token;
    } catch (error) {
      console.error('Error getting valid access token:', error);
      return null;
    }
  }

  /**
   * Refresh tokens using refresh token
   * @param {string} refreshToken - The refresh token
   * @param {string} userId - User identifier
   * @param {object} env - Environment variables
   * @returns {object} - New token object
   */
  async refreshTokens(refreshToken, userId = this.defaultUserId, env) {
    try {
      const { refreshAccessToken } = require('../oauth-handler');
      const newTokens = await refreshAccessToken(refreshToken, env);
      
      // Save the new tokens
      await this.saveTokens(newTokens, userId);
      
      return newTokens;
    } catch (error) {
      console.error('Error refreshing tokens:', error);
      throw error;
    }
  }

  /**
   * Delete tokens for a user
   * @param {string} userId - User identifier (optional, uses default)
   */
  async deleteTokens(userId = this.defaultUserId) {
    try {
      await this.kv.delete(`tokens:${userId}`);
      console.log(`Tokens deleted for user: ${userId}`);
    } catch (error) {
      console.error('Error deleting tokens from KV:', error);
      throw error;
    }
  }

  /**
   * Check if user has valid tokens
   * @param {string} userId - User identifier (optional, uses default)
   * @returns {boolean} - True if user has valid tokens
   */
  async hasValidTokens(userId = this.defaultUserId) {
    const accessToken = await this.getValidAccessToken(userId);
    return !!accessToken;
  }
}

module.exports = { KVTokenStorage };