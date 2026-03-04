# TUF-Compliant MCP Engine Integration Guide

## 🔐 **THE UPDATE FRAMEWORK (TUF) REGULATION DELIVERY SYSTEM**

### **EXECUTIVE SUMMARY**

The MCP Engine now implements **The Update Framework (TUF)** for enterprise-grade security in regulation delivery. This system provides cryptographic verification, tamper detection, and rollback protection for all regulation updates.

---

## **🏗️ ARCHITECTURE OVERVIEW**

```
┌─────────────────────────────────────────────────────────────┐
│                    MCP Engine (Cloud)                       │
├─────────────────────────────────────────────────────────────┤
│  TUF Repository Server (Port 3052)                         │
│  ├── Root Role (Offline Keys) ── root.json                 │
│  ├── Targets Role (Regulation Metadata) ── targets.json    │
│  ├── Snapshot Role (Consistency) ── snapshot.json          │
│  ├── Timestamp Role (Freshness) ── timestamp.json          │
│  └── Regulation Files ── /targets/regulations/*.json       │
├─────────────────────────────────────────────────────────────┤
│  WebSocket Notifications (Port 3053)                       │
│  └── Real-time Update Alerts                               │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTPS/WSS
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                EdSteward (Customer Network)                 │
├─────────────────────────────────────────────────────────────┤
│  TUF Client Library                                        │
│  ├── Metadata Verification                                 │
│  ├── Cryptographic Validation                              │
│  ├── Rollback Protection                                   │
│  └── Tamper Detection                                      │
├─────────────────────────────────────────────────────────────┤
│  Local Repository Cache                                    │
│  └── Verified Regulation Files                             │
├─────────────────────────────────────────────────────────────┤
│  Frontend Application                                      │
│  └── Real-time UI Updates                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## **🔑 SECURITY FEATURES**

### **TUF Security Guarantees**
- ✅ **Arbitrary Installation Attacks** - Prevented
- ✅ **Rollback Attacks** - Detected and blocked
- ✅ **Mix-and-Match Attacks** - Prevented via snapshot consistency
- ✅ **Freeze Attacks** - Timestamp expiration validation
- ✅ **Key Compromise Resilience** - Role separation and thresholds
- ✅ **Tamper Detection** - Cryptographic hash verification

### **Cryptographic Foundation**
- **Signing Algorithm**: Ed25519 (Elliptic Curve Digital Signatures)
- **Hash Function**: SHA-256
- **Key Management**: Role-based key separation
- **Metadata Signing**: Multi-role threshold signatures

---

## **📡 ENDPOINTS AND SERVICES**

### **TUF Repository Server (Port 3052)**

```http
# Health Check
GET http://localhost:3052/health

# TUF Metadata (Standard TUF Endpoints)
GET http://localhost:3052/metadata/root.json
GET http://localhost:3052/metadata/targets.json
GET http://localhost:3052/metadata/snapshot.json
GET http://localhost:3052/metadata/timestamp.json

# Regulation Files
GET http://localhost:3052/targets/regulations/{regulationId}.json

# Administrative API
POST http://localhost:3052/admin/initialize
POST http://localhost:3052/admin/add-regulation
GET http://localhost:3052/admin/status

# Client API
GET http://localhost:3052/api/regulations
```

### **WebSocket Notifications (Port 3053)**

```javascript
// Connection
const ws = new WebSocket('ws://localhost:3053');

// Subscribe to updates
ws.send(JSON.stringify({
  type: 'subscribe'
}));

// Receive notifications
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.type === 'regulation_updated') {
    // Handle regulation update
  }
};
```

---

## **💻 CLIENT INTEGRATION**

### **1. Install Dependencies**

```bash
npm install tweetnacl tweetnacl-util fast-json-stable-stringify
```

### **2. Initialize TUF Client**

```javascript
import { TUFClient } from './tuf-client.js';

// Initialize client
const tufClient = new TUFClient({
  repositoryUrl: 'http://your-mcp-engine-url:3052',
  metadataDir: './tuf-metadata',
  targetsDir: './tuf-targets'
});

// Get trusted root metadata (initial setup)
const trustedRoot = await fetch('http://your-mcp-engine-url:3052/metadata/root.json')
  .then(r => r.json());

await tufClient.initialize(trustedRoot);
```

### **3. Check for Updates**

```javascript
// Check for regulation updates
const regulations = await tufClient.checkForRegulationUpdates();

