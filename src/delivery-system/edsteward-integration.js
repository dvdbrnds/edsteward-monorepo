/**
 * EdSteward Integration Service
 * Sends MCP Engine regulation updates to EdSteward's API endpoint
 */

import fetch from 'node-fetch';

export class EdStewardIntegration {
  constructor(options = {}) {
    this.edstewardUrl = options.edstewardUrl || 'http://localhost:3000';
    this.apiKey = options.apiKey || null;
    this.retryAttempts = options.retryAttempts || 3;
    this.retryDelay = options.retryDelay || 1000;
    
    // Regulation ID mapping (MCP Engine -> EdSteward)
    this.regulationMapping = {
      'REG-66': 4661,  // TEACH Act in EdSteward
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

    const updatePayload = {
      regulationId: edstewardId,
      name: this.getRegulationName(mcpUpdate.regulationId),
      originalContent: mcpUpdate.data.before?.content || "Previous regulation text...",
      updatedContent: mcpUpdate.data.after?.content || "New regulation text with changes...",
      status: "pending",
      metadata: {
        mcpRegulationId: mcpUpdate.regulationId,
        mcpVersion: mcpUpdate.version,
        changeType: mcpUpdate.data.changeType,
        impact: mcpUpdate.data.after?.impact,
        timestamp: mcpUpdate.timestamp,
        contentHash: mcpUpdate.data.contentHash
      }
    };

    console.log(`📤 Sending update to EdSteward for ${mcpUpdate.regulationId} -> ${edstewardId}`);
    
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
}
