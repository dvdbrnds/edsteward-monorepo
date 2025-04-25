/**
 * Compliance Processor Service
 * 
 * Processes compliance queries against the regulation registry.
 * This module handles:
 * - Query parsing and processing
 * - Regulation matching
 * - Response formatting
 */

import { setupLogger, formatError } from '../utils/logger.js';

// Initialize logger
const logger = setupLogger('compliance-processor');

/**
 * Process a compliance query against the registry
 * 
 * @param {string} query - The user query to process
 * @param {Object} registry - The regulation registry to query against
 * @param {Object} [options] - Additional processing options
 * @returns {Promise<Object>} The processed response
 */
export async function processComplianceQuery(query, registry, options = {}) {
  logger.info('Processing compliance query', { 
    queryLength: query.length,
    options
  });
  
  try {
    // Validate inputs
    if (!query || typeof query !== 'string') {
      throw new Error('Invalid query: Query must be a non-empty string');
    }
    
    if (!registry || typeof registry !== 'object') {
      throw new Error('Invalid registry: Registry must be a valid object');
    }
    
    // Extract relevant regulations based on query
    const matchedRegulations = findRelevantRegulations(query, registry);
    
    // Format response with relevant regulations and guidance
    const response = formatComplianceResponse(query, matchedRegulations);
    
    logger.info('Query processing completed', {
      matchCount: matchedRegulations.length,
      responseSize: JSON.stringify(response).length
    });
    
    return response;
  } catch (error) {
    logger.error('Error processing compliance query', formatError(error));
    throw error;
  }
}

/**
 * Find regulations relevant to the query
 * 
 * @param {string} query - The user query
 * @param {Object} registry - The regulation registry
 * @returns {Array} Array of relevant regulations
 */
function findRelevantRegulations(query, registry) {
  logger.debug('Finding relevant regulations for query');
  
  const matchedRegulations = [];
  
  // Extract regulations from registry
  const regulations = registry.regulations || {};
  
  // For now, using a simple keyword matching approach
  // In a production system, this would use more sophisticated NLP or embeddings
  const queryTerms = extractKeywords(query);
  
  // Iterate through all regulations to find matches
  for (const [id, regulation] of Object.entries(regulations)) {
    const regulationScore = calculateRelevanceScore(queryTerms, regulation);
    
    if (regulationScore > 0) {
      matchedRegulations.push({
        ...regulation,
        relevanceScore: regulationScore
      });
    }
  }
  
  // Sort by relevance
  matchedRegulations.sort((a, b) => b.relevanceScore - a.relevanceScore);
  
  logger.debug('Found relevant regulations', { 
    count: matchedRegulations.length 
  });
  
  return matchedRegulations;
}

/**
 * Format the compliance response
 * 
 * @param {string} query - The original query
 * @param {Array} regulations - Matched regulations
 * @returns {Object} Formatted response
 */
function formatComplianceResponse(query, regulations) {
  logger.debug('Formatting compliance response');
  
  // Extract top regulations (limit to top 10 if there are many)
  const topRegulations = regulations.slice(0, 10);
  
  // Structure the response
  const response = {
    query,
    timestamp: new Date().toISOString(),
    results: {
      regulationCount: regulations.length,
      regulations: topRegulations.map(regulation => ({
        id: regulation.id,
        title: regulation.title,
        summary: regulation.summary,
        relevance: regulation.relevanceScore,
        category: regulation.category,
        requirements: regulation.requirements || [],
        deadlines: regulation.deadlines || [],
        reference: {
          statute: regulation.statute,
          regulation: regulation.regulation,
          url: regulation.url
        }
      }))
    },
    guidance: generateGuidance(query, topRegulations)
  };
  
  return response;
}

/**
 * Generate compliance guidance based on matched regulations
 * 
 * @param {string} query - Original query
 * @param {Array} regulations - Matched regulations
 * @returns {Object} Guidance information
 */
