/**
 * Consistent Summary Service
 * 
 * Ensures LLM-generated regulation summaries maintain consistent voice, tone, and structure
 * across regulation updates to preserve the value of customer differential view tools.
 * 
 * Key Features:
 * - Deterministic summary generation with consistent voice
 * - Template-based prompts with few-shot examples
 * - Structured output format for reliable parsing
 * - Change detection that ignores stylistic variations
 * - Version control for summary templates
 */

import { callLLM } from '../regulatory-sources/llm-processing.js';
import crypto from 'crypto';

export class ConsistentSummaryService {
  constructor(options = {}) {
    this.templateVersion = '1.0.0';
    this.consistencySettings = {
      temperature: 0.1, // Very low for deterministic output
      model: process.env.LLM_DEFAULT_MODEL || 'claude-3-5-sonnet-20241022',
      maxTokens: 1000
    };
    
    // Standard voice and tone guidelines
    this.voiceGuidelines = {
      tone: 'professional, clear, actionable',
      perspective: 'second person (your organization)',
      structure: 'requirement-focused with specific actions',
      language: 'business-friendly, avoid legal jargon',
      format: 'structured with consistent sections'
    };
    
    // Few-shot examples for consistency
    this.exampleSummaries = [
      {
        regulation: 'FERPA',
        summary: 'Your educational institution must protect student education records and obtain written consent before disclosing personally identifiable information. You must provide annual notification of FERPA rights, maintain accurate records, and allow eligible students to inspect and request amendments to their records.'
      },
      {
        regulation: 'Title IX',
        summary: 'Your institution must prevent sex-based discrimination in all education programs receiving federal funding. You must designate a Title IX coordinator, establish grievance procedures for complaints, provide prompt and equitable resolution of incidents, and ensure no retaliation against complainants.'
      },
      {
        regulation: 'ADA',
        summary: 'Your organization must provide equal access and reasonable accommodations for individuals with disabilities. You must ensure physical accessibility, provide auxiliary aids and services, modify policies when necessary, and maintain effective communication with disabled individuals.'
      }
    ];
  }

