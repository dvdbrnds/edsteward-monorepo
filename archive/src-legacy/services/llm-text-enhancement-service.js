/**
 * LLM Text Enhancement Service
 * 
 * Transforms raw regulatory text into comprehensive, readable summaries
 * while maintaining consistency across regulation updates for differential view tools.
 * 
 * Features:
 * - Consistent voice and tone across all summaries
 * - Structured output for reliable parsing
 * - Change detection that preserves differential view value
 * - Integration with EdSteward delivery system
 * - Fallback strategies for reliability
 */

import { ConsistentSummaryService } from './consistent-summary-service.js';
import { callLLM } from '../regulatory-sources/llm-processing.js';
import { setupLogger } from '../utils/logger.js';

const logger = setupLogger('llm-text-enhancement');

export class LLMTextEnhancementService {
  constructor(options = {}) {
    this.consistentSummaryService = new ConsistentSummaryService();
    this.cache = new Map();
    this.cacheTTL = options.cacheTTL || 3600000; // 1 hour
    
    // Enhancement settings
    this.enhancementSettings = {
      temperature: 0.1, // Low for consistency
      model: options.model || 'gpt-4o',
      maxTokens: 2000,
      enableCache: options.enableCache !== false,
      enableFallback: options.enableFallback !== false
    };
    
    // Track summary versions for consistency
    this.summaryVersions = new Map();
  }

  /**
   * Enhance regulation text with comprehensive, readable summaries
   * @param {string} regulationSlug - Regulation identifier
   * @param {string} regulationTitle - Full regulation title
   * @param {string} regulationText - Raw regulation text from eCFR/government sources
   * @param {Object} options - Enhancement options
   * @returns {Promise<Object>} Enhanced regulation data with consistent summaries
   */
  async enhanceRegulationText(regulationSlug, regulationTitle, regulationText, options = {}) {
    try {
      logger.info(`Enhancing regulation text for ${regulationSlug}`);
      
      // Check cache first
      if (this.enhancementSettings.enableCache) {
        const cached = this.getFromCache(regulationSlug, regulationText);
        if (cached) {
          logger.info(`Using cached enhancement for ${regulationSlug}`);
          return cached;
        }
      }
      
      // Get previous summary for consistency reference
      const previousSummary = this.summaryVersions.get(regulationSlug);
      
      // Generate consistent summary
      const consistentSummary = await this.consistentSummaryService.generateConsistentSummary(
        regulationSlug,
        regulationTitle,
        regulationText,
        previousSummary
      );
      
      // Generate additional enhancements
      const enhancements = await this.generateAdditionalEnhancements(
        regulationSlug,
        regulationTitle,
        regulationText,
        consistentSummary
      );
      
      // Combine all enhancements
      const enhancedRegulation = {
        regulationSlug,
        regulationTitle,
        originalText: regulationText,
        
        // Consistent summary (primary)
        summary: consistentSummary.summary,
        summarySource: 'MCP Engine LLM Enhancement',
        summaryMetadata: consistentSummary.metadata,
        
        // Structured enhancements
        keyRequirements: consistentSummary.keyRequirements,
        complianceActions: consistentSummary.complianceActions,
        riskLevel: consistentSummary.riskLevel,
        primaryStakeholders: consistentSummary.primaryStakeholders,
        enforcementAgency: consistentSummary.enforcementAgency,
        
        // Additional enhancements
        ...enhancements,
        
        // Metadata
        enhancedAt: new Date().toISOString(),
        enhancementVersion: '1.0.0',
        consistency: {
          templateVersion: consistentSummary.metadata.templateVersion,
          consistencyHash: consistentSummary.metadata.consistencyHash,
          isConsistent: consistentSummary.metadata.isConsistent
        }
      };
      
      // Store for future consistency reference
      this.summaryVersions.set(regulationSlug, {
        summary: consistentSummary.summary,
        hash: consistentSummary.metadata.consistencyHash,
        version: consistentSummary.metadata.templateVersion,
        createdAt: new Date().toISOString()
      });
      
      // Cache the result
      if (this.enhancementSettings.enableCache) {
        this.setCache(regulationSlug, regulationText, enhancedRegulation);
      }
      
      logger.info(`Successfully enhanced ${regulationSlug} with consistency score: ${consistentSummary.metadata.isConsistent ? 'CONSISTENT' : 'INCONSISTENT'}`);
      
      return enhancedRegulation;
      
    } catch (error) {
      logger.error(`Failed to enhance regulation text for ${regulationSlug}:`, error);
      
      // Fallback to basic enhancement
      if (this.enhancementSettings.enableFallback) {
        return this.generateFallbackEnhancement(regulationSlug, regulationTitle, regulationText);
      }
      
      throw error;
    }
  }

  /**
   * Generate additional enhancements beyond the consistent summary
   */
  async generateAdditionalEnhancements(regulationSlug, regulationTitle, regulationText, consistentSummary) {
    try {
      const enhancementPrompt = `Based on this regulation, provide additional business-focused enhancements:

Regulation: ${regulationTitle}
Summary: ${consistentSummary.summary}
Text: ${regulationText.substring(0, 4000)}...

Generate JSON with these enhancements:
{
  "businessImpact": "1-2 sentences on business/operational impact",
  "implementationSteps": ["step 1", "step 2", "step 3"],
  "commonViolations": ["typical compliance failures"],
  "bestPractices": ["recommended practices"],
  "relatedRegulations": ["other regulations that interact with this one"],
  "updateFrequency": "how often this regulation typically changes",
  "complianceCost": "estimated compliance cost level (low/medium/high)",
  "deadlines": ["any specific deadlines or timeframes"],
  "exemptions": ["who might be exempt from requirements"],
  "penalties": ["potential penalties for non-compliance"]
}`;

      const response = await callLLM(enhancementPrompt, {
        ...this.enhancementSettings,
        responseFormat: { type: 'json_object' }
      });

      return JSON.parse(response);
      
    } catch (error) {
      logger.warn(`Failed to generate additional enhancements for ${regulationSlug}:`, error);
      return {
        businessImpact: 'Compliance with this regulation is required for organizations in scope.',
        implementationSteps: ['Review requirements', 'Assess current compliance', 'Implement necessary changes'],
        commonViolations: ['Inadequate documentation', 'Insufficient training'],
        bestPractices: ['Regular compliance audits', 'Staff training programs'],
        relatedRegulations: [],
        updateFrequency: 'Varies',
        complianceCost: 'medium',
        deadlines: [],
        exemptions: [],
        penalties: ['Varies by regulation']
      };
    }
  }

