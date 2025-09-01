/**
 * EdSteward WebSocket Service
 * Dedicated WebSocket server on port 3003 for EdSteward integration
 * Handles validation requests and returns responses in JSON format
 */
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { setupLogger } from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

const logger = setupLogger('edsteward-websocket');

export class EdStewardWebSocketService {
  constructor(options = {}) {
    this.port = options.port || 3003;
    this.clients = new Map();
    this.validationLevels = ['A', 'B', 'C', 'D'];
    
    // Create HTTP server for WebSocket
    this.server = createServer();
    
    // Create WebSocket server
    this.wss = new WebSocketServer({ 
      server: this.server,
      path: '/regulation-updates'
    });
    
    this.setupWebSocketServer();
  }

  /**
   * Setup WebSocket server event handlers
   */
  setupWebSocketServer() {
    this.wss.on('connection', (ws, request) => {
      const clientId = uuidv4();
      const clientInfo = {
        id: clientId,
        ws,
        connectedAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        userAgent: request.headers['user-agent'] || 'Unknown',
        ip: request.socket.remoteAddress
      };
      
      this.clients.set(clientId, clientInfo);
      logger.info(`🔌 EdSteward client connected: ${clientId} from ${clientInfo.ip}`);
      
      // Send welcome message
      this.sendToClient(clientId, {
        type: 'connected',
        clientId,
        timestamp: new Date().toISOString(),
        availableValidationLevels: this.validationLevels,
        message: 'Connected to MCP Engine WebSocket Service'
      });

      // Handle incoming messages
      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());
          await this.handleClientMessage(clientId, message);
        } catch (error) {
          logger.error(`❌ Invalid message from ${clientId}:`, error.message);
          this.sendErrorToClient(clientId, 'Invalid JSON message format');
        }
      });

      // Handle client disconnect
      ws.on('close', () => {
        logger.info(`📴 EdSteward client disconnected: ${clientId}`);
        this.clients.delete(clientId);
      });

      // Handle WebSocket errors
      ws.on('error', (error) => {
        logger.error(`❌ WebSocket error for ${clientId}:`, error.message);
        this.clients.delete(clientId);
      });
    });
  }

  /**
   * Handle incoming messages from EdSteward clients
   */
  async handleClientMessage(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client) {
      logger.warn(`Message from unknown client: ${clientId}`);
      return;
    }

    // Update last activity
    client.lastActivity = new Date().toISOString();

    logger.info(`📨 Message from ${clientId}:`, message.type || 'unknown');

    try {
      switch (message.type) {
        case 'validation_request':
          await this.handleValidationRequest(clientId, message);
          break;
          
        case 'ping':
          this.sendToClient(clientId, {
            type: 'pong',
            timestamp: new Date().toISOString()
          });
          break;
          
        case 'subscribe':
          await this.handleSubscription(clientId, message);
          break;
          
        case 'unsubscribe':
          await this.handleUnsubscription(clientId, message);
          break;
          
        default:
          logger.warn(`Unknown message type from ${clientId}: ${message.type}`);
          this.sendErrorToClient(clientId, `Unknown message type: ${message.type}`);
      }
    } catch (error) {
      logger.error(`Error handling message from ${clientId}:`, error.message);
      this.sendErrorToClient(clientId, 'Internal server error processing request');
    }
  }

  /**
   * Handle validation requests from EdSteward
   */
  async handleValidationRequest(clientId, message) {
    const { 
      regulationId, 
      content, 
      validationLevel = 'B',
      requestId 
    } = message.data || {};

    if (!regulationId || !content) {
      this.sendErrorToClient(clientId, 'Missing required fields: regulationId and content');
      return;
    }

    if (!this.validationLevels.includes(validationLevel)) {
      this.sendErrorToClient(clientId, `Invalid validation level. Must be one of: ${this.validationLevels.join(', ')}`);
      return;
    }

    logger.info(`🔍 Processing validation request: ${regulationId} (Level ${validationLevel})`);

    try {
      // Call the LLM Gateway for validation
      const validationResult = await this.performValidation(regulationId, content, validationLevel);
      
      // Send response back to EdSteward
      this.sendToClient(clientId, {
        type: 'validation_response',
        requestId,
        data: {
          regulationId,
          validationLevel,
          result: validationResult,
          timestamp: new Date().toISOString(),
          processingTime: validationResult.processingTime || 0
        }
      });

      logger.info(`✅ Validation response sent for ${regulationId} (Level ${validationLevel})`);

    } catch (error) {
      logger.error(`❌ Validation failed for ${regulationId}:`, error.message);
      
      this.sendToClient(clientId, {
        type: 'validation_error',
        requestId,
        data: {
          regulationId,
          validationLevel,
          error: error.message,
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  /**
   * Perform validation by calling the LLM Gateway
   */
  async performValidation(regulationId, content, validationLevel) {
    const startTime = Date.now();
    
    try {
      // Use built-in fetch (Node.js 18+)
      const response = await fetch('http://localhost:3002/api/llm/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: `Validate the following content against ${regulationId}: ${content}`,
          options: {
            regulation: regulationId,
            validationLevel,
            realExecution: regulationId === 'reg-66'
          }
        })
      });

      if (!response.ok) {
        throw new Error(`LLM Gateway returned ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error?.message || 'LLM Gateway validation failed');
      }

      // Format response based on validation level
      return this.formatValidationResult(result.data, validationLevel, Date.now() - startTime);

    } catch (error) {
      logger.error('Validation API call failed:', error.message);
      throw error;
    }
  }

  /**
   * Format validation result based on level complexity
   */
  formatValidationResult(llmResult, validationLevel, processingTime) {
    const baseResult = {
      processingTime,
      confidence: llmResult.response?.confidence || 0.8,
      timestamp: new Date().toISOString()
    };

    switch (validationLevel) {
      case 'A': // Basic compliance checking
        return {
          ...baseResult,
          status: llmResult.response?.confidence > 0.7 ? 'compliant' : 'non-compliant',
          summary: llmResult.response?.fullResponse?.substring(0, 200) + '...',
          level: 'Basic'
        };

      case 'B': // Moderate complexity validation
        return {
          ...baseResult,
          status: llmResult.response?.confidence > 0.7 ? 'compliant' : 'non-compliant',
          summary: llmResult.response?.fullResponse?.substring(0, 500) + '...',
          keyPoints: llmResult.response?.keyPoints?.slice(0, 3) || [],
          level: 'Moderate'
        };

      case 'C': // Advanced analysis with context
        return {
          ...baseResult,
          status: llmResult.response?.confidence > 0.7 ? 'compliant' : 'non-compliant',
          summary: llmResult.response?.fullResponse,
          keyPoints: llmResult.response?.keyPoints || [],
          actionItems: llmResult.response?.actionItems?.slice(0, 5) || [],
          context: llmResult.relevantRegulations || [],
          level: 'Advanced'
        };

      case 'D': // Comprehensive validation with evidence
        return {
          ...baseResult,
          status: llmResult.response?.confidence > 0.7 ? 'compliant' : 'non-compliant',
          summary: llmResult.response?.fullResponse,
          keyPoints: llmResult.response?.keyPoints || [],
          actionItems: llmResult.response?.actionItems || [],
          context: llmResult.relevantRegulations || [],
          evidence: llmResult.workflowDetails || {},
          universityScores: llmResult.universityConfidenceScores || {},
          level: 'Comprehensive'
        };

      default:
        return baseResult;
    }
  }

  /**
   * Handle subscription requests
   */
  async handleSubscription(clientId, message) {
    const { topics = [] } = message.data || {};
    
    const client = this.clients.get(clientId);
    if (!client.subscriptions) {
      client.subscriptions = new Set();
    }
    
    topics.forEach(topic => client.subscriptions.add(topic));
    
    this.sendToClient(clientId, {
      type: 'subscription_confirmed',
      data: {
        topics: Array.from(client.subscriptions),
        timestamp: new Date().toISOString()
      }
    });
    
    logger.info(`📡 Client ${clientId} subscribed to: ${topics.join(', ')}`);
  }

  /**
   * Handle unsubscription requests
   */
  async handleUnsubscription(clientId, message) {
    const { topics = [] } = message.data || {};
    
    const client = this.clients.get(clientId);
    if (client.subscriptions) {
      topics.forEach(topic => client.subscriptions.delete(topic));
    }
    
    this.sendToClient(clientId, {
      type: 'unsubscription_confirmed',
      data: {
        topics: client.subscriptions ? Array.from(client.subscriptions) : [],
        timestamp: new Date().toISOString()
      }
    });
    
    logger.info(`📡 Client ${clientId} unsubscribed from: ${topics.join(', ')}`);
  }

  /**
   * Send message to specific client
   */
  sendToClient(clientId, message) {
    const client = this.clients.get(clientId);
    if (client && client.ws.readyState === client.ws.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Send error message to client
   */
  sendErrorToClient(clientId, errorMessage) {
    this.sendToClient(clientId, {
      type: 'error',
      error: errorMessage,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Broadcast message to all connected clients
   */
  broadcast(message, filter = null) {
    for (const [clientId, client] of this.clients) {
      if (filter && !filter(client)) continue;
      
      if (client.ws.readyState === client.ws.OPEN) {
        client.ws.send(JSON.stringify(message));
      }
    }
  }

  /**
   * Get connected clients info
   */
  getClientsInfo() {
    return Array.from(this.clients.values()).map(client => ({
      id: client.id,
      connectedAt: client.connectedAt,
      lastActivity: client.lastActivity,
      userAgent: client.userAgent,
      ip: client.ip,
      subscriptions: client.subscriptions ? Array.from(client.subscriptions) : []
    }));
  }

  /**
   * Start the WebSocket service
   */
  async start() {
    return new Promise((resolve, reject) => {
      this.server.listen(this.port, (error) => {
        if (error) {
          logger.error(`❌ Failed to start EdSteward WebSocket service: ${error.message}`);
          reject(error);
        } else {
          logger.info(`🚀 EdSteward WebSocket service running on port ${this.port}`);
          logger.info(`🔌 WebSocket endpoint: ws://localhost:${this.port}/regulation-updates`);
          resolve();
        }
      });
    });
  }

  /**
   * Stop the WebSocket service
   */
  async stop() {
    return new Promise((resolve) => {
      // Close all client connections
      for (const [clientId, client] of this.clients) {
        client.ws.close();
      }
      this.clients.clear();

      // Close WebSocket server
      this.wss.close(() => {
        // Close HTTP server
        this.server.close(() => {
          logger.info('📴 EdSteward WebSocket service stopped');
          resolve();
        });
      });
    });
  }
}

// Start the service if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const service = new EdStewardWebSocketService();
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    logger.info('🛑 Shutting down EdSteward WebSocket service...');
    await service.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    logger.info('🛑 Shutting down EdSteward WebSocket service...');
    await service.stop();
    process.exit(0);
  });
  
  // Start the service
  service.start().catch((error) => {
    logger.error('❌ Failed to start service:', error.message);
    process.exit(1);
  });
}
