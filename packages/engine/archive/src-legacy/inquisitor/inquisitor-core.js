/**
 * MCP Inquisitor Component
 * 
 * The Inquisitor is responsible for defining validation rules, executing them,
 * collecting evidence, and determining validation certainty levels.
 */

import {
  CERTAINTY_LEVELS,
  EVIDENCE_TYPES,
  createEvidence,
  createValidationResult
} from '../protocol/mcp-validation-protocol.js';

/**
 * Rule Type Definitions
 */
export const RULE_TYPES = {
  TEXT_MATCH: 'text_match',                 // Exact or fuzzy text matching
  PATTERN_MATCH: 'pattern_match',           // Regex pattern matching
  SEMANTIC_SIMILARITY: 'semantic_similarity', // NLP-based semantic comparison
  LOGICAL_CONDITION: 'logical_condition',   // Logical condition (AND, OR, NOT)
  EXTERNAL_VALIDATION: 'external_validation', // Call to external validation service
  METADATA_REQUIREMENT: 'metadata_requirement', // Metadata field requirement check
  COMPLEX_DEPENDENCY: 'complex_dependency',  // Rules with complex dependencies
  AGGREGATE_RULE: 'aggregate_rule'          // Aggregation of multiple rules
};

/**
 * Rule importance levels affect how they influence the certainty
 */
export const RULE_IMPORTANCE = {
  CRITICAL: 'critical',        // Must pass for any validation (certainty A)
  HIGH: 'high',                // Required for certainty level A or B
  MEDIUM: 'medium',            // Required for certainty level A, B, or C
  LOW: 'low',                  // Considered for all certainty levels but not required
  INFORMATIONAL: 'informational' // Not used for validation, just provides context
};

/**
 * Class representing a validation rule
 */
export class ValidationRule {
  /**
   * Create a validation rule
   * 
   * @param {Object} config - Rule configuration
   */
  constructor(config) {
    this.id = config.id || `rule-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    this.name = config.name || 'Unnamed Rule';
    this.description = config.description || '';
    this.type = config.type || RULE_TYPES.TEXT_MATCH;
    this.importance = config.importance || RULE_IMPORTANCE.MEDIUM;
    this.parameters = config.parameters || {};
    this.certaintyLevelRequired = config.certaintyLevelRequired || CERTAINTY_LEVELS.C;
    this.version = config.version || '1.0';
    this.tags = config.tags || [];
    this.dependencies = config.dependencies || [];
    this.validator = config.validator || null;
  }
  
  /**
   * Validate content using this rule
   * 
   * @param {Object} content - The content to validate
   * @param {Object} context - Additional context information
   * @returns {Object} Validation result including evidence
   */
  async validate(content, context = {}) {
    if (!this.validator || typeof this.validator !== 'function') {
      throw new Error(`No validator function defined for rule ${this.id}`);
    }
    
    try {
      const validationStart = Date.now();
      const validatorResult = await this.validator(content, this.parameters, context);
      const validationTime = Date.now() - validationStart;
      
      // Extract result properties
      const {
        isValid = false,
        confidence = 0,
        evidenceData = {},
        message = ''
      } = validatorResult;
      
      // Create evidence object
      const evidence = createEvidence(
        this.type === RULE_TYPES.TEXT_MATCH ? EVIDENCE_TYPES.TEXT_MATCH : 
        this.type === RULE_TYPES.PATTERN_MATCH ? EVIDENCE_TYPES.PATTERN_MATCH :
        this.type === RULE_TYPES.SEMANTIC_SIMILARITY ? EVIDENCE_TYPES.SEMANTIC_MATCH :
        this.type === RULE_TYPES.LOGICAL_CONDITION ? EVIDENCE_TYPES.LOGICAL_INFERENCE :
        EVIDENCE_TYPES.CONTEXTUAL_ANALYSIS,
        `Rule "${this.name}" ${isValid ? 'passed' : 'failed'}: ${message}`,
        {
          ...evidenceData,
          rule_id: this.id,
          rule_type: this.type,
          importance: this.importance,
          validation_time_ms: validationTime
        },
        confidence
      );
      
      return {
        ruleId: this.id,
        ruleName: this.name,
        passed: isValid,
        importance: this.importance,
        confidence,
        evidence: [evidence],
        message: message || (isValid ? `Validation passed for rule "${this.name}"` : `Validation failed for rule "${this.name}"`)
      };
    } catch (error) {
      // Create evidence for error
      const evidence = createEvidence(
        EVIDENCE_TYPES.LOGICAL_INFERENCE,
        `Error executing rule "${this.name}": ${error.message}`,
        {
          rule_id: this.id,
          rule_type: this.type,
          error: error.message,
          stack: error.stack
        },
        0
      );
      
      return {
        ruleId: this.id,
        ruleName: this.name,
        passed: false,
        importance: this.importance,
        confidence: 0,
        evidence: [evidence],
        message: `Error in rule "${this.name}": ${error.message}`
      };
    }
  }
}

/**
 * Class representing a rule set (group of related validation rules)
 */
export class ValidationRuleSet {
  /**
   * Create a validation rule set
   * 
   * @param {Object} config - Rule set configuration
   */
  constructor(config) {
    this.id = config.id || `ruleset-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    this.name = config.name || 'Unnamed Rule Set';
    this.description = config.description || '';
    this.version = config.version || '1.0';
    this.rules = config.rules || [];
    this.requiredRulePasses = config.requiredRulePasses || 0;
    this.tags = config.tags || [];
  }
  