  /**
   * Generate fallback enhancement when LLM processing fails
   */
  generateFallbackEnhancement(regulationSlug, regulationTitle, regulationText) {
    logger.warn(`Generating fallback enhancement for ${regulationSlug}`);
    
    // Basic template-based summary
    const fallbackSummary = `Your organization must comply with ${regulationTitle} requirements. Review the full regulation text and implement necessary policies and procedures to ensure compliance.`;
    
    return {
      regulationSlug,
      regulationTitle,
      originalText: regulationText,
      summary: fallbackSummary,
      summarySource: 'MCP Engine Fallback',
      summaryMetadata: {
        templateVersion: 'fallback-1.0.0',
        generatedAt: new Date().toISOString(),
        consistencyHash: 'fallback',
        isFallback: true
      },
      keyRequirements: ['Review regulation requirements', 'Implement compliance measures'],
      complianceActions: ['Assess current practices', 'Update policies as needed'],
      riskLevel: 'medium',
      primaryStakeholders: ['Compliance officers', 'Management'],
      enforcementAgency: 'Various',
      businessImpact: 'Compliance required to avoid penalties',
      implementationSteps: ['Review requirements', 'Assess gaps', 'Implement changes'],
      enhancedAt: new Date().toISOString(),
      enhancementVersion: 'fallback-1.0.0',
      isFallback: true
    };
  }

  /**
   * Detect changes between regulation versions for differential view tools
   */
  async detectRegulationChanges(regulationSlug, oldText, newText, oldSummary = null) {
    try {
      logger.info(`Detecting changes for ${regulationSlug}`);
      
      // Generate new summary
      const newEnhancement = await this.enhanceRegulationText(regulationSlug, regulationSlug, newText);
      
      // If we have an old summary, detect substantive changes
      if (oldSummary) {
        const changeAnalysis = await this.consistentSummaryService.detectSubstantiveChanges(
          oldSummary,
          { summary: newEnhancement.summary },
          oldText,
          newText
        );
        
        return {
          hasChanges: changeAnalysis.hasSubstantiveChanges,
          changeType: changeAnalysis.changeType,
          changes: changeAnalysis.substantiveChanges,
          stylisticChanges: changeAnalysis.stylisticChanges,
          impactLevel: changeAnalysis.impactLevel,
          recommendedAction: changeAnalysis.recommendedAction,
          newSummary: newEnhancement.summary,
          oldSummary: oldSummary.summary,
          differentialViewSafe: changeAnalysis.changeType !== 'stylistic'
        };
      }
      
      return {
        hasChanges: true,
        changeType: 'new',
        changes: ['New regulation added'],
        newSummary: newEnhancement.summary,
        differentialViewSafe: true
      };
      
    } catch (error) {
      logger.error(`Failed to detect changes for ${regulationSlug}:`, error);
      throw error;
    }
  }

  /**
   * Batch enhance multiple regulations with consistency
   */
  async batchEnhanceRegulations(regulations, options = {}) {
    const results = [];
    const batchSize = options.batchSize || 5;
    
    logger.info(`Batch enhancing ${regulations.length} regulations`);
    
    for (let i = 0; i < regulations.length; i += batchSize) {
      const batch = regulations.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (regulation) => {
        try {
          const enhanced = await this.enhanceRegulationText(
            regulation.slug,
            regulation.title,
            regulation.text,
            options
          );
          return { success: true, regulation: regulation.slug, data: enhanced };
        } catch (error) {
          logger.error(`Failed to enhance ${regulation.slug}:`, error);
          return { success: false, regulation: regulation.slug, error: error.message };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Small delay between batches to avoid rate limiting
      if (i + batchSize < regulations.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    logger.info(`Batch enhancement complete: ${successful} successful, ${failed} failed`);
    
    return results;
  }

  /**
   * Cache management
   */
  getFromCache(regulationSlug, regulationText) {
    const cacheKey = this.generateCacheKey(regulationSlug, regulationText);
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }
    
    return null;
  }

  setCache(regulationSlug, regulationText, data) {
    const cacheKey = this.generateCacheKey(regulationSlug, regulationText);
    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });
  }

  generateCacheKey(regulationSlug, regulationText) {
    const crypto = require('crypto');
    const textHash = crypto.createHash('sha256').update(regulationText).digest('hex').substring(0, 16);
    return `${regulationSlug}-${textHash}`;
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
    logger.info('Enhancement cache cleared');
  }

  /**
   * Get service statistics
   */
  getStats() {
    return {
      cacheSize: this.cache.size,
      summaryVersionsTracked: this.summaryVersions.size,
      enhancementSettings: this.enhancementSettings,
      consistencyTemplateVersion: this.consistentSummaryService.templateVersion
    };
  }
}

export default LLMTextEnhancementService;
