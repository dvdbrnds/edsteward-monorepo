/**
 * EdSteward Integration Service
 * Sends MCP Engine regulation updates to EdSteward's API endpoint
 */

import fetch from 'node-fetch';
import WebSocket from 'ws';

export class EdStewardIntegration {
  constructor(options = {}) {
    this.edstewardUrl = options.edstewardUrl || process.env.EDSTEWARD_URL || 'http://localhost:3000';
    this.apiKey = options.apiKey || process.env.EDSTEWARD_API_KEY || null;
    this.retryAttempts = options.retryAttempts || 3;
    this.retryDelay = options.retryDelay || 1000;
    this.websocketUrl = options.websocketUrl || process.env.EDSTEWARD_WS_URL || 'ws://localhost:3000/ws';
    
    // Regulation ID mapping (MCP Engine -> EdSteward)
    this.regulationMapping = {
      'REG-66': 4524,  // TEACH Act in EdSteward (updated per client spec)
      'REG-17': 4662,  // Copyright Act
      'REG-DMCA': 4663 // DMCA
    };
    
    console.log(`🔗 EdSteward Integration initialized: ${this.edstewardUrl}`);
  }

  /**
   * Send regulation update to EdSteward
   */
  async sendRegulationUpdate(mcpUpdate) {
    const edstewardId = this.regulationMapping[mcpUpdate.regulationId];
    
    if (!edstewardId) {
      console.warn(`⚠️ No EdSteward mapping for ${mcpUpdate.regulationId}`);
      return { success: false, error: 'No regulation mapping found' };
    }

    // Debug: Log the structure of mcpUpdate to understand the data format
    console.log(`🔍 DEBUG: mcpUpdate structure for ${mcpUpdate.regulationId}:`);
    console.log(`  - data.before keys:`, mcpUpdate.data.before ? Object.keys(mcpUpdate.data.before) : 'undefined');
    console.log(`  - data.after keys:`, mcpUpdate.data.after ? Object.keys(mcpUpdate.data.after) : 'undefined');
    console.log(`  - data.after.fullText length:`, mcpUpdate.data.after?.fullText?.length || 'undefined');
    console.log(`  - data.after.content length:`, mcpUpdate.data.after?.content?.length || 'undefined');

    // Extract the COMPLETE USC regulation text for EdSteward differential view
    const originalText = mcpUpdate.data.before?.content || mcpUpdate.data.before?.fullText || "";
    const updatedText = mcpUpdate.data.after?.content || mcpUpdate.data.after?.fullText || "";
    
    console.log(`📋 Content lengths - Original: ${originalText.length}, Updated: ${updatedText.length}`);
    console.log(`📋 Original text preview: ${originalText.substring(0, 100)}...`);
    console.log(`📋 Updated text preview: ${updatedText.substring(0, 100)}...`);

    const updatePayload = {
      regulationId: edstewardId,
      name: this.getRegulationName(mcpUpdate.regulationId),
      originalContent: originalText,
      updatedContent: updatedText,
      status: "pending"
    };

    console.log(`📤 Sending update to EdSteward for ${mcpUpdate.regulationId} -> ${edstewardId}`);
    console.log(`🔍 PAYLOAD DEBUG - originalContent length: ${updatePayload.originalContent.length}`);
    console.log(`🔍 PAYLOAD DEBUG - updatedContent length: ${updatePayload.updatedContent.length}`);
    console.log(`🔍 PAYLOAD DEBUG - originalContent preview: ${updatePayload.originalContent.substring(0, 100)}...`);
    console.log(`🔍 PAYLOAD DEBUG - updatedContent preview: ${updatePayload.updatedContent.substring(0, 100)}...`);
    
    return await this.sendWithRetry(updatePayload);
  }

  /**
   * Send update with retry logic
   */
  async sendWithRetry(payload, attempt = 1) {
    try {
      const headers = {
        'Content-Type': 'application/json'
      };
      
      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const response = await fetch(`${this.edstewardUrl}/api/regulation-updates`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        timeout: 10000
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      console.log(`✅ EdSteward update successful: ${result.update?.id || 'Unknown ID'}`);
      console.log(`   Regulation: ${payload.regulationId} (${payload.name})`);
      console.log(`   Status: ${payload.status}`);
      
      // Send WebSocket notification for instant UI refresh
      await this.sendWebSocketNotification({
        regulationId: payload.regulationId,
        updateId: result.update?.id,
        name: payload.name,
        timestamp: new Date().toISOString()
      });
      
      return {
        success: true,
        updateId: result.update?.id,
        result
      };

    } catch (error) {
      console.error(`❌ EdSteward update failed (attempt ${attempt}):`, error.message);
      
      if (attempt < this.retryAttempts) {
        console.log(`🔄 Retrying in ${this.retryDelay}ms...`);
        await this.delay(this.retryDelay);
        return await this.sendWithRetry(payload, attempt + 1);
      }
      
      return {
        success: false,
        error: error.message,
        attempts: attempt
      };
    }
  }

  /**
   * Get human-readable regulation name
   */
  getRegulationName(mcpRegulationId) {
    const names = {
      'REG-66': 'TEACH Act 2024 Update',
      'REG-17': 'Copyright Act Amendment',
      'REG-DMCA': 'DMCA Safe Harbor Update'
    };
    
    return names[mcpRegulationId] || `${mcpRegulationId} Update`;
  }

  /**
   * Test connection to EdSteward
   */
  async testConnection() {
    try {
      console.log('🧪 Testing EdSteward connection...');
      
      const response = await fetch(`${this.edstewardUrl}/api/health`, {
        timeout: 5000
      });
      
      if (response.ok) {
        console.log('✅ EdSteward connection successful');
        return true;
      } else {
        console.warn(`⚠️ EdSteward responded with status ${response.status}`);
        return false;
      }
    } catch (error) {
      console.error('❌ EdSteward connection failed:', error.message);
      return false;
    }
  }

  /**
   * Utility delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Add new regulation mapping
   */
  addRegulationMapping(mcpId, edstewardId) {
    this.regulationMapping[mcpId] = edstewardId;
    console.log(`📋 Added regulation mapping: ${mcpId} -> ${edstewardId}`);
  }

  /**
   * Get current mappings
   */
  getMappings() {
    return { ...this.regulationMapping };
  }

  /**
   * Send WebSocket notification to EdSteward for instant UI refresh
   */
  async sendWebSocketNotification(updateData) {
    return new Promise((resolve) => {
      try {
        console.log(`📡 Sending WebSocket notification to ${this.websocketUrl}`);
        
        const ws = new WebSocket(this.websocketUrl);
        
        ws.on('open', () => {
          const message = {
            type: 'regulation_updated',
            data: {
              regulationId: updateData.regulationId,
              updateId: updateData.updateId,
              name: updateData.name,
              timestamp: updateData.timestamp
            }
          };
          
          ws.send(JSON.stringify(message));
          console.log(`✅ WebSocket notification sent: Update ID ${updateData.updateId}`);
          ws.close();
          resolve(true);
        });
        
        ws.on('error', (error) => {
          console.warn(`⚠️ WebSocket notification failed: ${error.message}`);
          resolve(false);
        });
        
        ws.on('close', () => {
          resolve(true);
        });
        
        // Timeout after 5 seconds
        setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.close();
          }
          resolve(false);
        }, 5000);
        
      } catch (error) {
        console.warn(`⚠️ WebSocket notification error: ${error.message}`);
        resolve(false);
      }
    });
  }
}
