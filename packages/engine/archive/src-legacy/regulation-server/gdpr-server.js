/**
 * GDPR MCP Validation Server
 * 
 * Implements a GDPR-specific MCP server that validates content against GDPR regulations.
 */

import { BaseRegulationServer } from './base-regulation-server.js';
import { CERTAINTY_LEVELS, EVIDENCE_TYPES, createEvidence } from '../protocol/mcp-validation-protocol.js';

// GDPR rule types
const GDPR_RULE_TYPES = {
  PII_DETECTION: 'pii_detection',
  CONSENT_VERIFICATION: 'consent_verification',
  DATA_TRANSFER: 'data_transfer',
  DATA_RETENTION: 'data_retention',
  SUBJECT_RIGHTS: 'subject_rights'
};

/**
 * GDPR-specific MCP server implementation
 */
export class GdprServer extends BaseRegulationServer {
  /**
   * Create a new GDPR validation server
   * 
   * @param {Object} options - Server configuration options
   */
  constructor(options = {}) {
    super({
      regulationId: "GDPR",
      name: options.name || "gdpr-validation-server",
      version: options.version || "1.0.0",
      description: options.description || "MCP Server for GDPR compliance validation",
      ...options
    });
    
    // Initialize GDPR-specific capabilities
    this.capabilities.gdpr_version = "2016/679";
    this.capabilities.applicable_regions = ["EU", "EEA"];
    this.capabilities.rule_types = Object.values(GDPR_RULE_TYPES);
    
    // Register default GDPR validation rules
    this._registerDefaultRules();
  }
  
  /**
   * Register default GDPR validation rules
   */
  _registerDefaultRules() {
    // PII Detection Rules
    this.registerValidationRule("GDPR-PII-001", {
      name: "Personal Data Detection",
      description: "Detects personal identifiable information in content",
      type: GDPR_RULE_TYPES.PII_DETECTION,
      importance: "HIGH",
      validate: async (content, validationType, context) => {
        const result = await this._detectPersonalData(content);
        
        return {
          compliant: result.personalDataCount === 0,
          certainty: result.personalDataCount === 0 ? CERTAINTY_LEVELS.B : CERTAINTY_LEVELS.A,
          evidence: [
            createEvidence({
              type: EVIDENCE_TYPES.PATTERN_MATCH,
              content: `Found ${result.personalDataCount} personal data items`,
              details: {
                items: result.items,
                detection_method: "pattern_matching"
              },
              certainty: CERTAINTY_LEVELS.A
            })
          ]
        };
      }
    });
    
    this.registerValidationRule("GDPR-PII-002", {
      name: "Special Category Data Detection",
      description: "Detects special category data (sensitive data) in content",
      type: GDPR_RULE_TYPES.PII_DETECTION,
      importance: "CRITICAL",
      validate: async (content, validationType, context) => {
        const result = await this._detectSpecialCategoryData(content);
        
        return {
          compliant: result.sensitiveDataCount === 0,
          certainty: result.sensitiveDataCount === 0 ? CERTAINTY_LEVELS.C : CERTAINTY_LEVELS.B,
          evidence: [
            createEvidence({
              type: EVIDENCE_TYPES.PATTERN_MATCH,
              content: `Found ${result.sensitiveDataCount} sensitive data items`,
              details: {
                items: result.items,
                detection_method: "semantic_analysis"
              },
              certainty: CERTAINTY_LEVELS.B
            })
          ]
        };
      }
    });
    
    // Consent Verification Rules
    this.registerValidationRule("GDPR-CONSENT-001", {
      name: "Explicit Consent Verification",
      description: "Verifies that explicit consent statements are present and valid",
      type: GDPR_RULE_TYPES.CONSENT_VERIFICATION,
      importance: "CRITICAL",
      validate: async (content, validationType, context) => {
        const result = await this._verifyExplicitConsent(content);
        
        return {
          compliant: result.validConsent,
          certainty: result.validConsent ? CERTAINTY_LEVELS.B : CERTAINTY_LEVELS.B,
          evidence: [
            createEvidence({
              type: EVIDENCE_TYPES.SEMANTIC_MATCH,
              content: result.validConsent ? 
                "Valid explicit consent found" : 
                "No valid explicit consent found",
              details: {
                consent_statements: result.consentStatements,
                validity_score: result.validityScore
              },
              certainty: CERTAINTY_LEVELS.B
            })
          ]
        };
      }
    });
    
    // Data Transfer Rules
    this.registerValidationRule("GDPR-TRANSFER-001", {
      name: "International Transfer Safeguards",
      description: "Checks for appropriate safeguards for international data transfers",
      type: GDPR_RULE_TYPES.DATA_TRANSFER,
      importance: "HIGH",
      validate: async (content, validationType, context) => {
        const result = await this._checkInternationalTransfers(content);
        
        return {
          compliant: result.hasAdequateSafeguards,
          certainty: CERTAINTY_LEVELS.C,
          evidence: [
            createEvidence({
              type: EVIDENCE_TYPES.CONTEXTUAL_ANALYSIS,
              content: result.hasAdequateSafeguards ? 
                "Adequate safeguards for international transfers found" : 
                "No adequate safeguards for international transfers found",
              details: {
                transfer_mechanisms: result.transferMechanisms,
                countries_mentioned: result.countriesMentioned
              },
              certainty: CERTAINTY_LEVELS.C
            })
          ]
        };
      }
    });
    
    // Data Retention Rules
    this.registerValidationRule("GDPR-RETENTION-001", {
      name: "Data Retention Limits",
      description: "Verifies that appropriate data retention limits are specified",
      type: GDPR_RULE_TYPES.DATA_RETENTION,
      importance: "MEDIUM",
      validate: async (content, validationType, context) => {
        const result = await this._checkDataRetentionLimits(content);
        
        return {
          compliant: result.hasRetentionLimits,
          certainty: CERTAINTY_LEVELS.C,
          evidence: [
            createEvidence({
              type: EVIDENCE_TYPES.SEMANTIC_MATCH,
              content: result.hasRetentionLimits ? 
                "Data retention limits found" : 
                "No data retention limits found",
              details: {
                retention_periods: result.retentionPeriods,
                retention_justification: result.retentionJustification
              },
              certainty: CERTAINTY_LEVELS.C
            })
          ]
        };
      }
    });
    
    // Subject Rights Rules
    this.registerValidationRule("GDPR-RIGHTS-001", {
      name: "Data Subject Rights",
      description: "Checks if data subject rights information is provided",
      type: GDPR_RULE_TYPES.SUBJECT_RIGHTS,
      importance: "MEDIUM",
      validate: async (content, validationType, context) => {
        const result = await this._checkDataSubjectRights(content);
        
        return {
          compliant: result.rightsInformationProvided,
          certainty: CERTAINTY_LEVELS.B,
          evidence: [
            createEvidence({
              type: EVIDENCE_TYPES.SEMANTIC_MATCH,
              content: result.rightsInformationProvided ? 
                "Data subject rights information provided" : 
                "No data subject rights information provided",
              details: {
                rights_mentioned: result.rightsMentioned,
                comprehensiveness: result.comprehensiveness
              },
              certainty: CERTAINTY_LEVELS.B
            })
          ]
        };
      }
    });
  }
  
