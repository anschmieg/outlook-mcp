#!/usr/bin/env node
/**
 * Script to create a custom rule for GitHub notifications
 * using direct folder IDs
 */
// Node-only utility script
const https = require('https');
const fs = require('fs');
const path = require('path');
const logger = require('./src/utils/log');

// Configure logger for CLI: default to info unless overridden
logger.setLevelFromEnv(process.env);
if (global.__LOG_LEVEL === undefined) logger.setLevel('info');

// Configuration
const homePath = process.env.HOME || '/Users/ryaker';
const tokenPath = path.join(homePath, '.outlook-mcp-tokens.json');
const notificationsFolderId = 'AAMkAGQ0NzYwMTdmLTYzMWUtNDE1ZS04ZDYyLTZjZmQ5YjkyNWM0OQAuAAAAAAAMiw_uRKMyQ4cvWGcmDNGZAQD-pkus0juzTK_ueB_BlgMCAAGKmpqpAAA=';

// Main function
async function createGitHubRule() {
  try {
    // Read the authentication token from file
    logger.info(`Reading token from ${tokenPath}`);
    const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
    const accessToken = tokenData.access_token;
    
    if (!accessToken) {
      logger.error('No access token found in token file!');
      process.exit(1);
    }
    
    logger.info('Successfully read access token');
    
    // Define the rule for GitHub notifications
    const rule = {
      displayName: "GitHub Workflow Notifications to Subfolder",
      sequence: 1,
      isEnabled: true,
      conditions: {
        fromAddresses: [
          {
            emailAddress: {
              address: "notifications@github.com"
            }
          },
          {
            emailAddress: {
              address: "noreply@github.com"
            }
          }
        ],
        // This will catch GitHub workflow notifications
        subjectContains: ["workflow", "Run failed", "Run completed", "GitHub Actions"]
      },
      actions: {
        moveToFolder: notificationsFolderId,
        stopProcessingRules: true
      }
    };
    
    // Create the rule
    logger.info('Creating GitHub notifications rule...');
    const response = await callGraphAPI('me/mailFolders/inbox/messageRules', 'POST', rule);
    
    logger.info('\nRule created successfully:');
    logger.info(`Name: ${response.displayName}`);
    logger.info(`ID: ${response.id}`);
    logger.info(`Sequence: ${response.sequence}`);
    logger.info(`Enabled: ${response.isEnabled}`);
    
    // Create a second rule for repository notifications
    const repoRule = {
      displayName: "GitHub Repository Notifications to Subfolder",
      sequence: 2,
      isEnabled: true,
      conditions: {
        fromAddresses: [
          {
            emailAddress: {
              address: "notifications@github.com"
            }
          }
        ],
        // This catches repository notifications with format [repo-name]
        subjectContains: ["[Gondola"]
      },
      actions: {
        moveToFolder: notificationsFolderId,
        stopProcessingRules: true
      }
    };
    
    logger.info('\nCreating GitHub repository notifications rule...');
    const repoResponse = await callGraphAPI('me/mailFolders/inbox/messageRules', 'POST', repoRule);
    
    logger.info('\nRepository rule created successfully:');
    logger.info(`Name: ${repoResponse.displayName}`);
    logger.info(`ID: ${repoResponse.id}`);
    logger.info(`Sequence: ${repoResponse.sequence}`);
    logger.info(`Enabled: ${repoResponse.isEnabled}`);
    
    logger.info('\nRules created successfully! Your GitHub notifications will now be moved to the Notifications subfolder.');
  } catch (error) {
    logger.error('Error:', error);
  }
}

/**
 * Helper function to call Microsoft Graph API
 */
async function callGraphAPI(endpoint, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    // Read token from file again to ensure it's fresh
    const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
    const accessToken = tokenData.access_token;
    
    const options = {
      hostname: 'graph.microsoft.com',
      path: `/v1.0/${endpoint}`,
      method: method,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    };
    
    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const jsonResponse = JSON.parse(responseData);
            resolve(jsonResponse);
          } catch (error) {
            reject(new Error(`Failed to parse API response: ${error.message}`));
          }
        } else {
          reject(new Error(`API request failed with status ${res.statusCode}: ${responseData}`));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(new Error(`Network error: ${error.message}`));
    });
    
    if (data && (method === 'POST' || method === 'PATCH' || method === 'PUT')) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

// Run the script
createGitHubRule();
