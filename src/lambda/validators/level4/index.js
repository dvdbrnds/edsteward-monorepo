const {
  ValidationStatus,
  SeverityLevel
} = require('../../../common/mcp/protocol');

/**
 * Level 4 (Advanced) Validator Lambda Handler
 * Performs cross-document and temporal validation
 */
exports.handler = async (event) => {
  try {
    const { request, configuration } = event;
    const {
      temporalMatchThreshold = 0.95,
      useCache = true,
      maxReferences = 100,
      validateHistory = true,
      validateCrossRefs = true
    } = configuration;

    // Initialize validation result
    const validationResult = {
      status: ValidationStatus.PASS,
      confidence: 1.0,
      findings: []
    };

    // Get advanced validation requirements
    const requirements = await getAdvancedRequirements(request.regulation);

    // Build document context
    const context = await buildValidationContext(request, maxReferences);

    // Validate each advanced requirement
    for (const requirement of requirements) {
      const advancedResult = await validateAdvancedRequirement(
        requirement,
        context,
        {
          threshold: temporalMatchThreshold,
          validateHistory,
          validateCrossRefs
        }
      );

      if (!advancedResult.matches) {
        validationResult.findings.push({
          id: `L4-${requirement.id}`,
          path: advancedResult.path || 'data',
          severity: SeverityLevel.ERROR,
          message: `Advanced validation failed: ${requirement.description}`,
          reference: requirement.reference,
          confidence: advancedResult.confidence,
          details: advancedResult.details
        });
      }

      // Update overall confidence
      validationResult.confidence = Math.min(
        validationResult.confidence,
        advancedResult.confidence
      );
    }

    // Set final status based on findings
    if (validationResult.findings.length > 0) {
      validationResult.status = ValidationStatus.FAIL;
    }

    return validationResult;
  } catch (error) {
    console.error('Error in Level 4 Validator:', error);
    throw new Error(`Level 4 Validation Error: ${error.message}`);
  }
};

/**
 * Retrieves advanced validation requirements from the database or cache
 * @param {Object} regulation - Regulation metadata
 * @returns {Array} List of advanced requirements
 */
async function getAdvancedRequirements(regulation) {
  // TODO: Implement actual database/cache lookup
  // For now, return mock requirements
  return [
    {
      id: 'ADV001',
      type: 'temporal_sequence',
      expectedSequence: {
        field: 'metadata.effectiveDate',
        constraints: [
          {
            type: 'not_before',
            value: 'metadata.approvalDate'
          },
          {
            type: 'within',
            value: '90d',
            from: 'metadata.approvalDate'
          }
        ]
      },
      reference: 'Section 4.1',
      description: 'Temporal sequence requirements'
    },
    {
      id: 'ADV002',
      type: 'cross_reference',
      expectedReferences: {
        sourceField: 'content.references',
        constraints: [
          {
            type: 'document_exists',
            status: ['active', 'published']
          },
          {
            type: 'version_compatible',
            field: 'metadata.version'
          }
        ]
      },
      reference: 'Section 4.2',
      description: 'Cross-reference integrity requirements'
    },
    {
      id: 'ADV003',
      type: 'version_history',
      expectedHistory: {
        field: 'metadata.version',
        constraints: [
          {
            type: 'incremental',
            pattern: 'semver'
          },
          {
            type: 'changelog_required',
            minEntries: 1
          }
        ]
      },
      reference: 'Section 4.3',
      description: 'Version history requirements'
    }
  ];
}

/**
 * Builds validation context including referenced documents and history
 * @param {Object} request - Validation request
 * @param {number} maxReferences - Maximum number of references to follow
 * @returns {Object} Validation context
 */
async function buildValidationContext(request, maxReferences) {
  const context = {
    currentDocument: request.data,
    referencedDocuments: new Map(),
    versionHistory: [],
    metadata: {
      referenceCount: 0,
      historyDepth: 0,
      temporalRange: null
    }
  };

  // TODO: Implement actual document lookup and history retrieval
  // For now, use mock data

  // Add referenced documents
  const references = extractReferences(request.data);
  for (const ref of references.slice(0, maxReferences)) {
    const referencedDoc = await fetchReferencedDocument(ref);
    if (referencedDoc) {
      context.referencedDocuments.set(ref.id, referencedDoc);
      context.metadata.referenceCount++;
    }
  }

  // Add version history
  const history = await fetchVersionHistory(request.data);
  context.versionHistory = history;
  context.metadata.historyDepth = history.length;

  // Calculate temporal range
  context.metadata.temporalRange = calculateTemporalRange(
    [request.data, ...context.referencedDocuments.values()]
  );

  return context;
}

