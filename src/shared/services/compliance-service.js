/**
 * Compliance Service
 * Handles all compliance-related business logic
 */
import { ComplianceServiceInterface } from '../interfaces/service.js';
import { setupLogger } from '../../utils/logger.js';
import { ValidationError, ComplianceError } from '../../core/error-types.js';

export class ComplianceService extends ComplianceServiceInterface {
  constructor(dependencies = {}) {
    super(dependencies);
    this.regulationRepository = dependencies.regulationRepository;
    this.llmService = dependencies.llmService;
    this.validationService = dependencies.validationService;
    this.cacheRepository = dependencies.cacheRepository;
    this.logger = setupLogger('compliance-service');
    
    if (!this.regulationRepository) {
      throw new Error('RegulationRepository is required');
    }
    if (!this.llmService) {
      throw new Error('LLMService is required');
    }
  }

  /**
   * Process a compliance query
   */
  async processQuery(query, options = {}) {
    try {
      this.logger.info(`Processing compliance query: "${query}"`);
      
      // Validate input
      if (this.validationService) {
        const validation = await this.validationService.validateComplianceQuery({ query });
        if (!validation.isValid) {
          throw new ValidationError('Invalid query input', validation.errors);
        }
      }
      
      // Check cache first
      const cacheKey = `compliance:query:${this._hashQuery(query)}`;
      if (this.cacheRepository) {
        const cached = await this.cacheRepository.get(cacheKey);
        if (cached) {
          this.logger.debug(`Returning cached result for query: ${query}`);
          return cached;
        }
      }
      
      // Get relevant regulations
      const regulations = await this._findRelevantRegulations(query, options);
      
      // Create context for LLM
      const context = this._createComplianceContext(regulations);
      
      // Process with LLM
      const llmResponse = await this.llmService.analyzeCompliance(query, regulations);
      
      // Format response
      const result = {
        query,
        response: this._formatComplianceResponse(llmResponse),
        relevantRegulations: regulations.map(reg => ({
          id: reg.id,
          name: reg.name,
          category: reg.category
        })),
        timestamp: new Date().toISOString(),
        processingTime: Date.now() - (options.startTime || Date.now())
      };
      
      // Cache the result
      if (this.cacheRepository) {
        await this.cacheRepository.set(cacheKey, result, 1800); // Cache for 30 minutes
      }
      
      this.logger.info(`Successfully processed compliance query in ${result.processingTime}ms`);
      return result;
      
    } catch (error) {
      this.handleError(error, 'processQuery', { query, options });
    }
  }

  /**
   * Validate content against regulations
   */
  async validateContent(content, regulationIds = []) {
    try {
      this.logger.info(`Validating content against ${regulationIds.length || 'all'} regulations`);
      
      // Get regulations to check
      let regulations;
      if (regulationIds.length > 0) {
        regulations = await this.regulationRepository.findMany({ ids: regulationIds });
      } else {
        regulations = await this.regulationRepository.findAll();
      }
      
      // Process each regulation
      const results = await Promise.all(
        regulations.map(regulation => this._validateAgainstRegulation(content, regulation))
      );
      
      // Calculate overall compliance score
      const complianceScore = this._calculateComplianceScore(results);
      
      return {
        content: content.substring(0, 100) + '...', // Truncated for response
        regulations: results,
        overallScore: complianceScore,
        compliant: complianceScore >= 0.8, // 80% threshold
        timestamp: new Date().toISOString(),
        summary: this._generateValidationSummary(results)
      };
      
    } catch (error) {
      this.handleError(error, 'validateContent', { contentLength: content.length, regulationIds });
    }
  }

