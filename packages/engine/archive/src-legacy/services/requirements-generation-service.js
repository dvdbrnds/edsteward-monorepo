/**
 * Requirements Generation Service
 * 
 * LLM Stage 2: Generates structured, actionable compliance requirements
 * from full regulation text for higher education institutions.
 * 
 * Fixes the critical issue where full regulation text was being dumped
 * into the requirements field instead of structured compliance guidance.
 */

import { callLLM } from '../regulatory-sources/llm-processing.js';
import crypto from 'crypto';

export class RequirementsGenerationService {
  constructor(options = {}) {
    this.templateVersion = '1.0.0';
    this.llmModel = options.llmModel || process.env.LLM_DEFAULT_MODEL || 'claude-3-5-sonnet-20241022';
    this.temperature = options.temperature || parseFloat(process.env.LLM_TEMPERATURE) || 0.2; // Slightly higher for creativity
    this.maxTokens = options.maxTokens || parseInt(process.env.MAX_TOKENS) || 6000; // More tokens for detailed requirements
    this.requirementsApiKey = options.requirementsApiKey || process.env.REQUIREMENTS_API_KEY || process.env.LLM_API_KEY;
    this.logger = options.logger || console;
  }

  /**
   * Generate structured compliance requirements from regulation text
   * @param {string} regulationSlug - Regulation identifier
   * @param {string} regulationTitle - Full regulation title
   * @param {string} regulationText - Full regulation text
   * @returns {Promise<Object>} Structured requirements with metadata
   */
  async generateComplianceRequirements(regulationSlug, regulationTitle, regulationText) {
    try {
      const systemMessage = `You are a compliance expert specializing in higher education regulations. Generate structured, actionable compliance requirements from regulation text that compliance officers can immediately implement.

CRITICAL REQUIREMENTS:
- Focus on ACTIONABLE requirements, not legal theory
- Specify WHO is responsible for each requirement
- Include WHEN requirements must be completed (deadlines/frequency)
- Provide SPECIFIC implementation steps
- Use plain language, avoid legal jargon
- Structure consistently for all regulations
- Target higher education institutions specifically`;

      const userMessage = `Analyze this regulation and generate specific compliance requirements for higher education institutions:

REGULATION: ${regulationTitle}
SLUG: ${regulationSlug}

FULL TEXT:
${regulationText.substring(0, 12000)}${regulationText.length > 12000 ? '\n\n[Text truncated for processing]' : ''}

Generate requirements in this EXACT format:

**Key Compliance Requirements:**

1. **[Requirement Category]**
   - [Specific actionable requirement with WHO does it]
   - [Implementation deadline/frequency if applicable]
   - [Responsible party/department clearly identified]

2. **[Next Category]**
   - [Specific actionable requirement]
   - [Implementation details and steps]

**Documentation Requirements:**
- [Required records/documentation to maintain]
- [Retention periods with specific timeframes]
- [Where documents should be stored/who maintains them]

**Reporting Requirements:**
- [Required reports/submissions with specific details]
- [Submission deadlines and frequencies]
- [Recipient agencies or departments]

**Training Requirements:**
- [Required training programs with content details]
- [Target audiences (faculty, staff, students)]
- [Training frequency and update requirements]

**Monitoring & Compliance:**
- [Ongoing monitoring activities with specific methods]
- [Compliance verification procedures]
- [Internal audit requirements and schedules]

**Risk Management:**
- [Key compliance risks to monitor]
- [Mitigation strategies for common violations]
- [Escalation procedures for compliance issues]

Focus on actionable, specific requirements that compliance officers can implement immediately. Each requirement should answer: WHO does WHAT by WHEN and HOW.`;

      this.logger.info(`Generating compliance requirements for ${regulationSlug}...`);

      const response = await callLLM(userMessage, {
        model: this.llmModel,
        temperature: this.temperature,
        maxTokens: this.maxTokens,
        systemMessage: systemMessage,
        apiKey: this.requirementsApiKey
      });

      const requirements = response.trim();
      const requirementsHash = this.generateRequirementsHash(requirements);

      // Validate requirements quality
      const qualityScore = this.validateRequirementsQuality(requirements);

      const result = {
        requirements: requirements,
        metadata: {
          templateVersion: this.templateVersion,
          generatedAt: new Date().toISOString(),
          regulationSlug: regulationSlug,
          regulationTitle: regulationTitle,
          requirementsHash: requirementsHash,
          llmModel: this.llmModel,
          temperature: this.temperature,
          qualityScore: qualityScore,
          wordCount: requirements.split(/\s+/).length,
          characterCount: requirements.length,
          stage: 'LLM Stage 2: Requirements Generation'
        }
      };

      this.logger.info(`Requirements generated for ${regulationSlug}: ${result.metadata.wordCount} words, quality score: ${qualityScore.score}/100`);

      return result;

    } catch (error) {
      this.logger.error(`Failed to generate requirements for ${regulationSlug}:`, error);
      throw new Error(`Requirements generation failed: ${error.message}`);
    }
  }

  /**
   * Generate hash for requirements versioning and change detection
   */
  generateRequirementsHash(requirementsText) {
    // Normalize text for consistent hashing
    const normalized = requirementsText
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[.,;:!?]/g, '')
      .trim();
    
