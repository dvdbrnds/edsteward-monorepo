const {
  ValidationStatus,
  SeverityLevel,
  ValidationStrategy
} = require('../../common/mcp/protocol');

const VALIDATION_LEVELS = {
  LEVEL1: 'level1',
  LEVEL2: 'level2',
  LEVEL3: 'level3',
  LEVEL4: 'level4'
};

class OrchestratorService {
  constructor(config = {}) {
    this.config = {
      useCache: true,
      cacheTTL: 3600, // 1 hour
      parallelValidation: true,
      ...config
    };

    this.validationCache = new Map();
  }

  /**
   * Orchestrates validation across multiple levels
   * @param {Object} request - Validation request
   * @param {Object} options - Validation options
   * @returns {Promise<Object>} Aggregated validation result
   */
  async orchestrateValidation(request, options = {}) {
    try {
      const {
        strategy = ValidationStrategy.ALL,
        levels = Object.values(VALIDATION_LEVELS),
        skipCache = false
      } = options;

      // Check cache if enabled
      if (!skipCache && this.config.useCache) {
        const cachedResult = this.getCachedResult(request);
        if (cachedResult) {
          return cachedResult;
        }
      }

      // Determine validation sequence
      const validationSequence = this.determineValidationSequence(levels, strategy);

      // Execute validations
      const results = await this.executeValidations(validationSequence, request);

      // Aggregate results
      const aggregatedResult = this.aggregateResults(results);

      // Cache result if enabled
      if (this.config.useCache) {
        this.cacheResult(request, aggregatedResult);
      }

      return aggregatedResult;
    } catch (error) {
      console.error('Validation orchestration error:', error);
      throw new Error(`Orchestration failed: ${error.message}`);
    }
  }

  /**
   * Determines the sequence of validations to run
   * @param {Array} levels - Validation levels to include
   * @param {string} strategy - Validation strategy
   * @returns {Array} Ordered sequence of validations
   */
  determineValidationSequence(levels, strategy) {
    const sequence = [...levels].sort(); // Ensure consistent ordering

    switch (strategy) {
      case ValidationStrategy.FAST_FAIL:
        // Order by complexity (fastest first)
        return sequence.sort((a, b) => this.getValidationComplexity(a) - this.getValidationComplexity(b));

      case ValidationStrategy.THOROUGH:
        // Order by complexity (most thorough first)
        return sequence.sort((a, b) => this.getValidationComplexity(b) - this.getValidationComplexity(a));

      case ValidationStrategy.CACHED_FIRST:
        // Prioritize levels with cached results
        return sequence.sort((a, b) => {
          const aHasCache = this.hasCachedResults(a);
          const bHasCache = this.hasCachedResults(b);
          return bHasCache - aHasCache;
        });
      
      case ValidationStrategy.CONFIDENCE_PRIORITIZED:
        // Prioritize based on historic confidence scores (highest first)
        return sequence.sort((a, b) => 
          this.getHistoricConfidence(b) - this.getHistoricConfidence(a)
        );
      
      case ValidationStrategy.PERFORMANCE_OPTIMIZED:
        // Optimize for execution speed
        return this.getPerformanceOptimizedSequence(sequence);
      
      case ValidationStrategy.COST_OPTIMIZED:
        // Optimize for computational cost
        return this.getCostOptimizedSequence(sequence);
      
      case ValidationStrategy.ADAPTIVE:
        // Adapt strategy based on input characteristics
        return this.getAdaptiveSequence(sequence);

      default: // ValidationStrategy.ALL
        return sequence;
    }
  }

  /**
   * Executes validation sequence
   * @param {Array} sequence - Validation sequence
   * @param {Object} request - Validation request
   * @returns {Promise<Array>} Validation results
   */
  async executeValidations(sequence, request) {
    if (this.config.parallelValidation) {
      // Execute validations in parallel
      const validationPromises = sequence.map(level =>
        this.executeValidationLevel(level, request)
      );
      return Promise.all(validationPromises);
    } else {
      // Execute validations sequentially
      const results = [];
      for (const level of sequence) {
        const result = await this.executeValidationLevel(level, request);
        results.push(result);

        // Check for fast-fail condition
        if (result.status === ValidationStatus.FAIL && request.strategy === ValidationStrategy.FAST_FAIL) {
          break;
        }
      }
      return results;
    }
  }

