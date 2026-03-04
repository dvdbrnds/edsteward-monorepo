/**
 * Enhanced Summary Integration Service
 * 
 * Integrates LLM-enhanced summaries with the existing MCP Engine infrastructure
 * and EdSteward delivery system while maintaining consistency for differential views.
 */

import { LLMTextEnhancementService } from './llm-text-enhancement-service.js';
import { setupLogger } from '../utils/logger.js';

const logger = setupLogger('enhanced-summary-integration');

export class EnhancedSummaryIntegration {
  constructor(options = {}) {
    this.enhancementService = new LLMTextEnhancementService(options);
    this.integrationSettings = {
      enableEdStewardDelivery: options.enableEdStewardDelivery !== false,
      enableConsistencyChecking: options.enableConsistencyChecking !== false,
      enableBatchProcessing: options.enableBatchProcessing !== false
    };
  }

  /**
   * Enhance regulation and integrate with existing LLM Gateway endpoints
   * This replaces the basic generateCustomerFocusedSummary function
   */
  async enhanceRegulationForGateway(regulationSlug, regulationTitle, fullText) {
    try {
      logger.info(`Enhancing regulation for gateway: ${regulationSlug}`);
      
      // Use the LLM enhancement service
      const enhanced = await this.enhancementService.enhanceRegulationText(
        regulationSlug,
        regulationTitle,
        fullText
      );
      
      // Format for existing gateway response structure
      const gatewayResponse = {
        success: true,
        data: {
          title: regulationTitle,
          source: 'Code of Federal Regulations',
          content: fullText,
          fullText: fullText,
          
          // Enhanced summary (replaces basic template)
          summary: enhanced.summary,
          summarySource: enhanced.summarySource,
          summaryMetadata: enhanced.summaryMetadata,
          
          // Additional enhancements
          enhancedSummary: enhanced.summary,
          baseSummary: enhanced.summary, // For backward compatibility
          citations: enhanced.relatedRegulations || [],
          workflowStatus: 'enhanced',
          
          // Business-focused additions
          keyRequirements: enhanced.keyRequirements,
          complianceActions: enhanced.complianceActions,
          businessImpact: enhanced.businessImpact,
          implementationSteps: enhanced.implementationSteps,
          riskLevel: enhanced.riskLevel,
          
          // Metadata
          lastUpdated: new Date().toISOString(),
          metadata: {
            confidence: 95, // High confidence for LLM-enhanced content
            isReal: true,
            version: "2025.1",
            enhancementVersion: enhanced.enhancementVersion,
            consistencyHash: enhanced.consistency.consistencyHash,
            isConsistent: enhanced.consistency.isConsistent
          },
          sections: []
        }
      };
      
      // Trigger EdSteward delivery if enabled
      if (this.integrationSettings.enableEdStewardDelivery) {
        await this.deliverToEdSteward(regulationSlug, enhanced);
      }
      
      return gatewayResponse;
      
    } catch (error) {
      logger.error(`Failed to enhance regulation for gateway: ${regulationSlug}`, error);
      
      // Fallback to basic summary
      return this.generateFallbackGatewayResponse(regulationSlug, regulationTitle, fullText);
    }
  }

  /**
   * Generate fallback response when enhancement fails
   */
  generateFallbackGatewayResponse(regulationSlug, regulationTitle, fullText) {
    logger.warn(`Generating fallback gateway response for ${regulationSlug}`);
    
    const basicSummary = `Your organization must comply with ${regulationTitle} requirements. Review the regulation text and implement necessary compliance measures.`;
    
    return {
      success: true,
      data: {
        title: regulationTitle,
        source: 'Code of Federal Regulations',
        content: fullText,
        fullText: fullText,
        summary: basicSummary,
        summarySource: 'MCP Engine Fallback',
        enhancedSummary: basicSummary,
        baseSummary: basicSummary,
        citations: [],
        workflowStatus: 'fallback',
        lastUpdated: new Date().toISOString(),
        metadata: {
          confidence: 70,
          isReal: true,
          version: "2025.1",
          isFallback: true
        },
        sections: []
      }
    };
  }

