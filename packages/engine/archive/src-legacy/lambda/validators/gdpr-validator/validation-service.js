/**
 * GDPR Validation Service
 * 
 * Provides validation services for GDPR compliance checking at different levels
 */

const AWS = require('aws-sdk');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const cheerio = require('cheerio');

// Initialize AWS services
const dynamoDB = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3();
const lambda = new AWS.Lambda();

// Table names from environment variables
const VALIDATIONS_TABLE = process.env.VALIDATIONS_TABLE || 'mcp-validation-engine-dev-validations';
const REGULATIONS_TABLE = process.env.REGULATIONS_TABLE || 'mcp-validation-engine-dev-regulations';
const BASELINES_BUCKET = process.env.BASELINES_BUCKET || 'mcp-validation-engine-dev-baselines';

/**
 * Compare two text strings and calculate their similarity
 * 
 * @param {string} text1 - First text to compare
 * @param {string} text2 - Second text to compare
 * @returns {number} Similarity score between 0 and 1
 */
function calculateTextSimilarity(text1, text2) {
  // Normalize texts for comparison
  const normalizedText1 = text1.toLowerCase().replace(/\\s+/g, ' ').trim();
  const normalizedText2 = text2.toLowerCase().replace(/\\s+/g, ' ').trim();
  
  // Simple longest common substring approach
  // In production, more sophisticated algorithms would be used
  if (normalizedText1 === normalizedText2) return 1.0;
  
  // Calculate Jaccard similarity on word sets
  const words1 = new Set(normalizedText1.split(/\\s+/));
  const words2 = new Set(normalizedText2.split(/\\s+/));
  
  // Find intersection
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  
  // Calculate Jaccard similarity: intersection size / union size
  return intersection.size / (words1.size + words2.size - intersection.size);
}

/**
 * Create a validation record in DynamoDB
 * 
 * @param {Object} data - Validation data
 * @returns {string} Validation ID
 */
async function createValidationRecord(data) {
  const validationId = uuidv4();
  const timestamp = new Date().toISOString();
  
  const item = {
    id: validationId,
    regulationId: data.regulationId,
    regulationVersion: data.regulationVersion || 'unknown',
    validationLevel: data.validationLevel,
    status: data.status || 'pending',
    createdAt: timestamp,
    updatedAt: timestamp
  };
  
  await dynamoDB.put({
    TableName: VALIDATIONS_TABLE,
    Item: item
  }).promise();
  
  return validationId;
}

/**
 * Update a validation record in DynamoDB
 * 
 * @param {string} validationId - ID of the validation record
 * @param {Object} data - Updated validation data
 * @returns {Object} Updated record
 */
async function updateValidationRecord(validationId, data) {
  const timestamp = new Date().toISOString();
  
  // Build update expression and attribute values
  let updateExpression = 'SET updatedAt = :timestamp';
  const expressionAttributeValues = {
    ':timestamp': timestamp
  };
  
  // Add all fields to update
  Object.entries(data).forEach(([key, value]) => {
    updateExpression += `, ${key} = :${key}`;
    expressionAttributeValues[`:${key}`] = value;
  });
  
  const params = {
    TableName: VALIDATIONS_TABLE,
    Key: { id: validationId },
    UpdateExpression: updateExpression,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: 'ALL_NEW'
  };
  
  const result = await dynamoDB.update(params).promise();
  return result.Attributes;
}

/**
 * Get validation status from DynamoDB
 * 
 * @param {string} validationId - ID of the validation to check
 * @returns {Object} Validation status
 */
async function getValidationStatus(validationId) {
  const params = {
    TableName: VALIDATIONS_TABLE,
    Key: { id: validationId }
  };
  
  const result = await dynamoDB.get(params).promise();
  
  if (!result.Item) {
    throw new Error(`Validation with ID ${validationId} not found`);
  }
  
  return result.Item;
}

/**
 * Get authoritative source for a regulation
 * 
 * @param {string} regulationId - Regulation identifier
 * @returns {Object} Authoritative source information
 */
async function getAuthoritativeSource(regulationId) {
  // First check if we have this regulation in our database
  const params = {
    TableName: REGULATIONS_TABLE,
    Key: { regulationId }
  };
  
  const result = await dynamoDB.get(params).promise();
  
  if (!result.Item) {
    // Fallback to default sources if not found
    return getDefaultAuthoritativeSource(regulationId);
  }
  
  return {
    webUrl: result.Item.authoritativeWebUrl,
    apiEndpoint: result.Item.authoritativeApiEndpoint,
    officialText: result.Item.officialText || await getBaselineFromS3(regulationId)
  };
}

/**
 * Get baseline regulation text from S3
 * 
 * @param {string} regulationId - Regulation identifier
 * @returns {string} Baseline regulation text
 */
async function getBaselineFromS3(regulationId) {
  try {
    const params = {
      Bucket: BASELINES_BUCKET,
      Key: `baselines/${regulationId}/latest.txt`
    };
    
    const result = await s3.getObject(params).promise();
    return result.Body.toString('utf-8');
  } catch (error) {
    console.warn(`Baseline for ${regulationId} not found in S3:`, error.message);
    return null;
  }
}

/**
 * Get default authoritative source for common regulations
 * 
 * @param {string} regulationId - Regulation identifier
 * @returns {Object} Default authoritative source
 */