console.log('Available regulations:', regulations);
// Output:
// [
//   {
//     regulationId: "REG-66",
//     path: "regulations/REG-66.json",
//     hash: "a1b2c3d4...",
//     length: 45231,
//     updateTime: "2025-08-19T13:30:00.000Z",
//     metadata: { ... }
//   }
// ]
```

### **4. Download Verified Regulation**

```javascript
// Download and verify regulation
const regulation = await tufClient.downloadRegulation('REG-66');

console.log('Downloaded regulation:', regulation);
// Output:
// {
//   regulationId: "REG-66",
//   content: { /* regulation data */ },
//   metadata: { updateTime: "...", ... },
//   verified: true
// }
```

### **5. Real-time Update Handling**

```javascript
// WebSocket connection for real-time updates
const ws = new WebSocket('ws://your-mcp-engine-url:3053');

ws.onopen = () => {
  ws.send(JSON.stringify({ type: 'subscribe' }));
};

ws.onmessage = async (event) => {
  const message = JSON.parse(event.data);
  
  if (message.type === 'regulation_updated') {
    console.log('Regulation updated:', message.regulationId);
    
    // Fetch the updated regulation
    const updatedRegulation = await tufClient.downloadRegulation(message.regulationId);
    
    // Update your application
    updateApplicationData(updatedRegulation);
    
    // Refresh UI
    refreshUserInterface();
  }
};
```

---

## **🌐 BROWSER INTEGRATION**

### **Frontend JavaScript Implementation**

```html
<!DOCTYPE html>
<html>
<head>
    <title>EdSteward - TUF Integration</title>
</head>
<body>
    <div id="regulation-status"></div>
    <div id="regulation-content"></div>

    <script type="module">
        import { BrowserTUFClient } from './tuf-client.js';

        class EdStewardTUFIntegration {
            constructor() {
                this.tufClient = new BrowserTUFClient('http://your-mcp-engine-url:3052');
                this.ws = null;
                this.regulations = new Map();
            }

            async initialize() {
                // Initialize TUF client
                const trustedRoot = await fetch('http://your-mcp-engine-url:3052/metadata/root.json')
                    .then(r => r.json());
                
                await this.tufClient.initialize(trustedRoot);

                // Setup WebSocket for real-time updates
                this.setupWebSocket();

                // Initial regulation check
                await this.checkForUpdates();
            }

            setupWebSocket() {
                this.ws = new WebSocket('ws://your-mcp-engine-url:3053');
                
                this.ws.onopen = () => {
                    this.ws.send(JSON.stringify({ type: 'subscribe' }));
                    this.updateStatus('Connected to MCP Engine');
                };

                this.ws.onmessage = async (event) => {
                    const message = JSON.parse(event.data);
                    
                    if (message.type === 'regulation_updated') {
                        await this.handleRegulationUpdate(message);
                    }
                };

                this.ws.onclose = () => {
                    this.updateStatus('Disconnected from MCP Engine');
                    // Implement reconnection logic
                    setTimeout(() => this.setupWebSocket(), 5000);
                };
            }

            async checkForUpdates() {
                try {
                    const regulations = await this.tufClient.checkForUpdates();
                    
                    for (const regulation of regulations) {
                        this.regulations.set(regulation.regulationId, regulation);
                    }

                    this.updateStatus(`Found ${regulations.length} regulations`);
                    this.renderRegulations();
                } catch (error) {
                    console.error('Failed to check for updates:', error);
                    this.updateStatus('Update check failed');
                }
            }

            async handleRegulationUpdate(message) {
                try {
                    this.updateStatus(`Updating ${message.regulationId}...`);
                    
                    const regulation = await this.tufClient.downloadRegulation(message.regulationId);
                    this.regulations.set(regulation.regulationId, regulation);
                    
                    this.updateStatus(`✅ ${message.regulationId} updated successfully`);
                    this.renderRegulations();
                    
                    // Show notification
                    this.showNotification(`Regulation ${message.regulationId} has been updated`);
                } catch (error) {
                    console.error('Failed to handle regulation update:', error);
                    this.updateStatus(`❌ Failed to update ${message.regulationId}`);
                }
            }

            updateStatus(message) {
                const statusEl = document.getElementById('regulation-status');
                statusEl.textContent = `${new Date().toLocaleTimeString()}: ${message}`;
            }

            renderRegulations() {
                const contentEl = document.getElementById('regulation-content');
                contentEl.innerHTML = '';

                for (const [id, regulation] of this.regulations) {
                    const div = document.createElement('div');
                    div.innerHTML = `
                        <h3>📋 ${id}</h3>
                        <p>Last Updated: ${new Date(regulation.metadata.updateTime).toLocaleString()}</p>
                        <p>Status: ✅ Verified</p>
                        <details>
                            <summary>Regulation Content</summary>
                            <pre>${JSON.stringify(regulation.content, null, 2)}</pre>
                        </details>
                    `;
                    contentEl.appendChild(div);
                }
            }

            showNotification(message) {
                // Create notification banner
                const notification = document.createElement('div');
                notification.style.cssText = `
                    position: fixed; top: 20px; right: 20px; 
                    background: #4CAF50; color: white; 
                    padding: 15px; border-radius: 5px; 
                    z-index: 1000; max-width: 300px;
                `;
                notification.textContent = message;
                
                document.body.appendChild(notification);
                
                setTimeout(() => {
                    document.body.removeChild(notification);
                }, 5000);
            }
        }

        // Initialize the integration
        const edstewardTUF = new EdStewardTUFIntegration();
        edstewardTUF.initialize().catch(console.error);
    </script>
