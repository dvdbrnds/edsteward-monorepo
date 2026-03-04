/**
 * MCP Engine Client SDK for Real-Time Regulation Updates
 * 
 * JavaScript SDK for customer frontends to receive real-time regulation updates
 * Based on Context7 best practices and Emittery patterns
 */

class RegulationUpdateClient {
  constructor(options = {}) {
    this.wsUrl = options.wsUrl || 'ws://localhost:3051/regulation-updates';
    this.autoReconnect = options.autoReconnect !== false;
    this.reconnectDelay = options.reconnectDelay || 5000;
    this.maxReconnectAttempts = options.maxReconnectAttempts || 10;
    
    this.ws = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.subscriptions = new Set();
    this.eventHandlers = new Map();
    this.connectionId = null;
    
    // Event types
    this.events = {
      CONNECTED: 'connected',
      DISCONNECTED: 'disconnected', 
      REGULATION_UPDATED: 'regulation_updated',
      SUBSCRIPTION_CONFIRMED: 'subscription_confirmed',
      ERROR: 'error',
      RECONNECTING: 'reconnecting'
    };
  }

  /**
   * Connect to the regulation update service
   */
  async connect() {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.wsUrl);
        
        this.ws.onopen = () => {
          console.log('🔌 Connected to regulation update service');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.emit(this.events.CONNECTED);
          resolve();
        };
        
        this.ws.onmessage = (event) => {
          this.handleMessage(event);
        };
        
        this.ws.onclose = (event) => {
          console.log('📴 Disconnected from regulation update service');
          this.isConnected = false;
          this.emit(this.events.DISCONNECTED, { code: event.code, reason: event.reason });
          
          if (this.autoReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.attemptReconnect();
          }
        };
        
        this.ws.onerror = (error) => {
          console.error('❌ WebSocket error:', error);
          this.emit(this.events.ERROR, error);
          
          if (!this.isConnected) {
            reject(error);
          }
        };
        
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Handle incoming messages from the server
   */
  handleMessage(event) {
    try {
      const message = JSON.parse(event.data);
      
      switch (message.type) {
        case 'connected':
          this.connectionId = message.clientId;
          console.log(`✅ Connection confirmed, ID: ${this.connectionId}`);
          break;
          
        case 'regulation_updated':
          console.log(`📋 Regulation update received: ${message.regulationId}`);
          this.emit(this.events.REGULATION_UPDATED, {
            regulationId: message.regulationId,
            data: message.data,
            timestamp: message.timestamp,
            version: message.version
          });
          break;
          
        case 'subscription_confirmed':
          console.log(`📋 Subscription confirmed: ${message.regulationIds.join(', ')}`);
          this.emit(this.events.SUBSCRIPTION_CONFIRMED, {
            regulationIds: message.regulationIds,
            timestamp: message.timestamp
          });
          break;
          
        case 'pong':
          // Handle ping/pong for connection health
          break;
          
        default:
          console.warn('⚠️ Unknown message type:', message.type);
      }
      
    } catch (error) {
      console.error('❌ Error parsing message:', error);
      this.emit(this.events.ERROR, error);
    }
  }

  /**
   * Subscribe to regulation updates
   */
  subscribeToRegulations(regulationIds) {
    if (!Array.isArray(regulationIds)) {
      regulationIds = [regulationIds];
    }
    
    if (!this.isConnected) {
      throw new Error('Not connected to regulation update service');
    }
    
    // Add to our local subscriptions
    regulationIds.forEach(id => this.subscriptions.add(id));
    
    // Send subscription request
    this.send({
      type: 'subscribe',
      regulationIds
    });
    
    console.log(`📋 Subscribing to: ${regulationIds.join(', ')}`);
  }

  /**
   * Unsubscribe from regulation updates  
   */
  unsubscribeFromRegulations(regulationIds) {
    if (!Array.isArray(regulationIds)) {
      regulationIds = [regulationIds];
    }
    
    if (!this.isConnected) {
      throw new Error('Not connected to regulation update service');
    }
    
    // Remove from local subscriptions
    regulationIds.forEach(id => this.subscriptions.delete(id));
    
    // Send unsubscription request
    this.send({
      type: 'unsubscribe',
      regulationIds
    });
    
    console.log(`📋 Unsubscribing from: ${regulationIds.join(', ')}`);
  }

