/**
 * HIPAA MCP Validation Server
 * 
 * Implements a HIPAA-specific MCP server that validates content against HIPAA regulations.
 */

import { BaseRegulationServer } from './base-regulation-server.js';
import { CERTAINTY_LEVELS, EVIDENCE_TYPES, createEvidence } from '../protocol/mcp-validation-protocol.js';

// HIPAA rule types
const HIPAA_RULE_TYPES = {
  PHI_DETECTION: 'phi_detection',
  SECURITY_RULE: 'security_rule',
  PRIVACY_RULE: 'privacy_rule',
  BREACH_NOTIFICATION: 'breach_notification',
  AUTHORIZATION: 'authorization'
};

/**
 * HIPAA-specific MCP server implementation
 */
export class HipaaServer extends BaseRegulationServer {
  /**
   * Create a new HIPAA validation server
   * 
   * @param {Object} options - Server configuration options
   */
  constructor(options = {}) {
    super({
      regulationId: "HIPAA",
      name: options.name || "hipaa-validation-server",
      version: options.version || "1.0.0",
      description: options.description || "MCP Server for HIPAA compliance validation",
      ...options
    });
    
    // Initialize HIPAA-specific capabilities
    this.capabilities.hipaa_version = "2013 Omnibus Rule";
    this.capabilities.applicable_regions = ["US"];
    this.capabilities.rule_types = Object.values(HIPAA_RULE_TYPES);
    
    // Register default HIPAA validation rules
    this._registerDefaultRules();
  }
  
