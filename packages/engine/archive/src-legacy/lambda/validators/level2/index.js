const {
  ValidationStatus,
  SeverityLevel
} = require('../../../common/mcp/protocol');

/**
 * Level 2 (Semantic) Validator Lambda Handler
 * Performs semantic validation using NLP techniques
 */
exports.handler = async (event) => {
  try {
    const { request, configuration } = event;
    const {
      semanticMatchThreshold = 0.85,
      useCache = true,
      maxTokens = 1000,
      language = 'en'
    } = configuration;

    // Initialize validation result
    const validationResult = {
      status: ValidationStatus.PASS,
      confidence: 1.0,
      findings: []
    };

    // Get semantic requirements
    const requirements = await getSemanticRequirements(request.regulation);

    // Process and tokenize the input data
    const processedData = preprocessData(request.data);

    // Validate each semantic requirement
    for (const requirement of requirements) {
      const semanticResult = await validateSemanticRequirement(
        requirement,
        processedData,
        {
          threshold: semanticMatchThreshold,
          maxTokens,
          language
        }
      );

      if (!semanticResult.matches) {
        validationResult.findings.push({
          id: `L2-${requirement.id}`,
          path: semanticResult.path || 'data',
          severity: SeverityLevel.ERROR,
          message: `Semantic validation failed: ${requirement.description}`,
          reference: requirement.reference,
          confidence: semanticResult.confidence,
          details: semanticResult.details
        });
      }

      // Update overall confidence
      validationResult.confidence = Math.min(
        validationResult.confidence,
        semanticResult.confidence
      );
    }

    // Set final status based on findings
    if (validationResult.findings.length > 0) {
      validationResult.status = ValidationStatus.FAIL;
    }

    return validationResult;
  } catch (error) {
    console.error('Error in Level 2 Validator:', error);
    throw new Error(`Level 2 Validation Error: ${error.message}`);
  }
};

/**
 * Retrieves semantic requirements from the database or cache
 * @param {Object} regulation - Regulation metadata
 * @returns {Array} List of semantic requirements
 */
async function getSemanticRequirements(regulation) {
  // TODO: Implement actual database/cache lookup
  // For now, return mock requirements
  return [
    {
      id: 'SEM001',
      concept: 'data_privacy',
      expectedContext: ['personal', 'data', 'protection', 'privacy'],
      reference: 'Section 2.1',
      description: 'Data privacy requirements'
    },
    {
      id: 'SEM002',
      concept: 'consent',
      expectedContext: ['explicit', 'consent', 'agreement', 'authorization'],
      reference: 'Section 2.2',
      description: 'User consent requirements'
    },
    {
      id: 'SEM003',
      concept: 'data_retention',
      expectedContext: ['retention', 'period', 'storage', 'duration'],
      reference: 'Section 2.3',
      description: 'Data retention policies'
    }
  ];
}

/**
 * Preprocesses input data for semantic analysis
 * @param {Object} data - Raw input data
 * @returns {Object} Processed data with extracted text and metadata
 */
function preprocessData(data) {
  const processed = {
    text: '',
    metadata: {},
    sections: []
  };

  // Extract text content from various data fields
  function extractText(obj, path = '') {
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;
      
      if (typeof value === 'string') {
        processed.text += ` ${value}`;
        processed.sections.push({
          path: currentPath,
          content: value
        });
      } else if (typeof value === 'object' && value !== null) {
        extractText(value, currentPath);
      }
    }
  }

  extractText(data);
  processed.text = processed.text.trim();

  // Add basic metadata
  processed.metadata = {
    totalSections: processed.sections.length,
    wordCount: processed.text.split(/\s+/).length,
    averageSectionLength: processed.sections.reduce((acc, sec) => 
      acc + sec.content.length, 0) / processed.sections.length
  };

  return processed;
}

/**
 * Validates a single semantic requirement
 * @param {Object} requirement - Semantic requirement definition
 * @param {Object} processedData - Preprocessed input data
 * @param {Object} options - Validation options
 * @returns {Object} Semantic validation result
 */
async function validateSemanticRequirement(requirement, processedData, options) {
  const result = {
    matches: false,
    confidence: 0,
    path: null,
    details: {}
  };

  try {
    // Perform semantic analysis
    const semanticScore = await calculateSemanticSimilarity(
      requirement.expectedContext,
      processedData.text,
      options
    );

    // Find most relevant section
    const relevantSection = findMostRelevantSection(
      requirement.expectedContext,
      processedData.sections
    );

    result.confidence = semanticScore;
    result.matches = semanticScore >= options.threshold;
    result.path = relevantSection?.path;
    result.details = {
      conceptMatch: requirement.concept,
      relevantContext: relevantSection?.content,
      semanticScore
    };
  } catch (error) {
    console.warn(`Error in semantic validation for ${requirement.id}:`, error);
    result.confidence = 0;
    result.matches = false;
    result.details.error = error.message;
  }

  return result;
}

/**
 * Calculates semantic similarity between expected context and input text
 * @param {Array} expectedContext - List of expected context terms
 * @param {string} inputText - Input text to analyze
 * @param {Object} options - Analysis options
 * @returns {number} Similarity score (0-1)
 */
async function calculateSemanticSimilarity(expectedContext, inputText, options) {
  // TODO: Implement actual NLP-based semantic similarity
  // For now, use a simple term frequency approach
  
  const contextTerms = new Set(expectedContext.map(term => term.toLowerCase()));
  const inputTerms = new Set(inputText.toLowerCase().split(/\W+/));
  
  let matches = 0;
  for (const term of contextTerms) {
    if (inputTerms.has(term)) {
      matches++;
    }
  }
  
  return matches / contextTerms.size;
}

/**
 * Finds the most semantically relevant section
 * @param {Array} expectedContext - Expected context terms
 * @param {Array} sections - Document sections
 * @returns {Object} Most relevant section
 */
function findMostRelevantSection(expectedContext, sections) {
  let bestMatch = null;
  let highestScore = 0;

  for (const section of sections) {
    const score = calculateSemanticSimilarity(
      expectedContext,
      section.content,
      {}
    );

    if (score > highestScore) {
      highestScore = score;
      bestMatch = section;
    }
  }

  return bestMatch;
} 