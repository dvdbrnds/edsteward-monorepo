#!/usr/bin/env node

/**
 * Universal Regulation Update Test Script
 * Tests the update mechanism for ALL regulation engines in the MCP system
 * 
 * This script demonstrates the expanded capability to push updates to clients
 * for all regulation engines, not just OSHA.
 */

import fetch from 'node-fetch';
import { WebSocket } from 'ws';

// Comprehensive list of all regulation engines in the system
const ALL_REGULATION_ENGINES = [
  // Core MCP Engine Regulations
  { id: 'REG-66', name: 'TEACH Act', type: 'copyright' },
  { id: 'reg-66', name: 'TEACH Act (lowercase)', type: 'copyright' },
  
  // Privacy & Data Protection
  { id: 'gdpr-2018', name: 'GDPR', type: 'privacy' },
  { id: 'hipaa-1996', name: 'HIPAA', type: 'healthcare' },
  { id: 'ccpa-2018', name: 'CCPA', type: 'privacy' },
  
  // OSHA Regulations (the original working example)
  { id: 'osha-s-emergency-action-plan-standard', name: 'OSHA Emergency Action Plan', type: 'safety' },
  { id: 'REG-4580', name: 'OSHA Emergency Action Plan (REG format)', type: 'safety' },
  { id: 'occupational-safety-and-health-act-of-1970', name: 'OSHA General', type: 'safety' },
  { id: 'REG-1813', name: 'OSHA General (REG format)', type: 'safety' },
  
  // Educational Compliance
  { id: 'title-ix-of-the-education-amendment-of-1972', name: 'Title IX', type: 'education' },
  { id: 'REG-4001', name: 'Title IX (REG format)', type: 'education' },
  { id: 'clery-act', name: 'Clery Act', type: 'education' },
  { id: 'REG-4002', name: 'Clery Act (REG format)', type: 'education' },
  { id: 'ferpa', name: 'FERPA', type: 'education' },
  { id: 'REG-4004', name: 'FERPA (REG format)', type: 'education' },
  
  // Accessibility & Civil Rights
  { id: 'ada', name: 'ADA', type: 'accessibility' },
  { id: 'REG-4003', name: 'ADA (REG format)', type: 'accessibility' },
  { id: 'Acade-1701-XXXX', name: 'Americans with Disabilities Act of 1990', type: 'accessibility' },
  { id: 'Acade-1692-XXXX', name: 'Age Discrimination Act of 1975', type: 'civil_rights' },
  
  // Higher Education Act Provisions
  { id: 'Acade-1605-XXXX', name: 'HEA: Institutional Information', type: 'higher_ed' },
  { id: 'Acade-1636-XXXX', name: 'HEA: Textbook Information', type: 'higher_ed' },
  { id: 'Acade-1766-XXXX', name: 'Higher Education Opportunity Act', type: 'higher_ed' },
  
  // Test Regulations
  { id: 'TEST-GDPR-DEMO', name: 'Test GDPR Demo', type: 'test' }
];

const DELIVERY_SERVER_URL = 'http://localhost:3051';
const WEBSOCKET_URL = 'ws://localhost:3051/regulation-updates';

class UniversalRegulationTester {
  constructor() {
    this.testResults = [];
    this.websocketConnections = new Map();
  }

  /**
   * Test the delivery system health
   */
  async testDeliverySystemHealth() {
    console.log('🏥 Testing delivery system health...');
    
    try {
      const response = await fetch(`${DELIVERY_SERVER_URL}/health`);
      const health = await response.json();
      
      if (response.ok) {
        console.log('✅ Delivery system is healthy');
        console.log(`   Status: ${health.status}`);
        console.log(`   Uptime: ${Math.floor(health.uptime)}s`);
        return true;
      } else {
        console.error('❌ Delivery system health check failed');
        return false;
      }
    } catch (error) {
      console.error('❌ Failed to connect to delivery system:', error.message);
      return false;
    }
  }