  /**
   * Executes a single validation level
   * @param {string} level - Validation level
   * @param {Object} request - Validation request
   * @returns {Promise<Object>} Validation result
   */
  async executeValidationLevel(level, request) {
    try {
      // Import validator dynamically
      const validator = require(`../validators/${level}`);
      
      // Prepare level-specific configuration
      const levelConfig = this.getLevelConfiguration(level, request);

      // Execute validation
      const result = await validator.handler({
        request,
        configuration: levelConfig
      });

      return {
        level,
        ...result
      };
    } catch (error) {
      console.error(`Error in ${level} validation:`, error);
      return {
        level,
        status: ValidationStatus.ERROR,
        confidence: 0,
        findings: [{
          id: `${level.toUpperCase()}_ERROR`,
          severity: SeverityLevel.ERROR,
          message: `Validation failed: ${error.message}`
        }]
      };
    }
  }

  /**
   * Aggregates results from multiple validation levels
   * @param {Array} results - Validation results
   * @returns {Object} Aggregated result
   */
  aggregateResults(results) {
    const aggregated = {
      status: ValidationStatus.PASS,
      confidence: 1.0,
      findings: [],
      levelResults: {}
    };

    let totalConfidence = 0;
    let validLevels = 0;

    for (const result of results) {
      // Store individual level results
      aggregated.levelResults[result.level] = {
        status: result.status,
        confidence: result.confidence
      };

      // Aggregate findings
      if (result.findings) {
        aggregated.findings.push(...result.findings.map(finding => ({
          ...finding,
          level: result.level
        })));
      }

      // Update status
      if (result.status === ValidationStatus.FAIL) {
        aggregated.status = ValidationStatus.FAIL;
      } else if (result.status === ValidationStatus.ERROR && aggregated.status !== ValidationStatus.FAIL) {
        aggregated.status = ValidationStatus.ERROR;
      }

      // Update confidence
      if (result.status !== ValidationStatus.ERROR) {
        totalConfidence += result.confidence;
        validLevels++;
      }
    }

    // Calculate average confidence
    if (validLevels > 0) {
      aggregated.confidence = totalConfidence / validLevels;
    } else {
      aggregated.confidence = 0;
    }

    return aggregated;
  }

  /**
   * Gets level-specific configuration
   * @param {string} level - Validation level
   * @param {Object} request - Validation request
   * @returns {Object} Level configuration
   */
  getLevelConfiguration(level, request) {
    const baseConfig = {
      useCache: this.config.useCache
    };

    switch (level) {
      case VALIDATION_LEVELS.LEVEL1:
        return {
          ...baseConfig,
          textMatchThreshold: 0.95
        };

      case VALIDATION_LEVELS.LEVEL2:
        return {
          ...baseConfig,
          semanticMatchThreshold: 0.85,
          useNLP: true
        };

      case VALIDATION_LEVELS.LEVEL3:
        return {
          ...baseConfig,
          structuralMatchThreshold: 0.90,
          validateRelationships: true
        };

      case VALIDATION_LEVELS.LEVEL4:
        return {
          ...baseConfig,
          temporalMatchThreshold: 0.95,
          validateHistory: true,
          validateCrossRefs: true,
          maxReferences: 100
        };

      default:
        return baseConfig;
    }
  }

  /**
   * Gets relative complexity of validation level
   * @param {string} level - Validation level
   * @returns {number} Complexity score
   */
  getValidationComplexity(level) {
    const complexityMap = {
      [VALIDATION_LEVELS.LEVEL1]: 1,
      [VALIDATION_LEVELS.LEVEL2]: 2,
      [VALIDATION_LEVELS.LEVEL3]: 3,
      [VALIDATION_LEVELS.LEVEL4]: 4
    };
    return complexityMap[level] || 0;
  }

