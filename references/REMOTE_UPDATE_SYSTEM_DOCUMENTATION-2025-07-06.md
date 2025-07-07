# EdSteward Remote Update System Documentation

**Version**: 1.0.0  
**Last Updated**: January 2025  
**System**: MCP Integration & Remote Update Pipeline  
**Tenant Focus**: Moravian University Database Updates  

---

## 📋 **Table of Contents**

1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Database Schema](#database-schema)
4. [API Endpoints](#api-endpoints)
5. [Authentication & Security](#authentication--security)
6. [Update Processing Pipeline](#update-processing-pipeline)
7. [Version Management](#version-management)
8. [Conflict Resolution](#conflict-resolution)
9. [Configuration](#configuration)
10. [Usage Examples](#usage-examples)
11. [Monitoring & Troubleshooting](#monitoring--troubleshooting)
12. [Best Practices](#best-practices)

---

## 🏗️ **System Overview**

EdSteward implements a **comprehensive remote update system** using **MCP (Model Control Panel) integration** that enables external servers to push regulation updates directly to tenant databases. The system is specifically designed for the **database-per-tenant architecture** where each tenant (like Moravian University) has complete data isolation.

### **Key Capabilities**
- 🔄 **Real-time Updates**: Receive regulation updates from external servers
- 🔐 **Secure API**: API key-based authentication for remote access
- 📊 **Version Control**: Complete version history and rollback capabilities
- ⚖️ **Conflict Resolution**: Automated detection and manual resolution workflows
- 🎯 **Tenant Isolation**: Updates target specific tenant databases
- 📢 **Notifications**: Automated user notifications for all updates
- ✅ **Validation**: Multi-level validation (A/B/C/D) for incoming data

### **Primary Use Cases**
- **Regulatory Updates**: Push new regulation versions from central systems
- **Content Synchronization**: Keep multiple environments in sync
- **Batch Updates**: Process bulk regulation changes
- **Version Migration**: Transfer updates between development stages

---

## 🏛️ **Architecture**

### **Database-Per-Tenant Model**

Each tenant has a **physically separate PostgreSQL database** ensuring complete isolation:

```
┌─────────────────────────────────────────────────────────┐
│                External Update Server                   │
│  ┌─────────────────────────────────────────────────────┐│
│  │           Your Remote Server                        ││
│  │     (Pushes regulation updates)                     ││
│  └─────────────────────────────────────────────────────┘│
└─────────────────────┬───────────────────────────────────┘
                      │ HTTPS + API Key Auth
                      ▼
┌─────────────────────────────────────────────────────────┐
│                EdSteward MCP API                        │
│  ┌─────────────────────────────────────────────────────┐│
│  │              Express.js Server                      ││
│  │    ┌─────────────┐  ┌─────────────┐                ││
│  │    │   MCP API   │  │   Auth      │                ││
│  │    │ Endpoints   │  │ Middleware  │                ││
│  │    └─────────────┘  └─────────────┘                ││
│  └─────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────┤
│              Multi-Tenant Database Service              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │
│  │   Admin     │  │  Moravian   │  │   Staging   │      │
│  │  Database   │  │  Database   │  │  Database   │      │
│  │             │  │             │  │             │      │
│  │edsteward_   │  │edsteward_   │  │edsteward_   │      │
│  │   admin     │  │  moravian   │  │  staging    │      │
│  └─────────────┘  └─────────────┘  └─────────────┘      │
└─────────────────────────────────────────────────────────┘
```

### **Moravian Tenant Configuration**

```typescript
// Tenant Database Configuration
const MORAVIAN_CONFIG = {
  tenantId: 'moravian',
  name: 'Moravian University',
  databaseUrl: process.env.MORAVIAN_DATABASE_URL,
  poolConfig: { 
    max: 5, 
    idleTimeoutMillis: 30000, 
    connectionTimeoutMillis: 10000 
  },
  domain: 'moravian.edu',
  subdomain: 'moravian',
  features: {
    apiAccess: true,
    ssoEnabled: true,
    maxUsers: 500,
    maxRegulations: 5000
  }
}
```

---

## 📊 **Database Schema**

### **Core MCP Integration Tables**

The system uses **5 specialized tables** for managing remote updates:

#### **1. regulation_versions**
Stores complete version history of regulations from external sources.

```sql
CREATE TABLE regulation_versions (
  id SERIAL PRIMARY KEY,
  regulation_id INTEGER NOT NULL REFERENCES regulations(id),
  version_number INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by INTEGER REFERENCES users(id),
  source TEXT NOT NULL DEFAULT 'local',  -- 'local', 'mcp', 'import'
  source_id TEXT,                        -- External system ID
  validation_status JSONB                -- Validation results
);

-- Performance indexes
CREATE INDEX idx_regulation_versions_regulation_id ON regulation_versions(regulation_id);
CREATE INDEX idx_regulation_versions_source ON regulation_versions(source);
```

#### **2. validation_status**
Tracks multi-level validation results for each regulation version.

```sql
CREATE TABLE validation_status (
  id SERIAL PRIMARY KEY,
  regulation_id INTEGER NOT NULL REFERENCES regulations(id),
  version_id INTEGER REFERENCES regulation_versions(id),
  level TEXT NOT NULL,                   -- 'A', 'B', 'C', 'D'
  status TEXT NOT NULL,                  -- 'passed', 'failed', 'warning'
  details JSONB,                         -- Error details and metadata
  validated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  validated_by INTEGER REFERENCES users(id)
);

-- Performance indexes
CREATE INDEX idx_validation_status_regulation_id ON validation_status(regulation_id);
CREATE INDEX idx_validation_status_version_id ON validation_status(version_id);
CREATE INDEX idx_validation_status_level ON validation_status(level);
```

#### **3. sync_control**
Controls synchronization settings and tracks sync attempts.

```sql
CREATE TABLE sync_control (
  id SERIAL PRIMARY KEY,
  regulation_id INTEGER NOT NULL REFERENCES regulations(id),
  last_sync_attempt TIMESTAMP,
  last_successful_sync TIMESTAMP,
  sync_errors JSONB,                     -- Error details from failed syncs
  next_scheduled_sync TIMESTAMP,
  sync_state TEXT NOT NULL DEFAULT 'idle', -- 'idle', 'syncing', 'failed'
  sync_settings JSONB,                   -- Sync configuration
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Performance indexes
CREATE INDEX idx_sync_control_regulation_id ON sync_control(regulation_id);
CREATE INDEX idx_sync_control_state ON sync_control(sync_state);
CREATE INDEX idx_sync_control_next_sync ON sync_control(next_scheduled_sync);
```

#### **4. notification_queue**
Manages notifications for regulation updates and system events.

```sql
CREATE TABLE notification_queue (
  id SERIAL PRIMARY KEY,
  regulation_id INTEGER NOT NULL REFERENCES regulations(id),
  user_id INTEGER REFERENCES users(id),
  type TEXT NOT NULL,                    -- 'sync_complete', 'version_conflict', etc.
  content JSONB NOT NULL,                -- Notification payload
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'failed'
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMP,
  priority TEXT NOT NULL DEFAULT 'normal', -- 'low', 'normal', 'high', 'critical'
  retry_count INTEGER NOT NULL DEFAULT 0,
  next_retry_at TIMESTAMP
);

-- Performance indexes
CREATE INDEX idx_notification_queue_regulation_id ON notification_queue(regulation_id);
CREATE INDEX idx_notification_queue_status ON notification_queue(status);
CREATE INDEX idx_notification_queue_priority ON notification_queue(priority);
```

#### **5. version_conflicts**
Tracks conflicts between local and remote regulation versions.

```sql
CREATE TABLE version_conflicts (
  id SERIAL PRIMARY KEY,
  regulation_id INTEGER NOT NULL REFERENCES regulations(id),
  local_version_id INTEGER REFERENCES regulation_versions(id),
  remote_version_id TEXT NOT NULL,       -- ID from external system
  conflicts JSONB,                       -- Detailed conflict information
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'resolved', 'rejected'
  resolution_method TEXT,                -- 'auto', 'manual'
  resolved_at TIMESTAMP,
  resolved_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Performance indexes
CREATE INDEX idx_version_conflicts_regulation_id ON version_conflicts(regulation_id);
CREATE INDEX idx_version_conflicts_status ON version_conflicts(status);
```

---

## 🔌 **API Endpoints**

### **Base URL Structure**
```
https://moravian.edsteward.ai/api/mcp/*
```

All MCP endpoints require authentication via `X-MCP-API-Key` header.

### **Core Update Endpoints**

#### **1. Push New Regulation Version**
```http
POST /api/mcp/versions/:regulationId
Content-Type: application/json
X-MCP-API-Key: your-api-key-here

{
  "regulationId": 4903,
  "content": "# Updated regulation content...",
  "source": "mcp_orchestrator",
  "sourceId": "mcp-update-20250119-001",
  "validationStatus": [
    {
      "level": "A",
      "passed": true,
      "errors": [],
      "validatedAt": "2025-01-19T18:30:45Z"
    }
  ]
}
```

**Response:**
```json
{
  "id": 1234,
  "regulationId": 4903,
  "versionNumber": 3,
  "content": "# Updated regulation content...",
  "source": "mcp_orchestrator",
  "sourceId": "mcp-update-20250119-001",
  "createdAt": "2025-01-19T18:30:45Z",
  "createdBy": 1
}
```

#### **2. Get Sync Status**
```http
GET /api/mcp/sync-status
X-MCP-API-Key: your-api-key-here
```

**Response:**
```json
[
  {
    "regulationId": 4903,
    "itemId": "REG-001",
    "name": "Research Ethics and Integrity",
    "syncStatus": {
      "regulationId": 4903,
      "lastSyncAttempt": "2025-01-19T18:30:45Z",
      "lastSuccessfulSync": "2025-01-19T18:30:45Z",
      "syncState": "idle",
      "nextScheduledSync": "2025-01-20T18:30:45Z"
    }
  }
]
```

#### **3. Register Version Conflict**
```http
POST /api/mcp/conflicts/:regulationId
Content-Type: application/json
X-MCP-API-Key: your-api-key-here

{
  "regulationId": 4903,
  "localVersionId": 1233,
  "remoteVersionId": "mcp-update-20250119-002",
  "conflicts": [
    {
      "field": "requirements.section3.1",
      "localValue": "All individuals who make substantial contributions...",
      "remoteValue": "All individuals who make significant contributions...",
      "resolutionStrategy": "manual"
    }
  ]
}
```

#### **4. Schedule Synchronization**
```http
POST /api/mcp/sync/:regulationId
Content-Type: application/json
X-MCP-API-Key: your-api-key-here

{
  "nextSync": "2025-01-20T18:30:45Z",
  "syncSettings": {
    "frequency": "daily",
    "priority": "normal",
    "includeContent": true,
    "validateOnSync": true
  }
}
```

### **Monitoring Endpoints**

#### **5. Get Latest Version**
```http
GET /api/mcp/versions/:regulationId/latest
X-MCP-API-Key: your-api-key-here
```

#### **6. Get All Versions**
```http
GET /api/mcp/versions/:regulationId
X-MCP-API-Key: your-api-key-here
```

#### **7. Get Pending Conflicts**
```http
GET /api/mcp/conflicts/pending
X-MCP-API-Key: your-api-key-here
```

#### **8. Validate Version**
```http
POST /api/mcp/validate/:versionId
X-MCP-API-Key: your-api-key-here
```

---

## 🔐 **Authentication & Security**

### **API Key Authentication**

All MCP endpoints require a valid API key in the request header:

```typescript
// Authentication Middleware
const authenticateMCP = async (req: Request, res: Response, next: Function) => {
  const apiKey = req.headers['x-mcp-api-key'];
  
  if (!apiKey) {
    return res.status(401).json({ error: "API key required" });
  }
  
  if (apiKey !== process.env.MCP_API_KEY) {
    return res.status(403).json({ error: "Invalid API key" });
  }
  
  next();
};
```

### **Environment Configuration**

```bash
# Required Environment Variables
MCP_API_KEY=your-secure-api-key-here-256-bits
MORAVIAN_DATABASE_URL=postgresql://user:pass@host:5432/edsteward_moravian

# Optional Security Settings
MCP_RATE_LIMIT=100  # requests per minute
MCP_ALLOWED_IPS=192.168.1.100,10.0.0.5  # IP whitelist
```

### **Security Features**

- ✅ **API Key Validation**: Secure authentication for all endpoints
- ✅ **HTTPS Only**: All communication encrypted in transit
- ✅ **Request Validation**: Zod schema validation for all payloads
- ✅ **Rate Limiting**: Configurable request rate limits
- ✅ **IP Whitelisting**: Optional IP-based access control
- ✅ **Audit Logging**: Complete audit trail via syslog
- ✅ **Input Sanitization**: SQL injection prevention via prepared statements

---

## 🔄 **Update Processing Pipeline**

### **Step-by-Step Update Flow**

```mermaid
graph TD
    A[External Server] -->|POST /api/mcp/versions/:id| B[API Gateway]
    B --> C[Authentication Check]
    C -->|Valid API Key| D[Request Validation]
    C -->|Invalid| E[401/403 Error]
    D -->|Valid Payload| F[Database Version Creation]
    D -->|Invalid| G[400 Error]
    F --> H[Validation Pipeline]
    H --> I[Conflict Detection]
    I -->|No Conflicts| J[Update Regulation]
    I -->|Conflicts Found| K[Create Conflict Record]
    J --> L[Send Notifications]
    K --> L
    L --> M[Success Response]
```

### **1. Request Reception**
```typescript
// Endpoint receives update request
app.post('/api/mcp/versions/:regulationId', authenticateMCP, async (req, res) => {
  const regulationId = parseInt(req.params.regulationId, 10);
  const validationResult = regulationVersionSchema.safeParse(req.body);
  
  if (!validationResult.success) {
    return res.status(400).json({ 
      error: 'Invalid version data', 
      details: validationResult.error.format() 
    });
  }
```

### **2. Version Creation**
```typescript
// Create new regulation version
const newVersion = await storage.createRegulationVersion({
  regulationId,
  versionNumber: latestVersion ? latestVersion.versionNumber + 1 : 1,
  content: data.content,
  source: data.source,
  sourceId: data.sourceId,
  validationStatus: data.validationStatus,
  createdBy: 1 // System user ID
});
```

### **3. Validation Pipeline**
The system performs **multi-level validation** on incoming updates:

- **Level A**: Basic structural validation (JSON format, required fields)
- **Level B**: Content-level validation (regulation format, syntax)
- **Level C**: Business rules validation (compliance requirements)
- **Level D**: Contextual validation (cross-references, dependencies)

### **4. Conflict Detection**
```typescript
// Automatic conflict detection
const conflicts = await detectVersionConflicts(regulationId, newVersion);

if (conflicts.length > 0) {
  await storage.createVersionConflict({
    regulationId,
    localVersionId: currentVersion.id,
    remoteVersionId: data.sourceId,
    conflicts: conflicts,
    status: 'pending'
  });
}
```

### **5. Notification System**
```typescript
// Create notification for users
await storage.createNotificationQueueItem({
  regulationId,
  type: 'sync_complete',
  content: {
    versionId: newVersion.id,
    versionNumber,
    message: `New version ${versionNumber} received from MCP`
  },
  status: 'pending',
  priority: 'normal'
});
```

---

## 📝 **Version Management**

### **Version Numbering**
- **Automatic Incrementing**: Each new version gets `previousVersion + 1`
- **Source Tracking**: Track whether version came from 'local', 'mcp', or 'import'
- **External IDs**: Store external system identifiers for traceability

### **Version Comparison**
```typescript
// Compare two regulation versions
const comparison = await storage.compareRegulationVersions(versionA, versionB);

// Returns:
{
  changes: [
    {
      field: "requirements.section3.1",
      valueA: "old content",
      valueB: "new content", 
      changeType: "modified"
    }
  ]
}
```

### **Rollback Capabilities**
```typescript
// Rollback to previous version
await storage.rollbackToVersion(regulationId, targetVersionId, userId);
```

---

## ⚖️ **Conflict Resolution**

### **Conflict Types**
1. **Content Conflicts**: Different content for same regulation section
2. **Timing Conflicts**: Simultaneous updates from multiple sources
3. **Validation Conflicts**: Local passes validation, remote fails
4. **Dependency Conflicts**: Updates affect referenced regulations

### **Resolution Strategies**
- **`local`**: Keep local version, ignore remote
- **`remote`**: Accept remote version, overwrite local
- **`merge`**: Combine both versions (manual or automatic)
- **`manual`**: Require human intervention

### **Manual Resolution Workflow**
```typescript
// Resolve conflict manually
await storage.resolveVersionConflict(conflictId, resolutions, userId);

// Example resolutions
const resolutions = [
  {
    field: "requirements.section3.1",
    localValue: "substantial contributions",
    remoteValue: "significant contributions", 
    resolutionStrategy: "remote",
    resolvedValue: "significant contributions"
  }
];
```

---

## ⚙️ **Configuration**

### **Environment Variables**

```bash
# Core Configuration
MCP_API_KEY=your-256-bit-api-key-here
MORAVIAN_DATABASE_URL=postgresql://user:pass@host:5432/edsteward_moravian

# Optional Settings
MCP_RATE_LIMIT=100                    # Requests per minute
MCP_ALLOWED_IPS=192.168.1.100         # IP whitelist
MCP_VALIDATION_TIMEOUT=30000          # Validation timeout (ms)
MCP_NOTIFICATION_BATCH_SIZE=50        # Notification batch size
MCP_CONFLICT_AUTO_RESOLVE=false       # Auto-resolve simple conflicts

# Database Connection Pool
MORAVIAN_DB_POOL_MAX=5               # Max connections
MORAVIAN_DB_POOL_IDLE_TIMEOUT=30000   # Idle timeout (ms)
MORAVIAN_DB_POOL_CONNECTION_TIMEOUT=10000  # Connection timeout (ms)
```

### **Sync Settings**
```json
{
  "frequency": "daily",        // hourly, daily, weekly, manual
  "priority": "normal",        // low, normal, high
  "includeContent": true,      // Include full content in sync
  "validateOnSync": true,      // Run validation on incoming updates
  "autoResolveConflicts": false,  // Auto-resolve simple conflicts
  "notifyOnConflicts": true,   // Send notifications for conflicts
  "retryFailedSyncs": true,    // Retry failed sync attempts
  "maxRetries": 3              // Maximum retry attempts
}
```

---

## 🚀 **Usage Examples**

### **Example 1: Simple Regulation Update**

```bash
# Push a regulation update from your server
curl -X POST https://moravian.edsteward.ai/api/mcp/versions/4903 \
  -H "Content-Type: application/json" \
  -H "X-MCP-API-Key: your-api-key-here" \
  -d '{
    "regulationId": 4903,
    "content": "# Updated Research Ethics Policy\n\nNew requirements for data handling...",
    "source": "central_compliance_system",
    "sourceId": "update-2025-01-19-001"
  }'
```

### **Example 2: Batch Update with Validation**

```javascript
// JavaScript example for batch updates
const updateRegulations = async (regulations) => {
  const results = [];
  
  for (const regulation of regulations) {
    try {
      const response = await fetch(`https://moravian.edsteward.ai/api/mcp/versions/${regulation.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-MCP-API-Key': process.env.MCP_API_KEY
        },
        body: JSON.stringify({
          regulationId: regulation.id,
          content: regulation.content,
          source: 'batch_update_system',
          sourceId: `batch-${Date.now()}-${regulation.id}`,
          validationStatus: regulation.validationResults
        })
      });
      
      const result = await response.json();
      results.push({ id: regulation.id, success: true, result });
      
    } catch (error) {
      results.push({ id: regulation.id, success: false, error: error.message });
    }
  }
  
  return results;
};
```

### **Example 3: Monitoring Sync Status**

```python
# Python example for monitoring
import requests
import time

def monitor_sync_status(api_key):
    headers = {'X-MCP-API-Key': api_key}
    
    while True:
        response = requests.get(
            'https://moravian.edsteward.ai/api/mcp/sync-status',
            headers=headers
        )
        
        if response.status_code == 200:
            statuses = response.json()
            
            for status in statuses:
                if status['syncStatus']['syncState'] == 'failed':
                    print(f"Sync failed for regulation {status['regulationId']}: {status['name']}")
                elif status['syncStatus']['syncState'] == 'syncing':
                    print(f"Syncing regulation {status['regulationId']}: {status['name']}")
        
        time.sleep(60)  # Check every minute
```

### **Example 4: Conflict Resolution**

```bash
# Check for pending conflicts
curl -X GET https://moravian.edsteward.ai/api/mcp/conflicts/pending \
  -H "X-MCP-API-Key: your-api-key-here"

# Register a conflict when detected
curl -X POST https://moravian.edsteward.ai/api/mcp/conflicts/4903 \
  -H "Content-Type: application/json" \
  -H "X-MCP-API-Key: your-api-key-here" \
  -d '{
    "regulationId": 4903,
    "localVersionId": 1233,
    "remoteVersionId": "update-2025-01-19-002",
    "conflicts": [
      {
        "field": "requirements.section2.1",
        "localValue": "Data must be stored for 5 years",
        "remoteValue": "Data must be stored for 7 years",
        "resolutionStrategy": "manual"
      }
    ]
  }'
```

---

## 📊 **Monitoring & Troubleshooting**

### **Health Check Endpoints**

```bash
# Check system health
curl https://moravian.edsteward.ai/api/health

# Check MCP API health
curl -H "X-MCP-API-Key: your-key" https://moravian.edsteward.ai/api/mcp/sync-status
```

### **Common Error Scenarios**

#### **1. Authentication Errors**
```json
// 401 Unauthorized
{
  "error": "API key required"
}

// 403 Forbidden  
{
  "error": "Invalid API key"
}
```

**Solution**: Verify `MCP_API_KEY` environment variable is set correctly.

#### **2. Validation Errors**
```json
// 400 Bad Request
{
  "error": "Invalid version data",
  "details": {
    "content": ["Required"],
    "regulationId": ["Expected number, received string"]
  }
}
```

**Solution**: Check request payload matches expected schema.

#### **3. Database Connection Errors**
```json
// 500 Internal Server Error
{
  "error": "Failed to create version"
}
```

**Solution**: Check `MORAVIAN_DATABASE_URL` and database connectivity.

### **Logging and Debugging**

```typescript
// Enable debug logging
process.env.DEBUG = 'mcp:*';

// Check syslog for detailed information
tail -f /var/log/system.log | grep MCP
```

### **Performance Monitoring**

```sql
-- Check regulation update performance
SELECT 
  regulation_id,
  COUNT(*) as version_count,
  MAX(created_at) as last_update,
  AVG(EXTRACT(EPOCH FROM (created_at - LAG(created_at) OVER (PARTITION BY regulation_id ORDER BY created_at)))) as avg_update_interval
FROM regulation_versions 
WHERE source = 'mcp'
GROUP BY regulation_id
ORDER BY last_update DESC;

-- Check for failed validations
SELECT 
  regulation_id,
  level,
  COUNT(*) as failed_count
FROM validation_status 
WHERE status = 'failed'
GROUP BY regulation_id, level
ORDER BY failed_count DESC;
```

---

## ✅ **Best Practices**

### **For Remote Update Servers**

1. **Use Idempotent Updates**: Include `sourceId` to prevent duplicate processing
2. **Validate Before Sending**: Run local validation before pushing updates
3. **Handle Rate Limits**: Implement exponential backoff for API calls
4. **Monitor Responses**: Check HTTP status codes and response bodies
5. **Batch Updates**: Group multiple updates for better performance
6. **Use HTTPS**: Always use encrypted connections

### **For System Administration**

1. **Regular Monitoring**: Check sync status and conflict queues daily
2. **API Key Rotation**: Rotate API keys periodically for security
3. **Database Maintenance**: Monitor regulation_versions table size
4. **Conflict Resolution**: Address pending conflicts promptly
5. **Backup Strategy**: Include MCP tables in database backups
6. **Performance Tuning**: Monitor connection pools and query performance

### **For Content Management**

1. **Version Control**: Use meaningful source IDs for tracking
2. **Validation Levels**: Ensure all levels (A/B/C/D) pass before production
3. **Conflict Prevention**: Coordinate updates between systems
4. **Documentation**: Document all regulation change processes
5. **Testing**: Test updates in staging environment first
6. **Rollback Plans**: Have rollback procedures for failed updates

---

## 🎯 **Integration Checklist**

Before pushing updates to the Moravian tenant:

- [ ] **Environment Setup**: `MCP_API_KEY` and `MORAVIAN_DATABASE_URL` configured
- [ ] **Database Tables**: All MCP tables created and indexed
- [ ] **API Access**: Test authentication with health check endpoint
- [ ] **Validation**: Test payload validation with sample data
- [ ] **Monitoring**: Set up monitoring for sync status and conflicts
- [ ] **Error Handling**: Implement retry logic and error reporting
- [ ] **Documentation**: Document your update process and schedules
- [ ] **Backup**: Ensure database backup strategy includes MCP tables

---

## 📞 **Support & Resources**

### **API Reference**
- Base URL: `https://moravian.edsteward.ai/api/mcp/`
- Authentication: `X-MCP-API-Key` header required
- Rate Limit: 100 requests/minute (configurable)
- Content-Type: `application/json`

### **Database Access**
- Connection: `MORAVIAN_DATABASE_URL` environment variable
- Tables: `regulation_versions`, `validation_status`, `sync_control`, `notification_queue`, `version_conflicts`
- Indexes: Optimized for regulation_id and status queries

### **Monitoring**
- Health: `/api/health` endpoint
- Sync Status: `/api/mcp/sync-status` endpoint  
- Logs: System logs via syslog facility
- Metrics: Database performance queries provided

---

**The EdSteward remote update system is production-ready and fully prepared to receive regulation updates for the Moravian University tenant! 🚀**