  /**
   * Detect personal data in content
   * 
   * @param {Object} content - Content to analyze
   * @returns {Promise<Object>} Detection result
   */
  async _detectPersonalData(content) {
    // Mock implementation for testing purposes
    const contentStr = JSON.stringify(content);
    const piiPatterns = [
      { type: "email", regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g },
      { type: "phone", regex: /(\+\d{1,3})?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g },
      { type: "ssn", regex: /\d{3}-\d{2}-\d{4}/g },
      { type: "credit_card", regex: /\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/g },
      { type: "ip_address", regex: /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/g }
    ];
    
    const items = [];
    for (const pattern of piiPatterns) {
      const matches = contentStr.match(pattern.regex) || [];
      if (matches.length > 0) {
        items.push({
          type: pattern.type,
          count: matches.length,
          examples: matches.slice(0, 2) // Only keep a couple of examples
        });
      }
    }
    
    return {
      personalDataCount: items.reduce((count, item) => count + item.count, 0),
      items
    };
  }
  
  /**
   * Detect special category data in content
   * 
   * @param {Object} content - Content to analyze
   * @returns {Promise<Object>} Detection result
   */
  async _detectSpecialCategoryData(content) {
    // Mock implementation for testing purposes
    const contentStr = JSON.stringify(content).toLowerCase();
    const sensitiveCategories = [
      { type: "racial", terms: ["race", "ethnicity", "ethnic origin", "skin color"] },
      { type: "political", terms: ["political", "politics", "voting", "election"] },
      { type: "religious", terms: ["religion", "religious", "faith", "belief"] },
      { type: "health", terms: ["health", "medical", "disease", "condition", "diagnosis"] },
      { type: "biometric", terms: ["biometric", "fingerprint", "facial recognition", "dna"] }
    ];
    
    const items = [];
    for (const category of sensitiveCategories) {
      const matches = category.terms.filter(term => contentStr.includes(term));
      if (matches.length > 0) {
        items.push({
          type: category.type,
          count: matches.length,
          matched_terms: matches
        });
      }
    }
    
    return {
      sensitiveDataCount: items.reduce((count, item) => count + item.count, 0),
      items
    };
  }
  
