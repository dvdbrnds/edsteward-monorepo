import { WebSocketServer } from 'ws';
import { Server } from 'http';

export function setupWebSocketServer(httpServer: Server) {
  
  const wss = new WebSocketServer({ 
    server: httpServer,
    path: '/ws'
  });
  
  // Track connected clients for broadcasting
  const connectedClients = new Set<any>();
  
  wss.on('connection', (ws) => {
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
        
        if (message.type === 'regulation_updated') {
          // Broadcast to all connected frontend clients for instant refresh
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
      connectedClients.delete(ws);
    });
    
    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error);
      connectedClients.delete(ws);
    });
  });
  
  // Helper function to broadcast messages to all clients
  function broadcastToClients(message: any, clients: Set<any>) {
    let _broadcastCount = 0;
    clients.forEach(client => {
      if (client.readyState === 1) { // WebSocket.OPEN
        try {
          client.send(JSON.stringify(message));
          _broadcastCount++;
        } catch (error) {
          console.error('❌ Error broadcasting to client:', error);
          clients.delete(client);
        }
      } else {
        clients.delete(client);
      }
    });
  }
  
  return wss;
}

