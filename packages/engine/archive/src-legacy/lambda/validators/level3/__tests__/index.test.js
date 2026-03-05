const { handler } = require('../index');
const {
  ValidationStatus,
  SeverityLevel
} = require('../../../../common/mcp/protocol');

describe('Level 3 Validator', () => {
  const defaultConfig = {
    structuralMatchThreshold: 0.90,
    useCache: true,
    maxDepth: 10,
    validateRelationships: true
  };

  it('should pass validation for correct document structure', async () => {
    const event = {
      request: {
        regulation: {
          id: 'test-regulation',
          version: '1.0'
        },
        data: {
          metadata: {
            version: '2.0',
            status: 'published'
          },
          content: [
            {
              section: '1',
              text: 'Introduction'
            }
          ]
        }
      },
      configuration: defaultConfig
    };

    const result = await handler(event);

    expect(result.status).toBe(ValidationStatus.PASS);
    expect(result.confidence).toBe(1.0);
    expect(result.findings).toHaveLength(0);
  });

  it('should fail validation for missing required fields', async () => {
    const event = {
      request: {
        regulation: {
          id: 'test-regulation',
          version: '1.0'
        },
        data: {
          metadata: {
            version: '2.0'
            // missing status field
          },
          content: []  // empty array
        }
      },
      configuration: defaultConfig
    };

    const result = await handler(event);

    expect(result.status).toBe(ValidationStatus.FAIL);
    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.findings[0]).toMatchObject({
      id: expect.stringMatching(/^L3-STR\d+/),
      severity: SeverityLevel.ERROR,
      message: expect.stringContaining('Structural validation failed')
    });
  });

  it('should validate relationships between fields', async () => {
    const event = {
      request: {
        regulation: {
          id: 'test-regulation',
          version: '1.0'
        },
        data: {
          metadata: {
            version: '2.0',
            status: 'published'
          },
          content: [
            {
              version: '2.0',  // matches metadata.version
              text: 'Content'
            }
          ]
        }
      },
      configuration: defaultConfig
    };

    const result = await handler(event);

    expect(result.status).toBe(ValidationStatus.PASS);
    expect(result.confidence).toBe(1.0);
  });

  it('should validate conditional dependencies', async () => {
    const event = {
      request: {
        regulation: {
          id: 'test-regulation',
          version: '1.0'
        },
        data: {
          metadata: {
            version: '2.0',
            status: 'draft',
            reviewedBy: 'John Doe',
            reviewDate: '2024-03-20'
          },
          content: [
            {
              section: '1',
              text: 'Draft content'
            }
          ]
        }
      },
      configuration: defaultConfig
    };

    const result = await handler(event);

    expect(result.status).toBe(ValidationStatus.PASS);
    expect(result.confidence).toBe(1.0);
  });

  it('should fail validation for missing dependent fields', async () => {
    const event = {
      request: {
        regulation: {
          id: 'test-regulation',
          version: '1.0'
        },
        data: {
          metadata: {
            version: '2.0',
            status: 'draft'
            // missing reviewedBy and reviewDate
          },
          content: [
            {
              section: '1',
              text: 'Draft content'
            }
          ]
        }
      },
      configuration: defaultConfig
    };

    const result = await handler(event);

    expect(result.status).toBe(ValidationStatus.FAIL);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].message).toContain('Missing dependent field');
  });

  it('should respect maxDepth configuration', async () => {
    const deeplyNested = {
      l1: { l2: { l3: { l4: { l5: { l6: { value: 'too deep' } } } } } }
    };

    const event = {
      request: {
        regulation: {
          id: 'test-regulation',
          version: '1.0'
        },
        data: {
          metadata: {
            version: '2.0',
            status: 'published'
          },
          content: [deeplyNested]
        }
      },
      configuration: {
        ...defaultConfig,
        maxDepth: 3
      }
    };

    const result = await handler(event);

    // Should not fail due to depth limitation
    expect(result.status).toBe(ValidationStatus.PASS);
  });

  it('should handle invalid input gracefully', async () => {
    const event = {
      request: {
        regulation: {
          id: 'test-regulation',
          version: '1.0'
        },
        data: null
      },
      configuration: defaultConfig
    };

    await expect(handler(event)).rejects.toThrow('Level 3 Validation Error');
  });
}); 