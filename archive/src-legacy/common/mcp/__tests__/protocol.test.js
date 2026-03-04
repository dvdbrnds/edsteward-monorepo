const {
  MCPProtocol,
  ValidationLevel,
  ValidationStatus,
  SeverityLevel,
  PROTOCOL_VERSION
} = require('../protocol');

describe('MCPProtocol', () => {
  describe('createRequest', () => {
    it('should create a valid request object', () => {
      const request = MCPProtocol.createRequest({
        clientId: 'test-client',
        clientVersion: '1.0.0',
        regulationId: 'test-regulation',
        regulationVersion: '2023-01-01',
        validationLevel: ValidationLevel.BASIC,
        data: { test: 'data' }
      });

      expect(request).toMatchObject({
        protocol: {
          version: PROTOCOL_VERSION,
          level: ValidationLevel.BASIC
        },
        client: {
          id: 'test-client',
          version: '1.0.0'
        },
        regulation: {
          id: 'test-regulation',
          version: '2023-01-01'
        },
        data: { test: 'data' },
        options: {
          attestation: false,
          diff: false,
          explanation: false
        }
      });

      expect(request.requestId).toBeDefined();
      expect(request.timestamp).toBeDefined();
    });

    it('should throw error for invalid request', () => {
      expect(() => {
        MCPProtocol.createRequest({
          clientId: 'test-client',
          // Missing required fields
        });
      }).toThrow('Invalid request');
    });
  });

  describe('createResponse', () => {
    it('should create a valid response object', () => {
      const response = MCPProtocol.createResponse({
        requestId: '123e4567-e89b-12d3-a456-426614174000',
        validationLevel: ValidationLevel.BASIC,
        regulationId: 'test-regulation',
        regulationVersion: '2023-01-01',
        hasUpdate: false,
        status: ValidationStatus.PASS,
        confidence: 0.95,
        findings: [],
        processingTime: 100,
        validatorId: 'test-validator'
      });

      expect(response).toMatchObject({
        protocol: {
          version: PROTOCOL_VERSION,
          level: ValidationLevel.BASIC
        },
        regulation: {
          id: 'test-regulation',
          version: '2023-01-01',
          hasUpdate: false
        },
        validation: {
          status: ValidationStatus.PASS,
          confidence: 0.95,
          findings: []
        },
        meta: {
          processingTime: 100,
          validatorId: 'test-validator'
        }
      });

      expect(response.responseId).toBeDefined();
      expect(response.timestamp).toBeDefined();
    });

    it('should include optional fields when provided', () => {
      const response = MCPProtocol.createResponse({
        requestId: '123e4567-e89b-12d3-a456-426614174000',
        validationLevel: ValidationLevel.BASIC,
        regulationId: 'test-regulation',
        regulationVersion: '2023-01-01',
        hasUpdate: false,
        status: ValidationStatus.PASS,
        confidence: 0.95,
        findings: [],
        attestation: { id: 'test-attestation' },
        diff: { changes: [] },
        explanation: { summary: 'test' },
        processingTime: 100,
        validatorId: 'test-validator'
      });

      expect(response.attestation).toBeDefined();
      expect(response.diff).toBeDefined();
      expect(response.explanation).toBeDefined();
    });

    it('should throw error for invalid response', () => {
      expect(() => {
        MCPProtocol.createResponse({
          requestId: '123e4567-e89b-12d3-a456-426614174000',
          // Missing required fields
        });
      }).toThrow('Invalid response');
    });
  });

  describe('createFinding', () => {
    it('should create a valid finding object', () => {
      const finding = MCPProtocol.createFinding({
        id: 'test-finding',
        path: 'data.test',
        severity: SeverityLevel.ERROR,
        message: 'Test error',
        reference: 'TEST-001'
      });

      expect(finding).toMatchObject({
        id: 'test-finding',
        path: 'data.test',
        severity: SeverityLevel.ERROR,
        message: 'Test error',
        reference: 'TEST-001'
      });
    });

    it('should throw error for invalid finding', () => {
      expect(() => {
        MCPProtocol.createFinding({
          id: 'test-finding',
          // Missing required fields
        });
      }).toThrow('Invalid finding');
    });
  });

  describe('isVersionSupported', () => {
    it('should return true for supported versions', () => {
      expect(MCPProtocol.isVersionSupported('1.0')).toBe(true);
      expect(MCPProtocol.isVersionSupported('1.1')).toBe(true);
      expect(MCPProtocol.isVersionSupported('1.2')).toBe(true);
    });

    it('should return false for unsupported versions', () => {
      expect(MCPProtocol.isVersionSupported('0.9')).toBe(false);
      expect(MCPProtocol.isVersionSupported('1.3')).toBe(false);
      expect(MCPProtocol.isVersionSupported('2.0')).toBe(false);
    });
  });

  describe('createErrorResponse', () => {
    it('should create a valid error response', () => {
      const errorResponse = MCPProtocol.createErrorResponse(
        'INVALID_REQUEST',
        'Invalid request format',
        { field: 'test' },
        '123e4567-e89b-12d3-a456-426614174000'
      );

      expect(errorResponse).toMatchObject({
        error: {
          code: 'INVALID_REQUEST',
          message: 'Invalid request format',
          details: { field: 'test' },
          requestId: '123e4567-e89b-12d3-a456-426614174000'
        }
      });
    });
  });
}); 