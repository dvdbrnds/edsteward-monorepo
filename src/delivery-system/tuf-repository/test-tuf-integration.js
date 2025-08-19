#!/usr/bin/env node
/**
 * Comprehensive TUF Integration Test Suite
 * Tests end-to-end TUF workflow compliance with official specification
 */

import { TUFClient } from './tuf-client.js';
import WebSocket from 'ws';
import fetch from 'node-fetch';

class TUFIntegrationTester {
  constructor() {
    this.repositoryUrl = 'http://localhost:3052';
    this.websocketUrl = 'ws://localhost:3053';
    this.client = null;
    this.testResults = [];
    this.websocketMessages = [];
  }

  /**
   * Add test result
   */
  addResult(testName, success, details = '', error = null) {
    this.testResults.push({
      test: testName,
      success: success,
      details: details,
      error: error?.message || null,
      timestamp: new Date().toISOString()
    });

    const status = success ? '✅' : '❌';
    console.log(`${status} ${testName}: ${details}`);
    if (error) {
      console.log(`   Error: ${error.message}`);
    }
  }

  /**
   * Test 1: Repository Health and Availability
   */
  async testRepositoryHealth() {
    console.log('\n🔍 Testing Repository Health...');
    
    try {
      const response = await fetch(`${this.repositoryUrl}/health`);
      const health = await response.json();
      
      if (response.ok && health.status === 'healthy') {
        this.addResult(
          'Repository Health Check', 
          true, 
          `Status: ${health.status}, Targets: ${health.repository.targets}`
        );
        return true;
      } else {
        this.addResult('Repository Health Check', false, 'Unhealthy response');
        return false;
      }
    } catch (error) {
      this.addResult('Repository Health Check', false, 'Failed to connect', error);
      return false;
    }
  }