function generateGuidance(query, regulations) {
  logger.debug('Generating compliance guidance');
  
  // If no regulations found, return generic guidance
  if (!regulations.length) {
    return {
      summary: "No specific regulations found matching your query.",
      nextSteps: [
        "Consider refining your query with more specific terms",
        "Consult with compliance department for further guidance",
        "Review general compliance documentation"
      ]
    };
  }
  
  // Extract key requirements from top regulations
  const requirements = regulations
    .flatMap(r => r.requirements || [])
    .filter(Boolean)
    .slice(0, 5);
  
  // Extract key deadlines from top regulations
  const deadlines = regulations
    .flatMap(r => r.deadlines || [])
    .filter(Boolean)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 3);
  
  // Create guidance summary
  const summary = regulations.length === 1
    ? `Your query relates primarily to ${regulations[0].title}.`
    : `Your query relates to ${regulations.length} regulations, most significantly ${regulations[0].title}.`;
  
  return {
    summary,
    keyRequirements: requirements,
    upcomingDeadlines: deadlines,
    nextSteps: [
      "Review the detailed regulations provided",
      "Consult with compliance officers about implementation",
      "Document compliance measures taken"
    ]
  };
}

/**
 * Extract keywords from query string
 * 
 * @param {string} query - Query string to extract keywords from
 * @returns {Array} Array of extracted keywords
 */
function extractKeywords(query) {
  // Remove punctuation and convert to lowercase
  const processedQuery = query.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Split into words
  const words = processedQuery.split(' ');
  
  // Filter out common stopwords
  const stopwords = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'is', 'are', 'was', 'were',
    'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
    'to', 'from', 'in', 'out', 'on', 'off', 'over', 'under', 'again',
    'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why',
    'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other',
    'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so',
    'than', 'too', 'very', 's', 't', 'can', 'will', 'just', 'should',
    'now', 'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves',
    'you', 'your', 'yours', 'yourself', 'yourselves', 'he', 'him', 'his',
    'himself', 'she', 'her', 'hers', 'herself', 'it', 'its', 'itself',
    'they', 'them', 'their', 'theirs', 'themselves', 'what', 'which', 'who',
    'whom', 'this', 'that', 'these', 'those', 'am', 'with', 'about', 'for'
  ]);
  
  return words.filter(word => !stopwords.has(word) && word.length > 1);
}

/**
 * Calculate relevance score of a regulation to query terms
 * 
 * @param {Array} queryTerms - Array of query keywords
 * @param {Object} regulation - Regulation to score
 * @returns {number} Relevance score (0-100)
 */
function calculateRelevanceScore(queryTerms, regulation) {
  if (!queryTerms.length) return 0;
  
  let score = 0;
  const textToSearch = [
    regulation.title || '',
    regulation.summary || '',
    regulation.statute || '',
    regulation.regulation || '',
    ...(regulation.keywords || []),
    ...(regulation.requirements || []).map(r => r.description || ''),
    regulation.category || ''
  ].join(' ').toLowerCase();
  
  // Count matching terms
  for (const term of queryTerms) {
    // Exact match worth more points
    if (textToSearch.includes(` ${term} `)) {
      score += 5;
    } 
    // Partial match worth fewer points
    else if (textToSearch.includes(term)) {
      score += 2;
    }
  }
  
  // Normalize score (0-100)
  const maxPossibleScore = queryTerms.length * 5;
  return Math.min(100, Math.round((score / maxPossibleScore) * 100));
}

/**
 * Parse query to extract structured information
 * 
 * @param {string} query - Query string to parse
 * @returns {Object} Structured query information
 */
export function parseQuery(query) {
  // This is a placeholder for more sophisticated parsing
  // In a production system, this would use NLP or a language model
  
  // Look for category mentions
  const categoryMatches = {
    academic: /academic|education|student|curriculum|learning|teaching|faculty/i,
    financial: /financial|money|payment|fund|budget|cost|expense|revenue/i,
    legal: /legal|law|statute|regulation|compliance|rule|policy/i,
    security: /security|safety|protection|risk|threat|vulnerability/i,
    ethics: /ethics|ethical|conduct|behavior|integrity|moral/i
  };
  
  const detectedCategories = [];
  
  for (const [category, pattern] of Object.entries(categoryMatches)) {
    if (pattern.test(query)) {
      detectedCategories.push(category);
    }
  }
  
  // Check for deadline-related queries
  const isDeadlineQuery = /deadline|due date|by when|schedule|calendar|time limit/i.test(query);
  
  // Check for requirement-related queries
  const isRequirementQuery = /require|necessary|must|should|mandatory|compliance|obligation/i.test(query);
  
  return {
    categories: detectedCategories,
    isDeadlineQuery,
    isRequirementQuery,
    keywords: extractKeywords(query)
  };
} 