/**
 * TUF Core Library for MCP Engine Regulation Delivery
 * Implements The Update Framework (TUF) specification for secure regulation updates
 */

import crypto from 'crypto';
import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';
import stringify from 'fast-json-stable-stringify';

export class TUFMetadata {
  constructor() {
    this.specVersion = "1.0.0";
  }

  /**
   * Generate canonical JSON form for signing
   */
  canonicalize(obj) {
    return stringify(obj);
  }

  /**
   * Create signed metadata object
   */
  createSignedMetadata(role, signatures) {
    return {
      signed: role,
      signatures: signatures
    };
  }

  /**
   * Verify signature against metadata
   */
  verifySignature(metadata, publicKey, signature, keyId) {
    try {
      const canonical = this.canonicalize(metadata);
      const messageBytes = naclUtil.decodeUTF8(canonical);
      const signatureBytes = naclUtil.decodeBase64(signature);
      const publicKeyBytes = naclUtil.decodeBase64(publicKey);

      return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
    } catch (error) {
      console.error('Signature verification failed:', error.message);
      return false;
    }
  }
}

export class TUFRole extends TUFMetadata {
  constructor(roleType) {
    super();
    this.roleType = roleType;
    this.version = 1;
    this.expires = new Date(Date.now() + (365 * 24 * 60 * 60 * 1000)).toISOString(); // 1 year
  }

  /**
   * Set custom expiration time
   */
  setExpiration(date) {
    this.expires = date.toISOString();
  }

  /**
   * Increment version number
   */
  incrementVersion() {
    this.version += 1;
  }
}

export class RootRole extends TUFRole {
  constructor() {
    super('root');
    this.consistentSnapshot = true;
    this.keys = {};
    this.roles = {
      root: { keyids: [], threshold: 1 },
      targets: { keyids: [], threshold: 1 },
      snapshot: { keyids: [], threshold: 1 },
      timestamp: { keyids: [], threshold: 1 }
    };
  }

  addKey(keyId, keyObject) {
    this.keys[keyId] = keyObject;
  }

  setRoleKeys(roleName, keyIds, threshold = 1) {
    this.roles[roleName] = {
      keyids: keyIds,
      threshold: threshold
    };
  }

  getMetadata() {
    return {
      _type: this.roleType,
      spec_version: this.specVersion,
      consistent_snapshot: this.consistentSnapshot,
      version: this.version,
      expires: this.expires,
      keys: this.keys,
      roles: this.roles
    };
  }
}

export class TargetsRole extends TUFRole {
  constructor() {
    super('targets');
    this.targets = {};
    this.delegations = null;
  }

  addTarget(path, fileInfo) {
    this.targets[path] = {
      length: fileInfo.length,
      hashes: fileInfo.hashes,
      custom: fileInfo.custom || {}
    };
  }

  removeTarget(path) {
    delete this.targets[path];
  }

  addDelegation(keys, roles) {
    this.delegations = {
      keys: keys,
      roles: roles
    };
  }

  getMetadata() {
    const metadata = {
      _type: this.roleType,
      spec_version: this.specVersion,
      version: this.version,
      expires: this.expires,
      targets: this.targets
    };

    if (this.delegations) {
      metadata.delegations = this.delegations;
    }

    return metadata;
  }
}

export class SnapshotRole extends TUFRole {
  constructor() {
    super('snapshot');
    this.meta = {};
  }

  addMetaFile(metaPath, fileInfo) {
    this.meta[metaPath] = {
      version: fileInfo.version
    };
    
    if (fileInfo.length !== undefined) {
      this.meta[metaPath].length = fileInfo.length;
    }
    
    if (fileInfo.hashes) {
      this.meta[metaPath].hashes = fileInfo.hashes;
    }
  }

  getMetadata() {
    return {
      _type: this.roleType,
      spec_version: this.specVersion,
      version: this.version,
      expires: this.expires,
      meta: this.meta
    };
  }
}

export class TimestampRole extends TUFRole {
  constructor() {
    super('timestamp');
    this.meta = {};
  }

  setSnapshotMeta(snapshotInfo) {
    this.meta['snapshot.json'] = {
      version: snapshotInfo.version,
      length: snapshotInfo.length,
      hashes: snapshotInfo.hashes
    };
  }

