// src/lambda/orchestrator/aggregator.js
/**
 * MCP Result Aggregator
 * 
 * This module aggregates results from multiple validators into a single consolidated
 * validation result.
 */

const { ValidationStatus, SeverityLevel } = require('../../common/mcp/protocol');

/**
 * Aggregate validation results from multiple validators
 * 
 * @param {Array} validationResults - Array of results from validators
 * @returns {Object} Aggregated validation result
 */
function aggregateResults(validationResults) {
  console.log('Aggregating results from', validationResults.length, 'validators');
  
  if (!validationResults || validationResults.length === 0) {
    return createEmptyResult();
  }
  
  // Extract findings from all validators
  const allFindings = [];
  let hasErrors = false;
  let hasWarnings = false;
  
  for (const result of validationResults) {
    // Skip results with errors
    if (result.error) {
      console.warn(`Skipping result from ${result.validatorType} due to error:`, result.error);
      continue;
    }
    
    // Process findings
    if (result.findings && Array.isArray(result.findings)) {
      // Add validator type to each finding for tracking
      const processedFindings = result.findings.map(finding => ({
        ...finding,
        validatorType: result.validatorType
      }));
      
      // Check for errors and warnings
      for (const finding of processedFindings) {
        if (finding.severity === SeverityLevel.ERROR) {
          hasErrors = true;
        } else if (finding.severity === SeverityLevel.WARNING) {
          hasWarnings = true;
        }
      }
      
      // Add to combined findings
      allFindings.push(...processedFindings);
    }
  }
  
  // Deduplicate findings (may have overlaps from different validators)
  const deduplicatedFindings = deduplicateFindings(allFindings);
  
  // Determine overall status
  let status = ValidationStatus.PASS;
  if (hasErrors) {
    status = ValidationStatus.FAIL;
  } else if (hasWarnings) {
    status = ValidationStatus.PARTIAL;
  }
  
  // Calculate confidence
  const confidence = calculateConfidence(
    deduplicatedFindings, 
    deduplicatedFindings.length + 1 // Add 1 to avoid division by zero
  );
  
  return {
    status,
    confidence,
    findings: deduplicatedFindings
  };
}

/**
 * Create empty result for when no validators are executed
 * 
 * @returns {Object} Empty validation result
 */
function createEmptyResult() {
  return {
    status: ValidationStatus.FAIL,
    confidence: 0,
    findings: [{
      id: 'find-system-001',
      path: '',
      severity: SeverityLevel.ERROR,
      message: 'No validators were executed for this regulation',
      reference: 'SYSTEM'
    }]
  };
}

/**
 * Deduplicate findings from multiple validators
 * 
 * @param {Array} findings - Combined findings from all validators
 * @returns {Array} Deduplicated findings
 */
function deduplicateFindings(findings) {
  if (!findings || findings.length === 0) {
    return [];
  }
  
  // Create a map to track findings by path and message
  const findingMap = new Map();
  
  for (const finding of findings) {
    const key = `${finding.path}:${finding.message}`;
    
    if (!findingMap.has(key)) {
      // New finding, add to map
      findingMap.set(key, finding);
    } else {
      // Existing finding, keep the one with highest severity
      const existingFinding = findingMap.get(key);
      if (getSeverityWeight(finding.severity) > getSeverityWeight(existingFinding.severity)) {
        findingMap.set(key, finding);
      }
    }
  }
  
  // Convert map back to array and sort findings
  const deduplicatedFindings = Array.from(findingMap.values());
  
  // Sort by severity (highest first) then by path
  return deduplicatedFindings.sort((a, b) => {
    const severityDiff = getSeverityWeight(b.severity) - getSeverityWeight(a.severity);
    if (severityDiff !== 0) {
      return severityDiff;
    }
    return a.path.localeCompare(b.path);
  });
}

/**
 * Get numeric weight for severity level for sorting
 * 
 * @param {string} severity - Severity level from SeverityLevel enum
 * @returns {number} Numeric weight (higher = more severe)
 */
function getSeverityWeight(severity) {
  switch (severity) {
    case SeverityLevel.ERROR:
      return 3;
    case SeverityLevel.WARNING:
      return 2;
    case SeverityLevel.INFO:
      return 1;
    default:
      return 0;
  }
}

/**
 * Calculate confidence score based on findings
 * 
 * @param {Array} findings - Array of validation findings
 * @param {number} totalRules - Total number of validation rules applied
 * @returns {number} Confidence score between 0 and 1
 */
function calculateConfidence(findings, totalRules) {
  if (!findings || findings.length === 0) return 1.0;
  if (!totalRules || totalRules <= 0) return 0.0;
  
  // Weight factors for different severity levels
  const errorWeight = 0.6;
  const warningWeight = 0.3;
  const infoWeight = 0.1;
  
  // Count findings by severity
  let errorCount = 0;
  let warningCount = 0;
  let infoCount = 0;
  
  findings.forEach(finding => {
    if (finding.severity === SeverityLevel.ERROR) errorCount++;
    else if (finding.severity === SeverityLevel.WARNING) warningCount++;
    else if (finding.severity === SeverityLevel.INFO) infoCount++;
  });
  
  // Calculate weighted sum of issues
  const weightedIssues = (errorCount * errorWeight) + 
                         (warningCount * warningWeight) + 
                         (infoCount * infoWeight);
  
  // Calculate confidence score (higher is better)
  return Math.max(0, Math.min(1, 1 - (weightedIssues / totalRules)));
}

module.exports = {
  aggregateResults
};
