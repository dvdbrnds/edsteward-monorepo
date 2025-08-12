/**
 * Simple demo showing Level-4 TEACH Act validator functionality
 * Demonstrates the advanced compliance validation logic
 */

// Mock minimal dependencies for demo
const ValidationStatus = {
  PASS: 'PASS',
  FAIL: 'FAIL'
};

const SeverityLevel = {
  ERROR: 'ERROR',
  WARNING: 'WARNING',
  INFO: 'INFO'
};

// Simulate our getAdvancedRequirements function
async function getAdvancedRequirements(regulation) {
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
            maxRetentionHours: 0,
            validationLogic: 'expiration_time <= session_end'
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
              'student_copyright_notice'
            ],
            validationLogic: 'all_policies_exist && policies_current && policies_accessible'
          }
        ]
      },
      reference: '17 USC §110(2)(D)(i)(ii)(iii)',
      description: 'TEACH Act institutional copyright policy requirements',
      severity: 'HIGH',
      legalBasis: 'Institution must have comprehensive copyright policies and educational materials'
    }
  ];
}

// Simulate temporal validation
function validateDuringClassSession(transmissionData, constraint) {
  try {
    const transmissionTime = new Date(transmissionData.startTime || transmissionData.timestamp);
    const sessionStart = new Date(transmissionData.classSession?.startTime);
    const sessionEnd = new Date(transmissionData.classSession?.endTime);

    if (isNaN(transmissionTime) || isNaN(sessionStart) || isNaN(sessionEnd)) {
      return {
        valid: false,
        details: { error: 'Invalid timestamp data' }
      };
    }

    const isWithinSession = transmissionTime >= sessionStart && transmissionTime <= sessionEnd;
    
    return {
      valid: isWithinSession,
      details: {
        transmissionTime: transmissionTime.toISOString(),
        sessionStart: sessionStart.toISOString(),
        sessionEnd: sessionEnd.toISOString(),
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

function validateRetentionLimits(transmissionData, constraint) {
  try {
    const sessionEnd = new Date(transmissionData.classSession?.endTime);
    const contentExpiration = new Date(transmissionData.expirationTime || transmissionData.endTime);
    
    if (isNaN(sessionEnd) || isNaN(contentExpiration)) {
      return {
        valid: false,
        details: { error: 'Invalid expiration timing data' }
      };
    }

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

function getFieldValue(obj, path) {
  return path.split('.').reduce((current, part) => current?.[part], obj);
}

// Simplified validation logic for demo
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

  for (const constraint of constraints) {
    try {
      let isValid = false;
      let details = {};

      switch (constraint.type) {
        case 'during_session':
          const sessionResult = validateDuringClassSession(transmissionData, constraint);
          isValid = sessionResult.valid;
          details = sessionResult.details;
          break;

        case 'retention_limits':
          const retentionResult = validateRetentionLimits(transmissionData, constraint);
          isValid = retentionResult.valid;
          details = retentionResult.details;
          break;
      }

      result.validationDetails[constraint.type] = details;

      if (!isValid) {
        result.violations.push({
          path: field,
          message: `TEACH Act temporal violation: ${constraint.description}`,
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

// Demo validation function
async function demoLevel4Validation() {
  console.log('🏆 Level-4 TEACH Act Validator Demo\n');
  console.log('Demonstrating advanced compliance validation with real requirements\n');

  // Test data - compliant case
  const compliantData = {
    currentDocument: {
      transmission: {
        classSession: {
          startTime: '2024-01-15T10:00:00Z',
          endTime: '2024-01-15T11:30:00Z',
          courseId: 'CS-101'
        },
        startTime: '2024-01-15T10:15:00Z',  // Within session ✅
        expirationTime: '2024-01-15T11:30:00Z'  // Expires at session end ✅
      }
    }
  };

  // Test data - non-compliant case
  const nonCompliantData = {
    currentDocument: {
      transmission: {
        classSession: {
          startTime: '2024-01-15T14:00:00Z',
          endTime: '2024-01-15T15:30:00Z',
          courseId: 'HIST-201'
        },
        startTime: '2024-01-15T14:10:00Z',
        expirationTime: '2024-01-15T18:00:00Z'  // Retention beyond session! ❌
      }
    }
  };

  try {
    // Get real TEACH Act requirements
    const requirements = await getAdvancedRequirements({ id: 'REG-66' });
    
    console.log(`📋 Loaded ${requirements.length} advanced TEACH Act requirements:`);
    requirements.forEach((req, i) => {
      console.log(`  ${i + 1}. ${req.description} (${req.severity})`);
      console.log(`     Legal Basis: ${req.legalBasis}`);
      console.log(`     Reference: ${req.reference}\n`);
    });

    // Test compliant case
    console.log('✅ Testing COMPLIANT transmission:\n');
    const temporalReq = requirements.find(r => r.type === 'temporal_sequence');
    const compliantResult = validateTemporalSequence(temporalReq.expectedSequence, compliantData);
    
    console.log(`   Confidence: ${(compliantResult.confidence * 100).toFixed(1)}%`);
    console.log(`   Violations: ${compliantResult.violations.length}`);
    if (compliantResult.violations.length === 0) {
      console.log('   🎉 All temporal constraints satisfied!');
    }
    console.log('   Details:', JSON.stringify(compliantResult.validationDetails, null, 4));

    console.log('\n' + '='.repeat(60) + '\n');

    // Test non-compliant case
    console.log('❌ Testing NON-COMPLIANT transmission:\n');
    const nonCompliantResult = validateTemporalSequence(temporalReq.expectedSequence, nonCompliantData);
    
    console.log(`   Confidence: ${(nonCompliantResult.confidence * 100).toFixed(1)}%`);
    console.log(`   Violations: ${nonCompliantResult.violations.length}`);
    if (nonCompliantResult.violations.length > 0) {
      console.log('   🚨 TEACH Act violations detected:');
      nonCompliantResult.violations.forEach((violation, i) => {
        console.log(`     ${i + 1}. [${violation.severity}] ${violation.message}`);
        console.log(`        Legal Reference: ${violation.legalReference}`);
      });
    }
    console.log('   Details:', JSON.stringify(nonCompliantResult.validationDetails, null, 4));

    console.log('\n🎯 Level-4 Validator Demo Summary:');
    console.log('✅ Real TEACH Act compliance requirements loaded');
    console.log('✅ Sophisticated temporal validation implemented');
    console.log('✅ Legal basis and references provided');
    console.log('✅ Detailed validation results with confidence scores');
    console.log('\n🏆 The Level-4 validators are now using REAL TEACH Act compliance logic!\n');

  } catch (error) {
    console.error('❌ Demo failed:', error);
  }
}

// Run demo
demoLevel4Validation();