  getMetadata() {
    return {
      _type: this.roleType,
      spec_version: this.specVersion,
      version: this.version,
      expires: this.expires,
      meta: this.meta
    };
  }
}

export class TUFKeyManager {
  constructor() {
    this.keys = new Map();
  }

  /**
   * Generate new Ed25519 key pair for TUF role
   */
  generateKeyPair(keyId) {
    const keyPair = nacl.sign.keyPair();
    
    const publicKeyBase64 = naclUtil.encodeBase64(keyPair.publicKey);
    const privateKeyBase64 = naclUtil.encodeBase64(keyPair.secretKey);

    const keyObject = {
      keytype: 'ed25519',
      scheme: 'ed25519',
      keyval: {
        public: publicKeyBase64,
        private: privateKeyBase64
      }
    };

    // Calculate keyId as SHA-256 hash of the canonical public key
    const publicKeyObject = {
      keytype: 'ed25519',
      scheme: 'ed25519',
      keyval: {
        public: publicKeyBase64
      }
    };

    const canonical = stringify(publicKeyObject);
    const calculatedKeyId = crypto.createHash('sha256').update(canonical).digest('hex');

    this.keys.set(calculatedKeyId, keyObject);
    
    return {
      keyId: calculatedKeyId,
      keyObject: keyObject,
      publicKey: publicKeyBase64,
      privateKey: privateKeyBase64
    };
  }

  /**
   * Sign metadata using private key
   */
  signMetadata(metadata, privateKey, keyId) {
    try {
      const canonical = stringify(metadata);
      const messageBytes = naclUtil.decodeUTF8(canonical);
      const privateKeyBytes = naclUtil.decodeBase64(privateKey);
      
      const signature = nacl.sign.detached(messageBytes, privateKeyBytes);
      const signatureBase64 = naclUtil.encodeBase64(signature);

      return {
        keyid: keyId,
        sig: signatureBase64
      };
    } catch (error) {
      throw new Error(`Failed to sign metadata: ${error.message}`);
    }
  }

  /**
   * Get public key object for metadata
   */
  getPublicKeyObject(keyId) {
    const keyObject = this.keys.get(keyId);
    if (!keyObject) {
      throw new Error(`Key not found: ${keyId}`);
    }

    return {
      keytype: keyObject.keytype,
      scheme: keyObject.scheme,
      keyval: {
        public: keyObject.keyval.public
      }
    };
  }

  /**
   * Export keys for backup (SECURE STORAGE REQUIRED)
   */
  exportKeys() {
    const exported = {};
    for (const [keyId, keyObject] of this.keys) {
      exported[keyId] = keyObject;
    }
    return exported;
  }

  /**
   * Import keys from backup
   */
  importKeys(keyData) {
    for (const [keyId, keyObject] of Object.entries(keyData)) {
      this.keys.set(keyId, keyObject);
    }
  }
}

export class TUFRepository {
  constructor() {
    this.keyManager = new TUFKeyManager();
    this.rootRole = new RootRole();
    this.targetsRole = new TargetsRole();
    this.snapshotRole = new SnapshotRole();
    this.timestampRole = new TimestampRole();
    this.roleKeys = {};
  }

  /**
   * Initialize repository with new keys
   */
  async initialize() {
    // Generate keys for all roles
    const rootKey = this.keyManager.generateKeyPair();
    const targetsKey = this.keyManager.generateKeyPair();
    const snapshotKey = this.keyManager.generateKeyPair();
    const timestampKey = this.keyManager.generateKeyPair();

    // Store private keys for signing
    this.roleKeys = {
      root: { keyId: rootKey.keyId, privateKey: rootKey.privateKey },
      targets: { keyId: targetsKey.keyId, privateKey: targetsKey.privateKey },
      snapshot: { keyId: snapshotKey.keyId, privateKey: snapshotKey.privateKey },
      timestamp: { keyId: timestampKey.keyId, privateKey: timestampKey.privateKey }
    };

    // Configure root metadata
    this.rootRole.addKey(rootKey.keyId, this.keyManager.getPublicKeyObject(rootKey.keyId));
    this.rootRole.addKey(targetsKey.keyId, this.keyManager.getPublicKeyObject(targetsKey.keyId));
    this.rootRole.addKey(snapshotKey.keyId, this.keyManager.getPublicKeyObject(snapshotKey.keyId));
    this.rootRole.addKey(timestampKey.keyId, this.keyManager.getPublicKeyObject(timestampKey.keyId));

    this.rootRole.setRoleKeys('root', [rootKey.keyId]);
    this.rootRole.setRoleKeys('targets', [targetsKey.keyId]);
    this.rootRole.setRoleKeys('snapshot', [snapshotKey.keyId]);
    this.rootRole.setRoleKeys('timestamp', [timestampKey.keyId]);

    console.log('✅ TUF Repository initialized with new keys');
    return this.roleKeys;
  }