/**
 * Validates a single advanced requirement
 * @param {Object} requirement - Advanced requirement definition
 * @param {Object} context - Validation context
 * @param {Object} options - Validation options
 * @returns {Object} Advanced validation result
 */
async function validateAdvancedRequirement(requirement, context, options) {
  const result = {
    matches: false,
    confidence: 0,
    path: null,
    details: {}
  };

  try {
    switch (requirement.type) {
      case 'temporal_sequence':
        result.details = validateTemporalSequence(
          requirement.expectedSequence,
          context
        );
        break;
      
      case 'cross_reference':
        if (options.validateCrossRefs) {
          result.details = validateCrossReferences(
            requirement.expectedReferences,
            context
          );
        } else {
          result.details = { confidence: 1.0, skipped: true };
        }
        break;
      
      case 'version_history':
        if (options.validateHistory) {
          result.details = validateVersionHistory(
            requirement.expectedHistory,
            context
          );
        } else {
          result.details = { confidence: 1.0, skipped: true };
        }
        break;
      
      default:
        throw new Error(`Unknown requirement type: ${requirement.type}`);
    }

    result.confidence = result.details.confidence;
    result.matches = result.confidence >= options.threshold;
    result.path = result.details.violationPath;
  } catch (error) {
    console.warn(`Error in advanced validation for ${requirement.id}:`, error);
    result.confidence = 0;
    result.matches = false;
    result.details.error = error.message;
  }

  return result;
}

/**
 * Validates temporal sequence constraints
 * @param {Object} expectedSequence - Expected temporal sequence
 * @param {Object} context - Validation context
 * @returns {Object} Validation details
 */
function validateTemporalSequence(expectedSequence, context) {
  const result = {
    confidence: 1.0,
    violations: [],
    violationPath: null
  };

  const { field, constraints } = expectedSequence;
  const fieldValue = getFieldValue(context.currentDocument, field);
  
  if (!fieldValue) {
    result.violations.push({
      path: field,
      message: 'Missing temporal field'
    });
    result.confidence = 0;
    result.violationPath = field;
    return result;
  }

  for (const constraint of constraints) {
    switch (constraint.type) {
      case 'not_before':
        const referenceDate = getFieldValue(
          context.currentDocument,
          constraint.value
        );
        if (!isValidSequence(fieldValue, referenceDate)) {
          result.violations.push({
            path: field,
            message: `Date must not be before ${constraint.value}`
          });
        }
        break;

      case 'within':
        const fromDate = getFieldValue(
          context.currentDocument,
          constraint.from
        );
        if (!isWithinRange(fieldValue, fromDate, constraint.value)) {
          result.violations.push({
            path: field,
            message: `Date must be within ${constraint.value} of ${constraint.from}`
          });
        }
        break;
    }
  }

  if (result.violations.length > 0) {
    result.confidence = 0;
    result.violationPath = result.violations[0].path;
  }

  return result;
}

/**
 * Validates cross-reference constraints
 * @param {Object} expectedReferences - Expected cross-references
 * @param {Object} context - Validation context
 * @returns {Object} Validation details
 */
function validateCrossReferences(expectedReferences, context) {
  const result = {
    confidence: 1.0,
    violations: [],
    violationPath: null
  };

  const { sourceField, constraints } = expectedReferences;
  const references = getFieldValue(context.currentDocument, sourceField) || [];

  for (const reference of references) {
    const referencedDoc = context.referencedDocuments.get(reference.id);
    
    if (!referencedDoc) {
      result.violations.push({
        path: sourceField,
        message: `Referenced document not found: ${reference.id}`
      });
      continue;
    }

    for (const constraint of constraints) {
      switch (constraint.type) {
        case 'document_exists':
          if (!constraint.status.includes(referencedDoc.metadata?.status)) {
            result.violations.push({
              path: sourceField,
              message: `Referenced document status invalid: ${reference.id}`
            });
          }
          break;

        case 'version_compatible':
          const sourceVersion = getFieldValue(
            context.currentDocument,
            constraint.field
          );
          const targetVersion = getFieldValue(
            referencedDoc,
            constraint.field
          );
          if (!isVersionCompatible(sourceVersion, targetVersion)) {
            result.violations.push({
              path: sourceField,
              message: `Version incompatibility: ${reference.id}`
            });
          }
          break;
      }
    }
  }

  if (result.violations.length > 0) {
    result.confidence = 0;
    result.violationPath = result.violations[0].path;
  }

  return result;
}