  /**
   * Deliver enhanced summary to EdSteward system
   */
  async deliverToEdSteward(regulationSlug, enhancedData) {
    try {
      logger.info(`Delivering enhanced summary to EdSteward: ${regulationSlug}`);
      
      // Format for EdSteward delivery
      const edstewardPayload = {
        regulationId: regulationSlug,
        summary: enhancedData.summary,
        summarySource: 'MCP Engine Enhanced',
        keyRequirements: enhancedData.keyRequirements,
        complianceActions: enhancedData.complianceActions,
        riskLevel: enhancedData.riskLevel,
        businessImpact: enhancedData.businessImpact,
        lastUpdated: enhancedData.enhancedAt,
        consistencyMetadata: enhancedData.consistency,
        enhancementVersion: enhancedData.enhancementVersion
      };
      
      // Send to EdSteward integration (if available)
      if (typeof global.edstewardIntegration !== 'undefined') {
        await global.edstewardIntegration.deliverEnhancedSummary(edstewardPayload);
        logger.info(`Successfully delivered to EdSteward: ${regulationSlug}`);
      } else {
        logger.warn('EdSteward integration not available, skipping delivery');
      }
      
    } catch (error) {
      logger.error(`Failed to deliver to EdSteward: ${regulationSlug}`, error);
      // Don't throw - delivery failure shouldn't break the enhancement
    }
  }

  /**
   * Batch process regulations for initial enhancement
   */
  async batchEnhanceRegulations(regulations, options = {}) {
    logger.info(`Starting batch enhancement of ${regulations.length} regulations`);
    
    const results = await this.enhancementService.batchEnhanceRegulations(regulations, {
      ...options,
      batchSize: options.batchSize || 3 // Conservative batch size for stability
    });
    
    // Process successful enhancements for EdSteward delivery
    if (this.integrationSettings.enableEdStewardDelivery) {
      const successful = results.filter(r => r.success);
      
      for (const result of successful) {
        try {
          await this.deliverToEdSteward(result.regulation, result.data);
        } catch (error) {
          logger.error(`Failed EdSteward delivery for ${result.regulation}:`, error);
        }
      }
    }
    
    return results;
  }

  /**
   * Handle regulation updates with consistency checking
   */
  async handleRegulationUpdate(regulationSlug, oldText, newText, oldSummary = null) {
    try {
      logger.info(`Handling regulation update: ${regulationSlug}`);
      
      // Detect changes with consistency preservation
      const changeAnalysis = await this.enhancementService.detectRegulationChanges(
        regulationSlug,
        oldText,
        newText,
        oldSummary
      );
      
      // Only deliver to EdSteward if there are substantive changes
      if (changeAnalysis.differentialViewSafe && this.integrationSettings.enableEdStewardDelivery) {
        const updatePayload = {
          regulationId: regulationSlug,
          changeType: changeAnalysis.changeType,
          hasSubstantiveChanges: changeAnalysis.hasChanges,
          changes: changeAnalysis.changes,
          newSummary: changeAnalysis.newSummary,
          oldSummary: changeAnalysis.oldSummary,
          impactLevel: changeAnalysis.impactLevel,
          recommendedAction: changeAnalysis.recommendedAction,
          updatedAt: new Date().toISOString()
        };
        
        if (typeof global.edstewardIntegration !== 'undefined') {
          await global.edstewardIntegration.deliverRegulationUpdate(updatePayload);
        }
      }
      
      return changeAnalysis;
      
    } catch (error) {
      logger.error(`Failed to handle regulation update: ${regulationSlug}`, error);
      throw error;
    }
  }

  /**
   * Integration with existing CFR endpoint
   * This can be called from simple-usc-gateway.js to replace generateCustomerFocusedSummary
   */
  async enhanceForCFREndpoint(regulationSlug, regulationTitle, fullText) {
    const enhanced = await this.enhanceRegulationForGateway(regulationSlug, regulationTitle, fullText);
    
    // Return just the summary for backward compatibility
    return enhanced.data.summary;
  }

  /**
   * Get integration statistics
   */
  getIntegrationStats() {
    return {
      enhancementService: this.enhancementService.getStats(),
      integrationSettings: this.integrationSettings,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage()
    };
  }

  /**
   * Health check for the integration
   */
  async healthCheck() {
    try {
      // Test enhancement service
      const testEnhancement = await this.enhancementService.enhanceRegulationText(
        'health-check',
        'Health Check Regulation',
        'This is a test regulation for health checking purposes.',
        { skipCache: true }
      );
      
      return {
        status: 'healthy',
        enhancementService: 'operational',
        edstewardIntegration: typeof global.edstewardIntegration !== 'undefined' ? 'available' : 'unavailable',
        lastHealthCheck: new Date().toISOString(),
        testEnhancementGenerated: !!testEnhancement.summary
      };
      
    } catch (error) {
      logger.error('Health check failed:', error);
      return {
        status: 'unhealthy',
        error: error.message,
        lastHealthCheck: new Date().toISOString()
      };
    }
  }
}

export default EnhancedSummaryIntegration;