  /**
   * Generate a consistent summary for a regulation
   * @param {string} regulationSlug - Regulation identifier
   * @param {string} regulationTitle - Full regulation title
   * @param {string} regulationText - Full regulation text
   * @param {Object} previousSummary - Previous summary for consistency reference
   * @returns {Promise<Object>} Consistent summary with metadata
   */
  async generateConsistentSummary(regulationSlug, regulationTitle, regulationText, previousSummary = null) {
    try {
      // Create deterministic prompt with consistency guidelines
      const prompt = this.buildConsistentPrompt(regulationSlug, regulationTitle, regulationText, previousSummary);
      
      // Generate summary with strict consistency settings
      let response = await callLLM(prompt, this.consistencySettings);
      
      // Strip JSON code fences if present
      if (response && typeof response === 'string') {
        response = response.trim();
        // Remove ```json or ``` wrapper
        if (response.startsWith('```json')) {
          response = response.slice(7);
        } else if (response.startsWith('```')) {
          response = response.slice(3);
        }
        if (response.endsWith('```')) {
          response = response.slice(0, -3);
        }
        response = response.trim();
      }
      
      // Try to parse JSON response, fallback to simple summary if needed
      let parsedResponse;
      try {
        parsedResponse = JSON.parse(response);
        
        // Ensure summary is plain text, not JSON
        if (parsedResponse.summary && typeof parsedResponse.summary === 'string') {
          // If summary still has JSON prefix, extract just the text
          if (parsedResponse.summary.startsWith('```')) {
            parsedResponse.summary = parsedResponse.summary.replace(/^```json?\n?|\n?```$/g, '').trim();
          }
        }
      } catch (e) {
        // Fallback: create simple response structure
        // If response looks like it has a summary key embedded, try to extract it
        const summaryMatch = response.match(/"summary":\s*"([^"]+)"/);
        parsedResponse = {
          summary: summaryMatch ? summaryMatch[1] : response.trim(),
          keyRequirements: [],
          complianceActions: [],
          riskLevel: 'medium',
          primaryStakeholders: ['educational institutions'],
          enforcementAgency: 'various'
        };
      }
      
      // Add consistency metadata
      const consistentSummary = {
        ...parsedResponse,
        metadata: {
          templateVersion: this.templateVersion,
          generatedAt: new Date().toISOString(),
          consistencyHash: this.generateConsistencyHash(parsedResponse.summary),
          voiceProfile: this.voiceGuidelines,
          regulationSlug: regulationSlug,
          isConsistent: previousSummary ? this.checkConsistency(parsedResponse.summary, previousSummary.summary) : true
        }
      };
      
      return consistentSummary;
      
    } catch (error) {
      console.error(`Failed to generate consistent summary for ${regulationSlug}:`, error);
      throw new Error(`Consistent summary generation failed: ${error.message}`);
    }
  }

  /**
   * Build a consistent prompt with few-shot examples and strict guidelines
   */
  buildConsistentPrompt(regulationSlug, regulationTitle, regulationText, previousSummary) {
    const basePrompt = `You are a regulatory compliance expert creating consistent, business-focused summaries for institutional compliance officers.

CRITICAL CONSISTENCY REQUIREMENTS:
- Use EXACTLY the same voice, tone, and structure as the examples below
- Always write in second person ("Your organization must...")
- Focus on specific actions and requirements, not legal theory
- Use consistent sentence structure and formatting
- Maintain professional, clear, actionable tone
- Avoid legal jargon - use business-friendly language

EXAMPLE SUMMARIES (maintain this exact style):
${this.exampleSummaries.map(ex => `${ex.regulation}: "${ex.summary}"`).join('\n')}

${previousSummary ? `PREVIOUS SUMMARY FOR REFERENCE (maintain similar structure and voice):
"${previousSummary.summary}"

IMPORTANT: If the regulation content is substantially the same, your summary should be nearly identical to the previous version. Only change the summary if there are actual regulatory changes, not for stylistic reasons.` : ''}

REGULATION TO SUMMARIZE:
Title: ${regulationTitle}
Slug: ${regulationSlug}
Content: ${regulationText.substring(0, 6000)}${regulationText.length > 6000 ? '...[truncated]' : ''}

Generate a JSON response with these exact fields:
{
  "summary": "2-3 sentence business-focused summary using the exact style from examples",
  "keyRequirements": ["array", "of", "3-5", "specific", "actionable", "requirements"],
  "complianceActions": ["array", "of", "specific", "actions", "organizations", "must", "take"],
  "riskLevel": "high|medium|low",
  "primaryStakeholders": ["who", "is", "affected"],
  "enforcementAgency": "which agency enforces this"
}

Remember: Consistency is critical. Match the voice, tone, and structure exactly.`;

    return basePrompt;
  }

  /**
   * Generate a hash for consistency checking
   */
  generateConsistencyHash(summaryText) {
    // Normalize text for consistent hashing (remove minor variations)
    const normalized = summaryText
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[.,;:!?]/g, '')
      .trim();
    
    return crypto.createHash('sha256').update(normalized).digest('hex').substring(0, 16);
  }

  /**
   * Check if two summaries are consistent in voice and structure
   */
  checkConsistency(newSummary, previousSummary) {
    if (!previousSummary) return true;
    
    // Check structural consistency
    const newStructure = this.analyzeStructure(newSummary);
    const previousStructure = this.analyzeStructure(previousSummary);
    
    return (
      newStructure.startsWithYour === previousStructure.startsWithYour &&
      newStructure.sentenceCount >= previousStructure.sentenceCount - 1 &&
      newStructure.sentenceCount <= previousStructure.sentenceCount + 1 &&
      newStructure.hasActionWords === previousStructure.hasActionWords
    );
  }

  /**
   * Analyze summary structure for consistency checking
   */
  analyzeStructure(summary) {
    return {
      startsWithYour: summary.toLowerCase().startsWith('your'),
      sentenceCount: (summary.match(/[.!?]+/g) || []).length,
      hasActionWords: /must|shall|should|require|ensure|provide|maintain|establish/.test(summary.toLowerCase()),
      wordCount: summary.split(/\s+/).length
    };
  }

  /**
   * Compare two summaries and identify only substantive changes
   * (ignores stylistic variations for differential view tools)
   */
  async detectSubstantiveChanges(oldSummary, newSummary, oldRegulationText, newRegulationText) {
    try {
      const changeDetectionPrompt = `You are analyzing changes between regulation summaries to identify ONLY substantive regulatory changes, not stylistic variations.

OLD SUMMARY: "${oldSummary.summary}"
NEW SUMMARY: "${newSummary.summary}"

OLD REGULATION TEXT: ${oldRegulationText.substring(0, 3000)}...
NEW REGULATION TEXT: ${newRegulationText.substring(0, 3000)}...

Analyze and return JSON with:
{
  "hasSubstantiveChanges": boolean,
  "changeType": "major|minor|stylistic|none",
  "substantiveChanges": ["list", "of", "actual", "regulatory", "changes"],
  "stylisticChanges": ["list", "of", "style", "only", "changes"],
  "impactLevel": "high|medium|low|none",
  "recommendedAction": "what should customers do about these changes"
}

Focus ONLY on actual regulatory requirement changes, not wording improvements.`;

      const response = await callLLM(changeDetectionPrompt, this.consistencySettings);

      return JSON.parse(response);
      
    } catch (error) {
      console.error('Failed to detect substantive changes:', error);
      return {
        hasSubstantiveChanges: true, // Err on the side of caution
        changeType: 'unknown',
        substantiveChanges: ['Unable to analyze changes'],
        stylisticChanges: [],
        impactLevel: 'medium',
        recommendedAction: 'Review changes manually'
      };
    }
  }

  /**
   * Update summary template version (for controlled consistency evolution)
   */
  updateTemplateVersion(newVersion, migrationRules = {}) {
    console.log(`Updating summary template from ${this.templateVersion} to ${newVersion}`);
    this.templateVersion = newVersion;
    
    // Apply migration rules if needed
    if (migrationRules.voiceGuidelines) {
      this.voiceGuidelines = { ...this.voiceGuidelines, ...migrationRules.voiceGuidelines };
    }
    
    if (migrationRules.exampleSummaries) {
      this.exampleSummaries = migrationRules.exampleSummaries;
    }
  }

  /**
   * Validate summary meets consistency standards
   */
  validateSummaryConsistency(summary) {
    const issues = [];
    
    // Check voice consistency
    if (!summary.summary.toLowerCase().startsWith('your')) {
      issues.push('Summary should start with "Your organization" or "Your institution"');
    }
    
    // Check for action words
    if (!/must|shall|should|require|ensure|provide|maintain|establish/.test(summary.summary.toLowerCase())) {
      issues.push('Summary should include clear action requirements');
    }
    
    // Check length consistency
    if (summary.summary.split(/\s+/).length < 20 || summary.summary.split(/\s+/).length > 100) {
      issues.push('Summary length should be 20-100 words for consistency');
    }
    
    // Check for legal jargon
    const legalJargon = ['pursuant to', 'heretofore', 'whereas', 'aforementioned', 'notwithstanding'];
    const hasJargon = legalJargon.some(term => summary.summary.toLowerCase().includes(term));
    if (hasJargon) {
      issues.push('Summary contains legal jargon - use business-friendly language');
    }
    
    return {
      isValid: issues.length === 0,
      issues: issues,
      score: Math.max(0, 100 - (issues.length * 25))
    };
  }
}

export default ConsistentSummaryService;
