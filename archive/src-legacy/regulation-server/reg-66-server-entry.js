#!/usr/bin/env node

/**
 * REG-66 Advanced MCP Server Entry Point
 * 
 * This is the main entry point for the REG-66 advanced MCP validation server.
 * This server serves as the template for all future regulation implementations.
 * 
 * Features:
 * - Advanced validation capabilities
 * - Real-time compliance monitoring  
 * - Analytics dashboard
 * - Custom API endpoints
 * - Audit trail functionality
 * - Extensible rule engine
 * 
 * Run with: npx @modelcontextprotocol/inspector node src/regulation-server/reg-66-server-entry.js [port]
 * Or directly: node src/regulation-server/reg-66-server-entry.js [port]
 */

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Reg66Server } from './reg-66-server.js';

// Parse command line arguments
const args = process.argv.slice(2);
const port = parseInt(args[0]) || 3366; // Default port for REG-66

console.log(`🚀 Starting REG-66 Advanced MCP Server on port ${port}`);
console.log(`📋 Regulation: FERPA Section 66 (Education Records Privacy)`);
console.log(`🎯 Template Version: 2.0.0 - Advanced Features Enabled`);

// Create and configure the REG-66 server
const server = new Reg66Server({
  name: "reg-66-advanced-validation-server",
  version: "2.0.0",
  description: "Advanced MCP Server for FERPA Section 66 compliance validation - Template for all future regulations"
});

// Create Express app for advanced API endpoints
const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(cors());

