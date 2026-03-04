const { handler } = require('../index');
const OrchestratorService = require('../service');
const { 
  ValidationStatus, 
  ValidationStrategy,
  MCPProtocol
} = require('../../../common/mcp/protocol');

// Mock the OrchestratorService
jest.mock('../service');

// Mock MCPProtocol
jest.mock('../../../common/mcp/protocol', () => {
  const actual = jest.requireActual('../../../common/mcp/protocol');
  return {
    ...actual,
    MCPProtocol: {
      createResponse: jest.fn().mockReturnValue({
        responseId: 'mock-response-id',
        validation: {
          status: actual.ValidationStatus.PASS,
          confidence: 1.0,
          findings: []
        }
      }),
      createErrorResponse: jest.fn().mockReturnValue({
        error: {
          code: 'MOCK_ERROR',
          message: 'Mock error message'
        }
      })
    }
  };
});

describe('Orchestrator Lambda Handler', () => {
  let mockOrchestrateValidation;
  let mockEvent;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup mock implementation for OrchestratorService
    mockOrchestrateValidation = jest.fn().mockResolvedValue({
      status: ValidationStatus.PASS,
      confidence: 1.0,
      findings: [],
      levelResults: {
        level1: { status: ValidationStatus.PASS },
        level2: { status: ValidationStatus.PASS }
      }
    });
    
    OrchestratorService.mockImplementation(() => ({
      orchestrateValidation: mockOrchestrateValidation
    }));
    
    // Setup mock event
    mockEvent = {
      requestId: 'test-request-id',
      regulation: {
        id: 'REG-001',
        version: '1.0'
      },
      data: {
        metadata: {
          title: 'Test Document'
        },
        content: 'Sample content for validation'
      },
      client: {
        id: 'test-client',
        version: '1.0'
      },
      protocol: {
        level: 'BASIC',
        version: '1.0'
      },
      useCache: true,
      parallelValidation: true
    };
  });
  
  it('should properly handle a direct invocation event', async () => {
    const response = await handler(mockEvent);
    
    expect(response.statusCode).toBe(200);
    expect(MCPProtocol.createResponse).toHaveBeenCalledWith(expect.objectContaining({
      requestId: mockEvent.requestId,
      regulationId: mockEvent.regulation.id,
      regulationVersion: mockEvent.regulation.version,
    }));
    
    expect(OrchestratorService).toHaveBeenCalledWith(expect.objectContaining({
      useCache: true,
      parallelValidation: true
    }));
    
    expect(mockOrchestrateValidation).toHaveBeenCalledWith(
      expect.objectContaining({
        regulation: mockEvent.regulation,
        data: mockEvent.data
      }),
      expect.any(Object)
    );
  });
  
  it('should properly handle an API Gateway event', async () => {
    const apiGatewayEvent = {
      body: JSON.stringify(mockEvent),
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    const response = await handler(apiGatewayEvent);
    
    expect(response.statusCode).toBe(200);
    expect(MCPProtocol.createResponse).toHaveBeenCalled();
    expect(mockOrchestrateValidation).toHaveBeenCalled();
  });
  
  it('should use default values when configuration is not provided', async () => {
    const minimalEvent = {
      regulation: {
        id: 'REG-001'
      },
      data: {
        content: 'Minimal content'
      }
    };
    
    await handler(minimalEvent);
    
    expect(OrchestratorService).toHaveBeenCalledWith(expect.objectContaining({
      useCache: true,
      cacheTTL: 3600,
      parallelValidation: true
    }));
    
    expect(mockOrchestrateValidation).toHaveBeenCalledWith(
      expect.objectContaining({
        client: { id: 'anonymous', version: '1.0' },
        protocol: { level: 'BASIC', version: '1.0' }
      }),
      expect.any(Object)
    );
  });
  
  it('should respect validation strategy from the request', async () => {
    const eventWithStrategy = {
      ...mockEvent,
      strategy: 'FAST_FAIL'
    };
    
    await handler(eventWithStrategy);
    
    expect(mockOrchestrateValidation).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        strategy: ValidationStrategy.FAST_FAIL
      })
    );
  });
  
  it('should respect validation levels from the request', async () => {
    const eventWithLevels = {
      ...mockEvent,
      levels: ['level1', 'level3']
    };
    
    await handler(eventWithLevels);
    
    expect(mockOrchestrateValidation).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        levels: ['level1', 'level3']
      })
    );
  });
  
  it('should handle invalid levels correctly', async () => {
    const eventWithInvalidLevels = {
      ...mockEvent,
      levels: ['invalid', 'level2']
    };
    
    await handler(eventWithInvalidLevels);
    
    expect(mockOrchestrateValidation).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        levels: ['level2']
      })
    );
  });
  
  it('should handle errors gracefully', async () => {
    const invalidEvent = {
      // Missing required fields
    };
    
    const response = await handler(invalidEvent);
    
    expect(response.statusCode).toBe(500);
    expect(MCPProtocol.createErrorResponse).toHaveBeenCalled();
  });
  
  it('should respect skipCache option', async () => {
    const eventWithSkipCache = {
      ...mockEvent,
      skipCache: true
    };
    
    await handler(eventWithSkipCache);
    
    expect(mockOrchestrateValidation).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        skipCache: true
      })
    );
  });
  
  it('should disable useCache when explicitly set to false', async () => {
    const eventWithoutCache = {
      ...mockEvent,
      useCache: false
    };
    
    await handler(eventWithoutCache);
    
    expect(OrchestratorService).toHaveBeenCalledWith(expect.objectContaining({
      useCache: false
    }));
  });
  
  it('should handle service errors and return appropriate response', async () => {
    mockOrchestrateValidation.mockRejectedValue(new Error('Service error'));
    
    const response = await handler(mockEvent);
    
    expect(response.statusCode).toBe(500);
    expect(MCPProtocol.createErrorResponse).toHaveBeenCalledWith(
      'VALIDATION_ERROR',
      'Service error',
      expect.any(Object),
      expect.any(String)
    );
  });
}); 