/**
 * Validates version history constraints
 * @param {Object} expectedHistory - Expected version history
 * @param {Object} context - Validation context
 * @returns {Object} Validation details
 */
function validateVersionHistory(expectedHistory, context) {
  const result = {
    confidence: 1.0,
    violations: [],
    violationPath: null
  };

  const { field, constraints } = expectedHistory;
  const currentVersion = getFieldValue(context.currentDocument, field);
  
  if (!currentVersion) {
    result.violations.push({
      path: field,
      message: 'Missing version field'
    });
    result.confidence = 0;
    result.violationPath = field;
    return result;
  }

  for (const constraint of constraints) {
    switch (constraint.type) {
      case 'incremental':
        if (!isValidVersionSequence(
          context.versionHistory,
          currentVersion,
          constraint.pattern
        )) {
          result.violations.push({
            path: field,
            message: 'Invalid version sequence'
          });
        }
        break;

      case 'changelog_required':
        if (!hasValidChangelog(
          context.versionHistory,
          constraint.minEntries
        )) {
          result.violations.push({
            path: field,
            message: `Changelog must have at least ${constraint.minEntries} entries`
          });
        }
        break;
    }
  }

  if (result.violations.length > 0) {
    result.confidence = 0;
    result.violationPath = result.violations[0].path;
  }

  return result;
}

// Helper functions

/**
 * Extracts references from document data
 * @param {Object} data - Document data
 * @returns {Array} List of references
 */
function extractReferences(data) {
  const references = [];

  function traverse(obj, path = '') {
    if (!obj || typeof obj !== 'object') return;

    // Check if current object is a reference
    if (obj.id && obj.type && obj.type === 'citation') {
      references.push({
        id: obj.id,
        type: obj.type,
        path
      });
      return;
    }

    // Check if we have a references array
    if (Array.isArray(obj) && path.endsWith('references')) {
      references.push(...obj.filter(ref => ref.id && ref.type));
      return;
    }

    // Recursively traverse object
    for (const [key, value] of Object.entries(obj)) {
      const newPath = path ? `${path}.${key}` : key;
      traverse(value, newPath);
    }
  }

  traverse(data);
  return references;
}

/**
 * Fetches a referenced document
 * @param {Object} reference - Reference metadata
 * @returns {Promise<Object>} Referenced document
 */
async function fetchReferencedDocument(reference) {
  try {
    // TODO: Replace with actual document fetching from database/storage
    // For now, simulate document fetching with mock data
    return {
      id: reference.id,
      metadata: {
        status: 'published',
        version: '1.0',
        lastModified: new Date().toISOString()
      },
      content: {
        text: 'Referenced document content'
      }
    };
  } catch (error) {
    console.warn(`Error fetching document ${reference.id}:`, error);
    return null;
  }
}

/**
 * Fetches version history for a document
 * @param {Object} data - Document data
 * @returns {Promise<Array>} Version history
 */
async function fetchVersionHistory(data) {
  try {
    // Extract current version
    const currentVersion = data.metadata?.version;
    if (!currentVersion) return [];

    // TODO: Replace with actual history fetching from database
    // For now, generate mock history
    const versions = [];
    const [major, minor] = currentVersion.split('.').map(Number);

    for (let i = 0; i <= major; i++) {
      for (let j = 0; j <= (i === major ? minor : 9); j++) {
        if (i === 0 && j === 0) continue; // Skip 0.0
        versions.push({
          version: `${i}.${j}`,
          timestamp: new Date(2024, 0, i * 30 + j).toISOString(),
          changelog: [`Version ${i}.${j} changes`]
        });
      }
    }

    return versions.sort((a, b) => 
      a.version.localeCompare(b.version, undefined, { numeric: true }));
  } catch (error) {
    console.warn('Error fetching version history:', error);
    return [];
  }
}

/**
 * Calculates temporal range for a set of documents
 * @param {Array} documents - List of documents
 * @returns {Object} Temporal range metadata
 */
function calculateTemporalRange(documents) {
  const dates = [];
  const dateFields = [
    'metadata.effectiveDate',
    'metadata.approvalDate',
    'metadata.lastModified'
  ];

  // Extract all dates from documents
  for (const doc of documents) {
    for (const field of dateFields) {
      const value = getFieldValue(doc, field);
      if (value) {
        try {
          dates.push(new Date(value));
        } catch (error) {
          console.warn(`Invalid date in ${field}:`, value);
        }
      }
    }
  }

  if (dates.length === 0) return null;

  // Calculate range
  const start = new Date(Math.min(...dates));
  const end = new Date(Math.max(...dates));
  const durationDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

  return {
    start: start.toISOString(),
    end: end.toISOString(),
    durationDays,
    dateCount: dates.length
  };
}