function getDefaultAuthoritativeSource(regulationId) {
  // Handle known regulations with default sources
  const lowerRegId = String(regulationId || '').toLowerCase();
  
  if (lowerRegId.includes('gdpr')) {
    return {
      webUrl: 'https://gdpr-info.eu/',
      apiEndpoint: 'https://gdpr-api.eu/api/regulations',
      officialText: null // Will be retrieved from web scraping if needed
    };
  }
  
  throw new Error(`No authoritative source found for regulation: ${regulationId}`);
}

/**
 * Perform web scrape validation (Level A)
 * 
 * @param {string} regulationText - Text to validate
 * @param {string} sourceUrl - URL to scrape for validation
 * @returns {Object} Validation result
 */
async function performWebScrapeValidation(regulationText, sourceUrl) {
  console.log(`Performing web scrape validation using: ${sourceUrl}`);
  
  try {
    // Get the web page content
    const response = await axios.get(sourceUrl);
    const $ = cheerio.load(response.data);
    
    // Extract main content (this would need to be tuned for the specific site)
    let authoritativeText = '';
    
    // For GDPR-info.eu, main content is in articles
    if (sourceUrl.includes('gdpr-info.eu')) {
      $('.article-body').each((i, el) => {
        authoritativeText += $(el).text() + '\n\n';
      });
    } else {
      // Generic approach - get all paragraph text
      $('p').each((i, el) => {
        authoritativeText += $(el).text() + '\n';
      });
    }
    
    // Calculate similarity
    const similarity = calculateTextSimilarity(regulationText, authoritativeText);
    
    // Determine if regulation is valid based on similarity threshold
    const isValid = similarity >= 0.85;
    
    return {
      valid: isValid,
      message: isValid 
        ? 'Regulation text matches authoritative source'
        : 'Regulation text differs from authoritative source',
      similarity,
      authoritative: authoritativeText,
      needsHumanReview: similarity < 0.7 && similarity >= 0.5
    };
  } catch (error) {
    console.error('Error during web scrape validation:', error);
    
    return {
      valid: false,
      error: true,
      message: `Web scrape validation failed: ${error.message}`,
      needsHumanReview: true
    };
  }
}

/**
 * Perform API validation (Level B)
 * 
 * @param {string} regulationText - Text to validate
 * @param {string} apiEndpoint - API endpoint to use
 * @returns {Object} Validation result
 */
async function performApiValidation(regulationText, apiEndpoint) {
  console.log(`Performing API validation using: ${apiEndpoint}`);
  
  try {
    // Call the authoritative API
    const response = await axios.post(apiEndpoint, {
      text: regulationText,
      validateAgainst: 'latest'
    });
    
    const result = response.data;
    
    return {
      valid: result.valid === true,
      message: result.message || 'API validation completed',
      similarity: result.similarity || 0,
      authoritative: result.officialText || null,
      needsHumanReview: result.needsHumanReview === true
    };
  } catch (error) {
    console.error('Error during API validation:', error);
    
    // Fallback to web scraping if API fails
    console.log('API validation failed, falling back to web scrape validation');
    const sourceUrl = getDefaultAuthoritativeSource('gdpr').webUrl;
    return performWebScrapeValidation(regulationText, sourceUrl);
  }
}

/**
 * Perform AI-assisted validation (Level C)
 * 
 * @param {string} regulationText - Text to validate
 * @param {string} officialText - Official text to compare against
 * @returns {Object} Validation result
 */
async function performAiValidation(regulationText, officialText) {
  console.log('Performing AI-assisted validation');
  
  try {
    // If we don't have official text, try to get it
    if (!officialText) {
      // Try to get official text from web scraping
      const sourceUrl = getDefaultAuthoritativeSource('gdpr').webUrl;
      const webScrapeResult = await performWebScrapeValidation(regulationText, sourceUrl);
      officialText = webScrapeResult.authoritative;
      
      if (!officialText) {
        return {
          valid: false,
          message: 'Unable to obtain official text for AI validation',
          needsHumanReview: true
        };
      }
    }
    
    // In a real implementation, we would call an AI service here
    // For now, we'll simulate AI validation with a more sophisticated text comparison
    
    // Calculate basic similarity
    const similarity = calculateTextSimilarity(regulationText, officialText);
    
    // Check for semantic patterns that indicate valid/invalid content
    const hasValidGdprStructure = regulationText.includes('data processing') && 
                                 regulationText.includes('personal data') &&
                                 regulationText.includes('controller');
    
    // Synthesize AI validation result
    const isValid = similarity >= 0.75 && hasValidGdprStructure;
    
    return {
      valid: isValid,
      message: isValid 
        ? 'AI validation confirms regulation compliance'
        : 'AI validation detected potential issues with regulation text',
      similarity,
      authoritative: officialText,
      needsHumanReview: !isValid || similarity < 0.8
    };
  } catch (error) {
    console.error('Error during AI validation:', error);
    
    return {
      valid: false,
      error: true,
      message: `AI validation failed: ${error.message}`,
      needsHumanReview: true
    };
  }
}

module.exports = {
  calculateTextSimilarity,
  createValidationRecord,
  updateValidationRecord,
  getValidationStatus,
  getAuthoritativeSource,
  performWebScrapeValidation,
  performApiValidation,
  performAiValidation
};