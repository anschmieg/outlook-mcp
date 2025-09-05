/**
 * Improved search emails functionality
 */
const config = require('../config');
const { callGraphAPI } = require('../src/utils/http-graph-api');
const logger = require('../src/utils/log');
const { ensureAuthenticated } = require('../auth');
const { resolveFolderPath } = require('./folder-utils');

/**
 * Search emails handler
 * @param {object} args - Tool arguments
 * @returns {object} - MCP response
 */
async function handleSearchEmails(args) {
  const folder = args.folder || "inbox";
  const count = Math.min(args.count || 10, config.MAX_RESULT_COUNT);
  const query = args.query || '';
  const from = args.from || '';
  const to = args.to || '';
  const subject = args.subject || '';
  const hasAttachments = args.hasAttachments;
  const unreadOnly = args.unreadOnly;
  
  try {
    // Get access token
    const accessToken = await ensureAuthenticated();
    
    // Resolve the folder path
    const endpoint = await resolveFolderPath(accessToken, folder);
    
    // Execute progressive search
    const response = await progressiveSearch(
      endpoint, 
      accessToken, 
      { query, from, to, subject },
      { hasAttachments, unreadOnly },
      count
    );
    
    return formatSearchResults(response);
  } catch (error) {
    // Handle authentication errors
    if (error.message === 'Authentication required') {
      return {
        content: [{ 
          type: "text", 
          text: "Authentication required. Please use the 'authenticate' tool first."
        }]
      };
    }
    
    // General error response
    return {
      content: [{ 
        type: "text", 
        text: `Error searching emails: ${error.message}`
      }]
    };
  }
}

/**
 * Execute a search with progressively simpler fallback strategies
 * @param {string} endpoint - API endpoint
 * @param {string} accessToken - Access token
 * @param {object} searchTerms - Search terms (query, from, to, subject)
 * @param {object} filterTerms - Filter terms (hasAttachments, unreadOnly)
 * @param {number} count - Maximum number of results
 * @returns {Promise<object>} - Search results
 */
async function progressiveSearch(endpoint, accessToken, searchTerms, filterTerms, count) {
  // Track search strategies attempted
  const searchAttempts = [];
  
  // 1. Try combined search (most specific)
  try {
    const params = buildSearchParams(searchTerms, filterTerms, count);
    searchAttempts.push("combined-search");
    
    const response = await callGraphAPI(accessToken, 'GET', endpoint, null, params);
    if (response.value && response.value.length > 0) {
      return response;
    }
  } catch (error) {
    logger.debug(`Combined search failed: ${error.message}`);
  }
  
  // 2. Try each search term individually, starting with most specific
  const searchPriority = ['subject', 'from', 'to', 'query'];
  
  for (const term of searchPriority) {
    if (searchTerms[term]) {
      try {
        searchAttempts.push(`single-term-${term}`);
        
        // For single term search, only use $search with that term
        const simplifiedParams = {
          $top: count,
          $select: config.EMAIL_SELECT_FIELDS,
          $orderby: 'receivedDateTime desc'
        };
        
        // Add the search term in the appropriate KQL syntax
        if (term === 'query') {
          // General query doesn't need a prefix
          simplifiedParams.$search = `"${searchTerms[term]}"`;
        } else {
          // Specific field searches use field:value syntax
          simplifiedParams.$search = `${term}:"${searchTerms[term]}"`;
        }
        
        // Add boolean filters if applicable
        addBooleanFilters(simplifiedParams, filterTerms);
        
        const response = await callGraphAPI(accessToken, 'GET', endpoint, null, simplifiedParams);
        if (response.value && response.value.length > 0) {
          return response;
        }
      } catch (error) {
        logger.debug(`Search with ${term} failed: ${error.message}`);
      }
    }
  }
  
  // 3. Try with only boolean filters
  if (filterTerms.hasAttachments === true || filterTerms.unreadOnly === true) {
    try {
      searchAttempts.push("boolean-filters-only");
      
      const filterOnlyParams = {
        $top: count,
        $select: config.EMAIL_SELECT_FIELDS,
        $orderby: 'receivedDateTime desc'
      };
      
      // Add the boolean filters
      addBooleanFilters(filterOnlyParams, filterTerms);
      
      const response = await callGraphAPI(accessToken, 'GET', endpoint, null, filterOnlyParams);
      return response;
    } catch (error) {
      logger.debug(`Boolean filter search failed: ${error.message}`);
    }
  }
  
  // 4. Final fallback: just get recent emails
  logger.warn("All search strategies failed, falling back to recent emails");
  searchAttempts.push("recent-emails");
  
  const basicParams = {
    $top: count,
    $select: config.EMAIL_SELECT_FIELDS,
    $orderby: 'receivedDateTime desc'
  };
  
  const response = await callGraphAPI(accessToken, 'GET', endpoint, null, basicParams);
  
  // Add a note to the response about the search attempts
  response._searchInfo = {
    attemptsCount: searchAttempts.length,
    strategies: searchAttempts,
    originalTerms: searchTerms,
    filterTerms: filterTerms
  };
  
  return response;
}

