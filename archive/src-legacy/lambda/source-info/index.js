/**
 * Source Information API Endpoint Lambda Handler
 * Provides information about the regulatory sources and their update history
 */

// Mock DB module for now
const db = {
  getRegulationSourceInfo: async (regulationId) => {
    if (regulationId === 'FERPA') {
      return {
        id: 1,
        source_code: 'ED_GOV',
        name: 'Department of Education',
        authority: 'U.S. Department of Education',
        base_url: 'https://www2.ed.gov',
        description: 'The U.S. Department of Education is responsible for education policies and regulations.',
        last_updated: new Date().toISOString(),
        last_check: new Date().toISOString(),
        source_url: 'https://www2.ed.gov/policy/gen/guid/fpco/ferpa/index.html'
      };
    }
    
    throw new Error(`Regulation not found: ${regulationId}`);
  },
  
  getSourceUpdateHistory: async (regulationId, limit = 10) => {
    if (regulationId === 'FERPA') {
      // Mock data for demonstration
      return [
        {
          update_timestamp: new Date().toISOString(),
          fetch_status: 'SUCCESS',
          changes_detected: false,
          processed_regulations: 1,
          source_metadata: {
            source: 'https://www2.ed.gov/policy/gen/guid/fpco/ferpa/index.html',
            collectionTimestamp: new Date().toISOString(),
            regulationType: 'FERPA'
          }
        }
      ];
    }
    
    return [];
  },
  
  getRegulationVersions: async (regulationId, limit = 10) => {
    if (regulationId === 'FERPA') {
      // Mock data for demonstration
      return [
        {
          version: '2022.1',
          effective_date: '2022-01-01T00:00:00Z',
          publish_date: '2021-11-15T00:00:00Z',
          document_number: 'FERPA-2022-1',
          source_url: 'https://www2.ed.gov/policy/gen/guid/fpco/ferpa/index.html',
          last_source_update: new Date().toISOString()
        }
      ];
    }
    
    return [];
  }
};

/**
 * Handler for the source information API
 */
exports.handler = async (event) => {
  console.log('Received source information request:', JSON.stringify(event));
  
  try {
    const { pathParameters, queryStringParameters } = event;
    const regulationId = pathParameters ? pathParameters.id : null;
    
    if (!regulationId) {
      return formatResponse(400, {
        error: 'Missing regulation ID'
      });
    }
    
    // Get basic source information
    const sourceInfo = await db.getRegulationSourceInfo(regulationId);
    
    // Default response with just source info
    const response = {
      regulationId,
      sourceInfo
    };
    
    // Check if detailed history is requested
    const includeHistory = queryStringParameters && 
                          queryStringParameters.includeHistory === 'true';
    
    if (includeHistory) {
      const historyLimit = queryStringParameters && 
                          queryStringParameters.limit ? 
                          parseInt(queryStringParameters.limit, 10) : 10;
      
      response.updateHistory = await db.getSourceUpdateHistory(regulationId, historyLimit);
    }
    
    // Check if versions are requested
    const includeVersions = queryStringParameters && 
                           queryStringParameters.includeVersions === 'true';
    
    if (includeVersions) {
      const versionsLimit = queryStringParameters && 
                           queryStringParameters.limit ? 
                           parseInt(queryStringParameters.limit, 10) : 10;
      
      response.versions = await db.getRegulationVersions(regulationId, versionsLimit);
    }
    
    return formatResponse(200, response);
  } catch (error) {
    console.error('Error retrieving source information:', error);
    
    if (error.message.includes('not found')) {
      return formatResponse(404, {
        error: error.message
      });
    }
    
    return formatResponse(500, {
      error: 'Error retrieving source information'
    });
  }
};

/**
 * Format the API response
 * @param {number} statusCode - The HTTP status code
 * @param {Object} body - The response body
 * @returns {Object} Formatted response
 */
function formatResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*', // CORS support
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'GET,OPTIONS'
    },
    body: JSON.stringify(body)
  };
} 