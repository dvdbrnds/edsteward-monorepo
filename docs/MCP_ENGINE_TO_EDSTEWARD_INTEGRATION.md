# 🔗 MCP Engine → EdSteward Integration Guide

## Overview

This document explains how to coordinate your MCP Engine server with EdSteward's existing red/green regulation import system at `http://localhost:3000/regulations/updates`.

## 🎯 Integration Flow

```
MCP Engine → POST /api/regulation-updates → EdSteward Database → Red/Green UI
```

1. **MCP Engine** detects regulation changes
2. **MCP Engine** sends update to EdSteward API
3. **EdSteward** stores update as "pending" 
4. **EdSteward UI** shows red/green diff indicators
5. **Compliance Officers** approve/reject updates

## 🚀 API Endpoint

### Create Regulation Update

**Endpoint:** `POST http://localhost:3000/api/regulation-updates`

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "regulationId": 4661,
  "name": "TEACH Act 2024 Update",
  "originalContent": "Previous regulation text...",
  "updatedContent": "New regulation text with changes...",
  "status": "pending"
}
```

**Success Response (201):**
```json
{
  "success": true,
  "update": {
    "id": 123,
    "regulationId": 4661,
    "name": "TEACH Act 2024 Update",
    "status": "pending",
    "updateDate": "2024-01-15T10:30:00Z"
  },
  "message": "Regulation update 123 created and ready for review"
}
```

**Error Response (400):**
```json
{
  "error": "Invalid regulation update data",
  "details": [
    {
      "field": "regulationId",
      "message": "Required field missing"
    }
  ]
}
```

## 🔧 MCP Engine Integration Code

Here's exactly how your MCP Engine should send updates to EdSteward:

```javascript
/**
 * Send regulation update to EdSteward
 */
async function sendToEdSteward(regulationData) {
  const updatePayload = {
    regulationId: regulationData.id,
    name: `${regulationData.title} - Updated ${new Date().toLocaleDateString()}`,
    originalContent: regulationData.previousVersion,
    updatedContent: regulationData.currentVersion,
    status: "pending"
  };
  
  try {
    const response = await fetch('http://localhost:3000/api/regulation-updates', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updatePayload)
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log(`✅ Regulation update sent to EdSteward: ${result.update.id}`);
      
      // Send WebSocket notification (your existing code)
      broadcastRegulationUpdate({
        type: 'regulation_updated',
        regulationId: regulationData.id,
        version: regulationData.version,
        edstewardUpdateId: result.update.id, // Link to EdSteward update
        timestamp: new Date().toISOString()
      });
      
      return result.update;
    } else {
      console.error('❌ Failed to send to EdSteward:', result.error);
      return null;
    }
  } catch (error) {
    console.error('❌ EdSteward integration error:', error);
    return null;
  }
}
```

## 🎨 Red/Green UI System

Once your MCP Engine sends an update, EdSteward will:

1. **Calculate Diff Statistics:**
   - `addedPercentage`: % of content added (green)
   - `removedPercentage`: % of content removed (red)  
   - `changedPercentage`: % of total changes

2. **Display in UI:**
   - Green indicators for added content
   - Red indicators for removed content
   - Approve/Reject/Defer buttons

3. **Show at:** `http://localhost:3000/regulations/updates`

## 🧪 Testing the Integration

Run the test script to verify everything works:

```bash
node test-mcp-to-edsteward.js
```

This will:
- Send a sample regulation update
- Check it appears in the pending list
- Show you the exact URL to view it

## 📋 Required Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `regulationId` | number | ✅ | ID of existing regulation in EdSteward |
| `name` | string | ✅ | Human-readable name for the update |
| `originalContent` | string | ✅ | Previous version of regulation text |
| `updatedContent` | string | ✅ | New version of regulation text |
| `status` | string | ❌ | Defaults to "pending" |

## 🔄 Complete Workflow

### 1. MCP Engine Side
```javascript
// When regulation changes detected
const regulationUpdate = {
  regulationId: 4661,
  name: "TEACH Act - Emergency Update",
  originalContent: previousVersion,
  updatedContent: newVersion,
  status: "pending"
};

// Send to EdSteward
await sendToEdSteward(regulationUpdate);

// Send WebSocket notification (your existing code)
broadcastToClients({
  type: 'regulation_updated',
  regulationId: 'REG-66',
  message: 'Update sent to EdSteward for review'
});
```

### 2. EdSteward Side
- Receives update via API
- Stores in `regulation_updates` table
- Calculates red/green diff statistics
- Shows in UI at `/regulations/updates`

### 3. Compliance Officer
- Views update at `http://localhost:3000/regulations/updates`
- Sees red/green change indicators
- Clicks "View Changes" for detailed diff
- Approves, rejects, or defers the update

## 🚨 Error Handling

Your MCP Engine should handle these scenarios:

```javascript
async function sendToEdStewardWithRetry(updateData, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await sendToEdSteward(updateData);
      if (result) return result;
    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error);
      if (attempt === maxRetries) {
        // Log to your MCP Engine error system
        console.error('❌ Failed to send to EdSteward after all retries');
        return null;
      }
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}
```

## 🎉 Success Indicators

When integration is working correctly:

1. **MCP Engine Console:** Shows successful API calls
2. **EdSteward Console:** Shows "📋 MCP Engine regulation update received"
3. **EdSteward UI:** Shows new updates at `/regulations/updates`
4. **WebSocket Status:** Shows "MCP Engine Connected" badge

## 🔗 Related Files

- **API Implementation:** `server/regulation-updates-api.ts`
- **Database Schema:** `shared/schema.ts` (regulationUpdates table)
- **UI Component:** `client/src/pages/updates-list-page.tsx`
- **Test Script:** `test-mcp-to-edsteward.js`

---

**🎯 Result:** Your MCP Engine regulation updates will appear in EdSteward's red/green import system, ready for compliance officer review and approval!
