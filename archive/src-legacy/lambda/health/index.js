/**
 * MCP MVP Health Check Lambda
 * Simple health endpoint for the MCP system
 */
exports.handler = async (event, context) => {
  console.log('Health check requested');
  
  const health = {
    service: 'MCP Engine MVP',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0-mvp',
    environment: process.env.NODE_ENV || 'development',
    region: process.env.AWS_REGION || 'us-east-1',
    components: {
      orchestrator: 'operational',
      level1Validator: 'operational',
      mcpProtocol: 'operational'
    },
    endpoints: {
      validation: '/mcp/validate',
      health: '/health'
    }
  };
  
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true
    },
    body: JSON.stringify(health)
  };
};