  /**
   * Add a rule to the rule set
   * 
   * @param {ValidationRule} rule - The rule to add
   */
  addRule(rule) {
    if (!(rule instanceof ValidationRule)) {
      throw new Error('Only ValidationRule instances can be added to a rule set');
    }
    this.rules.push(rule);
  }
  
  /**
   * Validate content using all rules in the set
   * 
   * @param {Object} content - The content to validate
   * @param {Object} context - Additional context information
   * @returns {Object} Aggregated validation results
   */
  async validate(content, context = {}) {
    const ruleResults = await Promise.all(
      this.rules.map(rule => rule.validate(content, context))
    );
    
    // Count passes
    const passedRules = ruleResults.filter(result => result.passed);
    const totalRules = ruleResults.length;
    
    // Calculate overall confidence
    const weightedConfidence = ruleResults.reduce((sum, result) => {
      const importanceWeight = 
        result.importance === RULE_IMPORTANCE.CRITICAL ? 5 :
        result.importance === RULE_IMPORTANCE.HIGH ? 3 :
        result.importance === RULE_IMPORTANCE.MEDIUM ? 2 :
        result.importance === RULE_IMPORTANCE.LOW ? 1 : 0;
        
      return sum + (result.confidence * importanceWeight);
    }, 0);
    
    const totalWeight = ruleResults.reduce((sum, result) => {
      const importanceWeight = 
        result.importance === RULE_IMPORTANCE.CRITICAL ? 5 :
        result.importance === RULE_IMPORTANCE.HIGH ? 3 :
        result.importance === RULE_IMPORTANCE.MEDIUM ? 2 :
        result.importance === RULE_IMPORTANCE.LOW ? 1 : 0;
        
      return sum + (importanceWeight * 100);
    }, 0);
    
    const overallConfidence = totalWeight > 0 ? weightedConfidence / totalWeight * 100 : 0;
    
    // Determine certainty level based on confidence and critical rules
    let certaintyLevel = CERTAINTY_LEVELS.D;
    const allCriticalPassed = ruleResults
      .filter(result => result.importance === RULE_IMPORTANCE.CRITICAL)
      .every(result => result.passed);
      
    if (overallConfidence >= 90 && allCriticalPassed) {
      certaintyLevel = CERTAINTY_LEVELS.A;
    } else if (overallConfidence >= 75 && allCriticalPassed) {
      certaintyLevel = CERTAINTY_LEVELS.B;
    } else if (overallConfidence >= 50) {
      certaintyLevel = CERTAINTY_LEVELS.C;
    }
    
    // Combine all evidence
    const allEvidence = ruleResults.flatMap(result => result.evidence);
    
    // Determine overall pass/fail
    const requiredPasses = this.requiredRulePasses || 
      (ruleResults.some(r => r.importance === RULE_IMPORTANCE.CRITICAL) ? 
        ruleResults.length : // If there are critical rules, all must pass
        Math.ceil(ruleResults.length * 0.7)); // Otherwise 70% must pass
        
    const isValid = passedRules.length >= requiredPasses && allCriticalPassed;
    
    // Create message
    const message = isValid
      ? `Validation passed: ${passedRules.length} of ${totalRules} rules passed (${Math.round(overallConfidence)}% confidence)`
      : `Validation failed: ${passedRules.length} of ${totalRules} rules passed (${Math.round(overallConfidence)}% confidence)`;
      
    return {
      ruleSetId: this.id,
      ruleSetName: this.name,
      passed: isValid,
      passedRules: passedRules.length,
      totalRules,
      confidence: overallConfidence,
      certaintyLevel,
      evidence: allEvidence,
      ruleResults,
      message
    };
  }
}

/**
 * Class representing the main Inquisitor component
 */