  /**
   * Detect changes in compliance status
   */
  async detectChanges(previousContent, currentContent, categories = []) {
    try {
      this.logger.info(`Detecting compliance changes across ${categories.length || 'all'} categories`);
      
      // Get regulations by categories
      let regulations;
      if (categories.length > 0) {
        const promises = categories.map(cat => 
          this.regulationRepository.findByCategory(cat)
        );
        const categoryResults = await Promise.all(promises);
        regulations = categoryResults.flat();
      } else {
        regulations = await this.regulationRepository.findAll();
      }
      
      // Analyze both contents
      const [previousResults, currentResults] = await Promise.all([
        this._analyzeContentForChanges(previousContent, regulations),
        this._analyzeContentForChanges(currentContent, regulations)
      ]);
      
      // Compare results and detect changes
      const changes = this._compareAnalysisResults(previousResults, currentResults);
      
      return {
        changesDetected: changes.length > 0,
        changes,
        categoriesChecked: categories,
        regulationsAnalyzed: regulations.length,
        timestamp: new Date().toISOString(),
        summary: this._generateChangesSummary(changes)
      };
      
    } catch (error) {
      this.handleError(error, 'detectChanges', { 
        previousLength: previousContent.length, 
        currentLength: currentContent.length, 
        categories 
      });
    }
  }

  /**
   * Get compliance summary for content
   */
  async getComplianceSummary(content) {
    try {
      // Get all regulations and their categories
      const regulations = await this.regulationRepository.findAll();
      const categories = await this.regulationRepository.getCategories();
      
      // Analyze content against all regulations
      const validationResults = await this.validateContent(content);
      
      // Group results by category
      const categoryAnalysis = this._groupResultsByCategory(validationResults.regulations);
      
      return {
        overallCompliance: validationResults.compliant,
        overallScore: validationResults.overallScore,
        totalRegulations: regulations.length,
        categoriesAnalyzed: categories.length,
        categoryBreakdown: categoryAnalysis,
        topIssues: this._extractTopIssues(validationResults.regulations),
        recommendations: this._generateRecommendations(validationResults.regulations),
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      this.handleError(error, 'getComplianceSummary', { contentLength: content.length });
    }
  }

  // Private helper methods

  async _findRelevantRegulations(query, options) {
    const keywords = this._extractKeywords(query);
    
    if (keywords.length > 0) {
      return await this.regulationRepository.findByKeywords(keywords.join(' '));
    }
    
    // Fallback to all regulations if no specific keywords
    const limit = options.maxRegulations || 20;
    return await this.regulationRepository.findMany({}, { limit });
  }

  _extractKeywords(text) {
    // Simple keyword extraction - could be enhanced with NLP
    return text
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 3)
      .filter(word => !['this', 'that', 'with', 'from', 'they', 'have', 'been'].includes(word))
      .slice(0, 10); // Limit to top 10 keywords
  }

  _createComplianceContext(regulations) {
    return regulations.map(reg => ({
      id: reg.id,
      name: reg.name,
      category: reg.category,
      description: reg.description,
      statute: reg.statute,
      requirements: reg.reportingRequirements
    }));
  }

  _formatComplianceResponse(llmResponse) {
    return {
      fullResponse: llmResponse.analysis || llmResponse,
      confidence: llmResponse.confidence || 0.8,
      keyPoints: llmResponse.keyPoints || [],
      actionItems: llmResponse.actionItems || []
    };
  }

  async _validateAgainstRegulation(content, regulation) {
    // Use LLM to analyze content against specific regulation
    const prompt = this._createValidationPrompt(content, regulation);
    const llmResult = await this.llmService.query(prompt);
    
    return {
      regulationId: regulation.id,
      name: regulation.name,
      category: regulation.category,
      compliant: this._parseComplianceResult(llmResult),
      confidence: this._parseConfidence(llmResult),
      issues: this._parseIssues(llmResult),
      recommendations: this._parseRecommendations(llmResult)
    };
  }

  _createValidationPrompt(content, regulation) {
    return `
Analyze the following content for compliance with this regulation:

REGULATION:
Name: ${regulation.name}
Category: ${regulation.category}
Description: ${regulation.description}
Requirements: ${regulation.reportingRequirements}

CONTENT TO ANALYZE:
${content}

Respond with:
1. COMPLIANT: Yes/No
2. CONFIDENCE: 0.0-1.0
3. ISSUES: List any compliance issues
4. RECOMMENDATIONS: Specific recommendations
`;
  }

  _parseComplianceResult(llmResult) {
    // Simple parsing - could be enhanced
    return llmResult.toLowerCase().includes('compliant: yes');
  }

  _parseConfidence(llmResult) {
    const match = llmResult.match(/confidence:\s*([\d.]+)/i);
    return match ? parseFloat(match[1]) : 0.7;
  }