  /**
   * Verify explicit consent in content
   * 
   * @param {Object} content - Content to analyze
   * @returns {Promise<Object>} Verification result
   */
  async _verifyExplicitConsent(content) {
    // Mock implementation for testing purposes
    const contentStr = JSON.stringify(content).toLowerCase();
    
    const consentStatements = [];
    const consentPatterns = [
      "i consent to",
      "i agree to",
      "i explicitly consent",
      "opt-in",
      "i accept the"
    ];
    
    let validityScore = 0;
    for (const pattern of consentPatterns) {
      if (contentStr.includes(pattern)) {
        consentStatements.push(pattern);
        validityScore += 20; // Each match adds 20 points
      }
    }
    
    // Check for negative patterns that would invalidate consent
    const negativePatterns = [
      "pre-checked",
      "automatically enrolled",
      "by default"
    ];
    
    for (const pattern of negativePatterns) {
      if (contentStr.includes(pattern)) {
        validityScore -= 30; // Each negative match reduces score
      }
    }
    
    // Clamp validity score between 0-100
    validityScore = Math.max(0, Math.min(100, validityScore));
    
    return {
      validConsent: validityScore >= 60,
      consentStatements,
      validityScore
    };
  }
  
  /**
   * Check international transfers in content
   * 
   * @param {Object} content - Content to analyze
   * @returns {Promise<Object>} Check result
   */
  async _checkInternationalTransfers(content) {
    // Mock implementation for testing purposes
    const contentStr = JSON.stringify(content).toLowerCase();
    
    const countries = [
      // EU countries
      "austria", "belgium", "bulgaria", "croatia", "cyprus", "czech republic", 
      "denmark", "estonia", "finland", "france", "germany", "greece", "hungary", 
      "ireland", "italy", "latvia", "lithuania", "luxembourg", "malta", "netherlands", 
      "poland", "portugal", "romania", "slovakia", "slovenia", "spain", "sweden",
      // Non-EU countries
      "united states", "canada", "australia", "china", "russia", "india", "brazil", 
      "japan", "south korea"
    ];
    
    const transferMechanisms = [
      "standard contractual clauses",
      "binding corporate rules",
      "adequacy decision",
      "explicit consent",
      "privacy shield"
    ];
    
    const countriesMentioned = countries.filter(country => 
      contentStr.includes(country)
    );
    
    const mechanismsFound = transferMechanisms.filter(mechanism => 
      contentStr.includes(mechanism)
    );
    
    return {
      hasAdequateSafeguards: mechanismsFound.length > 0,
      transferMechanisms: mechanismsFound,
      countriesMentioned
    };
  }
  
  /**
   * Check data retention limits in content
   * 
   * @param {Object} content - Content to analyze
   * @returns {Promise<Object>} Check result
   */
  async _checkDataRetentionLimits(content) {
    // Mock implementation for testing purposes
    const contentStr = JSON.stringify(content).toLowerCase();
    
    const retentionPatterns = [
      { period: "days", regex: /(\d+)\s*days?/g },
      { period: "weeks", regex: /(\d+)\s*weeks?/g },
      { period: "months", regex: /(\d+)\s*months?/g },
      { period: "years", regex: /(\d+)\s*years?/g }
    ];
    
    const retentionPeriods = [];
    for (const pattern of retentionPatterns) {
      const matches = contentStr.match(pattern.regex) || [];
      for (const match of matches) {
        retentionPeriods.push(match);
      }
    }
    
    // Look for retention justification
    const justificationPatterns = [
      "retain for", "retention period", "stored for", "kept for", 
      "legal requirement", "business purpose"
    ];
    
    const justificationMatches = justificationPatterns.filter(pattern => 
      contentStr.includes(pattern)
    );
    
    return {
      hasRetentionLimits: retentionPeriods.length > 0,
      retentionPeriods,
      retentionJustification: justificationMatches
    };
  }
  
  /**
   * Check data subject rights in content
   * 
   * @param {Object} content - Content to analyze
   * @returns {Promise<Object>} Check result
   */
  async _checkDataSubjectRights(content) {
    // Mock implementation for testing purposes
    const contentStr = JSON.stringify(content).toLowerCase();
    
    const subjectRights = [
      "right to access",
      "right to rectification",
      "right to erasure",
      "right to be forgotten",
      "right to restriction",
      "right to data portability",
      "right to object",
      "rights related to automated decision making",
      "right to withdraw consent"
    ];
    
    const rightsMentioned = subjectRights.filter(right => 
      contentStr.includes(right)
    );
    
    // Calculate comprehensiveness score (0-100)
    const comprehensiveness = Math.round((rightsMentioned.length / subjectRights.length) * 100);
    
    return {
      rightsInformationProvided: rightsMentioned.length > 0,
      rightsMentioned,
      comprehensiveness
    };
  }
}

export default GdprServer; 