  /**
   * Register default HIPAA validation rules
   */
  _registerDefaultRules() {
    // PHI Detection Rules
    this.registerValidationRule("HIPAA-PHI-001", {
      name: "Protected Health Information Detection",
      description: "Detects protected health information (PHI) in content",
      type: HIPAA_RULE_TYPES.PHI_DETECTION,
      importance: "CRITICAL",
      validate: async (content, validationType, context) => {
        const result = await this._detectProtectedHealthInfo(content);
        
        return {
          compliant: result.phiCount === 0,
          certainty: result.phiCount === 0 ? CERTAINTY_LEVELS.B : CERTAINTY_LEVELS.A,
          evidence: [
            createEvidence({
              type: EVIDENCE_TYPES.PATTERN_MATCH,
              content: `Found ${result.phiCount} PHI items`,
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
    
    // Privacy Rule
    this.registerValidationRule("HIPAA-PRIVACY-001", {
      name: "Notice of Privacy Practices",
      description: "Verifies presence of required privacy notice elements",
      type: HIPAA_RULE_TYPES.PRIVACY_RULE,
      importance: "HIGH",
      validate: async (content, validationType, context) => {
        const result = await this._checkPrivacyNotice(content);
        
        return {
          compliant: result.hasRequiredElements,
          certainty: CERTAINTY_LEVELS.B,
          evidence: [
            createEvidence({
              type: EVIDENCE_TYPES.SEMANTIC_MATCH,
              content: result.hasRequiredElements ? 
                "Required privacy notice elements found" : 
                "Missing required privacy notice elements",
              details: {
                elements_found: result.elements,
                missing_elements: result.missingElements,
                completeness_score: result.completenessScore
              },
              certainty: CERTAINTY_LEVELS.B
            })
          ]
        };
      }
    });
    
    // Security Rule
    this.registerValidationRule("HIPAA-SECURITY-001", {
      name: "Security Measures",
      description: "Checks for appropriate security measures for electronic PHI",
      type: HIPAA_RULE_TYPES.SECURITY_RULE,
      importance: "HIGH",
      validate: async (content, validationType, context) => {
        const result = await this._checkSecurityMeasures(content);
        
        return {
          compliant: result.hasSufficientMeasures,
          certainty: CERTAINTY_LEVELS.C,
          evidence: [
            createEvidence({
              type: EVIDENCE_TYPES.SEMANTIC_MATCH,
              content: result.hasSufficientMeasures ? 
                "Sufficient security measures found" : 
                "Insufficient security measures found",
              details: {
                measures_found: result.measuresFound,
                security_score: result.securityScore
              },
              certainty: CERTAINTY_LEVELS.C
            })
          ]
        };
      }
    });
    
    // Authorization
    this.registerValidationRule("HIPAA-AUTH-001", {
      name: "Valid Authorization",
      description: "Checks for valid HIPAA authorization for use or disclosure",
      type: HIPAA_RULE_TYPES.AUTHORIZATION,
      importance: "HIGH",
      validate: async (content, validationType, context) => {
        const result = await this._checkAuthorization(content);
        
        return {
          compliant: result.hasValidAuthorization,
          certainty: CERTAINTY_LEVELS.B,
          evidence: [
            createEvidence({
              type: EVIDENCE_TYPES.SEMANTIC_MATCH,
              content: result.hasValidAuthorization ? 
                "Valid authorization found" : 
                "No valid authorization found",
              details: {
                elements_found: result.elements,
                validity_score: result.validityScore
              },
              certainty: CERTAINTY_LEVELS.B
            })
          ]
        };
      }
    });
    
    // Breach Notification
    this.registerValidationRule("HIPAA-BREACH-001", {
      name: "Breach Notification Procedures",
      description: "Checks for appropriate breach notification procedures",
      type: HIPAA_RULE_TYPES.BREACH_NOTIFICATION,
      importance: "MEDIUM",
      validate: async (content, validationType, context) => {
        const result = await this._checkBreachNotification(content);
        
        return {
          compliant: result.hasNotificationProcedures,
          certainty: CERTAINTY_LEVELS.C,
          evidence: [
            createEvidence({
              type: EVIDENCE_TYPES.SEMANTIC_MATCH,
              content: result.hasNotificationProcedures ? 
                "Breach notification procedures found" : 
                "No breach notification procedures found",
              details: {
                procedures_found: result.procedures,
                completeness: result.completeness
              },
              certainty: CERTAINTY_LEVELS.C
            })
          ]
        };
      }
    });
  }
  
  /**
   * Detect protected health information in content
   * 
   * @param {Object} content - Content to analyze
   * @returns {Promise<Object>} Detection result
   */
  async _detectProtectedHealthInfo(content) {
    // Mock implementation for testing purposes
    const contentStr = JSON.stringify(content);
    const phiPatterns = [
      { type: "name", regex: /\b(?:Dr\.|Mr\.|Mrs\.|Ms\.)?\s?[A-Z][a-z]+ [A-Z][a-z]+\b/g },
      { type: "dob", regex: /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g },
      { type: "ssn", regex: /\d{3}-\d{2}-\d{4}/g },
      { type: "mrn", regex: /\b(?:MRN|Medical Record Number|Patient ID):?\s*\d+\b/gi },
      { type: "treatment", regex: /\b(?:diagnosed|prescribed|treatment|medication|dose|therapy)\b/gi }
    ];
    
    const items = [];
    for (const pattern of phiPatterns) {
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
      phiCount: items.reduce((count, item) => count + item.count, 0),
      items
    };
  }
  
  /**
   * Check privacy notice elements
   * 
   * @param {Object} content - Content to analyze
   * @returns {Promise<Object>} Check result
   */
  async _checkPrivacyNotice(content) {
    // Mock implementation for testing purposes
    const contentStr = JSON.stringify(content).toLowerCase();
    
    const requiredElements = [
      "uses and disclosures",
      "individual rights",
      "covered entity duties",
      "complaints",
      "contact information",
      "effective date"
    ];
    
    const elements = requiredElements.filter(element => 
      contentStr.includes(element)
    );
    
    const missingElements = requiredElements.filter(element => 
      !elements.includes(element)
    );
    
    const completenessScore = Math.round((elements.length / requiredElements.length) * 100);
    
    return {
      hasRequiredElements: completenessScore >= 70,
      elements,
      missingElements,
      completenessScore
    };
  }
  
  /**
   * Check security measures
   * 
   * @param {Object} content - Content to analyze
   * @returns {Promise<Object>} Check result
   */
  async _checkSecurityMeasures(content) {
    // Mock implementation for testing purposes
    const contentStr = JSON.stringify(content).toLowerCase();
    
    const securityMeasures = [
      { category: "administrative", terms: ["risk analysis", "risk management", "security officer", "training", "contingency plan"] },
      { category: "physical", terms: ["facility access", "workstation security", "device and media controls"] },
      { category: "technical", terms: ["access control", "audit controls", "integrity", "authentication", "transmission security", "encryption"] }
    ];
    
    const measuresFound = [];
    for (const category of securityMeasures) {
      const found = category.terms.filter(term => 
        contentStr.includes(term)
      );
      
      if (found.length > 0) {
        measuresFound.push({
          category: category.category,
          measures: found
        });
      }
    }
    
    // Calculate security score (0-100)
    const totalTerms = securityMeasures.reduce((count, category) => count + category.terms.length, 0);
    const foundTerms = measuresFound.reduce((count, category) => count + category.measures.length, 0);
    const securityScore = Math.round((foundTerms / totalTerms) * 100);
    
    return {
      hasSufficientMeasures: securityScore >= 50,
      measuresFound,
      securityScore
    };
  }
  
  /**
   * Check authorization elements
   * 
   * @param {Object} content - Content to analyze
   * @returns {Promise<Object>} Check result
   */
  async _checkAuthorization(content) {
    // Mock implementation for testing purposes
    const contentStr = JSON.stringify(content).toLowerCase();
    
    const requiredElements = [
      "description of information",
      "purpose of use or disclosure",
      "recipient of information",
      "expiration date",
      "signature",
      "right to revoke"
    ];
    
    const elements = requiredElements.filter(element => 
      contentStr.includes(element)
    );
    
    const validityScore = Math.round((elements.length / requiredElements.length) * 100);
    
    return {
      hasValidAuthorization: validityScore >= 80,
      elements,
      validityScore
    };
  }
  
  /**
   * Check breach notification procedures
   * 
   * @param {Object} content - Content to analyze
   * @returns {Promise<Object>} Check result
   */
  async _checkBreachNotification(content) {
    // Mock implementation for testing purposes
    const contentStr = JSON.stringify(content).toLowerCase();
    
    const breachProcedures = [
      "breach notification",
      "without unreasonable delay",
      "no later than 60 days",
      "notification to individuals",
      "notification to media",
      "notification to hhs"
    ];
    
    const procedures = breachProcedures.filter(procedure => 
      contentStr.includes(procedure)
    );
    
    const completeness = Math.round((procedures.length / breachProcedures.length) * 100);
    
    return {
      hasNotificationProcedures: procedures.length > 0,
      procedures,
      completeness
    };
  }
}

export default HipaaServer; 