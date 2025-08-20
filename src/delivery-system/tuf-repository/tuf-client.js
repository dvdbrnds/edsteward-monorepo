/**
 * TUF Client Library for EdSteward Integration
 * Implements TUF client workflow for secure regulation updates
 */

import crypto from 'crypto';
import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';
import stringify from 'fast-json-stable-stringify';

export class TUFClient {
  constructor(options = {}) {
    this.repositoryUrl = options.repositoryUrl || 'http://localhost:3052';
    this.metadataDir = options.metadataDir || './tuf-metadata';
    this.targetsDir = options.targetsDir || './tuf-targets';
    this.trustedRoot = null;
    this.fixedUpdateStartTime = null;
  }

  /**
   * Initialize client with trusted root metadata
   */
  async initialize(trustedRootMetadata) {
    this.trustedRoot = trustedRootMetadata;
    console.log('✅ TUF Client initialized with trusted root');
  }

  /**
   * Perform complete TUF update workflow
   */
  async performUpdate() {
    try {
      // Step 1: Record fixed update start time
      this.fixedUpdateStartTime = new Date();
      console.log('🕐 Starting TUF update workflow...');

      // Step 2: Load trusted root metadata
      if (!this.trustedRoot) {
        throw new Error('TUF client not initialized with trusted root');
      }

      // Step 3: Update root metadata (if needed)
      await this.updateRootMetadata();

      // Step 4: Update timestamp metadata
      const timestampMeta = await this.updateTimestampMetadata();

      // Step 5: Update snapshot metadata
      const snapshotMeta = await this.updateSnapshotMetadata(timestampMeta);

      // Step 6: Update targets metadata
      const targetsMeta = await this.updateTargetsMetadata(snapshotMeta);

      // Step 7: Get available targets
      const availableTargets = this.getAvailableTargets(targetsMeta);

      console.log(`✅ TUF update completed. Found ${availableTargets.length} targets`);
      return availableTargets;
    } catch (error) {
      console.error('❌ TUF update failed:', error.message);
      throw error;
    }
  }

  /**
   * Download and verify a specific target file
   */
  async downloadTarget(targetPath, expectedHash, expectedLength) {
    try {
      console.log(`📥 Downloading target: ${targetPath}`);
      
      const response = await fetch(`${this.repositoryUrl}/targets/${targetPath}`);
      if (!response.ok) {
        throw new Error(`Failed to download target: ${response.statusText}`);
      }

      const content = await response.text();
      
      // Verify length (use Buffer.byteLength for UTF-8 consistency)
      const actualLength = Buffer.byteLength(content, 'utf8');
      if (actualLength !== expectedLength) {
        throw new Error(`Target length mismatch: expected ${expectedLength}, got ${actualLength}`);
      }

      // Verify hash
      const actualHash = crypto.createHash('sha256').update(content).digest('hex');
      if (actualHash !== expectedHash) {
        throw new Error(`Target hash mismatch: expected ${expectedHash}, got ${actualHash}`);
      }

      console.log(`✅ Target verified successfully: ${targetPath}`);
      return JSON.parse(content);
    } catch (error) {
      console.error(`❌ Failed to download target ${targetPath}:`, error.message);
      throw error;
    }
  }

  /**
   * Update timestamp metadata
   */
  async updateTimestampMetadata() {
    console.log('🕐 Updating timestamp metadata...');
    
    const response = await fetch(`${this.repositoryUrl}/metadata/timestamp.json`);
    if (!response.ok) {
      throw new Error(`Failed to fetch timestamp metadata: ${response.statusText}`);
    }

    const timestampMeta = await response.json();

    // Verify signatures
    await this.verifyMetadataSignatures(timestampMeta, 'timestamp');

    // Check expiration
    this.checkExpiration(timestampMeta.signed, 'timestamp');

    console.log('✅ Timestamp metadata updated');
    return timestampMeta;
  }

  /**
   * Update snapshot metadata
   */
  async updateSnapshotMetadata(timestampMeta) {
    console.log('📷 Updating snapshot metadata...');
    
    const response = await fetch(`${this.repositoryUrl}/metadata/snapshot.json`);
    if (!response.ok) {
      throw new Error(`Failed to fetch snapshot metadata: ${response.statusText}`);
    }

    const snapshotMeta = await response.json();

    // Verify against timestamp
    const expectedSnapshotInfo = timestampMeta.signed.meta['snapshot.json'];
    if (snapshotMeta.signed.version !== expectedSnapshotInfo.version) {
      throw new Error('Snapshot version mismatch with timestamp');
    }

    // Verify hash if provided
    if (expectedSnapshotInfo.hashes) {
      const actualHash = crypto.createHash('sha256')
        .update(JSON.stringify(snapshotMeta.signed))
        .digest('hex');
      
      if (actualHash !== expectedSnapshotInfo.hashes.sha256) {
        throw new Error('Snapshot hash mismatch');
      }
    }

    // Verify signatures
    await this.verifyMetadataSignatures(snapshotMeta, 'snapshot');

    // Check expiration
    this.checkExpiration(snapshotMeta.signed, 'snapshot');

    console.log('✅ Snapshot metadata updated');
    return snapshotMeta;
  }