  /**
   * Add regulation file to targets
   */
  addRegulationTarget(regulationId, fileContent, metadata = {}) {
    // Ensure we're working with a string for consistent hashing
    const contentString = typeof fileContent === 'string' ? fileContent : JSON.stringify(fileContent);
    const hash = crypto.createHash('sha256').update(contentString, 'utf8').digest('hex');
    const length = Buffer.byteLength(contentString, 'utf8');

    const targetPath = `regulations/${regulationId}.json`;
    
    this.targetsRole.addTarget(targetPath, {
      length: length,
      hashes: { sha256: hash },
      custom: {
        regulationId: regulationId,
        updateTime: new Date().toISOString(),
        ...metadata
      }
    });

    this.targetsRole.incrementVersion();
    console.log(`📋 Added regulation target: ${regulationId} (length: ${length}, hash: ${hash.substring(0, 16)}...)`);
    
    return { path: targetPath, hash, length };
  }

  /**
   * Sign and update all metadata
   */
  async updateMetadata() {
    // Sign targets metadata
    const targetsMetadata = this.targetsRole.getMetadata();
    const targetsSignature = this.keyManager.signMetadata(
      targetsMetadata, 
      this.roleKeys.targets.privateKey, 
      this.roleKeys.targets.keyId
    );

    // Update snapshot with targets info
    this.snapshotRole.addMetaFile('targets.json', {
      version: this.targetsRole.version,
      length: Buffer.byteLength(JSON.stringify(targetsMetadata)),
      hashes: { 
        sha256: crypto.createHash('sha256').update(JSON.stringify(targetsMetadata)).digest('hex') 
      }
    });

    this.snapshotRole.incrementVersion();

    // Sign snapshot metadata
    const snapshotMetadata = this.snapshotRole.getMetadata();
    const snapshotSignature = this.keyManager.signMetadata(
      snapshotMetadata,
      this.roleKeys.snapshot.privateKey,
      this.roleKeys.snapshot.keyId
    );

    // Update timestamp with snapshot info
    this.timestampRole.setSnapshotMeta({
      version: this.snapshotRole.version,
      length: Buffer.byteLength(JSON.stringify(snapshotMetadata)),
      hashes: {
        sha256: crypto.createHash('sha256').update(JSON.stringify(snapshotMetadata)).digest('hex')
      }
    });

    this.timestampRole.incrementVersion();

    // Sign timestamp metadata
    const timestampMetadata = this.timestampRole.getMetadata();
    const timestampSignature = this.keyManager.signMetadata(
      timestampMetadata,
      this.roleKeys.timestamp.privateKey,
      this.roleKeys.timestamp.keyId
    );

    // Sign root metadata (only when needed)
    const rootMetadata = this.rootRole.getMetadata();
    const rootSignature = this.keyManager.signMetadata(
      rootMetadata,
      this.roleKeys.root.privateKey,
      this.roleKeys.root.keyId
    );

    return {
      root: { signed: rootMetadata, signatures: [rootSignature] },
      targets: { signed: targetsMetadata, signatures: [targetsSignature] },
      snapshot: { signed: snapshotMetadata, signatures: [snapshotSignature] },
      timestamp: { signed: timestampMetadata, signatures: [timestampSignature] }
    };
  }

  /**
   * Get current repository status
   */
  getStatus() {
    return {
      initialized: Object.keys(this.roleKeys).length > 0,
      targets: Object.keys(this.targetsRole.targets).length,
      versions: {
        root: this.rootRole.version,
        targets: this.targetsRole.version,
        snapshot: this.snapshotRole.version,
        timestamp: this.timestampRole.version
      }
    };
  }
}
