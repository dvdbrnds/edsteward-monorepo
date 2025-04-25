const OrchestratorService = require('../service');
const {
  ValidationStatus,
  SeverityLevel,
  ValidationStrategy
} = require('../../../common/mcp/protocol');

// Mock validators
jest.mock('../../validators/level1', () => ({
  handler: jest.fn()
}));
jest.mock('../../validators/level2', () => ({
  handler: jest.fn()
}));
jest.mock('../../validators/level3', () => ({
  handler: jest.fn()
}));
jest.mock('../../validators/level4', () => ({
  handler: jest.fn()
}));

const level1 = require('../../validators/level1');
const level2 = require('../../validators/level2');
const level3 = require('../../validators/level3');
const level4 = require('../../validators/level4');

describe('OrchestratorService', () => {
  let orchestrator;
  let mockRequest;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create orchestrator instance
    orchestrator = new OrchestratorService({
      useCache: true,
      cacheTTL: 3600,
      parallelValidation: true
    });

    // Setup mock request
    mockRequest = {
      regulation: {
        id: 'TEST-REG-001',
        version: '1.0'
      },
      data: {
        metadata: {
          version: '1.0',
          status: 'draft'
        },
        content: {
          text: 'Test content'
        }
      }
    };

    // Setup default mock responses
    const mockSuccess = {
      status: ValidationStatus.PASS,
      confidence: 1.0,
      findings: []
    };

    level1.handler.mockResolvedValue(mockSuccess);
    level2.handler.mockResolvedValue(mockSuccess);
    level3.handler.mockResolvedValue(mockSuccess);
    level4.handler.mockResolvedValue(mockSuccess);
  });

  describe('Validation Orchestration', () => {
    it('should orchestrate validation across all levels', async () => {
      const result = await orchestrator.orchestrateValidation(mockRequest);

      expect(result.status).toBe(ValidationStatus.PASS);
      expect(result.confidence).toBe(1.0);
      expect(result.findings).toHaveLength(0);
      expect(result.levelResults).toBeDefined();

      // Verify all validators were called
      expect(level1.handler).toHaveBeenCalled();
      expect(level2.handler).toHaveBeenCalled();
      expect(level3.handler).toHaveBeenCalled();
      expect(level4.handler).toHaveBeenCalled();
    });

    it('should handle validation failures', async () => {
      level2.handler.mockResolvedValue({
        status: ValidationStatus.FAIL,
        confidence: 0.5,
        findings: [{
          id: 'TEST-001',
          severity: SeverityLevel.ERROR,
          message: 'Test failure'
        }]
      });

      const result = await orchestrator.orchestrateValidation(mockRequest);

      expect(result.status).toBe(ValidationStatus.FAIL);
      expect(result.confidence).toBeLessThan(1.0);
      expect(result.findings).toHaveLength(1);
      expect(result.findings[0].level).toBe('level2');
    });

    it('should respect validation strategy', async () => {
      const options = {
        strategy: ValidationStrategy.FAST_FAIL,
        levels: ['level1', 'level2']
      };

      level1.handler.mockResolvedValue({
        status: ValidationStatus.FAIL,
        confidence: 0,
        findings: [{
          id: 'TEST-002',
          severity: SeverityLevel.ERROR,
          message: 'Fast fail test'
        }]
      });

      const result = await orchestrator.orchestrateValidation(mockRequest, options);

      expect(result.status).toBe(ValidationStatus.FAIL);
      expect(level2.handler).not.toHaveBeenCalled();
    });
  });

  describe('Caching', () => {
    it('should cache validation results', async () => {
      // First validation
      await orchestrator.orchestrateValidation(mockRequest);

      // Reset mock calls
      jest.clearAllMocks();

      // Second validation with same request
      const result = await orchestrator.orchestrateValidation(mockRequest);

      expect(result).toBeDefined();
      // Validators should not be called again
      expect(level1.handler).not.toHaveBeenCalled();
      expect(level2.handler).not.toHaveBeenCalled();
      expect(level3.handler).not.toHaveBeenCalled();
      expect(level4.handler).not.toHaveBeenCalled();
    });

    it('should bypass cache when skipCache is true', async () => {
      // First validation
      await orchestrator.orchestrateValidation(mockRequest);

      // Reset mock calls
      jest.clearAllMocks();

      // Second validation with skipCache
      await orchestrator.orchestrateValidation(mockRequest, { skipCache: true });

      // Validators should be called again
      expect(level1.handler).toHaveBeenCalled();
      expect(level2.handler).toHaveBeenCalled();
      expect(level3.handler).toHaveBeenCalled();
      expect(level4.handler).toHaveBeenCalled();
    });

    it('should expire cache after TTL', async () => {
      // Create orchestrator with short TTL
      orchestrator = new OrchestratorService({
        useCache: true,
        cacheTTL: 1, // 1 second
        parallelValidation: true
      });

      // First validation
      await orchestrator.orchestrateValidation(mockRequest);

      // Reset mock calls
      jest.clearAllMocks();

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Second validation
      await orchestrator.orchestrateValidation(mockRequest);

      // Validators should be called again
      expect(level1.handler).toHaveBeenCalled();
      expect(level2.handler).toHaveBeenCalled();
      expect(level3.handler).toHaveBeenCalled();
      expect(level4.handler).toHaveBeenCalled();
    });
  });

  describe('Validation Sequence', () => {
    it('should order by complexity for FAST_FAIL strategy', async () => {
      const sequence = orchestrator.determineValidationSequence(
        ['level4', 'level1', 'level3', 'level2'],
        ValidationStrategy.FAST_FAIL
      );

      expect(sequence[0]).toBe('level1');
      expect(sequence[sequence.length - 1]).toBe('level4');
    });

    it('should order by complexity for THOROUGH strategy', async () => {
      const sequence = orchestrator.determineValidationSequence(
        ['level1', 'level4', 'level2', 'level3'],
        ValidationStrategy.THOROUGH
      );

      expect(sequence[0]).toBe('level4');
      expect(sequence[sequence.length - 1]).toBe('level1');
    });

    it('should prioritize cached results for CACHED_FIRST strategy', async () => {
      // Add some cached results
      orchestrator.validationCache.set('test_key', {
        result: {
          levelResults: {
            level1: { status: ValidationStatus.PASS },
            level3: { status: ValidationStatus.PASS }
          }
        },
        timestamp: Date.now()
      });

      const sequence = orchestrator.determineValidationSequence(
        ['level4', 'level1', 'level3', 'level2'],
        ValidationStrategy.CACHED_FIRST
      );

      // level1 and level3 should come first (order between them is not guaranteed)
      expect(sequence.slice(0, 2).sort()).toEqual(['level1', 'level3']);
    });
    
    it('should prioritize by confidence for CONFIDENCE_PRIORITIZED strategy', async () => {
      // Mock getHistoricConfidence
      jest.spyOn(orchestrator, 'getHistoricConfidence').mockImplementation((level) => {
        const confidenceMap = {
          level1: 0.8,
          level2: 0.9,
          level3: 0.7,
          level4: 0.6
        };
        return confidenceMap[level] || 0.5;
      });
      
      const sequence = orchestrator.determineValidationSequence(
        ['level4', 'level1', 'level3', 'level2'],
        ValidationStrategy.CONFIDENCE_PRIORITIZED
      );
      
      // Should order by confidence (highest first)
      expect(sequence[0]).toBe('level2'); // 0.9 confidence
      expect(sequence[1]).toBe('level1'); // 0.8 confidence
      expect(sequence[2]).toBe('level3'); // 0.7 confidence
      expect(sequence[3]).toBe('level4'); // 0.6 confidence
    });
    
    it('should optimize for performance with PERFORMANCE_OPTIMIZED strategy', async () => {
      // Mock performance-related methods
      jest.spyOn(orchestrator, 'getAverageExecutionTime').mockImplementation((level) => {
        const timeMap = {
          level1: 0.1, // Fastest
          level2: 0.3,
          level3: 0.7,
          level4: 0.9  // Slowest
        };
        return timeMap[level] || 0.5;
      });
      
      jest.spyOn(orchestrator, 'getHistoricalFailRate').mockReturnValue(0.5);
      
      const sequence = orchestrator.determineValidationSequence(
        ['level4', 'level3', 'level2', 'level1'],
        ValidationStrategy.PERFORMANCE_OPTIMIZED
      );
      
      // Should prioritize faster validators
      expect(sequence[0]).toBe('level1');
      expect(sequence[sequence.length - 1]).toBe('level4');
    });
    
    it('should optimize for cost with COST_OPTIMIZED strategy', async () => {
      // Mock cost-related methods
      jest.spyOn(orchestrator, 'getHistoricalIssueDetectionRate').mockImplementation((level) => {
        const detectionMap = {
          level1: 0.5,
          level2: 0.4,
          level3: 0.2, // Below threshold (0.3)
          level4: 0.1  // Below threshold (0.3)
        };
        return detectionMap[level] || 0.3;
      });
      
      const sequence = orchestrator.determineValidationSequence(
        ['level4', 'level3', 'level2', 'level1'],
        ValidationStrategy.COST_OPTIMIZED
      );
      
      // Should prioritize cheaper validators and deprioritize level3 and level4
      // with low detection rates
      expect(sequence[0]).toBe('level1');
      expect(sequence[1]).toBe('level2');
      // level3 and level4 should be at the end (order between them may vary)
      expect(sequence.slice(2).sort()).toEqual(['level3', 'level4']);
    });
    
    it('should adapt strategy with ADAPTIVE strategy based on system load', async () => {
      // Mock high system load to trigger performance optimization
      jest.spyOn(orchestrator, 'getCurrentSystemLoad').mockReturnValue(0.9);
      
      // Mock performance methods
      jest.spyOn(orchestrator, 'getPerformanceOptimizedSequence').mockReturnValue(
        ['level1', 'level2', 'level3', 'level4']
      );
      
      const sequence = orchestrator.determineValidationSequence(
        ['level4', 'level3', 'level2', 'level1'],
        ValidationStrategy.ADAPTIVE
      );
      
      // Should use performance-optimized sequence for high load
      expect(sequence).toEqual(['level1', 'level2', 'level3', 'level4']);
      expect(orchestrator.getPerformanceOptimizedSequence).toHaveBeenCalled();
    });
    
    it('should adapt strategy with ADAPTIVE strategy based on cache hit rate', async () => {
      // Mock normal system load but high cache hit rate
      jest.spyOn(orchestrator, 'getCurrentSystemLoad').mockReturnValue(0.5);
      jest.spyOn(orchestrator, 'getCacheHitRate').mockReturnValue(0.8);
      
      // Mock hasCachedResults to prioritize level1 and level3
      jest.spyOn(orchestrator, 'hasCachedResults').mockImplementation((level) => {
        return ['level1', 'level3'].includes(level);
      });
      
      const sequence = orchestrator.determineValidationSequence(
        ['level4', 'level3', 'level2', 'level1'],
        ValidationStrategy.ADAPTIVE
      );
      
      // level1 and level3 should come first (with cache)
      expect(sequence.slice(0, 2).sort()).toEqual(['level1', 'level3']);
      // level2 and level4 should come last (without cache)
      expect(sequence.slice(2).sort()).toEqual(['level2', 'level4']);
    });
  });

  describe('Error Handling', () => {
    it('should handle validator errors gracefully', async () => {
      level3.handler.mockRejectedValue(new Error('Test error'));

      const result = await orchestrator.orchestrateValidation(mockRequest);

      expect(result.status).not.toBe(ValidationStatus.ERROR);
      expect(result.levelResults.level3.status).toBe(ValidationStatus.ERROR);
      expect(result.findings.some(f => 
        f.level === 'level3' && f.message.includes('Test error')
      )).toBe(true);
    });

    it('should handle missing validators', async () => {
      const options = {
        levels: ['level1', 'nonexistent']
      };

      const result = await orchestrator.orchestrateValidation(mockRequest, options);

      expect(result.status).toBe(ValidationStatus.PASS);
      expect(result.levelResults.level1).toBeDefined();
      expect(result.levelResults.nonexistent).toBeUndefined();
    });
  });

  describe('Configuration', () => {
    it('should respect parallel validation setting', async () => {
      orchestrator = new OrchestratorService({
        parallelValidation: false
      });

      // Add delay to level1 validation
      level1.handler.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => 
          resolve({
            status: ValidationStatus.PASS,
            confidence: 1.0,
            findings: []
          }), 100)
        )
      );

      const startTime = Date.now();
      await orchestrator.orchestrateValidation(mockRequest);
      const duration = Date.now() - startTime;

      // Sequential execution should take longer
      expect(duration).toBeGreaterThan(100);
    });

    it('should apply level-specific configurations', async () => {
      await orchestrator.orchestrateValidation(mockRequest);

      // Verify each validator was called with correct config
      expect(level1.handler).toHaveBeenCalledWith(
        expect.objectContaining({
          configuration: expect.objectContaining({
            textMatchThreshold: 0.95
          })
        })
      );

      expect(level2.handler).toHaveBeenCalledWith(
        expect.objectContaining({
          configuration: expect.objectContaining({
            semanticMatchThreshold: 0.85,
            useNLP: true
          })
        })
      );

      expect(level4.handler).toHaveBeenCalledWith(
        expect.objectContaining({
          configuration: expect.objectContaining({
            temporalMatchThreshold: 0.95,
            validateHistory: true
          })
        })
      );
    });
  });
}); 