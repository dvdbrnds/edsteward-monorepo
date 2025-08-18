/**
 * MCP Engine Delivery Server
 * 
 * HTTP server that hosts the regulation delivery system
 * Integrates with existing LLM Gateway infrastructure
 */

import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import { RegulationDeliveryEngine, REGULATION_EVENTS } from './regulation-delivery-engine.js';
import { EdStewardIntegration } from './edsteward-integration.js';

class DeliveryServer {
  constructor(options = {}) {
    this.port = options.port || 3003;
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
  }

  async start() {
    try {
      // Create EdSteward integration
      this.edstewardIntegration = new EdStewardIntegration({
        edstewardUrl: process.env.EDSTEWARD_URL || 'http://localhost:3000',
        apiKey: process.env.EDSTEWARD_API_KEY
      });

      // Test EdSteward connection
      await this.edstewardIntegration.testConnection();

      // Initialize delivery engine
      this.deliveryEngine = new RegulationDeliveryEngine(this.server);
      
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

      // Start the delivery engine
      await this.deliveryEngine.start();
      
      // Start HTTP server
      this.server.listen(this.port, () => {
        console.log(`🚀 Regulation Delivery Server running on port ${this.port}`);
        console.log(`📡 WebSocket endpoint: ws://localhost:${this.port}/regulation-updates`);
        console.log(`🔍 Health check: http://localhost:${this.port}/health`);
        console.log(`📋 WebSocket info: http://localhost:${this.port}/api/websocket-info`);
      });

    } catch (error) {
      console.error('❌ Failed to start delivery server:', error);
      throw error;
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

// Start the server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new DeliveryServer({
    port: process.env.DELIVERY_PORT || 3003
  });
  
  server.start().catch(error => {
    console.error('❌ Server startup failed:', error);
    process.exit(1);
  });
  
  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    await server.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    await server.stop();
    process.exit(0);
  });
}