    return crypto.createHash('sha256').update(normalized).digest('hex').substring(0, 16);
  }

  /**
   * Validate requirements quality and actionability
   */
  validateRequirementsQuality(requirements) {
    const issues = [];
    let score = 100;

    // Check for required sections
    const requiredSections = [
      'Key Compliance Requirements',
      'Documentation Requirements',
      'Training Requirements',
      'Monitoring & Compliance'
    ];

    requiredSections.forEach(section => {
      if (!requirements.includes(section)) {
        issues.push(`Missing required section: ${section}`);
        score -= 15;
      }
    });

    // Check for actionable language
    const actionWords = ['must', 'shall', 'should', 'implement', 'establish', 'maintain', 'ensure', 'provide', 'conduct', 'review'];
    const hasActionWords = actionWords.some(word => requirements.toLowerCase().includes(word));
    if (!hasActionWords) {
      issues.push('Requirements lack actionable language');
      score -= 20;
    }

    // Check for specific details (WHO, WHEN, HOW indicators)
    const specificityIndicators = ['department', 'office', 'annually', 'monthly', 'deadline', 'responsible', 'within', 'by'];
    const specificityCount = specificityIndicators.filter(indicator => 
      requirements.toLowerCase().includes(indicator)
    ).length;
    
    if (specificityCount < 3) {
      issues.push('Requirements lack specificity (WHO, WHEN, HOW details)');
      score -= 15;
    }

    // Check length (should be substantial but not overwhelming)
    const wordCount = requirements.split(/\s+/).length;
    if (wordCount < 200) {
      issues.push('Requirements too brief - may lack necessary detail');
      score -= 10;
    } else if (wordCount > 2000) {
      issues.push('Requirements too lengthy - may be overwhelming');
      score -= 5;
    }

    // Check for legal jargon (should be minimal)
    const legalJargon = ['pursuant to', 'heretofore', 'whereas', 'aforementioned', 'notwithstanding', 'thereunder'];
    const jargonCount = legalJargon.filter(term => requirements.toLowerCase().includes(term)).length;
    if (jargonCount > 2) {
      issues.push('Contains too much legal jargon - should use plain language');
      score -= 10;
    }

    return {
      score: Math.max(0, score),
      issues: issues,
      isValid: score >= 70, // Minimum acceptable quality
      wordCount: wordCount,
      specificityScore: specificityCount,
      jargonCount: jargonCount
    };
  }

  /**
   * Generate requirements for multiple regulations in batch
   */
  async generateBatchRequirements(regulations, options = {}) {
    const results = [];
    const batchSize = options.batchSize || 5; // Process in small batches to avoid rate limits
    const delayMs = options.delayMs || 2000; // Delay between batches

    this.logger.info(`Starting batch requirements generation for ${regulations.length} regulations`);

    for (let i = 0; i < regulations.length; i += batchSize) {
      const batch = regulations.slice(i, i + batchSize);
      
      this.logger.info(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(regulations.length / batchSize)}`);

      const batchPromises = batch.map(async (regulation) => {
        try {
          const result = await this.generateComplianceRequirements(
            regulation.slug,
            regulation.title,
            regulation.text
          );
          return { success: true, regulation: regulation.slug, result };
        } catch (error) {
          this.logger.error(`Failed to generate requirements for ${regulation.slug}:`, error);
          return { success: false, regulation: regulation.slug, error: error.message };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Delay between batches to respect rate limits
      if (i + batchSize < regulations.length) {
        this.logger.info(`Waiting ${delayMs}ms before next batch...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    this.logger.info(`Batch requirements generation complete: ${successful} successful, ${failed} failed`);

    return {
      total: regulations.length,
      successful,
      failed,
      results
    };
  }

  /**
   * Create EdSteward API payload with separate full text and requirements
   */
  createEdStewardPayload(regulationId, regulationName, fullText, requirements, status = 'pending') {
    return {
      regulationId: regulationId,
      name: `${regulationName} Complete Update`,
      status: status,
      content: {
        uscText: {
          text: fullText,
          source: 'MCP Engine LLM Stage 1',
          generatedAt: new Date().toISOString()
        },
        requirements: {
          generated: true,
          llmModel: this.llmModel,
          generatedAt: new Date().toISOString(),
          content: requirements.requirements,
          metadata: requirements.metadata,
          qualityScore: requirements.metadata.qualityScore,
          stage: 'LLM Stage 2: Requirements Generation'
        }
      }
    };
  }

  /**
   * Fix contaminated requirements field (remove full text, generate proper requirements)
   */
  async fixContaminatedRequirements(regulationId, regulationSlug, regulationTitle, contaminatedText) {
    this.logger.warn(`Fixing contaminated requirements for regulation ${regulationId} (${regulationSlug})`);
    
    // Extract the actual regulation text from the contaminated field
    const cleanText = contaminatedText.substring(0, 10000); // Use first part as regulation text
    
    // Generate proper requirements
    const requirements = await this.generateComplianceRequirements(
      regulationSlug,
      regulationTitle,
      cleanText
    );

    // Create clean payload
    const payload = this.createEdStewardPayload(
      regulationId,
      `${regulationTitle} - Requirements Fixed`,
      cleanText,
      requirements,
      'requirements_fixed'
    );

    this.logger.info(`Fixed contaminated requirements for ${regulationSlug}: ${requirements.metadata.wordCount} words of proper requirements generated`);

    return payload;
  }
}

export default RequirementsGenerationService;