  _parseIssues(llmResult) {
    // Extract issues from LLM response
    const issuesMatch = llmResult.match(/issues:(.*?)(?:recommendations:|$)/is);
    if (issuesMatch) {
      return issuesMatch[1].trim().split('\n').filter(line => line.trim());
    }
    return [];
  }

  _parseRecommendations(llmResult) {
    // Extract recommendations from LLM response
    const recMatch = llmResult.match(/recommendations:(.*?)$/is);
    if (recMatch) {
      return recMatch[1].trim().split('\n').filter(line => line.trim());
    }
    return [];
  }

  _calculateComplianceScore(results) {
    if (results.length === 0) return 0;
    
    const totalScore = results.reduce((sum, result) => {
      const score = result.compliant ? 1 : 0;
      return sum + (score * result.confidence);
    }, 0);
    
    return totalScore / results.length;
  }

  _generateValidationSummary(results) {
    const compliant = results.filter(r => r.compliant).length;
    const total = results.length;
    
    return {
      compliantRegulations: compliant,
      totalRegulations: total,
      complianceRate: total > 0 ? (compliant / total) : 0,
      criticalIssues: results.filter(r => !r.compliant && r.confidence > 0.8).length
    };
  }

  async _analyzeContentForChanges(content, regulations) {
    // Simplified analysis for change detection
    return regulations.map(reg => ({
      regulationId: reg.id,
      relevance: this._calculateRelevance(content, reg),
      riskLevel: this._assessRiskLevel(content, reg)
    }));
  }

  _compareAnalysisResults(previous, current) {
    const changes = [];
    
    for (let i = 0; i < previous.length; i++) {
      const prev = previous[i];
      const curr = current[i];
      
      if (Math.abs(prev.relevance - curr.relevance) > 0.2 ||
          prev.riskLevel !== curr.riskLevel) {
        changes.push({
          regulationId: prev.regulationId,
          changeType: curr.relevance > prev.relevance ? 'increased_relevance' : 'decreased_relevance',
          previousScore: prev.relevance,
          currentScore: curr.relevance,
          riskChange: prev.riskLevel !== curr.riskLevel
        });
      }
    }
    
    return changes;
  }

  _calculateRelevance(content, regulation) {
    // Simple keyword matching - could be enhanced with ML
    const keywords = regulation.keywords || [];
    const contentLower = content.toLowerCase();
    
    const matches = keywords.filter(keyword => 
      contentLower.includes(keyword)
    ).length;
    
    return keywords.length > 0 ? matches / keywords.length : 0;
  }

  _assessRiskLevel(content, regulation) {
    const relevance = this._calculateRelevance(content, regulation);
    
    if (relevance > 0.7) return 'high';
    if (relevance > 0.4) return 'medium';
    return 'low';
  }

  _groupResultsByCategory(results) {
    const grouped = {};
    
    results.forEach(result => {
      if (!grouped[result.category]) {
        grouped[result.category] = {
          total: 0,
          compliant: 0,
          issues: []
        };
      }
      
      grouped[result.category].total++;
      if (result.compliant) {
        grouped[result.category].compliant++;
      }
      grouped[result.category].issues.push(...result.issues);
    });
    
    return grouped;
  }

  _extractTopIssues(results) {
    const allIssues = results.flatMap(r => r.issues);
    const issueCounts = {};
    
    allIssues.forEach(issue => {
      issueCounts[issue] = (issueCounts[issue] || 0) + 1;
    });
    
    return Object.entries(issueCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([issue, count]) => ({ issue, count }));
  }

  _generateRecommendations(results) {
    const recommendations = results
      .filter(r => !r.compliant)
      .flatMap(r => r.recommendations)
      .slice(0, 10);
    
    return [...new Set(recommendations)]; // Remove duplicates
  }

  _generateChangesSummary(changes) {
    const increased = changes.filter(c => c.changeType === 'increased_relevance').length;
    const decreased = changes.filter(c => c.changeType === 'decreased_relevance').length;
    
    return {
      totalChanges: changes.length,
      increasedRelevance: increased,
      decreasedRelevance: decreased,
      riskChanges: changes.filter(c => c.riskChange).length
    };
  }

  _hashQuery(query) {
    // Simple hash function for caching
    let hash = 0;
    for (let i = 0; i < query.length; i++) {
      const char = query.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString();
  }
} 