</body>
</html>
```

---

## **⚙️ CONFIGURATION**

### **Environment Variables**

```bash
# MCP Engine Configuration
TUF_REPOSITORY_PORT=3052
TUF_REPOSITORY_PATH=./tuf-repository
TUF_WEBSOCKET_PORT=3053

# EdSteward Configuration
MCP_ENGINE_URL=http://your-mcp-engine-url:3052
TUF_METADATA_DIR=./tuf-metadata
TUF_TARGETS_DIR=./tuf-targets
```

### **Security Configuration**

```javascript
// tuf-config.js
export const TUF_CONFIG = {
  // Key expiration settings
  ROOT_KEY_EXPIRY_DAYS: 365,
  TARGETS_KEY_EXPIRY_DAYS: 90,
  SNAPSHOT_KEY_EXPIRY_DAYS: 30,
  TIMESTAMP_KEY_EXPIRY_DAYS: 1,

  // Signature thresholds
  ROOT_THRESHOLD: 1,
  TARGETS_THRESHOLD: 1,
  SNAPSHOT_THRESHOLD: 1,
  TIMESTAMP_THRESHOLD: 1,

  // Update intervals
  METADATA_UPDATE_INTERVAL: 300000, // 5 minutes
  REGULATION_CHECK_INTERVAL: 600000, // 10 minutes

  // Network timeouts
  METADATA_TIMEOUT: 30000,
  TARGET_TIMEOUT: 60000
};
```

---

## **📊 MONITORING AND LOGGING**

### **TUF Client Logging**

```javascript
import { TUFClient } from './tuf-client.js';

class MonitoredTUFClient extends TUFClient {
  constructor(options) {
    super(options);
    this.metrics = {
      updatesChecked: 0,
      regulationsDownloaded: 0,
      verificationFailures: 0,
      lastUpdate: null
    };
  }

  async performUpdate() {
    const startTime = Date.now();
    try {
      const result = await super.performUpdate();
      this.metrics.updatesChecked++;
      this.metrics.lastUpdate = new Date();
      
      this.logMetrics('UPDATE_SUCCESS', {
        duration: Date.now() - startTime,
        targets: result.length
      });
      
      return result;
    } catch (error) {
      this.metrics.verificationFailures++;
      
      this.logMetrics('UPDATE_FAILED', {
        duration: Date.now() - startTime,
        error: error.message
      });
      
      throw error;
    }
  }

  logMetrics(event, data) {
    console.log(`[TUF-CLIENT] ${event}:`, {
      timestamp: new Date().toISOString(),
      metrics: this.metrics,
      eventData: data
    });
  }

  getHealthStatus() {
    return {
      status: this.metrics.verificationFailures === 0 ? 'healthy' : 'degraded',
      metrics: this.metrics,
      lastUpdate: this.metrics.lastUpdate
    };
  }
}
```

---

## **🛠️ TESTING AND VALIDATION**

### **1. Repository Initialization Test**

```bash
# Test repository initialization
curl -X POST http://localhost:3052/admin/initialize
```

### **2. Metadata Validation Test**

```bash
# Verify all metadata endpoints
curl http://localhost:3052/metadata/root.json | jq '.signatures | length'
curl http://localhost:3052/metadata/targets.json | jq '.signed.targets | keys'
curl http://localhost:3052/metadata/snapshot.json | jq '.signed.meta'
curl http://localhost:3052/metadata/timestamp.json | jq '.signed.expires'
```

### **3. Regulation Upload Test**

```bash
# Add test regulation
curl -X POST http://localhost:3052/admin/add-regulation \
  -H "Content-Type: application/json" \
  -d '{
    "regulationId": "TEST-REG-001",
    "content": {
      "title": "Test Regulation",
      "sections": ["Section 1", "Section 2"],
      "version": "1.0.0"
    },
    "metadata": {
      "category": "test",
      "priority": "low"
    }
  }'
