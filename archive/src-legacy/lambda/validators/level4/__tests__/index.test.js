const { handler } = require('../index');
const {
  ValidationStatus,
  SeverityLevel
} = require('../../../../common/mcp/protocol');

describe('Level 4 Validator', () => {
  const defaultConfig = {
    temporalMatchThreshold: 0.95,
    useCache: true,
    maxReferences: 100,
    validateHistory: true,
    validateCrossRefs: true
  };

  it('should pass validation for correct temporal sequences', async () => {
    const event = {
      request: {
        regulation: {
          id: 'test-regulation',
          version: '1.0'
        },
        data: {
          metadata: {
            approvalDate: '2024-03-01',
            effectiveDate: '2024-03-15',  // Within 90 days of approval
            version: '2.0'
          },
          content: [
            {
              section: '1',
              text: 'Valid temporal content'
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

  it('should fail validation for invalid temporal sequences', async () => {
    const event = {
      request: {
        regulation: {
          id: 'test-regulation',
          version: '1.0'
        },
        data: {
          metadata: {
            approvalDate: '2024-03-15',
            effectiveDate: '2024-03-01',  // Before approval date
            version: '2.0'
          },
          content: [
            {
              section: '1',
              text: 'Invalid temporal content'
            }
          ]
        }
      },
      configuration: defaultConfig
    };

    const result = await handler(event);

    expect(result.status).toBe(ValidationStatus.FAIL);
    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.findings[0]).toMatchObject({
      id: expect.stringMatching(/^L4-ADV\d+/),
      severity: SeverityLevel.ERROR,
      message: expect.stringContaining('Advanced validation failed')
    });
  });

  it('should validate cross-references correctly', async () => {
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
          content: {
            text: 'Main content',
            references: [
              {
                id: 'REF001',
                type: 'citation'
              }
            ]
          }
        }
      },
      configuration: defaultConfig
    };

    const result = await handler(event);

    // Should pass since reference validation is mocked
    expect(result.status).toBe(ValidationStatus.PASS);
  });

  it('should validate version history correctly', async () => {
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
          changelog: [
            {
              version: '2.0',
              changes: ['Feature A added', 'Bug B fixed']
            },
            {
              version: '1.0',
              changes: ['Initial release']
            }
          ]
        }
      },
      configuration: defaultConfig
    };

    const result = await handler(event);

    // Should pass since version history validation is mocked
    expect(result.status).toBe(ValidationStatus.PASS);
  });

  it('should respect configuration options', async () => {
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
          content: {
            references: [
              {
                id: 'REF001',
                type: 'citation'
              }
            ]
          }
        }
      },
      configuration: {
        ...defaultConfig,
        validateCrossRefs: false,  // Skip cross-reference validation
        validateHistory: false     // Skip history validation
      }
    };

    const result = await handler(event);

    expect(result.status).toBe(ValidationStatus.PASS);
    // Should not have findings related to cross-refs or history
    expect(result.findings.every(f => 
      !f.message.includes('cross-reference') && 
      !f.message.includes('history')
    )).toBe(true);
  });

  it('should handle missing required fields gracefully', async () => {
    const event = {
      request: {
        regulation: {
          id: 'test-regulation',
          version: '1.0'
        },
        data: {
          metadata: {
            // Missing required dates
            version: '2.0'
          }
        }
      },
      configuration: defaultConfig
    };

    const result = await handler(event);

    expect(result.status).toBe(ValidationStatus.FAIL);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].message).toContain('Missing temporal field');
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

    await expect(handler(event)).rejects.toThrow('Level 4 Validation Error');
  });

  it('should respect maxReferences configuration', async () => {
    const event = {
      request: {
        regulation: {
          id: 'test-regulation',
          version: '1.0'
        },
        data: {
          metadata: {
            version: '2.0'
          },
          content: {
            references: Array(150).fill(null).map((_, i) => ({
              id: `REF${String(i).padStart(3, '0')}`,
              type: 'citation'
            }))
          }
        }
      },
      configuration: {
        ...defaultConfig,
        maxReferences: 50  // Limit number of references to process
      }
    };

    const result = await handler(event);

    // Should not fail due to reference limit
    expect(result.status).toBe(ValidationStatus.PASS);
  });
}); 