  /**
   * Checks if level has cached results
   * @param {string} level - Validation level
   * @returns {boolean} Whether cache exists
   */
  hasCachedResults(level) {
    return Array.from(this.validationCache.values()).some(
      cache => cache.levelResults && cache.levelResults[level]
    );
  }

  /**
   * Gets cached validation result
   * @param {Object} request - Validation request
   * @returns {Object|null} Cached result
   */
  getCachedResult(request) {
    const cacheKey = this.generateCacheKey(request);
    const cached = this.validationCache.get(cacheKey);

    if (!cached) return null;

    // Check if cache is expired
    if (Date.now() - cached.timestamp > this.config.cacheTTL * 1000) {
      this.validationCache.delete(cacheKey);
      return null;
    }

    return cached.result;
  }

  /**
   * Caches validation result
   * @param {Object} request - Validation request
   * @param {Object} result - Validation result
   */
  cacheResult(request, result) {
    const cacheKey = this.generateCacheKey(request);
    this.validationCache.set(cacheKey, {
      result,
      timestamp: Date.now()
    });
  }

  /**
   * Generates cache key for request
   * @param {Object} request - Validation request
   * @returns {string} Cache key
   */
  generateCacheKey(request) {
    const { regulation, data } = request;
    return `${regulation.id}_${regulation.version}_${this.hashData(data)}`;
  }

