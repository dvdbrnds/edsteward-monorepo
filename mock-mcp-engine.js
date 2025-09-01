#!/usr/bin/env node

/**
 * Mock MCP Engine WebSocket Server
 * For testing EdSteward integration while real MCP Engine is in development
 */

import WebSocket, { WebSocketServer } from 'ws';
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const HTTP_PORT = 3003;
const WS_PORT = 3003;

// Mock regulation data
const mockRegulations = {
  'REG-66': {
    id: 'REG-66',
    title: 'Student Privacy Rights (FERPA)',
    version: '2024.1.0',
    lastUpdated: new Date().toISOString(),
    status: 'active'
  },
  'REG-42': {
    id: 'REG-42', 
    title: 'Title IX Compliance Requirements',
    version: '2024.2.1',
    lastUpdated: new Date().toISOString(),
    status: 'active'
  }
};

// Connected clients storage
const connectedClients = new Map();

// HTTP Server Setup
const server = app.listen(HTTP_PORT, () => {
  console.log('🚀 Mock MCP Engine HTTP Server running on port', HTTP_PORT);
});

// WebSocket Server Setup
const wss = new WebSocketServer({ 
  server,
  path: '/regulation-updates'
});

console.log('🔌 Mock MCP Engine WebSocket Server starting...');

// Health endpoint
app.get('/health', (req, res) => {
  res.json({
    service: 'Mock MCP Engine',
    status: 'healthy',
    version: '1.0.0-mock',
    details: {
      connectedClients: connectedClients.size,
      availableRegulations: Object.keys(mockRegulations).length,
      uptime: process.uptime()
    }
  });
});

// Simulate regulation change endpoint
app.post('/api/simulate-change/:regulationId', (req, res) => {
  const { regulationId } = req.params;
  const { changeType = 'content_update', mockData = {} } = req.body;
  
  console.log(`📡 Simulating change for ${regulationId}:`, changeType);
  
  if (!mockRegulations[regulationId]) {
    return res.status(404).json({ error: 'Regulation not found' });
  }
  
  // Update mock regulation
  const regulation = mockRegulations[regulationId];
  const versionParts = regulation.version.split('.');
  versionParts[2] = (parseInt(versionParts[2]) + 1).toString();
  regulation.version = versionParts.join('.');
  regulation.lastUpdated = new Date().toISOString();
  
  // Broadcast to all connected clients
  const updateMessage = {
    type: 'regulation_updated',
    regulationId: regulationId,
    version: regulation.version,
    changeType: changeType,
    timestamp: regulation.lastUpdated,
    details: {
      title: regulation.title,
      impact: mockData.impact || 'medium',
      summary: `${changeType} detected in ${regulation.title}`,
      ...mockData
    }
  };
  
  let broadcastCount = 0;
  connectedClients.forEach((clientInfo, ws) => {
    if (ws.readyState === WebSocket.OPEN && clientInfo.subscriptions.includes(regulationId)) {
      ws.send(JSON.stringify(updateMessage));
      broadcastCount++;
    }
  });
  
  console.log(`📤 Broadcasted update to ${broadcastCount} clients`);
  
  res.json({
    success: true,
    regulationId,
    newVersion: regulation.version,
    broadcastCount,
    message: 'Regulation update simulated and broadcasted'
  });
});

// WebSocket connection handling
wss.on('connection', (ws, req) => {
  const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  console.log(`🔗 New WebSocket connection: ${clientId}`);
  
  // Initialize client info
  connectedClients.set(ws, {
    id: clientId,
    connectedAt: new Date().toISOString(),
    subscriptions: []
  });
  
  // Send connection confirmation
  ws.send(JSON.stringify({
    type: 'connected',
    clientId: clientId,
    message: 'Connected to Mock MCP Engine',
    availableRegulations: Object.keys(mockRegulations)
  }));
  
  // Handle incoming messages
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      const clientInfo = connectedClients.get(ws);
      
      console.log(`📥 Received from ${clientId}:`, message.type);
      
      switch (message.type) {
        case 'subscribe':
          if (message.regulationIds && Array.isArray(message.regulationIds)) {
            // Add to subscriptions
            message.regulationIds.forEach(regId => {
              if (!clientInfo.subscriptions.includes(regId)) {
                clientInfo.subscriptions.push(regId);
              }
            });
            
            console.log(`📋 ${clientId} subscribed to:`, message.regulationIds);
            
            // Send subscription confirmation
            ws.send(JSON.stringify({
              type: 'subscribed',
              regulationIds: message.regulationIds,
              message: `Subscribed to ${message.regulationIds.length} regulation(s)`
            }));
          }
          break;
          
        case 'unsubscribe':
          if (message.regulationIds && Array.isArray(message.regulationIds)) {
            // Remove from subscriptions
            message.regulationIds.forEach(regId => {
              const index = clientInfo.subscriptions.indexOf(regId);
              if (index > -1) {
                clientInfo.subscriptions.splice(index, 1);
              }
            });
            
            console.log(`📋 ${clientId} unsubscribed from:`, message.regulationIds);
            
            ws.send(JSON.stringify({
              type: 'unsubscribed',
              regulationIds: message.regulationIds,
              message: `Unsubscribed from ${message.regulationIds.length} regulation(s)`
            }));
          }
          break;
          
        case 'ping':
          // Respond to ping with pong
          ws.send(JSON.stringify({
            type: 'pong',
            timestamp: new Date().toISOString()
          }));
          break;
          
        default:
          console.log(`❓ Unknown message type from ${clientId}:`, message.type);
          ws.send(JSON.stringify({
            type: 'error',
            message: `Unknown message type: ${message.type}`
          }));
      }
    } catch (error) {
      console.error(`❌ Error processing message from ${clientId}:`, error.message);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Invalid message format'
      }));
    }
  });
  
  // Handle client disconnect
  ws.on('close', () => {
    console.log(`🔌 Client disconnected: ${clientId}`);
    connectedClients.delete(ws);
  });
  
  // Handle WebSocket errors
  ws.on('error', (error) => {
    console.error(`❌ WebSocket error for ${clientId}:`, error.message);
    connectedClients.delete(ws);
  });
});

// Periodic regulation updates (simulate real-world changes)
setInterval(() => {
  const regulationIds = Object.keys(mockRegulations);
  const randomRegId = regulationIds[Math.floor(Math.random() * regulationIds.length)];
  
  // Only send updates if there are connected clients
  if (connectedClients.size > 0) {
    console.log(`🔄 Simulating periodic update for ${randomRegId}`);
    
    // Simulate via HTTP endpoint
    fetch(`http://localhost:${HTTP_PORT}/api/simulate-change/${randomRegId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        changeType: 'periodic_check',
        mockData: {
          impact: 'low',
          message: 'Periodic regulation monitoring update'
        }
      })
    }).catch(err => console.log('Periodic update error:', err.message));
  }
}, 60000); // Every 60 seconds

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down Mock MCP Engine...');
  
  // Close all WebSocket connections
  connectedClients.forEach((clientInfo, ws) => {
    ws.close(1000, 'Server shutting down');
  });
  
  // Close HTTP server
  server.close(() => {
    console.log('✅ Mock MCP Engine shut down gracefully');
    process.exit(0);
  });
});

console.log('✅ Mock MCP Engine ready!');
console.log('🌐 HTTP Health: http://localhost:3003/health');
console.log('🔌 WebSocket: ws://localhost:3003/regulation-updates');
console.log('📡 Test endpoint: POST http://localhost:3003/api/simulate-change/REG-66');
console.log('🧪 Use test-mcp-integration.js to validate connection');

