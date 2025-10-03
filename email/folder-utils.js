/**
 * Email folder utilities
 */
const { callGraphAPI } = require('../src/utils/http-graph-api');

/**
 * Cache of folder information to reduce API calls
 * Format: { userId: { folderName: { id, path } } }
 */
const folderCache = {};

/**
 * Resolve a folder name to its endpoint path
 * @param {string} accessToken - Access token
 * @param {string} folderName - Folder name to resolve
 * @returns {Promise<string>} - Resolved endpoint path
 */
async function resolveFolderPath(accessToken, folderName) {
  // Default to inbox if no folder specified
  if (!folderName) {
    return 'me/messages';
  }
  
  // Handle well-known folder names
  const wellKnownFolders = {
    'inbox': 'me/messages',
    'drafts': 'me/mailFolders/drafts/messages',
    'sent': 'me/mailFolders/sentItems/messages',
    'deleted': 'me/mailFolders/deletedItems/messages',
    'junk': 'me/mailFolders/junkemail/messages',
    'archive': 'me/mailFolders/archive/messages'
  };
  
  // Check if it's a well-known folder (case-insensitive)
  const lowerFolderName = folderName.toLowerCase();
  if (wellKnownFolders[lowerFolderName]) {
    return wellKnownFolders[lowerFolderName];
  }
  
  try {
    // Try to find the folder by name
    const folderId = await getFolderIdByName(accessToken, folderName);
    if (folderId) {
      const path = `me/mailFolders/${folderId}/messages`;
      return path;
    }
    
    // If not found, fall back to inbox
    console.warn(`Couldn't find folder "${folderName}", falling back to inbox`);
    return 'me/messages';
  } catch (error) {
    console.error(`Error resolving folder "${folderName}": ${error.message}`);
    return 'me/messages';
  }
}

/**
 * Get the ID of a mail folder by its name
 * @param {string} accessToken - Access token
 * @param {string} folderName - Name of the folder to find
 * @returns {Promise<string|null>} - Folder ID or null if not found
 */
async function getFolderIdByName(accessToken, folderName) {
  try {
    // First try with exact match filter
    const response = await callGraphAPI(
      accessToken,
      'GET',
      'me/mailFolders',
      null,
      { $filter: `displayName eq '${folderName}'` }
    );
    
    if (response.value && response.value.length > 0) {
      return response.value[0].id;
    }
    
    // If exact match fails, try to get all folders and do a case-insensitive comparison
    const allFoldersResponse = await callGraphAPI(
      accessToken,
      'GET',
      'me/mailFolders',
      null,
      { $top: 100 }
    );
    
    if (allFoldersResponse.value) {
      const lowerFolderName = folderName.toLowerCase();
      const matchingFolder = allFoldersResponse.value.find(
        folder => folder.displayName.toLowerCase() === lowerFolderName
      );
      
      if (matchingFolder) {
        return matchingFolder.id;
      }
    }
    
    console.warn(`No folder found matching "${folderName}"`);
    return null;
  } catch (error) {
    console.error(`Error finding folder "${folderName}": ${error.message}`);
    return null;
  }
}

/**
 * Get all mail folders
 * @param {string} accessToken - Access token
 * @returns {Promise<Array>} - Array of folder objects
 */
async function getAllFolders(accessToken) {
  try {
    // Get top-level folders
    const response = await callGraphAPI(
      accessToken,
      'GET',
      'me/mailFolders',
      null,
      { 
        $top: 100,
        $select: 'id,displayName,parentFolderId,childFolderCount,totalItemCount,unreadItemCount'
      }
    );
    
    if (!response.value) {
      return [];
    }
    
    // Get child folders for folders with children
    const foldersWithChildren = response.value.filter(f => f.childFolderCount > 0);
    
    const childFolderPromises = foldersWithChildren.map(async (folder) => {
      try {
        const childResponse = await callGraphAPI(
          accessToken,
          'GET',
          `me/mailFolders/${folder.id}/childFolders`,
          null,
          { 
            $select: 'id,displayName,parentFolderId,childFolderCount,totalItemCount,unreadItemCount'
          }
        );
        
        return childResponse.value || [];
      } catch (error) {
        console.error(`Error getting child folders for "${folder.displayName}": ${error.message}`);
        return [];
      }
    });
    
    const childFolders = await Promise.all(childFolderPromises);
    
    // Combine top-level folders and all child folders
    return [...response.value, ...childFolders.flat()];
  } catch (error) {
    console.error(`Error getting all folders: ${error.message}`);
    return [];
  }
}

module.exports = {
  resolveFolderPath,
  getFolderIdByName,
  getAllFolders
};
