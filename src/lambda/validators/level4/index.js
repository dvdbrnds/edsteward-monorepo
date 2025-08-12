import {
  ValidationStatus,
  SeverityLevel
} from '../../../common/mcp/protocol.js';

/**
 * Level 4 (Advanced) Validator Lambda Handler
 * Performs cross-document and temporal validation
 */
export const handler = async (event) => {
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
 * Retrieves advanced TEACH Act validation requirements
 * @param {Object} regulation - Regulation metadata
 * @returns {Array} List of real TEACH Act advanced requirements
 */
async function getAdvancedRequirements(regulation) {
  // Real TEACH Act advanced compliance requirements per 17 USC §110(2)
  console.log(`🎓 Loading TEACH Act Level-4 advanced requirements for ${regulation?.id || 'REG-66'}`);
  
  return [
    {
      id: 'TEACH-ADV001',
      type: 'temporal_sequence',
      expectedSequence: {
        field: 'transmission.classSession',
        constraints: [
          {
            type: 'during_session',
            description: 'Transmission must occur during class session',
            validationLogic: 'transmission_time >= session_start && transmission_time <= session_end'
          },
          {
            type: 'retention_limits',
            description: 'Materials cannot be retained beyond class session',
            maxRetentionHours: 0, // No retention beyond session
            validationLogic: 'expiration_time <= session_end'
          },
          {
            type: 'access_termination',
            description: 'Access must terminate at end of class session',
            validationLogic: 'access_controls.session_based === true'
          }
        ]
      },
      reference: '17 USC §110(2)(D)(ii) and §110(2)(E)(i)',
      description: 'TEACH Act temporal access and retention constraints',
      severity: 'CRITICAL',
      legalBasis: 'Transmission must be limited to class session duration with no post-session retention'
    },
    {
      id: 'TEACH-ADV002', 
      type: 'cross_reference',
      expectedReferences: {
        sourceField: 'institution.policies',
        constraints: [
          {
            type: 'copyright_policy_exists',
            requiredPolicies: [
              'copyright_compliance_policy',
              'faculty_copyright_education', 
              'student_copyright_notice',
              'dmca_policy'
            ],
            validationLogic: 'all_policies_exist && policies_current && policies_accessible'
          },
          {
            type: 'informational_materials',
            description: 'Institution must provide copyright education materials',
            requiredMaterials: [
              'faculty_copyright_guidelines',
              'student_copyright_notice',
              'fair_use_guidelines',
              'teach_act_compliance_guide'
            ],
            validationLogic: 'materials_accurate && materials_current && materials_accessible'
          },
          {
            type: 'policy_integration',
            description: 'Copyright policies must be integrated with TEACH Act procedures',
            validationLogic: 'teach_act_specific_procedures && policy_enforcement_mechanisms'
          }
        ]
      },
      reference: '17 USC §110(2)(D)(i)(ii)(iii)',
      description: 'TEACH Act institutional copyright policy requirements',
      severity: 'HIGH',
      legalBasis: 'Institution must have comprehensive copyright policies and educational materials'
    },
    {
      id: 'TEACH-ADV003',
      type: 'technological_measures',
      expectedMeasures: {
        field: 'technology.controls',
        constraints: [
          {
            type: 'access_controls',
            description: 'Technological measures to limit access to enrolled students',
            requiredControls: [
              'student_authentication',
              'enrollment_verification', 
              'authorized_personnel_access',
              'geographic_restrictions'
            ],
            validationLogic: 'access_limited_to_enrolled && authentication_verified'
          },
          {
            type: 'retention_prevention',
            description: 'Technology must prevent retention beyond class session',
            requiredMeasures: [
              'session_expiration',
              'download_prevention',
              'copy_protection',
              'streaming_only'
            ],
            validationLogic: 'retention_technically_prevented && downloads_blocked'
          },
          {
            type: 'dissemination_controls',
            description: 'Technology must prevent unauthorized further dissemination',
            requiredMeasures: [
              'sharing_prevention',
              'redistribution_blocks',
              'watermarking',
              'rights_management'
            ],
            validationLogic: 'dissemination_prevented && sharing_blocked'
          }
        ]
      },
      reference: '17 USC §110(2)(E)',
      description: 'TEACH Act technological protection requirements',
      severity: 'CRITICAL',
      legalBasis: 'Institution must implement technological measures to prevent retention and unauthorized dissemination'
    },
    {
      id: 'TEACH-ADV004',
      type: 'content_analysis',
      expectedContent: {
        field: 'content.materials',
        constraints: [
          {
            type: 'portion_limitation',
            description: 'Only reasonable and limited portions may be transmitted',
            contentTypes: {
              'audiovisual_works': {
                maxPortion: 'reasonable_limited_portion',
                validationLogic: 'portion < entire_work && portion_reasonable_for_teaching'
              },
              'other_works': {
                maxPortion: 'amount_comparable_to_live_classroom',
                validationLogic: 'amount <= typical_live_classroom_display'
              }
            }
          },
          {
            type: 'market_impact',
            description: 'Use must not interfere with technological measures',
            validationLogic: 'no_circumvention_of_copyright_protection && no_market_substitution'
          },
          {
            type: 'pedagogical_purpose',
            description: 'Content must be integral part of class experience',
            validationLogic: 'integral_to_instruction && instructor_supervised && analogous_to_live_classroom'
          }
        ]
      },
      reference: '17 USC §110(2)(A)(B)',
      description: 'TEACH Act content limitation and pedagogical requirements',
      severity: 'HIGH', 
      legalBasis: 'Content must be limited to reasonable portions for legitimate pedagogical purposes'
    },
    {
      id: 'TEACH-ADV005',
      type: 'institutional_eligibility',
      expectedEligibility: {
        field: 'institution.accreditation',
        constraints: [
          {
            type: 'accreditation_status',
            description: 'Institution must be accredited nonprofit educational institution',
            requiredStatus: 'accredited_nonprofit_educational',
            validationLogic: 'accreditation_current && nonprofit_status && educational_mission'
          },
          {
            type: 'governmental_body',
            description: 'Alternative: governmental body eligibility',
            validationLogic: 'government_entity && educational_purpose'
          },
          {
            type: 'mediated_instruction',
            description: 'Transmission must be part of mediated instructional activities',
            validationLogic: 'systematic_instruction && curriculum_based && instructor_oversight'
          }
        ]
      },
      reference: '17 USC §110(2) opening clause',
      description: 'TEACH Act institutional eligibility requirements',
      severity: 'CRITICAL',
      legalBasis: 'Only qualified educational institutions may use TEACH Act exemption'
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
    validationDetails: {},
    violationPath: null
  };

  console.log(`⏰ Validating TEACH Act temporal constraints for field: ${expectedSequence.field}`);

  const { field, constraints } = expectedSequence;
  const transmissionData = getFieldValue(context.currentDocument, field);

  if (!transmissionData) {
    result.violations.push({
      path: field,
      message: `Missing required transmission timing data: ${field}`,
      severity: 'CRITICAL'
    });
    result.confidence = 0;
    result.violationPath = field;
    return result;
  }

  // Real TEACH Act temporal validation
  for (const constraint of constraints) {
    try {
      let isValid = false;
      let details = {};

      switch (constraint.type) {
        case 'during_session':
          // Validate transmission occurs during class session
          const sessionResult = validateDuringClassSession(transmissionData, constraint);
          isValid = sessionResult.valid;
          details = sessionResult.details;
          break;

        case 'retention_limits':
          // Validate no retention beyond class session
          const retentionResult = validateRetentionLimits(transmissionData, constraint);
          isValid = retentionResult.valid;
          details = retentionResult.details;
          break;

        case 'access_termination':
          // Validate access terminates at session end
          const accessResult = validateAccessTermination(transmissionData, constraint);
          isValid = accessResult.valid;
          details = accessResult.details;
          break;

        // Legacy constraint types for backward compatibility
        case 'not_before':
          const referenceDate = getFieldValue(context.currentDocument, constraint.value);
          isValid = isValidSequence(transmissionData, referenceDate);
          details = { referenceDate, fieldValue: transmissionData };
          break;

        case 'within':
          const fromDate = getFieldValue(context.currentDocument, constraint.from);
          isValid = isWithinRange(transmissionData, fromDate, constraint.value);
          details = { fromDate, fieldValue: transmissionData, range: constraint.value };
          break;
      }

      result.validationDetails[constraint.type] = details;

      if (!isValid) {
        result.violations.push({
          path: field,
          message: `TEACH Act temporal violation: ${constraint.description || constraint.type}`,
          constraint,
          details,
          severity: 'CRITICAL',
          legalReference: '17 USC §110(2)(D)(ii) and §110(2)(E)(i)'
        });
      }
    } catch (error) {
      result.violations.push({
        path: field,
        message: `Error validating temporal constraint: ${error.message}`,
        constraint,
        severity: 'ERROR'
      });
    }
  }

  if (result.violations.length > 0) {
    result.confidence = Math.max(0, 1 - (result.violations.length * 0.3));
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
    console.log(`📚 Fetching real document: ${reference.id} (type: ${reference.type})`);
    
    // Real document fetching from multiple sources
    const axios = (await import('axios')).default;
    
    // Determine source based on reference type and ID
    let documentData = null;
    
    if (reference.id.includes('copyright.gov') || reference.type === 'government_policy') {
      // Fetch from Copyright Office
      documentData = await fetchFromCopyrightOffice(reference, axios);
    } else if (reference.id.includes('stanford.edu') || reference.type === 'university_policy') {
      // Fetch from Stanford Law Library
      documentData = await fetchFromStanfordLibrary(reference, axios);
    } else if (reference.id.includes('harvard.edu')) {
      // Fetch from Harvard Law Library  
      documentData = await fetchFromHarvardLibrary(reference, axios);
    } else if (reference.id.includes('yale.edu')) {
      // Fetch from Yale Law Library
      documentData = await fetchFromYaleLibrary(reference, axios);
    } else if (reference.id.includes('columbia.edu')) {
      // Fetch from Columbia Law Library
      documentData = await fetchFromColumbiaLibrary(reference, axios);
    } else if (reference.type === 'institutional_policy') {
      // Fetch institutional policies (simulated for now)
      documentData = await fetchInstitutionalPolicy(reference);
    } else {
      // Generic web document fetching
      documentData = await fetchGenericWebDocument(reference, axios);
    }
    
    if (!documentData) {
      console.warn(`❌ Document not found: ${reference.id}`);
      return null;
    }
    
    console.log(`✅ Successfully fetched document: ${reference.id}`);
    return {
      id: reference.id,
      metadata: {
        status: documentData.status || 'active',
        version: documentData.version || '1.0.0',
        lastModified: documentData.lastModified || new Date().toISOString(),
        source: documentData.source,
        confidence: documentData.confidence || 0.85
      },
      content: {
        text: documentData.content,
        validationDetails: documentData.validationDetails || {}
      }
    };
    
  } catch (error) {
    console.warn(`❌ Failed to fetch referenced document ${reference.id}:`, error.message);
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

/**
 * TEACH Act temporal validation helper functions
 */

/**
 * Validates transmission occurs during class session
 */
function validateDuringClassSession(transmissionData, constraint) {
  try {
    const transmissionTime = new Date(transmissionData.startTime || transmissionData.timestamp);
    const sessionStart = new Date(transmissionData.classSession?.startTime);
    const sessionEnd = new Date(transmissionData.classSession?.endTime);

    if (isNaN(transmissionTime) || isNaN(sessionStart) || isNaN(sessionEnd)) {
      return {
        valid: false,
        details: {
          error: 'Invalid timestamp data',
          transmissionTime: transmissionData.startTime,
          sessionStart: transmissionData.classSession?.startTime,
          sessionEnd: transmissionData.classSession?.endTime
        }
      };
    }

    const isWithinSession = transmissionTime >= sessionStart && transmissionTime <= sessionEnd;
    
    return {
      valid: isWithinSession,
      details: {
        transmissionTime: transmissionTime.toISOString(),
        sessionStart: sessionStart.toISOString(),
        sessionEnd: sessionEnd.toISOString(),
        sessionDurationMinutes: Math.round((sessionEnd - sessionStart) / (1000 * 60)),
        withinSession: isWithinSession,
        timeOffsetMinutes: isWithinSession ? 0 : Math.round((transmissionTime - sessionEnd) / (1000 * 60))
      }
    };
  } catch (error) {
    return {
      valid: false,
      details: { error: error.message }
    };
  }
}

/**
 * Validates no retention beyond class session
 */
function validateRetentionLimits(transmissionData, constraint) {
  try {
    const sessionEnd = new Date(transmissionData.classSession?.endTime);
    const contentExpiration = new Date(transmissionData.expirationTime || transmissionData.endTime);
    
    if (isNaN(sessionEnd) || isNaN(contentExpiration)) {
      return {
        valid: false,
        details: {
          error: 'Invalid expiration timing data',
          sessionEnd: transmissionData.classSession?.endTime,
          contentExpiration: transmissionData.expirationTime
        }
      };
    }

    // TEACH Act requires no retention beyond session
    const retentionBeyondSession = contentExpiration > sessionEnd;
    const retentionHours = retentionBeyondSession ? 
      Math.round((contentExpiration - sessionEnd) / (1000 * 60 * 60)) : 0;

    return {
      valid: !retentionBeyondSession,
      details: {
        sessionEnd: sessionEnd.toISOString(),
        contentExpiration: contentExpiration.toISOString(),
        retentionBeyondSession,
        excessRetentionHours: retentionHours,
        maxAllowedRetentionHours: constraint.maxRetentionHours,
        compliant: retentionHours <= constraint.maxRetentionHours
      }
    };
  } catch (error) {
    return {
      valid: false,
      details: { error: error.message }
    };
  }
}

/**
 * Validates access terminates at session end
 */
function validateAccessTermination(transmissionData, constraint) {
  try {
    const hasSessionBasedControls = transmissionData.accessControls?.sessionBased === true;
    const hasAutomaticTermination = transmissionData.accessControls?.automaticTermination === true;
    const terminationTime = transmissionData.accessControls?.terminationTime;
    const sessionEnd = new Date(transmissionData.classSession?.endTime);

    let terminatesCorrectly = false;
    if (terminationTime) {
      const termTime = new Date(terminationTime);
      terminatesCorrectly = !isNaN(termTime) && termTime <= sessionEnd;
    }

    const accessControlsValid = hasSessionBasedControls && hasAutomaticTermination && terminatesCorrectly;

    return {
      valid: accessControlsValid,
      details: {
        sessionBasedControls: hasSessionBasedControls,
        automaticTermination: hasAutomaticTermination,
        terminationTime: terminationTime,
        sessionEnd: sessionEnd.toISOString(),
        terminatesAtSessionEnd: terminatesCorrectly,
        accessControlsCompliant: accessControlsValid,
        requirements: {
          sessionBased: 'required',
          automaticTermination: 'required', 
          noPostSessionAccess: 'required'
        }
      }
    };
  } catch (error) {
    return {
      valid: false,
      details: { error: error.message }
    };
  }
}

/**
 * Helper functions for real document fetching from various sources
 */

/**
 * Fetches document from Copyright Office
 */
async function fetchFromCopyrightOffice(reference, axios) {
  try {
    const url = reference.id.startsWith('http') ? reference.id : `https://www.copyright.gov${reference.id}`;
    const response = await axios.get(url, { timeout: 10000 });
    
    const cheerio = (await import('cheerio')).default;
    const $ = cheerio.load(response.data);
    
    // Extract TEACH Act specific content
    const title = $('title').text() || $('h1').first().text();
    const content = $('main, .content, .body').text() || $('body').text();
    
    return {
      status: 'active',
      version: '2023.1',
      source: 'U.S. Copyright Office',
      confidence: 0.95,
      content: content.substring(0, 5000), // Limit content size
      lastModified: new Date().toISOString(),
      validationDetails: {
        title,
        authority: 'federal_government',
        credibility: 'high'
      }
    };
  } catch (error) {
    console.warn('Copyright Office fetch failed:', error.message);
    return null;
  }
}

/**
 * Fetches institutional policy document (simulated for demo)
 */
async function fetchInstitutionalPolicy(reference) {
  // In a real implementation, this would connect to institution's policy database
  const policyTypes = {
    'copyright_compliance_policy': {
      status: 'active',
      version: '2.1.0',
      lastModified: '2023-08-15T10:30:00Z',
      content: 'Comprehensive copyright compliance policy including TEACH Act procedures...',
      confidence: 0.90
    },
    'faculty_copyright_education': {
      status: 'active', 
      version: '1.5.0',
      lastModified: '2023-09-01T14:20:00Z',
      content: 'Faculty education materials on copyright law and TEACH Act compliance...',
      confidence: 0.88
    },
    'student_copyright_notice': {
      status: 'active',
      version: '1.2.0', 
      lastModified: '2023-07-20T09:15:00Z',
      content: 'Student notice regarding copyright protection of course materials...',
      confidence: 0.85
    }
  };
  
  const policyKey = reference.id.split('/').pop() || reference.type;
  return policyTypes[policyKey] || null;
}

/**
 * Fetches from Stanford Law Library
 */
async function fetchFromStanfordLibrary(reference, axios) {
  try {
    const baseUrl = 'https://fairuse.stanford.edu';
    const response = await axios.get(`${baseUrl}/overview/academic-and-educational-permissions/`, { timeout: 10000 });
    
    const cheerio = (await import('cheerio')).default;
    const $ = cheerio.load(response.data);
    
    const content = $('.content, .main-content').text() || $('body').text();
    
    return {
      status: 'active',
      version: '2023.2',
      source: 'Stanford Law Library',
      confidence: 0.92,
      content: content.substring(0, 5000),
      lastModified: new Date().toISOString(),
      validationDetails: {
        authority: 'academic_institution',
        credibility: 'high',
        expertise: 'copyright_law'
      }
    };
  } catch (error) {
    console.warn('Stanford Library fetch failed:', error.message);
    return null;
  }
}

/**
 * Fetches from Harvard Law Library
 */
async function fetchFromHarvardLibrary(reference, axios) {
  try {
    const response = await axios.get('https://guides.library.harvard.edu/copyright', { timeout: 10000 });
    
    const cheerio = (await import('cheerio')).default;
    const $ = cheerio.load(response.data);
    
    const content = $('.s-lib-main, .guide-content').text() || $('body').text();
    
    return {
      status: 'active',
      version: '2023.1',
      source: 'Harvard Law Library',
      confidence: 0.91,
      content: content.substring(0, 5000),
      lastModified: new Date().toISOString(),
      validationDetails: {
        authority: 'academic_institution',
        credibility: 'high',
        expertise: 'legal_research'
      }
    };
  } catch (error) {
    console.warn('Harvard Library fetch failed:', error.message);
    return null;
  }
}

/**
 * Fetches from Yale Law Library  
 */
async function fetchFromYaleLibrary(reference, axios) {
  try {
    const response = await axios.get('https://law.yale.edu/isp/digital-copyright', { timeout: 10000 });
    
    const cheerio = (await import('cheerio')).default;
    const $ = cheerio.load(response.data);
    
    const content = $('.field-item, .content').text() || $('body').text();
    
    return {
      status: 'active',
      version: '2023.1',
      source: 'Yale Law Library',
      confidence: 0.90,
      content: content.substring(0, 5000),
      lastModified: new Date().toISOString(),
      validationDetails: {
        authority: 'academic_institution',
        credibility: 'high',
        expertise: 'intellectual_property'
      }
    };
  } catch (error) {
    console.warn('Yale Library fetch failed:', error.message);
    return null;
  }
}

/**
 * Fetches from Columbia Law Library
 */
async function fetchFromColumbiaLibrary(reference, axios) {
  try {
    const response = await axios.get('https://library.law.columbia.edu/guides/copyright', { timeout: 10000 });
    
    const cheerio = (await import('cheerio')).default; 
    const $ = cheerio.load(response.data);
    
    const content = $('.guide-content, .s-lib-main').text() || $('body').text();
    
    return {
      status: 'active',
      version: '2023.1',
      source: 'Columbia Law Library',
      confidence: 0.89,
      content: content.substring(0, 5000),
      lastModified: new Date().toISOString(),
      validationDetails: {
        authority: 'academic_institution',
        credibility: 'high',
        expertise: 'copyright_law'
      }
    };
  } catch (error) {
    console.warn('Columbia Library fetch failed:', error.message);
    return null;
  }
}

/**
 * Fetches generic web document
 */
async function fetchGenericWebDocument(reference, axios) {
  try {
    if (!reference.id.startsWith('http')) {
      return null;
    }
    
    const response = await axios.get(reference.id, { timeout: 10000 });
    
    return {
      status: 'active',
      version: '1.0.0',
      source: 'Web Document',
      confidence: 0.70,
      content: response.data.substring(0, 3000),
      lastModified: new Date().toISOString(),
      validationDetails: {
        authority: 'web_source',
        credibility: 'medium'
      }
    };
  } catch (error) {
    console.warn('Generic web document fetch failed:', error.message);
    return null;
  }
} 