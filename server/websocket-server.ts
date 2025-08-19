import { WebSocketServer } from 'ws';
import { Server } from 'http';

export function setupWebSocketServer(httpServer: Server) {
  console.log('🚀 Setting up WebSocket server...');
  
  const wss = new WebSocketServer({ 
    server: httpServer,
    path: '/ws'
  });
  
  // Track connected clients for broadcasting
  const connectedClients = new Set<any>();
  
  wss.on('connection', (ws, req) => {
    console.log('🔌 WebSocket client connected:', req.socket.remoteAddress);
    connectedClients.add(ws);
    
    // Send connection confirmation
    ws.send(JSON.stringify({ 
      type: 'connected', 
      message: 'EdSteward WebSocket server ready',
      timestamp: new Date().toISOString()
    }));
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log('📡 Received WebSocket message:', message);
        
        if (message.type === 'regulation_updated') {
          // Broadcast to all connected frontend clients for instant refresh
          console.log(`📢 Broadcasting regulation update: ID ${message.data?.updateId || 'unknown'}`);
          broadcastToClients(message, connectedClients);
        }
      } catch (error) {
        console.error('❌ WebSocket message parsing error:', error);
        ws.send(JSON.stringify({ 
          type: 'error', 
          message: 'Invalid message format' 
        }));
      }
    });
    
    ws.on('close', () => {
      console.log('📴 WebSocket client disconnected');
      connectedClients.delete(ws);
    });
    
    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error);
      connectedClients.delete(ws);
    });
  });
  
  // Helper function to broadcast messages to all clients
  function broadcastToClients(message: any, clients: Set<any>) {
    let broadcastCount = 0;
    clients.forEach(client => {
      if (client.readyState === 1) { // WebSocket.OPEN
        try {
          client.send(JSON.stringify(message));
          broadcastCount++;
        } catch (error) {
          console.error('❌ Error broadcasting to client:', error);
          clients.delete(client);
        }
      } else {
        clients.delete(client);
      }
    });
    console.log(`✅ Broadcasted to ${broadcastCount} clients`);
  }
  
  console.log('✅ WebSocket server initialized on /ws path');
  return wss;
}