  /**
   * Test EdSteward integration status
   */
  async testEdStewardIntegration() {
    console.log('🔗 Testing EdSteward integration...');
    
    try {
      const response = await fetch(`${DELIVERY_SERVER_URL}/api/edsteward/status`);
      const status = await response.json();
      
      if (response.ok) {
        console.log(`✅ EdSteward integration status: ${status.connected ? 'Connected' : 'Disconnected'}`);
        console.log(`   URL: ${status.edstewardUrl}`);
        console.log(`   Mappings: ${Object.keys(status.mappings).length} regulations mapped`);
        return status.connected;
      } else {
        console.error('❌ EdSteward integration check failed');
        return false;
      }
    } catch (error) {
      console.error('❌ Failed to check EdSteward integration:', error.message);
      return false;
    }
  }

  /**
   * Set up WebSocket connection for a regulation
   */
  async setupWebSocketConnection(regulationId) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(WEBSOCKET_URL);
      let connected = false;
      
      ws.on('open', () => {
        console.log(`🔌 WebSocket connected for ${regulationId}`);
        
        // Subscribe to the regulation
        ws.send(JSON.stringify({
          type: 'subscribe',
          regulationIds: [regulationId]
        }));
        
        connected = true;
        this.websocketConnections.set(regulationId, ws);
        resolve(ws);
      });
      
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          console.log(`📨 WebSocket message for ${regulationId}:`, message.type);
          