export class Inquisitor {
  /**
   * Create an Inquisitor instance
   * 
   * @param {Object} config - Configuration
   */
  constructor(config = {}) {
    this.ruleSets = config.ruleSets || [];
    this.validators = config.validators || {};
    this.evidenceCollector = config.evidenceCollector || new EvidenceCollector();
  }
  
  /**
   * Add a rule set to the Inquisitor
   * 
   * @param {ValidationRuleSet} ruleSet - The rule set to add
   */
  addRuleSet(ruleSet) {
    if (!(ruleSet instanceof ValidationRuleSet)) {
      throw new Error('Only ValidationRuleSet instances can be added to the Inquisitor');
    }
    this.ruleSets.push(ruleSet);
  }
  
  /**
   * Register a validator function for a specific rule type
   * 
   * @param {string} ruleType - The rule type
   * @param {Function} validatorFn - The validator function
   */
  registerValidator(ruleType, validatorFn) {
    if (typeof validatorFn !== 'function') {
      throw new Error('Validator must be a function');
    }
    this.validators[ruleType] = validatorFn;
  }
  
  /**
   * Execute validation against all rule sets
   * 
   * @param {Object} content - The content to validate
   * @param {Object} context - Additional context information
   * @returns {Object} Validation result with certainty level and evidence
   */
  async validate(content, context = {}) {
    if (!this.ruleSets.length) {
      throw new Error('No rule sets defined for validation');
    }
    
    // Execute all rule sets
    const ruleSetResults = await Promise.all(
      this.ruleSets.map(ruleSet => ruleSet.validate(content, context))
    );
    
    // Collect all evidence
    const allEvidence = ruleSetResults.flatMap(result => result.evidence);
    
    // Determine overall certainty level - take the lowest certainty from results
    const certaintyLevels = ruleSetResults.map(result => result.certaintyLevel);
    const lowestCertaintyLevel = this.determineLowestCertaintyLevel(certaintyLevels);
    
    // Determine overall pass/fail
    const allPassed = ruleSetResults.every(result => result.passed);
    
    // Calculate overall confidence
    const overallConfidence = ruleSetResults.reduce((sum, result) => sum + result.confidence, 0) / ruleSetResults.length;
    
    // Create detailed message
    const passCount = ruleSetResults.filter(result => result.passed).length;
    const totalCount = ruleSetResults.length;
    const message = allPassed
      ? `All ${totalCount} rule sets passed validation with ${lowestCertaintyLevel} certainty (${Math.round(overallConfidence)}% confidence)`
      : `${passCount} of ${totalCount} rule sets passed validation with ${lowestCertaintyLevel} certainty (${Math.round(overallConfidence)}% confidence)`;
    
    // Return formatted validation result
    return createValidationResult(
      allPassed,
      lowestCertaintyLevel,
      allEvidence,
      message
    );
  }
  
  /**
   * Determine the lowest certainty level from a list
   * 
   * @param {Array} certaintyLevels - List of certainty levels
   * @returns {string} The lowest certainty level
   */
  determineLowestCertaintyLevel(certaintyLevels) {
    const levelRanking = {
      [CERTAINTY_LEVELS.A]: 4,
      [CERTAINTY_LEVELS.B]: 3,
      [CERTAINTY_LEVELS.C]: 2,
      [CERTAINTY_LEVELS.D]: 1
    };
    
    let lowestRank = 5; // Higher than any rank
    let lowestLevel = CERTAINTY_LEVELS.A;
    
    for (const level of certaintyLevels) {
      const rank = levelRanking[level] || 0;
      if (rank < lowestRank) {
        lowestRank = rank;
        lowestLevel = level;
      }
    }
    
    return lowestLevel;
  }
}

/**
 * Class responsible for collecting and organizing validation evidence
 */
export class EvidenceCollector {
  constructor() {
    this.evidenceStore = [];
  }
  
  /**
   * Add evidence to the collector
   * 
   * @param {Object} evidence - The evidence object
   */
  addEvidence(evidence) {
    this.evidenceStore.push({
      ...evidence,
      collected_at: new Date().toISOString()
    });
  }
  
  /**
   * Get all collected evidence
   * 
   * @returns {Array} All evidence items
   */
  getAllEvidence() {
    return [...this.evidenceStore];
  }
  
  /**
   * Filter evidence by specific criteria
   * 
   * @param {Function} filterFn - Filter function
   * @returns {Array} Filtered evidence items
   */
  filterEvidence(filterFn) {
    return this.evidenceStore.filter(filterFn);
  }
  
  /**
   * Clear all evidence
   */
  clearEvidence() {
    this.evidenceStore = [];
  }
}

export default {
  RULE_TYPES,
  RULE_IMPORTANCE,
  ValidationRule,
  ValidationRuleSet,
  Inquisitor,
  EvidenceCollector
}; 