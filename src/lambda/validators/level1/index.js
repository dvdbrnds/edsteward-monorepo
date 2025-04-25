const {
  MCPProtocol,
  ValidationStatus,
  SeverityLevel
} = require('../../../common/mcp/protocol');

/**
 * Level 1 (Basic) Validator Lambda Handler
 * Performs text-based validation using simple pattern matching
 */
exports.handler = async (event) => {
  try {
    const { request, configuration } = event;
    const { textMatchThreshold = 0.95, useCache = true } = configuration;
    
    // Initialize validation result
    const validationResult = {
      status: ValidationStatus.PASS,
      confidence: 1.0,
      findings: []
    };

    // Get regulation requirements
    const requirements = await getRegulationRequirements(request.regulation);
    
    // Validate each requirement
    for (const requirement of requirements) {
      const matchResult = validateRequirement(
        requirement,
        request.data,
        textMatchThreshold
      );

      if (!matchResult.matches) {
        validationResult.findings.push({
          id: `L1-${requirement.id}`,
          path: matchResult.path || 'data',
          severity: SeverityLevel.ERROR,
          message: `Text does not match required pattern: ${requirement.pattern}`,
          reference: requirement.reference,
          confidence: matchResult.confidence
        });
      }

      // Update overall confidence
      validationResult.confidence = Math.min(
        validationResult.confidence,
        matchResult.confidence
      );
    }

    // Set final status based on findings
    if (validationResult.findings.length > 0) {
      validationResult.status = ValidationStatus.FAIL;
    }

    return validationResult;
  } catch (error) {
    console.error('Error in Level 1 Validator:', error);
    throw new Error(`Level 1 Validation Error: ${error.message}`);
  }
};

/**
 * Retrieves regulation requirements from the database or cache
 * @param {Object} regulation - Regulation metadata
 * @returns {Array} List of requirements
 */
async function getRegulationRequirements(regulation) {
  // TODO: Implement actual database/cache lookup
  // For now, return mock requirements
  return [
    {
      id: 'REQ001',
      pattern: '^[A-Z]{2}\\d{6}$',
      reference: 'Section 1.1',
      description: 'Document ID format'
    },
    {
      id: 'REQ002',
      pattern: '^(true|false)$',
      reference: 'Section 1.2',
      description: 'Boolean flags'
    },
    {
      id: 'REQ003',
      pattern: '^\\d{4}-\\d{2}-\\d{2}$',
      reference: 'Section 1.3',
      description: 'Date format'
    }
  ];
}

/**
 * Validates a single requirement against the data
 * @param {Object} requirement - Requirement definition
 * @param {Object} data - Data to validate
 * @param {number} threshold - Match threshold
 * @returns {Object} Validation result
 */
function validateRequirement(requirement, data, threshold) {
  const result = {
    matches: false,
    confidence: 0,
    path: null
  };

  try {
    const pattern = new RegExp(requirement.pattern);
    const paths = findMatchingPaths(data, pattern);

    if (paths.length > 0) {
      // Calculate confidence based on the best match
      const confidences = paths.map(path => {
        const value = getValueAtPath(data, path);
        return calculateConfidence(value, pattern);
      });

      result.confidence = Math.max(...confidences);
      result.matches = result.confidence >= threshold;
      result.path = paths[0]; // Use the first matching path
    }
  } catch (error) {
    console.warn(`Error validating requirement ${requirement.id}:`, error);
    result.confidence = 0;
    result.matches = false;
  }

  return result;
}

/**
 * Finds all paths in an object where values match a pattern
 * @param {Object} obj - Object to search
 * @param {RegExp} pattern - Pattern to match
 * @param {string} [basePath=''] - Current path
 * @returns {Array} List of matching paths
 */
function findMatchingPaths(obj, pattern, basePath = '') {
  const paths = [];

  for (const [key, value] of Object.entries(obj)) {
    const currentPath = basePath ? `${basePath}.${key}` : key;

    if (typeof value === 'object' && value !== null) {
      paths.push(...findMatchingPaths(value, pattern, currentPath));
    } else if (typeof value === 'string' && pattern.test(value)) {
      paths.push(currentPath);
    }
  }

  return paths;
}

/**
 * Gets a value at a specific path in an object
 * @param {Object} obj - Object to traverse
 * @param {string} path - Path to the value
 * @returns {*} Value at path
 */
function getValueAtPath(obj, path) {
  return path.split('.').reduce((current, part) => current?.[part], obj);
}

/**
 * Calculates confidence score for a pattern match
 * @param {string} value - Value to check
 * @param {RegExp} pattern - Pattern to match
 * @returns {number} Confidence score (0-1)
 */
function calculateConfidence(value, pattern) {
  if (!value || typeof value !== 'string') {
    return 0;
  }

  // For exact matches, return 1
  if (pattern.test(value)) {
    return 1;
  }

  // For partial matches, calculate similarity
  const match = value.match(pattern);
  if (match) {
    return match[0].length / value.length;
  }

  return 0;
} 