// Enable detailed request logging for debugging
app.use((req, res, next) => {
  console.log(`📝 ${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Main MCP endpoint (JSON-RPC 2.0)
app.post('/mcp', async (req, res) => {
  try {
    const { jsonrpc, id, method, params } = req.body;
    
    console.log(`🔍 MCP Request: ${method} with params:`, params ? Object.keys(params) : 'none');
    
    // Validate JSON-RPC 2.0 format
    if (jsonrpc !== '2.0') {
      console.log(`❌ Invalid JSON-RPC version: ${jsonrpc}`);
      return res.status(400).json({
        jsonrpc: '2.0',
        id,
        error: {
          code: -32600,
          message: 'Invalid Request: Not a valid JSON-RPC 2.0 request'
        }
      });
    }
    
    // Handle the request via the server instance
    const result = await server.handleRequest(method, params, id);
    
    console.log(`✅ MCP Response: Success for ${method}`);
    
    // Send the response
    res.json({
      jsonrpc: '2.0',
      id,
      result
    });
    
  } catch (error) {
    console.error(`❌ Error processing MCP request:`, error);
    
    // Send error response
    res.status(500).json({
      jsonrpc: '2.0',
      id: req.body?.id || null,
      error: {
        code: -32603,
        message: 'Internal error',
        data: error.message
      }
    });
  }
});

// Advanced API Endpoints - Template Features

// Health check endpoint with advanced server status
app.get('/health', (req, res) => {
  const status = server.getAdvancedStatus();
  res.json({
    status: 'healthy',
    regulation: 'REG-66 (FERPA Section 66)',
    server_version: '2.0.0',
    template_features: 'enabled',
    ...status
  });
});

// Compliance dashboard data endpoint
app.get('/api/compliance-dashboard', (req, res) => {
  try {
    const dashboardData = {
      compliance_score: server.complianceScore,
      analytics: server.analyticsData,
      real_time_alerts: server.realTimeAlerts.slice(-10), // Last 10 alerts
      active_monitoring: server.monitoringActive,
      validation_rules: Array.from(server.validationRules.keys()),
      capabilities: server.capabilities
    };
    
    res.json(dashboardData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Real-time analytics endpoint
app.get('/api/analytics', (req, res) => {
  try {
    const analytics = {
      ...server.analyticsData,
      trend_analysis: server._getComplianceTrend ? server._getComplianceTrend() : 'N/A',
      server_uptime: new Date().toISOString(),
      template_version: '2.0.0'
    };
    
    res.json(analytics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Real-time alerts endpoint
app.get('/api/alerts', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const alerts = server.realTimeAlerts.slice(-limit);
    
    res.json({
      total_alerts: server.realTimeAlerts.length,
      alerts: alerts,
      monitoring_active: server.monitoringActive
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Audit trail endpoint
app.get('/api/audit-trail', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const trail = server.auditTrail.slice(-limit);
    
    res.json({
      total_entries: server.auditTrail.length,
      audit_trail: trail,
      retention_policy: '1000 entries max'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Custom validation rules management
app.get('/api/custom-rules', (req, res) => {
  try {
    const rules = Array.from(server.customRules.entries()).map(([id, rule]) => ({
      id,
      ...rule
    }));
    
    res.json({
      custom_rules_count: server.customRules.size,
      rules: rules,
      default_rules_count: server.validationRules.size
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add custom validation rule
app.post('/api/custom-rules', (req, res) => {
  try {
    const { id, rule } = req.body;
    
    if (!id || !rule) {
      return res.status(400).json({ error: 'Rule ID and rule definition required' });
    }
    
    server.customRules.set(id, {
      ...rule,
      created_at: new Date().toISOString(),
      custom: true
    });
    
    res.json({
      success: true,
      message: `Custom rule ${id} added successfully`,
      rule_id: id
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Export compliance report
app.get('/api/export-report', (req, res) => {
  try {
    const report = server.exportComplianceReport();
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="reg-66-compliance-report-${new Date().toISOString().split('T')[0]}.json"`);
    
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API documentation endpoint
app.get('/api/docs', (req, res) => {
  const endpoints = server.getCustomApiEndpoints();
  
  res.json({
    regulation: 'REG-66 (FERPA Section 66)',
    server_version: '2.0.0',
    template_features: 'Advanced regulation server template',
    api_endpoints: {
      mcp_endpoint: 'POST /mcp - JSON-RPC 2.0 MCP protocol endpoint',
      health_check: 'GET /health - Server health and status',
      ...endpoints
    },
    documentation: {
      mcp_protocol: 'Supports full MCP (Model Context Protocol) specification',
      validation_types: ['standard', 'comprehensive', 'quick'],
      certainty_levels: ['A', 'B', 'C', 'D'],
      real_time_features: ['monitoring', 'alerts', 'analytics', 'audit_trail']
    }
  });
});

// Root endpoint with server information
app.get('/', (req, res) => {
  res.json({
    server: 'REG-66 Advanced MCP Validation Server',
    regulation: 'FERPA Section 66 - Education Records Privacy Act',
    version: '2.0.0',
    template_version: '2.0.0',
    description: 'Advanced regulation server template with enhanced features',
    endpoints: {
      mcp: '/mcp',
      health: '/health',
      api_docs: '/api/docs',
      dashboard: '/api/compliance-dashboard'
    },
    features: [
      'Real-time compliance monitoring',
      'Advanced analytics and reporting',
      'Custom validation rules engine',
      'Audit trail and logging',
      'RESTful API endpoints',
      'Template for future regulations'
    ],
    status: 'operational'
  });
});

// Create HTTP server
const httpServer = createServer(app);

// Start the server
httpServer.listen(port, () => {
  console.log(`\n🌟 REG-66 Advanced MCP Server Started Successfully!`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📍 Server URL: http://localhost:${port}`);
  console.log(`🔌 MCP Endpoint: http://localhost:${port}/mcp`);
  console.log(`🏥 Health Check: http://localhost:${port}/health`);
  console.log(`📊 Dashboard API: http://localhost:${port}/api/compliance-dashboard`);
  console.log(`📚 API Docs: http://localhost:${port}/api/docs`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🎯 Template Features: ✅ Analytics ✅ Monitoring ✅ Audit Trail`);
  console.log(`📋 Regulation: FERPA Section 66 (Education Records Privacy)`);
  console.log(`🔍 MCP Inspector Compatible: Yes`);
  console.log(`⚡ Real-time Monitoring: Active`);
  console.log(`\n🚀 Ready to process compliance validation requests!`);
});

// Graceful shutdown handling
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  
  try {
    await server.stop();
    httpServer.close(() => {
      console.log('✅ REG-66 Advanced MCP Server shut down successfully');
      process.exit(0);
    });
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  
  try {
    await server.stop();
    httpServer.close(() => {
      console.log('✅ REG-66 Advanced MCP Server shut down successfully');
      process.exit(0);
    });
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

// Export for testing purposes
export { server, app };
export default { server, app };