  /**
   * Generates simple hash of data for cache key
   * @param {Object} data - Data to hash
   * @returns {string} Hash string
   */
  hashData(data) {
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Gets historic confidence scores for validation level
   * @param {string} level - Validation level
   * @returns {number} Historic confidence score (0-1)
   */
  getHistoricConfidence(level) {
    // Check cached results for this level's historic confidence
    const cachedResults = Array.from(this.validationCache.values())
      .filter(cache => 
        cache.result?.levelResults && 
        cache.result.levelResults[level] &&
        cache.result.levelResults[level].confidence !== undefined
      );
    
    if (cachedResults.length === 0) {
      // No historic data, fallback to complexity-based ordering
      return 1 - (this.getValidationComplexity(level) / 10);
    }
    
    // Calculate average confidence from cache
    const totalConfidence = cachedResults.reduce(
      (sum, cache) => sum + cache.result.levelResults[level].confidence, 
      0
    );
    
    return totalConfidence / cachedResults.length;
  }

  /**
   * Gets performance-optimized validation sequence
   * @param {Array} levels - Validation levels to sequence
   * @returns {Array} Optimized sequence
   */
  getPerformanceOptimizedSequence(levels) {
    // For performance optimization, consider:
    // 1. Execution time from historical data
    // 2. Complexity of validation
    // 3. Likelihood of failure (fail-fast)
    
    return levels.sort((a, b) => {
      // Get average execution time from cache if available
      const aTime = this.getAverageExecutionTime(a);
      const bTime = this.getAverageExecutionTime(b);
      
      // Get historical failure rates
      const aFailRate = this.getHistoricalFailRate(a);
      const bFailRate = this.getHistoricalFailRate(b);
      
      // Calculate performance score (lower is better)
      // Weight execution time higher than failure rate
      const aScore = (aTime * 0.7) - (aFailRate * 0.3);
      const bScore = (bTime * 0.7) - (bFailRate * 0.3);
      
      return aScore - bScore;
    });
  }

  /**
   * Gets cost-optimized validation sequence
   * @param {Array} levels - Validation levels to sequence
   * @returns {Array} Optimized sequence
   */
  getCostOptimizedSequence(levels) {
    // For cost optimization, consider:
    // 1. Computational complexity
    // 2. External service calls
    // 3. Historical ability to detect issues early
    
    // In most cases, run least complex validators first
    const sequence = [...levels].sort((a, b) => 
      this.getValidationComplexity(a) - this.getValidationComplexity(b)
    );
    
    // For level3 and level4, which make external calls, move to end
    // if they don't have a high probability of finding issues
    return sequence.sort((a, b) => {
      if ((a === 'level3' || a === 'level4') && 
          this.getHistoricalIssueDetectionRate(a) < 0.3) {
        return 1; // Move to end
      }
      if ((b === 'level3' || b === 'level4') && 
          this.getHistoricalIssueDetectionRate(b) < 0.3) {
        return -1; // Move to end
      }
      return 0;
    });
  }

  /**
   * Gets adaptive validation sequence based on input characteristics
   * @param {Array} levels - Validation levels to sequence
   * @returns {Array} Optimized sequence
   */
  getAdaptiveSequence(levels) {
    // Determine input characteristics and select appropriate strategy
    // This is a meta-strategy that chooses the best approach based on:
    // 1. Input data size and complexity
    // 2. Historical performance on similar inputs
    // 3. Current system load
    
    // Get current system load factor (mock implementation)
    const systemLoad = this.getCurrentSystemLoad();
    
    // If system is under heavy load, prioritize performance
    if (systemLoad > 0.8) {
      return this.getPerformanceOptimizedSequence(levels);
    }
    
    // If we have a good cache hit rate, use cached-first
    const cacheHitRate = this.getCacheHitRate();
    if (cacheHitRate > 0.7) {
      return levels.sort((a, b) => {
        const aHasCache = this.hasCachedResults(a);
        const bHasCache = this.hasCachedResults(b);
        return bHasCache - aHasCache;
      });
    }
    
    // Default to confidence-prioritized for balanced approach
    return levels.sort((a, b) => 
      this.getHistoricConfidence(b) - this.getHistoricConfidence(a)
    );
  }

  /**
   * Gets average execution time for a validation level
   * @param {string} level - Validation level
   * @returns {number} Average execution time (normalized 0-1)
   */
  getAverageExecutionTime(level) {
    // Mock implementation - in production, this would track actual execution times
    const executionTimeMap = {
      'level1': 0.2, // Fastest
      'level2': 0.5,
      'level3': 0.7,
      'level4': 1.0  // Slowest
    };
    
    return executionTimeMap[level] || 0.5;
  }

  /**
   * Gets historical failure rate for a validation level
   * @param {string} level - Validation level
   * @returns {number} Failure rate (0-1)
   */
  getHistoricalFailRate(level) {
    // In a real implementation, this would analyze cached results
    // to determine how often this validator fails
    const cachedResults = Array.from(this.validationCache.values())
      .filter(cache => 
        cache.result?.levelResults &&
        cache.result.levelResults[level]
      );
    
    if (cachedResults.length === 0) {
      return 0.1; // Default value
    }
    
    const failCount = cachedResults.filter(cache => 
      cache.result.levelResults[level].status === ValidationStatus.FAIL
    ).length;
    
    return failCount / cachedResults.length;
  }

  /**
   * Gets historical issue detection rate for a validation level
   * @param {string} level - Validation level
   * @returns {number} Issue detection rate (0-1)
   */
  getHistoricalIssueDetectionRate(level) {
    // Similar to failure rate, but specifically for finding issues
    // This would track how often this validator finds unique issues
    
    // For this mock implementation, we'll use fixed rates
    const detectionRates = {
      'level1': 0.4,
      'level2': 0.5,
      'level3': 0.3,
      'level4': 0.2
    };
    
    return detectionRates[level] || 0.3;
  }

  /**
   * Gets current system load factor
   * @returns {number} System load (0-1)
   */
  getCurrentSystemLoad() {
    // In a real implementation, this would check actual system metrics
    // For now, return a random value
    return Math.random();
  }

  /**
   * Gets cache hit rate
   * @returns {number} Cache hit rate (0-1)
   */
  getCacheHitRate() {
    // In a real implementation, this would track cache hits vs. misses
    // For now, estimate based on cache size
    const cacheSize = this.validationCache.size;
    return Math.min(cacheSize / 10, 1); // Normalize to 0-1
  }
}

module.exports = OrchestratorService; 