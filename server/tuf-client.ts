import nacl from 'tweetnacl';
import * as util from 'tweetnacl-util';
import stringify from 'fast-json-stable-stringify';
import crypto from 'crypto';

export interface TUFKey {
  keytype: string;
  scheme: string;
  keyval: {
    public: string;
  };
}

export interface TUFTargetInfo {
  length: number;
  hashes: {
    sha256: string;
  };
  custom?: {
    updateTime?: string;
    [key: string]: unknown;
  };
}

export interface TUFSigned {
  _type: string;
  version: number;
  expires: string;
  keys?: { [keyId: string]: TUFKey };
  targets?: { [path: string]: TUFTargetInfo };
  [key: string]: unknown;
}

export interface TUFMetadata {
  signed: TUFSigned;
  signatures: Array<{
    keyid: string;
    signature: string;
  }>;
}

export interface RegulationTarget {
  regulationId: string;
  path: string;
  hash: string;
  length: number;
  updateTime: string;
  metadata: { [key: string]: unknown };
  content?: unknown;
  verified?: boolean;
}

export interface TUFClientConfig {
  repositoryUrl: string;
  metadataDir?: string;
  targetsDir?: string;
  trustedKeys?: { [keyId: string]: string };
}

export class TUFClient {
  private repositoryUrl: string;
  private trustedKeys: { [keyId: string]: string } = {};
  private rootMetadata: TUFMetadata | null = null;
  private targetsMetadata: TUFMetadata | null = null;

  constructor(config: TUFClientConfig) {
    this.repositoryUrl = config.repositoryUrl;
    if (config.trustedKeys) {
      this.trustedKeys = config.trustedKeys;
    }
  }

  /**
   * Initialize TUF client with trusted root metadata
   */
  async initialize(trustedRoot: TUFMetadata): Promise<void> {
    console.log('🔒 Initializing TUF client with trusted root metadata...');
    
    // Verify root metadata signature
    if (!this.verifyMetadataSignature(trustedRoot)) {
      throw new Error('TUF root metadata signature verification failed');
    }

    this.rootMetadata = trustedRoot;
    
    // Extract trusted keys from root metadata
    const rootSigned = trustedRoot.signed;
    if (rootSigned.keys) {
      for (const [keyId, keyData] of Object.entries(rootSigned.keys)) {
        this.trustedKeys[keyId] = keyData.keyval.public;
      }
    }

    console.log(`✅ TUF client initialized with ${Object.keys(this.trustedKeys).length} trusted keys`);
  }

  /**
   * Check for regulation updates from TUF repository
   */
  async checkForRegulationUpdates(): Promise<RegulationTarget[]> {
    console.log('🔍 Checking for regulation updates via TUF...');
    
    try {
      // Fetch targets metadata
      const targetsUrl = `${this.repositoryUrl}/metadata/targets.json`;
      const response = await fetch(targetsUrl);
      
      if (!response.ok) {
        throw new Error(`TUF targets metadata fetch failed: ${response.status}`);
      }

      const targetsMetadata: TUFMetadata = await response.json();
      
      // Verify targets metadata signature
      if (!this.verifyMetadataSignature(targetsMetadata)) {
        throw new Error('TUF targets metadata signature verification failed');
      }

      this.targetsMetadata = targetsMetadata;
      
      // Extract regulation targets
      const regulations: RegulationTarget[] = [];
      const targets = targetsMetadata.signed.targets;
      
      if (targets) {
        for (const [path, targetInfo] of Object.entries(targets)) {
          if (path.startsWith('regulations/') && path.endsWith('.json')) {
            const regulationId = path.replace('regulations/', '').replace('.json', '');
            
            regulations.push({
              regulationId,
              path,
              hash: targetInfo.hashes.sha256,
              length: targetInfo.length,
              updateTime: targetInfo.custom?.updateTime || new Date().toISOString(),
              metadata: targetInfo.custom || {},
              verified: false
            });
          }
        }
      }

      console.log(`✅ Found ${regulations.length} regulations in TUF repository`);
      return regulations;
      
    } catch (error) {
      console.error('❌ TUF regulation check failed:', error);
      throw error;
    }
  }