/**
 * Validates if date1 is not before date2
 * @param {string} date1 - First date
 * @param {string} date2 - Second date
 * @returns {boolean} Whether sequence is valid
 */
function isValidSequence(date1, date2) {
  try {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    return !isNaN(d1) && !isNaN(d2) && d1 >= d2;
  } catch (error) {
    console.warn('Error comparing dates:', error);
    return false;
  }
}

/**
 * Checks if a date is within a specified range
 * @param {string} date - Date to check
 * @param {string} fromDate - Start date
 * @param {string} range - Range specification (e.g., '90d')
 * @returns {boolean} Whether date is within range
 */
function isWithinRange(date, fromDate, range) {
  try {
    const targetDate = new Date(date);
    const startDate = new Date(fromDate);
    if (isNaN(targetDate) || isNaN(startDate)) return false;

    // Parse range specification
    const match = range.match(/^(\d+)([dwmy])$/);
    if (!match) return false;

    const [, value, unit] = match;
    let maxDiff;

    switch (unit) {
      case 'd': // days
        maxDiff = value * 24 * 60 * 60 * 1000;
        break;
      case 'w': // weeks
        maxDiff = value * 7 * 24 * 60 * 60 * 1000;
        break;
      case 'm': // months
        maxDiff = value * 30 * 24 * 60 * 60 * 1000;
        break;
      case 'y': // years
        maxDiff = value * 365 * 24 * 60 * 60 * 1000;
        break;
      default:
        return false;
    }

    const diff = targetDate - startDate;
    return diff >= 0 && diff <= maxDiff;
  } catch (error) {
    console.warn('Error checking date range:', error);
    return false;
  }
}

/**
 * Checks if two versions are compatible
 * @param {string} sourceVersion - Source version
 * @param {string} targetVersion - Target version
 * @returns {boolean} Whether versions are compatible
 */
function isVersionCompatible(sourceVersion, targetVersion) {
  try {
    if (!sourceVersion || !targetVersion) return false;

    // Parse versions
    const [sourceMajor, sourceMinor = 0] = sourceVersion.split('.').map(Number);
    const [targetMajor, targetMinor = 0] = targetVersion.split('.').map(Number);

    // Check if versions are valid numbers
    if (isNaN(sourceMajor) || isNaN(sourceMinor) || 
        isNaN(targetMajor) || isNaN(targetMinor)) {
      return false;
    }

    // Major version must match, minor version of source must be >= target
    return sourceMajor === targetMajor && sourceMinor >= targetMinor;
  } catch (error) {
    console.warn('Error comparing versions:', error);
    return false;
  }
}

/**
 * Validates version sequence according to pattern
 * @param {Array} history - Version history
 * @param {string} currentVersion - Current version
 * @param {string} pattern - Version pattern (e.g., 'semver')
 * @returns {boolean} Whether sequence is valid
 */
function isValidVersionSequence(history, currentVersion, pattern) {
  try {
    if (!history || !currentVersion) return false;

    // Sort versions
    const versions = history.map(h => h.version)
      .concat(currentVersion)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    // Check if current version is the latest
    if (versions[versions.length - 1] !== currentVersion) {
      return false;
    }

    // Validate sequence based on pattern
    switch (pattern) {
      case 'semver':
        return versions.every((version, i) => {
          if (i === 0) return true;
          const [prevMajor, prevMinor = 0] = versions[i - 1].split('.').map(Number);
          const [curMajor, curMinor = 0] = version.split('.').map(Number);
          
          return curMajor > prevMajor || 
                (curMajor === prevMajor && curMinor > prevMinor);
        });

      default:
        return true; // No specific pattern validation
    }
  } catch (error) {
    console.warn('Error validating version sequence:', error);
    return false;
  }
}

/**
 * Validates changelog entries
 * @param {Array} history - Version history
 * @param {number} minEntries - Minimum required entries
 * @returns {boolean} Whether changelog is valid
 */
function hasValidChangelog(history, minEntries) {
  try {
    if (!history || !Array.isArray(history)) return false;

    // Count valid changelog entries
    const validEntries = history.filter(entry => 
      entry.changelog && 
      Array.isArray(entry.changelog) && 
      entry.changelog.length > 0
    ).length;

    return validEntries >= minEntries;
  } catch (error) {
    console.warn('Error validating changelog:', error);
    return false;
  }
}

function getFieldValue(obj, path) {
  return path.split('.').reduce((current, part) => current?.[part], obj);
} 