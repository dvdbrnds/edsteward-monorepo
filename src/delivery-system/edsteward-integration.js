/**
 * EdSteward Integration Service
 * Sends MCP Engine regulation updates to EdSteward's API endpoint
 */

import fetch from 'node-fetch';
import WebSocket from 'ws';
import { createHash } from 'crypto';

export class EdStewardIntegration {
  constructor(options = {}) {
    this.edstewardUrl = options.edstewardUrl || process.env.EDSTEWARD_URL || 'http://localhost:3000';
    this.apiKey = options.apiKey || process.env.EDSTEWARD_API_KEY || null;
    this.retryAttempts = options.retryAttempts || 3;
    this.retryDelay = options.retryDelay || 1000;
    this.websocketUrl = options.websocketUrl || process.env.EDSTEWARD_WS_URL || 'ws://localhost:3000/ws';
    
    // Regulation ID mapping (MCP Engine -> EdSteward)
    // Mapping for REAL regulations that exist in the system
    this.regulationMapping = {
      // Core MCP Engine Regulations
      'REG-66': 4524,  // TEACH Act in EdSteward (updated per client spec)
      'reg-66': 4524,  // TEACH Act (lowercase variant)
      
      // OSHA Regulations (original working example)
      'osha-s-emergency-action-plan-standard': 4580, // OSHA Emergency Action Plan Standard
      'REG-4580': 4580, // OSHA Emergency Action Plan Standard (REG format)
      'occupational-safety-and-health-act-of-1970': 1813, // OSHA General
      'REG-1813': 1813, // OSHA General (REG format)
      
      // Real regulations from CSV data (using Item IDs from compmat.csv)
      'drug-free-schools-and-communities-act': 4010, // Drug-Free Schools and Communities Act (Item ID 1807)
      'REG-1807': 4010, // Drug-Free Schools and Communities Act (by Item ID)
      
      'age-discrimination-act-of-1975': 4006, // Age Discrimination Act (Item ID 1785)
      'REG-1785': 4006, // Age Discrimination Act (by Item ID)
      
      'americans-with-disabilities-act-of-1990': 4003, // ADA (Item ID 1786)
      'REG-1786': 4003, // ADA (by Item ID)
      
      'higher-education-act-institutional-and-financial-assistance-information-for-students': 4007, // HEA (Item ID 1982)
      'REG-1982': 4007, // HEA (by Item ID)
      
      // Generic mapping for unknown regulations (will be assigned sequential IDs)
      '_FALLBACK_BASE_ID': 6000 // Base ID for auto-generated mappings
    };
    
    console.log(`🔗 EdSteward Integration initialized: ${this.edstewardUrl}`);
  }

  /**
   * Get or create EdSteward ID for a regulation
   */
  getEdStewardId(regulationId) {
    // Check if we have an explicit mapping
    if (this.regulationMapping[regulationId]) {
      return this.regulationMapping[regulationId];
    }
    
    // Generate a dynamic ID for unmapped regulations
    const baseId = this.regulationMapping['_FALLBACK_BASE_ID'];
    const hash = createHash('md5').update(regulationId).digest('hex');
    const dynamicId = baseId + parseInt(hash.substring(0, 4), 16) % 1000;
    
    // Cache the mapping for consistency
    this.regulationMapping[regulationId] = dynamicId;
    console.log(`📋 Auto-generated EdSteward ID ${dynamicId} for regulation ${regulationId}`);
    
    return dynamicId;
  }

  /**
   * Send regulation update to EdSteward
   */
  async sendRegulationUpdate(mcpUpdate) {
    // Temporarily disable EdSteward integration to focus on WebSocket delivery
    console.log(`📋 EdSteward integration disabled for ${mcpUpdate.regulationId} (focusing on WebSocket delivery)`);
    return { success: true, message: 'EdSteward integration temporarily disabled' };
    
    const edstewardId = this.getEdStewardId(mcpUpdate.regulationId);
    
    if (!edstewardId) {
      console.warn(`⚠️ Failed to get EdSteward ID for ${mcpUpdate.regulationId}`);
      return { success: false, error: 'Failed to generate regulation mapping' };
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
      // Core MCP Engine Regulations
      'REG-66': 'TEACH Act 2024 Update',
      'reg-66': 'TEACH Act 2024 Update',
      
      // OSHA Regulations (original working example)
      'REG-4580': 'OSHA Emergency Action Plan 2024 Update',
      'REG-1813': 'OSHA General Standards 2024 Update',
      'osha-s-emergency-action-plan-standard': 'OSHA Emergency Action Plan 2024 Update',
      'occupational-safety-and-health-act-of-1970': 'OSHA General Standards 2024 Update',
      
      // Real regulations from CSV data
      'drug-free-schools-and-communities-act': 'Drug-Free Schools and Communities Act 2024 Update',
      'REG-1807': 'Drug-Free Schools and Communities Act 2024 Update',
      
      'age-discrimination-act-of-1975': 'Age Discrimination Act of 1975 2024 Update',
      'REG-1785': 'Age Discrimination Act of 1975 2024 Update',
      
      'americans-with-disabilities-act-of-1990': 'Americans with Disabilities Act of 1990 2024 Update',
      'REG-1786': 'Americans with Disabilities Act of 1990 2024 Update',
      
      'higher-education-act-institutional-and-financial-assistance-information-for-students': 'Higher Education Act: Institutional Information 2024 Update',
      'REG-1982': 'Higher Education Act: Institutional Information 2024 Update'
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