  /**
   * Download and verify a specific regulation
   */
  async downloadRegulation(regulationId: string): Promise<RegulationTarget> {
    console.log(`📥 Downloading regulation ${regulationId} with TUF verification...`);
    
    if (!this.targetsMetadata) {
      await this.checkForRegulationUpdates();
    }

    const targetPath = `regulations/${regulationId}.json`;
    const targets = this.targetsMetadata?.signed.targets;
    const targetInfo = targets?.[targetPath];
    
    if (!targetInfo) {
      throw new Error(`Regulation ${regulationId} not found in TUF repository`);
    }

    try {
      // Download the regulation file
      const fileUrl = `${this.repositoryUrl}/targets/${targetPath}`;
      const response = await fetch(fileUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to download regulation ${regulationId}: ${response.status}`);
      }

      const content = await response.text();
      
      // Verify file hash
      const expectedHash = targetInfo.hashes.sha256;
      const actualHash = crypto.createHash('sha256').update(content).digest('hex');
      
      if (actualHash !== expectedHash) {
        throw new Error(`Hash mismatch for regulation ${regulationId}. Expected: ${expectedHash}, Got: ${actualHash}`);
      }

      console.log(`✅ Regulation ${regulationId} downloaded and verified successfully`);

      // Parse content
      let parsedContent;
      try {
        parsedContent = JSON.parse(content);
      } catch {
        console.warn(`⚠️ Could not parse regulation ${regulationId} as JSON, treating as text`);
        parsedContent = content;
      }

      return {
        regulationId,
        path: targetPath,
        hash: actualHash,
        length: content.length,
        updateTime: targetInfo.custom?.updateTime || new Date().toISOString(),
        metadata: targetInfo.custom || {},
        content: parsedContent,
        verified: true
      };

    } catch (error) {
      console.error(`❌ Failed to download regulation ${regulationId}:`, error);
      throw error;
    }
  }

  /**
   * Verify metadata signature using Ed25519
   */
  private verifyMetadataSignature(metadata: TUFMetadata): boolean {
    const signed = metadata.signed;
    const signatures = metadata.signatures;

    if (!signatures || signatures.length === 0) {
      console.error('❌ No signatures found in metadata');
      return false;
    }

    // Canonical JSON encoding of signed portion
    const signedBytes = util.decodeUTF8(stringify(signed));

    // Verify at least one signature
    for (const signature of signatures) {
      const keyId = signature.keyid;
      const signatureBytes = util.decodeBase64(signature.signature);
      
      if (this.trustedKeys[keyId]) {
        try {
          const publicKeyBytes = util.decodeBase64(this.trustedKeys[keyId]);
          const isValid = nacl.sign.detached.verify(signedBytes, signatureBytes, publicKeyBytes);
          
          if (isValid) {
            console.log(`✅ Valid signature found for key ${keyId}`);
            return true;
          }
        } catch (error) {
          console.warn(`⚠️ Signature verification failed for key ${keyId}:`, error);
        }
      }
    }

    console.error('❌ No valid signatures found');
    return false;
  }

  /**
   * Get repository health status
   */
  async getRepositoryHealth(): Promise<{ [key: string]: unknown }> {
    try {
      const healthUrl = `${this.repositoryUrl}/health`;
      const response = await fetch(healthUrl);
      
      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ TUF repository health check failed:', error);
      throw error;
    }
  }
}

/**
 * Browser-compatible TUF client (no Node.js crypto dependencies)
 */
export class BrowserTUFClient extends TUFClient {
  /**
   * Browser-compatible hash verification using Web Crypto API
   */
  async downloadRegulation(regulationId: string): Promise<RegulationTarget> {
    console.log(`📥 Downloading regulation ${regulationId} with browser TUF verification...`);
    
    if (!this.targetsMetadata) {
      await this.checkForRegulationUpdates();
    }

    const targetPath = `regulations/${regulationId}.json`;
    const targets = this.targetsMetadata?.signed.targets;
    const targetInfo = targets?.[targetPath];
    
    if (!targetInfo) {
      throw new Error(`Regulation ${regulationId} not found in TUF repository`);
    }

    try {
      // Download the regulation file
      const fileUrl = `${this.repositoryUrl}/targets/${targetPath}`;
      const response = await fetch(fileUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to download regulation ${regulationId}: ${response.status}`);
      }

      const content = await response.text();
      
      // Verify file hash using Web Crypto API
      const expectedHash = targetInfo.hashes.sha256;
      const encoder = new TextEncoder();
      const data = encoder.encode(content);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const actualHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      if (actualHash !== expectedHash) {
        throw new Error(`Hash mismatch for regulation ${regulationId}. Expected: ${expectedHash}, Got: ${actualHash}`);
      }

      console.log(`✅ Regulation ${regulationId} downloaded and verified successfully (browser)`);

      // Parse content
      let parsedContent;
      try {
        parsedContent = JSON.parse(content);
      } catch {
        console.warn(`⚠️ Could not parse regulation ${regulationId} as JSON, treating as text`);
        parsedContent = content;
      }

      return {
        regulationId,
        path: targetPath,
        hash: actualHash,
        length: content.length,
        updateTime: targetInfo.custom?.updateTime || new Date().toISOString(),
        metadata: targetInfo.custom || {},
        content: parsedContent,
        verified: true
      };

    } catch (error) {
      console.error(`❌ Failed to download regulation ${regulationId}:`, error);
      throw error;
    }
  }
}