  /**
   * Register event handler
   */
  on(eventType, handler) {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType).push(handler);
  }

  /**
   * Remove event handler
   */
  off(eventType, handler) {
    if (!this.eventHandlers.has(eventType)) return;
    
    const handlers = this.eventHandlers.get(eventType);
    const index = handlers.indexOf(handler);
    if (index > -1) {
      handlers.splice(index, 1);
    }
  }

  /**
   * Emit event to registered handlers
   */
  emit(eventType, data = null) {
    if (!this.eventHandlers.has(eventType)) return;
    
    const handlers = this.eventHandlers.get(eventType);
    handlers.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        console.error(`❌ Error in event handler for ${eventType}:`, error);
      }
    });
  }

  /**
   * Send message to server
   */
  send(message) {
    if (!this.isConnected || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not ready');
    }
    
    this.ws.send(JSON.stringify(message));
  }

  /**
   * Attempt to reconnect
   */
  attemptReconnect() {
    this.reconnectAttempts++;
    console.log(`🔄 Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
    
    this.emit(this.events.RECONNECTING, { attempt: this.reconnectAttempts });
    
    setTimeout(async () => {
      try {
        await this.connect();
        
        // Re-subscribe to previously subscribed regulations
        if (this.subscriptions.size > 0) {
          this.subscribeToRegulations(Array.from(this.subscriptions));
        }
        
      } catch (error) {
        console.error('❌ Reconnection failed:', error);
        
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          console.error('❌ Max reconnection attempts reached');
          this.emit(this.events.ERROR, new Error('Max reconnection attempts reached'));
        }
      }
    }, this.reconnectDelay);
  }

  /**
   * Disconnect from the service
   */
  disconnect() {
    this.autoReconnect = false;
    
    if (this.ws) {
      this.ws.close();
    }
    
    this.isConnected = false;
    this.connectionId = null;
    this.subscriptions.clear();
    
    console.log('🔌 Disconnected from regulation update service');
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      connected: this.isConnected,
      connectionId: this.connectionId,
      subscriptions: Array.from(this.subscriptions),
      reconnectAttempts: this.reconnectAttempts
    };
  }

  /**
   * Send ping to keep connection alive
   */
  ping() {
    if (this.isConnected) {
      this.send({ type: 'ping' });
    }
  }
}

/**
 * Helper class for easier REG-66 integration
 */
class REG66UpdateClient extends RegulationUpdateClient {
  constructor(options = {}) {
    super(options);
    
    // Automatically subscribe to REG-66 on connection
    this.on(this.events.CONNECTED, () => {
      this.subscribeToRegulations(['REG-66']);
    });
  }

  /**
   * Setup handlers for REG-66 specific events
   */
  onRegulationUpdate(handler) {
    this.on(this.events.REGULATION_UPDATED, (data) => {
      if (data.regulationId === 'REG-66') {
        handler(data);
      }
    });
  }

  /**
   * Integration with existing REG-66 console
   */
  integrateWithConsole(consoleElement) {
    this.onRegulationUpdate((updateData) => {
      // Add console log entry
      if (typeof addConsoleLog === 'function') {
        addConsoleLog(`📋 REG-66 regulation updated (v${updateData.version})`, 'info');
        addConsoleLog(`   - Change type: ${updateData.data.changeType}`, 'debug');
        addConsoleLog(`   - Timestamp: ${updateData.timestamp}`, 'debug');
      }
      
      // Update regulation status if available
      if (typeof updateRegulationStatus === 'function') {
        updateRegulationStatus();
      }
      
      // Trigger a visual notification
      this.showUpdateNotification(updateData);
    });
  }

  showUpdateNotification(updateData) {
    // Create a temporary notification
    const notification = document.createElement('div');
    notification.className = 'regulation-update-notification';
    notification.innerHTML = `
      <div style="
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10b981;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        font-family: 'Courier New', monospace;
        font-size: 14px;
        max-width: 400px;
      ">
        <strong>📋 REG-66 Updated</strong><br>
        Version: ${updateData.version}<br>
        Type: ${updateData.data.changeType}
      </div>
    `;
    
    document.body.appendChild(notification);
    
    // Remove after 5 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 5000);
  }
}

// Export for use in browsers and Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { RegulationUpdateClient, REG66UpdateClient };
} else if (typeof window !== 'undefined') {
  window.RegulationUpdateClient = RegulationUpdateClient;
  window.REG66UpdateClient = REG66UpdateClient;
}

export { RegulationUpdateClient, REG66UpdateClient };