/**
 * Build search parameters from search terms and filter terms
 * @param {object} searchTerms - Search terms (query, from, to, subject)
 * @param {object} filterTerms - Filter terms (hasAttachments, unreadOnly)
 * @param {number} count - Maximum number of results
 * @returns {object} - Query parameters
 */
function buildSearchParams(searchTerms, filterTerms, count) {
  const params = {
    $top: count,
    $select: config.EMAIL_SELECT_FIELDS,
    $orderby: 'receivedDateTime desc'
  };
  
  // Handle search terms
  const kqlTerms = [];
  
  if (searchTerms.query) {
    // General query doesn't need a prefix
    kqlTerms.push(searchTerms.query);
  }
  
  if (searchTerms.subject) {
    kqlTerms.push(`subject:"${searchTerms.subject}"`);
  }
  
  if (searchTerms.from) {
    kqlTerms.push(`from:"${searchTerms.from}"`);
  }
  
  if (searchTerms.to) {
    kqlTerms.push(`to:"${searchTerms.to}"`);
  }
  
  // Add $search if we have any search terms
  if (kqlTerms.length > 0) {
    params.$search = kqlTerms.join(' ');
  }
  
  // Add boolean filters
  addBooleanFilters(params, filterTerms);
  
  return params;
}

/**
 * Add boolean filters to query parameters
 * @param {object} params - Query parameters
 * @param {object} filterTerms - Filter terms (hasAttachments, unreadOnly)
 */
function addBooleanFilters(params, filterTerms) {
  const filterConditions = [];
  
  if (filterTerms.hasAttachments === true) {
    filterConditions.push('hasAttachments eq true');
  }
  
  if (filterTerms.unreadOnly === true) {
    filterConditions.push('isRead eq false');
  }
  
  // Add $filter parameter if we have any filter conditions
  if (filterConditions.length > 0) {
    params.$filter = filterConditions.join(' and ');
  }
}

/**
 * Format search results into a readable text format
 * @param {object} response - The API response object
 * @returns {object} - MCP response object
 */
function formatSearchResults(response) {
  if (!response.value || response.value.length === 0) {
    return {
      content: [{ 
        type: "text", 
        text: `No emails found matching your search criteria.`
      }]
    };
  }
  
  // Format results
  const emailList = response.value.map((email, index) => {
    const sender = email.from?.emailAddress || { name: 'Unknown', address: 'unknown' };
    const date = new Date(email.receivedDateTime).toLocaleString();
    const readStatus = email.isRead ? '' : '[UNREAD] ';
    
    return `${index + 1}. ${readStatus}${date} - From: ${sender.name} (${sender.address})\nSubject: ${email.subject}\nID: ${email.id}\n`;
  }).join("\n");
  
  // Add search strategy info if available
  let additionalInfo = '';
  if (response._searchInfo) {
    additionalInfo = `\n(Search used ${response._searchInfo.strategies[response._searchInfo.strategies.length - 1]} strategy)`;
  }
  
  return {
    content: [{ 
      type: "text", 
      text: `Found ${response.value.length} emails matching your search criteria:${additionalInfo}\n\n${emailList}`
    }]
  };
}

module.exports = handleSearchEmails;