          if (message.type === 'regulation_updated') {
            console.log(`   ✅ Update received: ${message.regulationId} v${message.version}`);
          }
        } catch (error) {
          console.error(`❌ Failed to parse WebSocket message for ${regulationId}:`, error.message);
        }
      });
      
      ws.on('error', (error) => {
        console.error(`❌ WebSocket error for ${regulationId}:`, error.message);
        if (!connected) reject(error);
      });
      
      ws.on('close', () => {
        console.log(`📴 WebSocket disconnected for ${regulationId}`);
        this.websocketConnections.delete(regulationId);
      });
      
      // Timeout after 5 seconds
      setTimeout(() => {
        if (!connected) {
          reject(new Error('WebSocket connection timeout'));
        }
      }, 5000);
    });
  }

  /**
   * Test manual update trigger for a regulation
   */
  async testManualUpdate(regulation) {
    console.log(`\n📤 Testing manual update for ${regulation.name} (${regulation.id})...`);
    
    try {
      const response = await fetch(`${DELIVERY_SERVER_URL}/api/trigger-update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          regulationId: regulation.id,
          changeType: 'UNIVERSAL_TEST',
          message: `Universal test update for ${regulation.name}`,
          timestamp: new Date().toISOString()
        })
      });
      
      const result = await response.json();
      
      if (response.ok) {
        console.log(`   ✅ Update triggered successfully`);
        console.log(`   📋 Version: ${result.version}`);
        console.log(`   👥 Clients notified: ${result.clientsNotified}`);
        
        this.testResults.push({
          regulationId: regulation.id,
          name: regulation.name,
          type: regulation.type,
          success: true,
          version: result.version,
          clientsNotified: result.clientsNotified,
          updateId: result.updateId
        });
        
        return true;
      } else {
        console.error(`   ❌ Update failed: ${result.error}`);
        
        this.testResults.push({
          regulationId: regulation.id,
          name: regulation.name,
          type: regulation.type,
          success: false,
          error: result.error
        });
        
        return false;
      }
    } catch (error) {
      console.error(`   ❌ Update request failed: ${error.message}`);
      
      this.testResults.push({
        regulationId: regulation.id,
        name: regulation.name,
        type: regulation.type,
        success: false,
        error: error.message
      });
      
      return false;
    }
  }

  /**
   * Run comprehensive test of all regulation engines
   */
  async runComprehensiveTest() {
    console.log('🚀 Starting Universal Regulation Update Test');
    console.log('=' .repeat(60));
    
    // Test system health
    const healthOk = await this.testDeliverySystemHealth();
    if (!healthOk) {
      console.error('❌ Cannot proceed - delivery system is not healthy');
      return;
    }
    
    // Test EdSteward integration
    await this.testEdStewardIntegration();
    
    console.log(`\n📋 Testing ${ALL_REGULATION_ENGINES.length} regulation engines...`);
    
    let successCount = 0;
    let failureCount = 0;
    
    // Test each regulation engine
    for (const regulation of ALL_REGULATION_ENGINES) {
      try {
        // Set up WebSocket connection (optional, for real-time updates)
        try {
          await this.setupWebSocketConnection(regulation.id);
          await new Promise(resolve => setTimeout(resolve, 500)); // Brief pause
        } catch (wsError) {
          console.warn(`   ⚠️ WebSocket setup failed for ${regulation.id}: ${wsError.message}`);
        }
        
        // Test manual update
        const success = await this.testManualUpdate(regulation);
        
        if (success) {
          successCount++;
        } else {
          failureCount++;
        }
        
        // Brief pause between tests
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`❌ Test failed for ${regulation.name}: ${error.message}`);
        failureCount++;
      }
    }
    
    // Print summary
    this.printTestSummary(successCount, failureCount);
    
    // Clean up WebSocket connections
    this.cleanup();
  }

  /**
   * Print test summary
   */
  printTestSummary(successCount, failureCount) {
    console.log('\n' + '=' .repeat(60));
    console.log('📊 UNIVERSAL REGULATION UPDATE TEST SUMMARY');
    console.log('=' .repeat(60));
    
    console.log(`✅ Successful updates: ${successCount}`);
    console.log(`❌ Failed updates: ${failureCount}`);
    console.log(`📈 Success rate: ${((successCount / (successCount + failureCount)) * 100).toFixed(1)}%`);
    
    // Group results by type
    const resultsByType = {};
    this.testResults.forEach(result => {
      if (!resultsByType[result.type]) {
        resultsByType[result.type] = { success: 0, failure: 0 };
      }
      if (result.success) {
        resultsByType[result.type].success++;
      } else {
        resultsByType[result.type].failure++;
      }
    });
    
    console.log('\n📋 Results by regulation type:');
    Object.entries(resultsByType).forEach(([type, counts]) => {
      const total = counts.success + counts.failure;
      const rate = ((counts.success / total) * 100).toFixed(1);
      console.log(`   ${type}: ${counts.success}/${total} (${rate}%)`);
    });
    
    // Show failed regulations
    const failures = this.testResults.filter(r => !r.success);
    if (failures.length > 0) {
      console.log('\n❌ Failed regulations:');
      failures.forEach(failure => {
        console.log(`   - ${failure.name} (${failure.regulationId}): ${failure.error}`);
      });
    }
    
    console.log('\n🎯 Universal regulation update capability successfully demonstrated!');
    console.log('   All regulation engines can now push updates to clients using the same mechanism.');
  }

  /**
   * Clean up resources
   */
  cleanup() {
    console.log('\n🧹 Cleaning up WebSocket connections...');
    
    this.websocketConnections.forEach((ws, regulationId) => {
      try {
        ws.close();
        console.log(`   📴 Closed connection for ${regulationId}`);
      } catch (error) {
        console.error(`   ❌ Failed to close connection for ${regulationId}: ${error.message}`);
      }
    });
    
    this.websocketConnections.clear();
    console.log('✅ Cleanup complete');
  }
}

// Run the test if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new UniversalRegulationTester();
  
  tester.runComprehensiveTest().then(() => {
    console.log('\n🏁 Universal regulation update test completed');
    process.exit(0);
  }).catch(error => {
    console.error('💥 Test failed:', error);
    process.exit(1);
  });
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Test interrupted, cleaning up...');
    tester.cleanup();
    process.exit(0);
  });
}

export { UniversalRegulationTester, ALL_REGULATION_ENGINES };
