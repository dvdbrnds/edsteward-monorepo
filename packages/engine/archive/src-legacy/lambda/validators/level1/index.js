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
  console.log('📋 Loading real compliance requirements for:', regulation.name || regulation.id);
  
  // Real TEACH Act Section 110(2) requirements for educational institutions
  if (regulation.id === 'reg-66' || regulation.name?.includes('TEACH Act')) {
    return [
      {
        id: 'TEACH_110_2_A',
        pattern: '(accredited|nonprofit educational institution)',
        reference: '17 U.S.C. § 110(2)(A)',
        description: 'Institution must be accredited nonprofit educational institution',
        category: 'institutional_eligibility',
        required: true
      },
      {
        id: 'TEACH_110_2_B',
        pattern: '(performance|display).*is made by, at the direction of, or under the actual supervision of an instructor',
        reference: '17 U.S.C. § 110(2)(B)',
        description: 'Performance/display must be under instructor supervision',
        category: 'instructor_supervision',
        required: true
      },
      {
        id: 'TEACH_110_2_C_I',
        pattern: 'integral part.*class experience.*controlled by.*instructor',
        reference: '17 U.S.C. § 110(2)(C)(i)',
        description: 'Content must be integral part of class experience under instructor control',
        category: 'mediated_instructional_activities',
        required: true
      },
      {
        id: 'TEACH_110_2_C_II',
        pattern: 'analogous.*live classroom setting',
        reference: '17 U.S.C. § 110(2)(C)(ii)',
        description: 'Activity must be analogous to live classroom setting',
        category: 'classroom_analogy',
        required: true
      },
      {
        id: 'TEACH_110_2_D_I',
        pattern: 'students officially enrolled.*course',
        reference: '17 U.S.C. § 110(2)(D)(i)',
        description: 'Transmission limited to officially enrolled students',
        category: 'student_eligibility',
        required: true
      },
      {
        id: 'TEACH_110_2_D_II_A',
        pattern: 'policies regarding copyright',
        reference: '17 U.S.C. § 110(2)(D)(ii)(I)',
        description: 'Institution must have copyright policies',
        category: 'copyright_policies',
        required: true
      },
      {
        id: 'TEACH_110_2_D_II_B',
        pattern: 'informational materials.*copyright.*compliance',
        reference: '17 U.S.C. § 110(2)(D)(ii)(II)',
        description: 'Institution must provide copyright compliance materials',
        category: 'copyright_education',
        required: true
      },
      {
        id: 'TEACH_110_2_D_II_C',
        pattern: 'notice.*copyright protection',
        reference: '17 U.S.C. § 110(2)(D)(ii)(III)',
        description: 'Institution must provide copyright protection notices',
        category: 'copyright_notices',
        required: true
      },
      {
        id: 'TEACH_110_2_E_I',
        pattern: 'technological measures.*prevent.*retention.*longer than.*class session',
        reference: '17 U.S.C. § 110(2)(E)(i)',
        description: 'Technology must prevent retention beyond class session',
        category: 'technological_measures_retention',
        required: true
      },
      {
        id: 'TEACH_110_2_E_II',
        pattern: 'technological measures.*prevent.*unauthorized.*dissemination',
        reference: '17 U.S.C. § 110(2)(E)(ii)',
        description: 'Technology must prevent unauthorized further dissemination',
        category: 'technological_measures_dissemination',
        required: true
      },
      {
        id: 'TEACH_112_F',
        pattern: 'ephemeral recording.*solely.*educational transmission.*destroyed.*end.*class session',
        reference: '17 U.S.C. § 112(f)',
        description: 'Ephemeral recordings must be destroyed at end of class session',
        category: 'ephemeral_recordings',
        required: true
      }
    ];
  }
  
  // Fallback to GDPR requirements if not TEACH Act
  if (regulation.id?.includes('gdpr') || regulation.name?.includes('GDPR')) {
    return [
      {
        id: 'GDPR_ART_6',
        pattern: '(consent|contract|legal obligation|vital interests|public task|legitimate interests)',
        reference: 'GDPR Article 6',
        description: 'Lawful basis for processing must be established',
        category: 'lawful_basis',
        required: true
      },
      {
        id: 'GDPR_ART_13_14',
        pattern: '(data controller|processing purposes|legal basis|retention period)',
        reference: 'GDPR Articles 13-14',
        description: 'Privacy information must be provided',
        category: 'transparency',
        required: true
      },
      {
        id: 'GDPR_ART_32',
        pattern: '(encryption|pseudonymization|technical measures|organizational measures)',
        reference: 'GDPR Article 32',
        description: 'Security of processing measures required',
        category: 'security_measures',
        required: true
      }
    ];
  }
  
  // Generic compliance requirements for other regulations
  console.warn('⚠️ Using generic requirements for regulation:', regulation.id);
  return [
    {
      id: 'GENERIC_POLICY',
      pattern: '(policy|procedure|guideline).*complia',
      reference: 'General Compliance',
      description: 'Institution must have compliance policies',
      category: 'policies',
      required: true
    },
    {
      id: 'GENERIC_TRAINING',
      pattern: '(training|education|awareness).*staff',
      reference: 'General Compliance',
      description: 'Staff training on compliance requirements',
      category: 'training',
      required: true
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
  console.log(`🔍 Validating ${requirement.id}: ${requirement.description}`);
  
  const result = {
    matches: false,
    confidence: 0,
    path: null,
    evidence: [],
    category: requirement.category || 'general'
  };

  try {
    // Convert data to searchable text if it's an object
    const searchText = typeof data === 'string' ? data : JSON.stringify(data);
    
    // Use case-insensitive matching for compliance patterns
    const pattern = new RegExp(requirement.pattern, 'gi');
    const matches = searchText.match(pattern);

    if (matches && matches.length > 0) {
      // Calculate confidence based on pattern strength and match context
      const contextualConfidence = calculateContextualConfidence(
        requirement, 
        matches, 
        searchText
      );
      
      result.confidence = contextualConfidence;
      result.matches = result.confidence >= threshold;
      result.evidence = matches.slice(0, 3); // Top 3 evidence pieces
      result.path = 'compliance_document'; // For compliance validation
      
      console.log(`✅ Found ${matches.length} matches for ${requirement.id} (confidence: ${Math.round(contextualConfidence * 100)}%)`);
    } else {
      // Check for partial compliance or related terms
      const partialMatches = findPartialCompliance(requirement, searchText);
      if (partialMatches.length > 0) {
        result.confidence = 0.3; // Partial compliance
        result.evidence = partialMatches;
        result.path = 'partial_compliance';
        console.log(`⚠️ Partial compliance found for ${requirement.id}`);
      } else {
        console.log(`❌ No evidence found for ${requirement.id}`);
      }
    }
  } catch (error) {
    console.warn(`Error validating requirement ${requirement.id}:`, error);
    result.confidence = 0;
    result.matches = false;
  }

  return result;
}

/**
 * Calculate contextual confidence based on requirement type and evidence quality
 */
function calculateContextualConfidence(requirement, matches, fullText) {
  let baseConfidence = 0.7; // Base confidence for pattern match
  
  // Boost confidence for critical TEACH Act requirements
  if (requirement.category === 'institutional_eligibility' && matches.length > 0) {
    baseConfidence = 0.95; // Very high confidence for institutional status
  } else if (requirement.category === 'technological_measures_retention' || 
             requirement.category === 'technological_measures_dissemination') {
    baseConfidence = 0.85; // High confidence for tech measures
  } else if (requirement.category === 'copyright_policies' && matches.length >= 2) {
    baseConfidence = 0.9; // High confidence if multiple policy references
  }
  
  // Reduce confidence if matches are weak or ambiguous
  const avgMatchLength = matches.reduce((sum, match) => sum + match.length, 0) / matches.length;
  if (avgMatchLength < 10) {
    baseConfidence *= 0.8; // Reduce for short/weak matches
  }
  
  // Boost confidence for multiple strong matches
  if (matches.length > 2 && avgMatchLength > 20) {
    baseConfidence = Math.min(0.98, baseConfidence * 1.1);
  }
  
  return Math.min(0.99, Math.max(0.0, baseConfidence));
}

/**
 * Find partial compliance indicators
 */
function findPartialCompliance(requirement, text) {
  const partialPatterns = [];
  
  // Extract key terms from the requirement pattern
  if (requirement.category === 'copyright_policies') {
    partialPatterns.push(/copyright/gi, /policy/gi, /intellectual property/gi);
  } else if (requirement.category === 'instructor_supervision') {
    partialPatterns.push(/instructor/gi, /teacher/gi, /supervision/gi, /guidance/gi);
  } else if (requirement.category === 'student_eligibility') {
    partialPatterns.push(/enrolled/gi, /student/gi, /registration/gi);
  } else if (requirement.category === 'technological_measures_retention') {
    partialPatterns.push(/technology/gi, /access control/gi, /retention/gi, /session/gi);
  }
  
  const partialMatches = [];
  partialPatterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      partialMatches.push(...matches.slice(0, 2)); // Limit partial matches
    }
  });
  
  return partialMatches;
}

// Legacy utility functions removed - validation logic improved above 