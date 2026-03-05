# 🚀 MCP Engine Integration Guide

## Overview

EdSteward has been reconfigured to consume regulation updates from your **MCP Engine Real-Time Regulation Delivery System**. This integration enables real-time regulation updates from authoritative sources directly into EdSteward's interface.

## 🏗️ Integration Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   MCP Engine    │───▶│   EdSteward     │───▶│   Frontend UI   │
│   Port 3003     │    │   Port 3000     │    │   Real-time     │
│                 │    │                 │    │   Updates       │
│ • Change Data   │    │ • WebSocket     │    │ • Toast Alerts  │
│   Capture (CDC) │    │   Client        │    │ • Query Refresh │
│ • Event Store   │    │ • Message       │    │ • UI Updates    │
│ • WebSocket     │    │   Handler       │    │                 │
│   Server        │    │ • DB Updates    │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## ⚙️ Configuration

### Environment Variables

**EdSteward (.env)**:
```bash
# MCP Engine Integration
VITE_MCP_WS_URL=ws://localhost:3003/regulation-updates
```

### WebSocket Protocol

**Connection URL**: `ws://localhost:3003/regulation-updates`

**Client → Server Messages**:
```json
// Subscribe to regulations
{
  "type": "subscribe",
  "regulationIds": ["REG-66", "REG-42"]
}

// Unsubscribe
{
  "type": "unsubscribe", 
  "regulationIds": ["REG-66"]
}

// Keep-alive
{
  "type": "ping"
}
```

**Server → Client Messages**:
```json
// Connection confirmed
{
  "type": "connected",
  "clientId": "abc123",
  "timestamp": "2025-01-29T19:00:00.000Z"
}

// Regulation updated
{
  "type": "regulation_updated",
  "regulationId": "REG-66",
  "version": 2,
  "timestamp": "2025-01-29T19:00:00.000Z",
  "data": {
    "changeType": "content_update",
    "summary": { ... }
  }
}

// Subscription confirmed
{
  "type": "subscription_confirmed",
  "regulationIds": ["REG-66"],
  "timestamp": "2025-01-29T19:00:00.000Z"
}
```

## 🔧 Implementation Details

### WebSocket Hook Updates

The `useWebSocket` hook in EdSteward has been enhanced to:

1. **Dual Protocol Support**: Handles both MCP Engine and legacy formats
2. **Authentication Bypass**: No authentication required for MCP Engine connections
3. **Auto-Subscription**: Automatically subscribes to REG-66 on connection
4. **Message Translation**: Converts MCP Engine messages to EdSteward format

### Message Handling

```typescript
// MCP Engine format → EdSteward processing
case 'regulation_updated': {
  const mcpEvent = message as MCPRegulationUpdateEvent;
  // Invalidate regulations queries to trigger refetch
  queryClient.invalidateQueries({ queryKey: ['regulations'] });
  
  toast({
    title: "Regulation Updated",
    description: `Regulation ${mcpEvent.regulationId} has been updated to version ${mcpEvent.version}`,
  });
  break;
}
```

## 🚦 Quick Start

### 1. Start MCP Engine
```bash
cd /path/to/mcp-engine
npm install
npm start
# Should be running on http://localhost:3003
```

### 2. Start EdSteward
```bash
cd /path/to/edsteward
npm run dev
# Should be running on http://localhost:3000
```

### 3. Verify Integration
```bash
# Run the integration test
node test-mcp-integration.js
```

### 4. Test Real-Time Updates
```bash
# Simulate a regulation update
curl -X POST http://localhost:3003/api/simulate-change/REG-66 \
  -H "Content-Type: application/json" \
  -d '{"changeType": "content_update"}'
```

## 🔍 Monitoring & Debugging

### Browser Console

When EdSteward connects to MCP Engine, you should see:
```
Connected to MCP Engine with client ID: abc123
Subscribed to regulations: ["REG-66"]
```

### WebSocket Connection Status

The `useWebSocket` hook provides connection state:
- `isConnected`: Boolean indicating active connection
- `useMCPEngine`: Boolean indicating MCP Engine mode
- `clientId`: MCP Engine assigned client ID
- `subscribedRegulations`: Array of subscribed regulation IDs

### Health Checks

**MCP Engine Health**:
```bash
curl http://localhost:3003/health
```

**EdSteward Health**:
```bash
curl http://localhost:3000/api/health
```

## 🎯 Supported Regulations

Currently configured for:
- **REG-66**: Primary regulation for testing
- **Expandable**: Add more regulations to subscription list

To subscribe to additional regulations:
```typescript
const { subscribeToRegulations } = useWebSocket();
subscribeToRegulations(['REG-42', 'REG-100']);
```

## 🚨 Troubleshooting

### Connection Issues

1. **MCP Engine not running**:
   - Start MCP Engine: `npm start` in MCP Engine directory
   - Verify: `curl http://localhost:3003/health`

2. **WebSocket connection fails**:
   - Check browser console for errors
   - Verify `VITE_MCP_WS_URL` in environment
   - Test with: `wscat -c ws://localhost:3003/regulation-updates`

3. **No updates received**:
   - Check MCP Engine CDC is active
   - Verify regulation subscription
   - Test with simulation endpoint

### Fallback Mode

If MCP Engine is unavailable, EdSteward automatically falls back to:
- Internal WebSocket server
- Legacy message format
- Authentication required

## 🔄 Migration Notes

### From Internal WebSocket

The integration maintains backward compatibility:
- Legacy `reg_version_advanced` messages still supported
- Authentication still works for internal connections
- Graceful fallback when MCP Engine unavailable

### Message Format Evolution

```typescript
// Old format (still supported)
{
  type: 'reg_version_advanced',
  reg_id: 'REG-66',
  version: 2
}

// New MCP Engine format (preferred)
{
  type: 'regulation_updated',
  regulationId: 'REG-66',
  version: 2,
  data: { changeType: 'content_update' }
}
```

## 📊 Performance Considerations

- **Real-time Updates**: No polling required
- **Efficient Queries**: Only invalidates affected regulation queries
- **Connection Management**: Auto-reconnection with exponential backoff
- **Memory Usage**: Minimal overhead for WebSocket connection

## 🎉 Success Indicators

Integration is working correctly when:

✅ **MCP Engine Health**: Returns healthy status  
✅ **WebSocket Connection**: Successfully connects without authentication  
✅ **Auto-Subscription**: Subscribes to REG-66 automatically  
✅ **Message Handling**: Processes `regulation_updated` events  
✅ **UI Updates**: Shows toast notifications for regulation changes  
✅ **Query Invalidation**: Triggers data refresh in EdSteward interface  

---

## 🚀 Next Steps

1. **Production Deployment**: Configure MCP Engine for production environment
2. **Regulation Expansion**: Add more regulations to monitoring system
3. **Authentication**: Add security layer for production deployments
4. **Monitoring**: Implement comprehensive logging and alerting
5. **Scaling**: Configure load balancing for multiple EdSteward instances

The integration is now complete and ready for real-time regulation delivery!