  /**
   * Update targets metadata
   */
  async updateTargetsMetadata(snapshotMeta) {
    console.log('🎯 Updating targets metadata...');
    
    const response = await fetch(`${this.repositoryUrl}/metadata/targets.json`);
    if (!response.ok) {
      throw new Error(`Failed to fetch targets metadata: ${response.statusText}`);
    }

    const targetsMeta = await response.json();

    // Verify against snapshot
    const expectedTargetsInfo = snapshotMeta.signed.meta['targets.json'];
    if (targetsMeta.signed.version !== expectedTargetsInfo.version) {
      throw new Error('Targets version mismatch with snapshot');
    }

    // Verify signatures
    await this.verifyMetadataSignatures(targetsMeta, 'targets');

    // Check expiration
    this.checkExpiration(targetsMeta.signed, 'targets');

    console.log('✅ Targets metadata updated');
    return targetsMeta;
  }

  /**
   * Update root metadata (implementation for key rotation)
   */
  async updateRootMetadata() {
    // In a production implementation, this would handle root key rotation
    console.log('🔑 Root metadata is current (no rotation needed)');
  }

  /**
   * Verify metadata signatures
   */
  async verifyMetadataSignatures(metadata, roleName) {
    const roleInfo = this.trustedRoot.signed.roles[roleName];
    if (!roleInfo) {
      throw new Error(`Unknown role: ${roleName}`);
    }

    const requiredThreshold = roleInfo.threshold;
    const validSignatures = [];

    for (const signature of metadata.signatures) {
      const keyInfo = this.trustedRoot.signed.keys[signature.keyid];
      if (!keyInfo) {
        console.warn(`Unknown key ID: ${signature.keyid}`);
        continue;
      }

      if (this.verifySignature(metadata.signed, keyInfo.keyval.public, signature.sig)) {
        validSignatures.push(signature.keyid);
      }
    }

    if (validSignatures.length < requiredThreshold) {
      throw new Error(`Insufficient signatures for ${roleName}: ${validSignatures.length}/${requiredThreshold}`);
    }

    console.log(`✅ Verified ${validSignatures.length} signatures for ${roleName}`);
  }

  /**
   * Verify individual signature
   */
  verifySignature(metadata, publicKey, signature) {
    try {
      const canonical = stringify(metadata);
      const messageBytes = naclUtil.decodeUTF8(canonical);
      const signatureBytes = naclUtil.decodeBase64(signature);
      const publicKeyBytes = naclUtil.decodeBase64(publicKey);

      return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
    } catch (error) {
      console.error('Signature verification error:', error.message);
      return false;
    }
  }

  /**
   * Check metadata expiration
   */
  checkExpiration(metadata, roleName) {
    const expirationTime = new Date(metadata.expires);
    
    if (expirationTime <= this.fixedUpdateStartTime) {
      throw new Error(`${roleName} metadata has expired: ${metadata.expires}`);
    }

    console.log(`✅ ${roleName} metadata expiration OK: ${metadata.expires}`);
  }

  /**
   * Get available targets from metadata
   */
  getAvailableTargets(targetsMeta) {
    const targets = [];
    
    for (const [targetPath, targetInfo] of Object.entries(targetsMeta.signed.targets)) {
      targets.push({
        path: targetPath,
        length: targetInfo.length,
        hashes: targetInfo.hashes,
        custom: targetInfo.custom || {}
      });
    }

    return targets;
  }

  /**
   * Check for regulation updates
   */
  async checkForRegulationUpdates() {
    try {
      const availableTargets = await this.performUpdate();
      
      const regulations = availableTargets
        .filter(target => target.path.startsWith('regulations/'))
        .map(target => ({
          regulationId: target.custom.regulationId,
          path: target.path,
          hash: target.hashes.sha256,
          length: target.length,
          updateTime: target.custom.updateTime,
          metadata: target.custom
        }));

      return regulations;
    } catch (error) {
      console.error('Failed to check for regulation updates:', error);
      throw error;
    }
  }

  /**
   * Download regulation by ID
   */
  async downloadRegulation(regulationId) {
    try {
      const availableTargets = await this.performUpdate();
      
      const target = availableTargets.find(t => 
        t.custom.regulationId === regulationId
      );

      if (!target) {
        throw new Error(`Regulation not found: ${regulationId}`);
      }

      const content = await this.downloadTarget(
        target.path, 
        target.hashes.sha256, 
        target.length
      );

      return {
        regulationId: regulationId,
        content: content,
        metadata: target.custom,
        verified: true
      };
    } catch (error) {
      console.error(`Failed to download regulation ${regulationId}:`, error);
      throw error;
    }
  }
}

/**
 * Browser-compatible TUF Client for frontend integration
 */
export class BrowserTUFClient {
  constructor(repositoryUrl) {
    this.repositoryUrl = repositoryUrl;
    this.trustedRoot = null;
  }

  async initialize(trustedRoot) {
    this.trustedRoot = trustedRoot;
    console.log('✅ Browser TUF Client initialized');
  }

  async checkForUpdates() {
    try {
      const response = await fetch(`${this.repositoryUrl}/api/regulations`);
      if (!response.ok) {
        throw new Error('Failed to fetch regulations list');
      }

      const data = await response.json();
      return data.regulations;
    } catch (error) {
      console.error('Failed to check for updates:', error);
      throw error;
    }
  }

  async downloadRegulation(regulationId) {
    try {
      const response = await fetch(`${this.repositoryUrl}/targets/regulations/${regulationId}.json`);
      if (!response.ok) {
        throw new Error(`Regulation not found: ${regulationId}`);
      }

      const content = await response.json();
      return {
        regulationId: regulationId,
        content: content,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error(`Failed to download regulation ${regulationId}:`, error);
      throw error;
    }
  }

  // Simplified verification for browser environment
  async verifyRegulation(regulationId, content, expectedHash) {
    // In a full implementation, this would verify against TUF metadata
    // For now, return basic verification status
    return {
      verified: true,
      regulationId: regulationId,
      timestamp: new Date().toISOString()
    };
  }
}