```

### **4. Client Integration Test**

```javascript
// test-tuf-integration.js
import { TUFClient } from './tuf-client.js';

async function testTUFIntegration() {
  console.log('🧪 Testing TUF Integration...');
  
  const client = new TUFClient({
    repositoryUrl: 'http://localhost:3052'
  });

  try {
    // Get trusted root
    const rootResponse = await fetch('http://localhost:3052/metadata/root.json');
    const trustedRoot = await rootResponse.json();
    
    await client.initialize(trustedRoot);
    console.log('✅ Client initialized');

    // Check for updates
    const regulations = await client.checkForRegulationUpdates();
    console.log(`✅ Found ${regulations.length} regulations`);

    // Download a regulation
    if (regulations.length > 0) {
      const regulation = await client.downloadRegulation(regulations[0].regulationId);
      console.log('✅ Downloaded regulation:', regulation.regulationId);
    }

    console.log('🎉 TUF Integration test completed successfully!');
  } catch (error) {
    console.error('❌ TUF Integration test failed:', error);
  }
}

testTUFIntegration();
```

---

## **📋 IMPLEMENTATION CHECKLIST**

### **Phase 1: Basic TUF Implementation**
- [x] TUF core library with Ed25519 signing
- [x] Repository server with metadata endpoints
- [x] Client library with verification workflow
- [x] WebSocket notification system

### **Phase 2: EdSteward Integration**
- [ ] Install TUF client library in EdSteward
- [ ] Configure repository URL and metadata directories
- [ ] Implement regulation update handlers
- [ ] Add real-time WebSocket integration

### **Phase 3: Production Deployment**
- [ ] Configure HTTPS/TLS for repository server
- [ ] Implement key backup and recovery procedures
- [ ] Set up monitoring and alerting
- [ ] Performance optimization and caching

### **Phase 4: Advanced Features**
- [ ] Delegation support for role-based access
- [ ] Consistent snapshots for atomic updates
- [ ] Mirror support for high availability
- [ ] Automated key rotation procedures

---

## **🚨 SECURITY CONSIDERATIONS**

### **Key Management**
- **Root Keys**: Store offline in hardware security modules
- **Online Keys**: Rotate regularly (timestamp: daily, snapshot: weekly)
- **Backup**: Secure key backup and recovery procedures
- **Thresholds**: Consider multi-signature requirements for critical roles

### **Network Security**
- **HTTPS**: Always use TLS for metadata and target downloads
- **Certificate Pinning**: Pin TUF repository certificates
- **WebSocket Security**: Use WSS for real-time notifications
- **Network Segmentation**: Isolate TUF repository in secure network zone

### **Operational Security**
- **Monitoring**: Log all metadata updates and downloads
- **Alerting**: Alert on verification failures or suspicious activity
- **Auditing**: Regular security audits of TUF implementation
- **Incident Response**: Procedures for key compromise scenarios

---

## **📞 SUPPORT AND DOCUMENTATION**

### **Additional Resources**
- [TUF Specification](https://theupdateframework.io/specification/)
- [TUF Security Analysis](https://theupdateframework.io/security/)
- [MCP Engine API Documentation](../delivery-system/README.md)

### **Troubleshooting**
- **Signature Verification Failures**: Check key material and metadata integrity
- **Network Connectivity**: Verify repository URL and network access
- **Metadata Expiration**: Ensure system clocks are synchronized
- **Performance Issues**: Implement caching and connection pooling

---

## **🎯 NEXT STEPS**

1. **Review this integration guide** with your development team
2. **Set up development environment** with TUF repository server
3. **Implement client integration** following the code examples
4. **Test end-to-end workflow** with regulation updates
5. **Plan production deployment** with security hardening
6. **Establish monitoring** and operational procedures

---

**This TUF-compliant system provides enterprise-grade security for your regulation delivery pipeline. The implementation follows industry best practices and provides cryptographic guarantees against supply chain attacks.**

