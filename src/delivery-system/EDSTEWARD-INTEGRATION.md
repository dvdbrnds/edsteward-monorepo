# 🔗 **MCP Engine ↔ EdSteward Integration Guide**

## **Overview**

The MCP Engine now automatically sends regulation updates to your EdSteward system via HTTP API calls. When a regulation changes, the MCP Engine will:

1. **Detect the change** via Change Data Capture (CDC)
2. **Process the update** through the Event Sourcing system  
3. **Notify WebSocket clients** in real-time
4. **Send HTTP update** to EdSteward's API endpoint

## **🎯 Integration Architecture**

```
MCP Engine (localhost:3002)
    ↓ regulation changes
Delivery System (localhost:3003)
    ↓ HTTP POST /api/regulation-updates
EdSteward (localhost:3000)
    ↓ creates regulation update
EdSteward Database
```

## **📋 Regulation ID Mapping**

| **MCP Engine ID** | **EdSteward ID** | **Description** |
|-------------------|------------------|-----------------|
| `REG-66` | `4661` | TEACH Act 2024 |
| `REG-17` | `4662` | Copyright Act Amendment |
| `REG-DMCA` | `4663` | DMCA Safe Harbor Update |

## **🚀 Setup Instructions**

### **1. EdSteward API Endpoint**

Ensure your EdSteward server has this endpoint:

```javascript
// POST /api/regulation-updates
app.post('/api/regulation-updates', async (req, res) => {
  const {
    regulationId,      // EdSteward regulation ID (e.g., 4661)
    name,              // Human-readable name
    originalContent,   // Previous content
    updatedContent,    // New content  
    status,            // "pending"
    metadata           // MCP Engine metadata
  } = req.body;

  // Create regulation update in EdSteward
  const update = await RegulationUpdate.create({
    regulationId,
    name,
    originalContent,
    updatedContent,
    status,
    metadata
  });

  res.json({
    success: true,
    update: {
      id: update.id,
      regulationId: update.regulationId,
      status: update.status
    }
  });
});
```

### **2. Environment Configuration**

Set these environment variables for the MCP Engine:

```bash
# EdSteward connection
export EDSTEWARD_URL="http://localhost:3000"
export EDSTEWARD_API_KEY="your-api-key-here"  # Optional
```

### **3. Start Systems**

```bash
# Terminal 1: Start MCP Engine
cd /workspaces/MCP-Engine
npm start

# Terminal 2: Start Delivery System  
cd /workspaces/MCP-Engine/src/delivery-system
npm start

# Terminal 3: Start EdSteward
cd /path/to/edsteward
npm start
```

## **🧪 Testing the Integration**

### **Test 1: Connection Status**
```bash
curl http://localhost:3003/api/edsteward/status
```

**Expected Response:**
```json
{
  "connected": true,
  "edstewardUrl": "http://localhost:3000", 
  "mappings": {
    "REG-66": 4661,
    "REG-17": 4662,
    "REG-DMCA": 4663
  },
  "timestamp": "2025-08-18T15:03:38.213Z"
}
```

### **Test 2: Manual Update**
```bash
curl -X POST http://localhost:3003/api/edsteward/test-update \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "success": true,
  "testUpdate": {
    "regulationId": "REG-66",
    "version": "TEST",
    "data": {
      "changeType": "MANUAL_TEST",
      "before": { "content": "Previous TEACH Act content..." },
      "after": {
        "content": "Updated TEACH Act content with new requirements...",
        "impact": "high",
        "message": "Manual test update from MCP Engine"
      }
    }
  },
  "result": {
    "success": true,
    "updateId": "12345"
  }
}
```

### **Test 3: Live Regulation Update**
```bash
curl -X POST http://localhost:3003/api/simulate-change/REG-66 \
  -H "Content-Type: application/json" \
  -d '{"changeType":"CONTENT_UPDATE","mockData":{"impact":"high","message":"New TEACH Act requirements"}}'
```

This will:
1. ✅ Trigger a regulation change in MCP Engine
2. ✅ Send WebSocket notifications to connected clients
3. ✅ Automatically send HTTP update to EdSteward
4. ✅ Create a new regulation update in EdSteward

## **📤 Update Payload Format**

When MCP Engine sends updates to EdSteward, the payload looks like:

```javascript
{
  "regulationId": 4661,  // EdSteward regulation ID
  "name": "TEACH Act 2024 Update",
  "originalContent": "Previous regulation text...",
  "updatedContent": "New regulation text with changes...",
  "status": "pending",
  "metadata": {
    "mcpRegulationId": "REG-66",
    "mcpVersion": "v1.2",
    "changeType": "CONTENT_UPDATE", 
    "impact": "high",
    "timestamp": "2025-08-18T15:03:42.892Z",
    "contentHash": "sha256_1755529422892"
  }
}
```

## **🔄 Automatic Integration Flow**

1. **Regulation Changes** in MCP Engine (via CDC monitoring)
2. **Event Stored** in Event Sourcing system
3. **WebSocket Clients Notified** in real-time
4. **HTTP Request Sent** to EdSteward automatically
5. **Regulation Update Created** in EdSteward database
6. **Compliance Officers Notified** in EdSteward UI

## **⚙️ Configuration Options**

### **Custom Regulation Mapping**
```javascript
// Add new regulation mappings
const integration = new EdStewardIntegration();
integration.addRegulationMapping('REG-CUSTOM', 9999);
```

### **Retry Configuration**
```javascript
const integration = new EdStewardIntegration({
  retryAttempts: 5,     // Number of retry attempts
  retryDelay: 2000,     // Delay between retries (ms)
  timeout: 15000        // Request timeout (ms)
});
```

### **Authentication**
```javascript
const integration = new EdStewardIntegration({
  apiKey: 'your-bearer-token',  // Adds Authorization header
  edstewardUrl: 'https://your-edsteward-domain.com'
});
```

## **📊 Monitoring & Logs**

### **MCP Engine Logs**
```
📤 Sending update to EdSteward for REG-66 -> 4661
✅ EdSteward update successful: 12345
   Regulation: 4661 (TEACH Act 2024 Update)
   Status: pending
```

### **Error Handling**
```
❌ EdSteward update failed (attempt 1): HTTP 500: Internal Server Error
🔄 Retrying in 1000ms...
❌ EdSteward notification failed: Connection timeout
```

## **🚨 Troubleshooting**

### **Connection Refused**
- ✅ Ensure EdSteward is running on localhost:3000
- ✅ Check firewall settings
- ✅ Verify EdSteward health endpoint: `curl http://localhost:3000/api/health`

### **404 Not Found**
- ✅ Ensure `/api/regulation-updates` endpoint exists in EdSteward
- ✅ Check EdSteward routing configuration

### **Authentication Errors**
- ✅ Set `EDSTEWARD_API_KEY` environment variable
- ✅ Verify API key format and permissions

### **Regulation Not Found**
- ✅ Check regulation ID mapping in `edsteward-integration.js`
- ✅ Ensure EdSteward regulation ID exists in database

## **🎯 Success Indicators**

When integration is working correctly, you'll see:

1. **MCP Engine Console**: `📤 EdSteward notified: Update ID 12345`
2. **EdSteward Database**: New regulation update record created
3. **EdSteward UI**: Compliance officers see new pending updates
4. **WebSocket Clients**: Real-time notifications received
5. **API Response**: `{"success": true, "updateId": "12345"}`

## **🔧 Advanced Configuration**

### **Custom Update Processing**
```javascript
// Override update payload format
integration.formatUpdatePayload = (mcpUpdate) => {
  return {
    regulation_id: mapping[mcpUpdate.regulationId],
    title: `${mcpUpdate.regulationId} Update`,
    content_before: mcpUpdate.data.before.content,
    content_after: mcpUpdate.data.after.content,
    priority: mcpUpdate.data.after.impact,
    source: 'MCP_ENGINE'
  };
};
```

### **Webhook Fallback**
```javascript
// Add webhook URL for reliable delivery
const integration = new EdStewardIntegration({
  webhookUrl: 'https://your-edsteward.com/webhooks/mcp-updates',
  fallbackToWebhook: true
});
```

---

## **✅ Integration Complete!**

Your MCP Engine now automatically pushes regulation updates to EdSteward in real-time. Compliance officers will receive immediate notifications when regulations change, ensuring your institution stays compliant with the latest requirements.

**Support**: Check logs in both systems for detailed error messages and integration status.
