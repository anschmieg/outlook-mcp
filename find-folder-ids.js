#!/usr/bin/env node
/**
 * Script to find folder IDs for GitHub and Notifications folders
 * This helps create rules that target specific folders
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

// Main function
async function findFolderIds() {
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
    
    // Step 1: Get the list of folders
    logger.info('\nFetching top-level folders...');
    const folders = await callGraphAPI('me/mailFolders?$top=100');
    
    // Print all folders and their IDs for reference
    logger.info('\nAll top-level folders:');
    folders.value.forEach(folder => {
      logger.info(`${folder.displayName}: ${folder.id}`);
    });
    
    // Step 2: Find the GitHub folder specifically
    const githubFolder = folders.value.find(f => 
      f.displayName === 'GitHub' || f.displayName.toLowerCase() === 'github'
    );
    
    if (!githubFolder) {
      logger.error('\nGitHub folder not found!');
      process.exit(1);
    }
    
    logger.info(`\nFound GitHub folder: ${githubFolder.displayName}`);
    logger.info(`ID: ${githubFolder.id}`);
    
    // Step 3: Get child folders of GitHub
    logger.info('\nFetching GitHub child folders...');
    const childFolders = await callGraphAPI(`me/mailFolders/${githubFolder.id}/childFolders`);
    
    // Print all child folders
    logger.info('\nChild folders of GitHub:');
    if (childFolders.value && childFolders.value.length > 0) {
      childFolders.value.forEach(folder => {
        logger.info(`${folder.displayName}: ${folder.id}`);
      });
      
      // Step 4: Find the Notifications subfolder
      const notificationsFolder = childFolders.value.find(f => 
        f.displayName === 'Notifications' || f.displayName.toLowerCase() === 'notifications'
      );
      
      if (notificationsFolder) {
        logger.info(`\nFound Notifications subfolder: ${notificationsFolder.displayName}`);
        logger.info(`ID: ${notificationsFolder.id}`);
        
        // Final output for easy reference
        logger.info('\n===== FOLDER IDs FOR RULES =====');
        logger.info(`GitHub folder: ${githubFolder.id}`);
        logger.info(`Notifications subfolder: ${notificationsFolder.id}`);
        logger.info('===============================');
      } else {
        logger.warn('\nNotifications subfolder not found in GitHub folder');
      }
    } else {
      logger.warn('No child folders found in GitHub folder');
    }
  } catch (error) {
    logger.error('Error:', error);
  }
}

/**
 * Helper function to call Microsoft Graph API
 */
async function callGraphAPI(endpoint) {
  return new Promise((resolve, reject) => {
    // Read token from file again to ensure it's fresh
    const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
    const accessToken = tokenData.access_token;
    
    const options = {
      hostname: 'graph.microsoft.com',
      path: `/v1.0/${endpoint}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const jsonResponse = JSON.parse(data);
            resolve(jsonResponse);
          } catch (error) {
            reject(new Error(`Failed to parse API response: ${error.message}`));
          }
        } else {
          reject(new Error(`API request failed with status ${res.statusCode}: ${data}`));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(new Error(`Network error: ${error.message}`));
    });
    
    req.end();
  });
}

// Run the script
findFolderIds();
