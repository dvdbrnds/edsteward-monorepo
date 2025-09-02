/**
 * MCP Engine Delivery Server
 * 
 * HTTP server that hosts the regulation delivery system
 * Integrates with existing LLM Gateway infrastructure
 */

import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { RegulationDeliveryEngine, REGULATION_EVENTS } from './regulation-delivery-engine.js';
import { EdStewardIntegration } from './edsteward-integration.js';

// Load environment variables
dotenv.config();

class DeliveryServer {
  constructor(options = {}) {
    this.port = options.port || 3051;
    this.app = express();
    this.server = createServer(this.app);
    this.deliveryEngine = null;
    this.edstewardIntegration = null;
    
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    this.app.use(cors({
      origin: ['http://localhost:3050', 'http://localhost:3000'],
      credentials: true
    }));
    
    this.app.use(express.json({ limit: '1mb' }));
    this.app.use(express.static('public'));
  }

  setupRoutes() {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      const status = this.deliveryEngine ? this.deliveryEngine.getStatus() : null;
      res.json({
        service: 'RegulationDeliveryEngine',
        status: status ? 'healthy' : 'initializing',
        timestamp: new Date().toISOString(),
        details: status
      });
    });

    // Trigger manual regulation check (for testing)
    this.app.post('/api/trigger-check/:regulationId', async (req, res) => {
      const { regulationId } = req.params;
      
      if (!this.deliveryEngine) {
        return res.status(503).json({ 
          error: 'Delivery engine not ready',
          timestamp: new Date().toISOString()
        });
      }

      try {
        // Manually trigger a regulation check
        await this.deliveryEngine.cdc.monitorRegulation(regulationId);
        
        res.json({
          success: true,
          message: `Manual check triggered for ${regulationId}`,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        res.status(500).json({
          error: error.message,
          regulationId,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Get event history for a regulation
    this.app.get('/api/events/:regulationId', (req, res) => {
      const { regulationId } = req.params;
      const { fromVersion = 0 } = req.query;
      
      if (!this.deliveryEngine) {
        return res.status(503).json({ error: 'Delivery engine not ready' });
      }

      const events = this.deliveryEngine.eventStore.getEvents(regulationId, parseInt(fromVersion));
      
      res.json({
        regulationId,
        events,
        total: events.length,
        timestamp: new Date().toISOString()
      });
    });

    // Get current state of a regulation
    this.app.get('/api/state/:regulationId', (req, res) => {
      const { regulationId } = req.params;
      
      if (!this.deliveryEngine) {
        return res.status(503).json({ error: 'Delivery engine not ready' });
      }

      const state = this.deliveryEngine.eventStore.getCurrentState(regulationId);
      
      res.json({
        regulationId,
        state,
        timestamp: new Date().toISOString()
      });
    });

    // WebSocket connection info endpoint
    this.app.get('/api/websocket-info', (req, res) => {
      res.json({
        websocketUrl: `ws://localhost:${this.port}/regulation-updates`,
        protocols: {
          subscribe: {
            type: 'subscribe',
            regulationIds: ['array of regulation IDs']
          },
          unsubscribe: {
            type: 'unsubscribe', 
            regulationIds: ['array of regulation IDs']
          },
          ping: { type: 'ping' }
        },
        events: {
          connected: 'Connection established',
          regulation_updated: 'Regulation content changed',
          subscription_confirmed: 'Subscription successful'
        }
      });
    });

    // EdSteward integration endpoints
    this.app.get('/api/edsteward/status', async (req, res) => {
      if (!this.edstewardIntegration) {
        return res.status(503).json({ error: 'EdSteward integration not initialized' });
      }

      const isConnected = await this.edstewardIntegration.testConnection();
      const mappings = this.edstewardIntegration.getMappings();

      res.json({
        connected: isConnected,
        edstewardUrl: this.edstewardIntegration.edstewardUrl,
        mappings,
        timestamp: new Date().toISOString()
      });
    });

    this.app.post('/api/edsteward/test-update', async (req, res) => {
      if (!this.edstewardIntegration) {
        return res.status(503).json({ error: 'EdSteward integration not initialized' });
      }

      const testUpdate = {
        regulationId: 'REG-66',
        version: 'TEST',
        timestamp: new Date().toISOString(),
        data: {
          changeType: 'MANUAL_TEST',
          before: { content: 'Previous TEACH Act content...' },
          after: { 
            content: 'Updated TEACH Act content with new requirements...',
            impact: 'high',
            message: 'Manual test update from MCP Engine'
          },
          contentHash: 'test_hash_' + Date.now()
        }
      };

      try {
        const result = await this.edstewardIntegration.sendRegulationUpdate(testUpdate);
        res.json({
          success: true,
          testUpdate,
          result,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message,
          testUpdate,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Simulate regulation change (for testing)
    this.app.post('/api/simulate-change/:regulationId', async (req, res) => {
      const { regulationId } = req.params;
      const { changeType = 'content_update', mockData = {} } = req.body;
      
      if (!this.deliveryEngine) {
        return res.status(503).json({ error: 'Delivery engine not ready' });
      }

      try {
        // Create a simulated change event
        const simulatedChange = {
          regulationId,
          before: { version: '1.0', content: 'Original content' },
          after: { version: '1.1', content: 'Updated content', ...mockData },
          changeType,
          timestamp: new Date().toISOString(),
          contentHash: 'simulated_hash_' + Date.now()
        };

        // Emit the change event
        await this.deliveryEngine.cdc.emit(REGULATION_EVENTS.CONTENT_CHANGED, simulatedChange);
        
        res.json({
          success: true,
          message: `Simulated ${changeType} for ${regulationId}`,
          changeData: simulatedChange,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        res.status(500).json({
          error: error.message,
          regulationId,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Manual trigger for regulation updates (from console)
    this.app.post('/api/trigger-update', async (req, res) => {
      const { regulationId = 'REG-66', changeType = 'MANUAL_PUSH', message = 'Manual update triggered' } = req.body;
      
      if (!this.deliveryEngine) {
        return res.status(503).json({ 
          error: 'Delivery engine not ready',
          timestamp: new Date().toISOString()
        });
      }

      try {
        console.log(`📤 Manual update triggered for ${regulationId} via console`);
        
        // Fetch the REAL regulation content from the MCP Engine
        const regulationContent = await this.fetchFullRegulationContent(regulationId);
        
        // Create a manual update event with COMPLETE USC TEXT for differential view
        const uscFullText = regulationContent.fullText || regulationContent.content || '';
        
        // For EdSteward differential view, we need COMPLETE text in both fields
        // originalContent = current USC text, updatedContent = same text with simulated changes
        const simulatedUpdate = uscFullText.replace(
          'Notwithstanding the provisions of section 106',
          'Notwithstanding the provisions of section 106 and the enhanced digital learning provisions'
        );
        
        const updateData = {
          regulationId,
          changeType,
          message,
          timestamp: new Date().toISOString(),
          source: 'console_manual_trigger',
          data: {
            before: { 
              content: uscFullText, // COMPLETE USC 17 Section 110 text
              fullText: uscFullText, // Alias for compatibility
              version: (regulationContent.version || 'unknown').replace(/\.\d+$/, '.0') // Previous version
            },
            after: {
              ...regulationContent,
              content: simulatedUpdate, // COMPLETE USC text with simulated changes
              fullText: simulatedUpdate, // Alias for compatibility
              message: `${message} - Updated via MCP Engine with complete USC 17 Section 110 text`
            },
            contentHash: 'manual_' + Date.now()
          }
        };

        // Trigger the delivery engine by emitting a content change event through the CDC
        await this.deliveryEngine.cdc.emit(REGULATION_EVENTS.CONTENT_CHANGED, updateData);
        
        // Get current status for response
        const status = this.deliveryEngine.getStatus();
        const realVersion = regulationContent.version || 'unknown';
        
        res.json({
          success: true,
          message: `Manual update triggered for ${regulationId}`,
          regulationId,
          version: realVersion,
          updateId: updateData.data.contentHash,
          clientsNotified: status?.regulations?.[regulationId]?.connectedClients || 0,
          timestamp: new Date().toISOString()
        });
        
      } catch (error) {
        console.error('❌ Manual trigger error:', error);
        res.status(500).json({
          error: error.message,
          regulationId,
          timestamp: new Date().toISOString()
        });
      }
    });
  }

  async start() {
    try {
      console.log('🔧 [START] Creating EdSteward integration...');
      
      // Create EdSteward integration
      this.edstewardIntegration = new EdStewardIntegration({
        edstewardUrl: process.env.EDSTEWARD_URL || 'http://localhost:3000',
        apiKey: process.env.EDSTEWARD_API_KEY
      });
      console.log('✅ [START] EdSteward integration created');

      // Test EdSteward connection (non-blocking)
      console.log('🔧 [START] Testing EdSteward connection...');
      try {
        await this.edstewardIntegration.testConnection();
        console.log('✅ [START] EdSteward connection successful');
      } catch (error) {
        console.warn('⚠️ [START] EdSteward connection failed during startup, will retry later:', error.message);
      }

      console.log('🔧 [START] Creating delivery engine...');
      // Initialize delivery engine
      this.deliveryEngine = new RegulationDeliveryEngine(this.server);
      console.log('✅ [START] Delivery engine created');
      
      console.log('🔧 [START] Setting up event handlers...');
      // Set up delivery engine event handlers
      this.deliveryEngine.on(REGULATION_EVENTS.SYSTEM_READY, (data) => {
        console.log('🎯 Delivery system ready:', data);
      });

      this.deliveryEngine.on(REGULATION_EVENTS.DELIVERY_CONFIRMED, async (data) => {
        console.log(`✅ Delivery confirmed for ${data.regulationId} (${data.clientsNotified} clients)`);
        
        // Send update to EdSteward when delivery is confirmed
        if (data.updateData) {
          try {
            const result = await this.edstewardIntegration.sendRegulationUpdate(data.updateData);
            if (result.success) {
              console.log(`📤 EdSteward notified: Update ID ${result.updateId}`);
            } else {
              console.error(`❌ EdSteward notification failed: ${result.error}`);
            }
          } catch (error) {
            console.error('❌ EdSteward integration error:', error.message);
          }
        }
      });

      this.deliveryEngine.on(REGULATION_EVENTS.PERFORMANCE_ALERT, (data) => {
        console.warn('⚠️ Performance alert:', data);
      });
      console.log('✅ [START] Event handlers set up');

      console.log('🔧 [START] Starting delivery engine...');
      // Start the delivery engine
      await this.deliveryEngine.start();
      console.log('✅ [START] Delivery engine started');
      
      console.log('🔧 [START] Starting HTTP server...');
      // Start HTTP server
      await new Promise((resolve, reject) => {
        const server = this.server.listen(this.port, (error) => {
          if (error) {
            reject(error);
          } else {
            console.log(`🚀 Regulation Delivery Server running on port ${this.port}`);
            console.log(`📡 WebSocket endpoint: ws://localhost:${this.port}/regulation-updates`);
            console.log(`🔍 Health check: http://localhost:${this.port}/health`);
            console.log(`📋 WebSocket info: http://localhost:${this.port}/api/websocket-info`);
            resolve();
          }
        });
        
        server.on('error', (error) => {
          console.error('❌ [START] HTTP server error:', error);
          reject(error);
        });
      });
      
      console.log('✅ [START] HTTP server started successfully');

    } catch (error) {
      console.error('❌ [START] Failed to start delivery server:', error);
      console.error('❌ [START] Stack:', error.stack);
      throw error;
    }
  }

  /**
   * Fetch complete regulation content from MCP Engine
   */
  async fetchFullRegulationContent(regulationId) {
    try {
      console.log(`🔍 Fetching full content for ${regulationId} from MCP Engine...`);
      
      // Fetch all the regulation data components
      const [uscResponse, cfrResponse, complianceResponse, versioningResponse] = await Promise.all([
        // USC Text
        fetch('http://localhost:3002/api/llm/usc/17/110', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        }),
        // CFR Guidance  
        fetch('http://localhost:3002/api/llm/cfr/teach-act', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        }),
        // Compliance Guide
        fetch('http://localhost:3002/api/llm/compliance/teach-act', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        }),
        // Versioning Data
        fetch('http://localhost:3002/api/llm/versioning/system-info', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        })
      ]);

      // Parse all responses
      const [uscData, cfrData, complianceData, versioningData] = await Promise.all([
        uscResponse.ok ? uscResponse.json() : { error: 'USC fetch failed' },
        cfrResponse.ok ? cfrResponse.json() : { error: 'CFR fetch failed' },
        complianceResponse.ok ? complianceResponse.json() : { error: 'Compliance fetch failed' },
        versioningResponse.ok ? versioningResponse.json() : { error: 'Versioning fetch failed' }
      ]);

      // Also run the LinearEngine workflow for comprehensive analysis
      const workflowResponse = await fetch('http://localhost:3002/api/llm/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `Get comprehensive analysis for ${regulationId}`,
          options: { regulation: regulationId, realExecution: true }
        })
      });

      const workflowData = workflowResponse.ok ? await workflowResponse.json() : { error: 'Workflow fetch failed' };

      // Extract the actual USC text for EdSteward differential view
      const uscFullText = uscData?.data?.content || uscData?.content || uscData?.fullText || 'USC 17 Section 110 text not available';
      
      // Construct the complete regulation payload
      const fullContent = {
        regulationId,
        timestamp: new Date().toISOString(),
        version: versioningData?.data?.currentRegulation?.version || versioningData?.currentVersion || 'unknown',
        // Add fullText field for EdSteward differential view
        fullText: uscFullText,
        content: uscFullText, // Alias for compatibility
        components: {
          uscText: uscData,
          cfrGuidance: cfrData,
          complianceGuide: complianceData,
          versioningInfo: versioningData,
          workflowAnalysis: workflowData
        },
        summary: {
          title: `${regulationId} - TEACH Act Compliance Update`,
          impact: 'high',
          changeType: 'comprehensive_update',
          affectedAreas: ['copyright', 'fair_use', 'educational_exemptions'],
          message: 'Complete USC 17 Section 110 regulation text with real-time analysis'
        }
      };

      console.log(`✅ Successfully fetched full content for ${regulationId}`);
      return fullContent;

    } catch (error) {
      console.error(`❌ Failed to fetch full content for ${regulationId}:`, error.message);
      
      // Return a fallback payload with error information
      return {
        regulationId,
        timestamp: new Date().toISOString(),
        version: 'error',
        error: error.message,
        components: {},
        summary: {
          title: `${regulationId} - Content Fetch Error`,
          impact: 'low',
          changeType: 'error',
          message: `Failed to fetch regulation content: ${error.message}`
        }
      };
    }
  }

  async stop() {
    console.log('⏹️ Stopping delivery server...');
    
    if (this.deliveryEngine) {
      await this.deliveryEngine.stop();
    }
    
    this.server.close();
    console.log('✅ Delivery server stopped');
  }
}

export { DeliveryServer };

// Add comprehensive error handling
process.on('uncaughtException', (error) => {
  console.error('💥 UNCAUGHT EXCEPTION in delivery system:', error);
  console.error('Stack:', error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 UNHANDLED REJECTION in delivery system:', reason);
  console.error('Promise:', promise);
  process.exit(1);
});

// Start the server if this file is run directly
// More robust check that works with different path formats
const isMainModule = process.argv[1] && (
  process.argv[1].endsWith('delivery-server.js') || 
  process.argv[1].includes('delivery-server.js')
);

console.log('🔧 [DEBUG] Module check:');
console.log('  import.meta.url:', import.meta.url);
console.log('  process.argv[1]:', process.argv[1]);
console.log('  isMainModule:', isMainModule);

if (isMainModule) {
  console.log('🚀 [STARTUP] Delivery server starting...');
  console.log('🔧 [STARTUP] Process arguments:', process.argv);
  console.log('🔧 [STARTUP] Working directory:', process.cwd());
  console.log('🔧 [STARTUP] Node version:', process.version);
  
  const server = new DeliveryServer({
    port: process.env.DELIVERY_PORT || 3051
  });
  
  console.log('🔧 [STARTUP] Server instance created, calling start()...');
  
  server.start().then(() => {
    console.log('✅ [STARTUP] Server started successfully, keeping process alive...');
    
    // Keep the process alive
    setInterval(() => {
      console.log('💚 [HEARTBEAT] Delivery system alive');
    }, 30000);
    
  }).catch(error => {
    console.error('❌ [STARTUP] Server startup failed:', error);
    console.error('❌ [STARTUP] Stack:', error.stack);
    process.exit(1);
  });
  
  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 [SHUTDOWN] Received SIGINT, shutting down gracefully...');
    await server.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n🛑 [SHUTDOWN] Received SIGTERM, shutting down gracefully...');
    await server.stop();
    process.exit(0);
  });
}