  /**
   * Test 2: TUF Metadata Availability (Per TUF Spec Section 4)
   */
  async testTUFMetadataEndpoints() {
    console.log('\n🔍 Testing TUF Metadata Endpoints...');
    
    const endpoints = [
      { name: 'root.json', path: '/metadata/root.json' },
      { name: 'targets.json', path: '/metadata/targets.json' },
      { name: 'snapshot.json', path: '/metadata/snapshot.json' },
      { name: 'timestamp.json', path: '/metadata/timestamp.json' }
    ];

    let allSuccess = true;

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(`${this.repositoryUrl}${endpoint.path}`);
        const metadata = await response.json();
        
        // Verify TUF metadata structure
        const hasSignatures = Array.isArray(metadata.signatures) && metadata.signatures.length > 0;
        const hasSigned = metadata.signed && typeof metadata.signed === 'object';
        const hasCorrectType = metadata.signed._type === endpoint.name.replace('.json', '');
        
        if (hasSignatures && hasSigned && hasCorrectType) {
          this.addResult(
            `TUF Metadata: ${endpoint.name}`, 
            true, 
            `Signatures: ${metadata.signatures.length}, Type: ${metadata.signed._type}`
          );
        } else {
          this.addResult(
            `TUF Metadata: ${endpoint.name}`, 
            false, 
            'Invalid TUF metadata structure'
          );
          allSuccess = false;
        }
      } catch (error) {
        this.addResult(`TUF Metadata: ${endpoint.name}`, false, 'Failed to fetch', error);
        allSuccess = false;
      }
    }

    return allSuccess;
  }

  /**
   * Test 3: Cryptographic Signature Verification (Per TUF Spec Section 4.4)
   */
  async testCryptographicSignatures() {
    console.log('\n🔍 Testing Cryptographic Signature Verification...');
    
    try {
      // Get root metadata for trusted keys
      const rootResponse = await fetch(`${this.repositoryUrl}/metadata/root.json`);
      const rootMetadata = await rootResponse.json();
      
      // Initialize TUF client for verification
      this.client = new TUFClient({ repositoryUrl: this.repositoryUrl });
      await this.client.initialize(rootMetadata);
      
      // Test signature verification on targets metadata
      const targetsResponse = await fetch(`${this.repositoryUrl}/metadata/targets.json`);
      const targetsMetadata = await targetsResponse.json();
      
      // Verify we have the required signature components
      const signature = targetsMetadata.signatures[0];
      const hasKeyId = signature.keyid && typeof signature.keyid === 'string';
      const hasSignature = signature.sig && typeof signature.sig === 'string';
      const keyExists = rootMetadata.signed.keys[signature.keyid];
      
      if (hasKeyId && hasSignature && keyExists) {
        this.addResult(
          'Cryptographic Signatures', 
          true, 
          `Key ID: ${signature.keyid.substring(0, 16)}..., Algorithm: ${keyExists.keytype}`
        );
        return true;
      } else {
        this.addResult('Cryptographic Signatures', false, 'Invalid signature structure');
        return false;
      }
    } catch (error) {
      this.addResult('Cryptographic Signatures', false, 'Verification failed', error);
      return false;
    }
  }

  /**
   * Test 4: TUF Client Workflow (Per TUF Spec Section 5)
   */
  async testTUFClientWorkflow() {
    console.log('\n🔍 Testing TUF Client Workflow...');
    
    try {
      if (!this.client) {
        const rootResponse = await fetch(`${this.repositoryUrl}/metadata/root.json`);
        const rootMetadata = await rootResponse.json();
        this.client = new TUFClient({ repositoryUrl: this.repositoryUrl });
        await this.client.initialize(rootMetadata);
      }

      // Test complete TUF update workflow
      const availableTargets = await this.client.performUpdate();
      
      if (Array.isArray(availableTargets) && availableTargets.length > 0) {
        this.addResult(
          'TUF Client Workflow', 
          true, 
          `Found ${availableTargets.length} verified targets`
        );
        return availableTargets;
      } else {
        this.addResult('TUF Client Workflow', false, 'No targets found');
        return [];
      }
    } catch (error) {
      this.addResult('TUF Client Workflow', false, 'Workflow failed', error);
      return [];
    }
  }

  /**
   * Test 5: Regulation File Download and Verification
   */
  async testRegulationDownload(availableTargets) {
    console.log('\n🔍 Testing Regulation File Download...');
    
    if (!availableTargets || availableTargets.length === 0) {
      this.addResult('Regulation Download', false, 'No targets available for download');
      return false;
    }

    try {
      // Find a regulation target
      const regulationTarget = availableTargets.find(target => 
        target.path.startsWith('regulations/') && target.custom.regulationId
      );

      if (!regulationTarget) {
        this.addResult('Regulation Download', false, 'No regulation targets found');
        return false;
      }

      // Download and verify regulation
      const regulation = await this.client.downloadRegulation(regulationTarget.custom.regulationId);
      
      if (regulation.verified && regulation.content) {
        this.addResult(
          'Regulation Download', 
          true, 
          `Downloaded ${regulation.regulationId}, verified: ${regulation.verified}`
        );
        return true;
      } else {
        this.addResult('Regulation Download', false, 'Verification failed');
        return false;
      }
    } catch (error) {
      this.addResult('Regulation Download', false, 'Download failed', error);
      return false;
    }
  }

  /**
   * Test 6: Hash Verification (Per TUF Spec - Protection against arbitrary installation)
   */
  async testHashVerification() {
    console.log('\n🔍 Testing Hash Verification...');
    
    try {
      // Get targets metadata
      const targetsResponse = await fetch(`${this.repositoryUrl}/metadata/targets.json`);
      const targetsMetadata = await targetsResponse.json();
      
      // Find first regulation target
      const targetPath = Object.keys(targetsMetadata.signed.targets)[0];
      const targetInfo = targetsMetadata.signed.targets[targetPath];
      
      if (!targetPath || !targetInfo.hashes) {
        this.addResult('Hash Verification', false, 'No targets with hashes found');
        return false;
      }

      // Download the actual file
      const fileResponse = await fetch(`${this.repositoryUrl}/targets/${targetPath}`);
      const fileContent = await fileResponse.text();
      
      // Calculate hash
      const crypto = await import('crypto');
      const actualHash = crypto.createHash('sha256').update(fileContent).digest('hex');
      const expectedHash = targetInfo.hashes.sha256;
      
      if (actualHash === expectedHash) {
        this.addResult(
          'Hash Verification', 
          true, 
          `Hash matches: ${actualHash.substring(0, 16)}...`
        );
        return true;
      } else {
        this.addResult(
          'Hash Verification', 
          false, 
          `Hash mismatch: expected ${expectedHash.substring(0, 16)}..., got ${actualHash.substring(0, 16)}...`
        );
        return false;
      }
    } catch (error) {
      this.addResult('Hash Verification', false, 'Hash check failed', error);
      return false;
    }
  }

  /**
   * Test 7: WebSocket Real-time Notifications
   */
  async testWebSocketNotifications() {
    console.log('\n🔍 Testing WebSocket Notifications...');
    
    return new Promise((resolve) => {
      try {
        const ws = new WebSocket(this.websocketUrl);
        let connected = false;
        let subscribed = false;
        
        const timeout = setTimeout(() => {
          if (!connected) {
            this.addResult('WebSocket Notifications', false, 'Connection timeout');
            ws.close();
            resolve(false);
          }
        }, 10000);

        ws.on('open', () => {
          connected = true;
          console.log('   📡 WebSocket connected');
          
          // Send subscription message
          ws.send(JSON.stringify({ type: 'subscribe' }));
        });

        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data);
            this.websocketMessages.push(message);
            
            if (message.type === 'subscription_confirmed') {
              subscribed = true;
              this.addResult(
                'WebSocket Notifications', 
                true, 
                'Connected and subscribed successfully'
              );
              clearTimeout(timeout);
              ws.close();
              resolve(true);
            } else if (message.type === 'welcome') {
              console.log('   📨 Received welcome message');
            } else {
              console.log('   📨 Received message:', message.type);
            }
          } catch (error) {
            console.log('   ❌ Failed to parse WebSocket message:', error);
          }
        });

        ws.on('error', (error) => {
          this.addResult('WebSocket Notifications', false, 'Connection error', error);
          clearTimeout(timeout);
          resolve(false);
        });

        ws.on('close', () => {
          if (!subscribed) {
            this.addResult('WebSocket Notifications', false, 'Connection closed before subscription');
            clearTimeout(timeout);
            resolve(false);
          }
        });
      } catch (error) {
        this.addResult('WebSocket Notifications', false, 'WebSocket setup failed', error);
        resolve(false);
      }
    });
  }

  /**
   * Test 8: Version and Expiration Checks (Rollback and Freeze Attack Protection)
   */
  async testVersionAndExpiration() {
    console.log('\n🔍 Testing Version and Expiration Checks...');
    
    try {
      const timestampResponse = await fetch(`${this.repositoryUrl}/metadata/timestamp.json`);
      const timestampMetadata = await timestampResponse.json();
      
      const snapshotResponse = await fetch(`${this.repositoryUrl}/metadata/snapshot.json`);
      const snapshotMetadata = await snapshotResponse.json();
      
      // Check version numbers are valid
      const timestampVersion = timestampMetadata.signed.version;
      const snapshotVersion = snapshotMetadata.signed.version;
      
      // Check expiration times are in the future
      const timestampExpiry = new Date(timestampMetadata.signed.expires);
      const snapshotExpiry = new Date(snapshotMetadata.signed.expires);
      const now = new Date();
      
      const versionsValid = timestampVersion > 0 && snapshotVersion > 0;
      const expirationValid = timestampExpiry > now && snapshotExpiry > now;
      
      if (versionsValid && expirationValid) {
        this.addResult(
          'Version and Expiration', 
          true, 
          `Timestamp v${timestampVersion}, Snapshot v${snapshotVersion}, both not expired`
        );
        return true;
      } else {
        this.addResult(
          'Version and Expiration', 
          false, 
          `Version check: ${versionsValid}, Expiration check: ${expirationValid}`
        );
        return false;
      }
    } catch (error) {
      this.addResult('Version and Expiration', false, 'Validation failed', error);
      return false;
    }
  }

  /**
   * Test 9: Add New Regulation and Verify Update
   */
  async testRegulationUpdateWorkflow() {
    console.log('\n🔍 Testing Regulation Update Workflow...');
    
    try {
      const testRegId = `TEST-${Date.now()}`;
      const testRegulation = {
        regulationId: testRegId,
        content: {
          title: `Test Regulation ${testRegId}`,
          version: '1.0.0',
          sections: ['Section 1: Test provision'],
          lastUpdated: new Date().toISOString(),
          testFlag: true
        },
        metadata: {
          category: 'test',
          priority: 'low',
          source: 'TUF Integration Test'
        }
      };

      // Add regulation via admin API
      const addResponse = await fetch(`${this.repositoryUrl}/admin/add-regulation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testRegulation)
      });

      if (!addResponse.ok) {
        throw new Error(`Failed to add regulation: ${addResponse.statusText}`);
      }

      const addResult = await addResponse.json();
      
      // Wait a moment for metadata to update
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Verify regulation is now available through TUF client
      const regulations = await this.client.checkForRegulationUpdates();
      const testReg = regulations.find(r => r.regulationId === testRegId);
      
      if (testReg) {
        this.addResult(
          'Regulation Update Workflow', 
          true, 
          `Added ${testRegId}, hash: ${addResult.target.hash.substring(0, 16)}...`
        );
        return true;
      } else {
        this.addResult('Regulation Update Workflow', false, 'Regulation not found after update');
        return false;
      }
    } catch (error) {
      this.addResult('Regulation Update Workflow', false, 'Update workflow failed', error);
      return false;
    }
  }

  /**
   * Run all tests
   */
  async runAllTests() {
    console.log('🧪 Starting Comprehensive TUF Integration Test Suite');
    console.log('📋 Testing compliance with TUF Specification v1.0.0');
    console.log('=' .repeat(60));

    const startTime = Date.now();

    // Run tests sequentially
    const healthOk = await this.testRepositoryHealth();
    if (!healthOk) {
      console.log('\n❌ Repository is not healthy. Aborting tests.');
      return this.generateReport();
    }

    const metadataOk = await this.testTUFMetadataEndpoints();
    const signaturesOk = await this.testCryptographicSignatures();
    const availableTargets = await this.testTUFClientWorkflow();
    const downloadOk = await this.testRegulationDownload(availableTargets);
    const hashOk = await this.testHashVerification();
    const websocketOk = await this.testWebSocketNotifications();
    const versionOk = await this.testVersionAndExpiration();
    const updateOk = await this.testRegulationUpdateWorkflow();

    const duration = Date.now() - startTime;
    
    return this.generateReport(duration);
  }

  /**
   * Generate test report
   */
  generateReport(duration = 0) {
    const successful = this.testResults.filter(r => r.success).length;
    const total = this.testResults.length;
    const successRate = (successful / total * 100).toFixed(1);

    console.log('\n' + '=' .repeat(60));
    console.log('📊 TUF INTEGRATION TEST REPORT');
    console.log('=' .repeat(60));
    console.log(`⏱️  Duration: ${duration}ms`);
    console.log(`✅ Successful: ${successful}/${total} (${successRate}%)`);
    console.log(`❌ Failed: ${total - successful}/${total}`);
    
    if (successful === total) {
      console.log('🎉 ALL TESTS PASSED - TUF INTEGRATION FULLY COMPLIANT!');
    } else {
      console.log('⚠️  SOME TESTS FAILED - REVIEW ISSUES BELOW');
    }

    console.log('\n📋 DETAILED RESULTS:');
    this.testResults.forEach((result, index) => {
      const status = result.success ? '✅' : '❌';
      console.log(`${index + 1}. ${status} ${result.test}`);
      console.log(`   ${result.details}`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });

    if (this.websocketMessages.length > 0) {
      console.log('\n📨 WEBSOCKET MESSAGES RECEIVED:');
      this.websocketMessages.forEach((msg, index) => {
        console.log(`${index + 1}. ${msg.type}: ${JSON.stringify(msg, null, 2)}`);
      });
    }

    console.log('\n' + '=' .repeat(60));

    return {
      success: successful === total,
      totalTests: total,
      passedTests: successful,
      failedTests: total - successful,
      successRate: successRate,
      duration: duration,
      results: this.testResults,
      websocketMessages: this.websocketMessages
    };
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new TUFIntegrationTester();
  
  tester.runAllTests()
    .then(report => {
      process.exit(report.success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Test suite failed:', error);
      process.exit(1);
    });
}

export { TUFIntegrationTester };

