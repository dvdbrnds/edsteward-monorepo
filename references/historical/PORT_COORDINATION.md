# 🔌 EdSteward System - Port Coordination Guide

## **CURRENT PORT ALLOCATION (ACTIVE)**

### **EdSteward Application Ports**
- **Port 3000** (TCP) - EdSteward Main Application
  - **Purpose**: HTTP/HTTPS server, REST API, WebSocket connections
  - **Protocol**: HTTP + WebSocket
  - **Binding**: `0.0.0.0:3000` (external access enabled)
  - **Health Check**: `GET /api/health`
  - **Status**: ✅ **ACTIVE**

### **MCP Engine Integration Ports**
- **Port 3003** (TCP/WebSocket) - MCP Engine Integration Endpoint
  - **Purpose**: Real-time regulation updates, change notifications
  - **Protocol**: HTTP + WebSocket
  - **Endpoints**: `/regulation-updates`, `/api/simulate-change/*`
  - **URL**: `ws://localhost:3003/regulation-updates`
  - **Status**: ✅ **ACTIVE INTEGRATION**

### **Database & Cache Ports**
- **Port 5432** (TCP) - PostgreSQL Database
  - **Purpose**: User data, regulations, compliance tracking
  - **Protocol**: PostgreSQL with SSL (`sslmode=require`)
  - **Host**: `ep-weathered-term-a5rmi9cx-pooler.us-east-2.aws.neon.tech`
  - **Schema**: Default schema (shared database)
  - **Status**: ✅ **ACTIVE**

- **Port 6379** (TCP) - Redis Cache
  - **Purpose**: Session management, caching
  - **Protocol**: Redis
  - **Prefixes**: `session:*`, `cache:*` (shared Redis instance)
  - **Status**: ✅ **ACTIVE**

---

## **RESERVED PORTS (MCP ENGINE - DO NOT USE)**

### **MCP Engine Core Services**
- **Port 3002** - MCP Engine LLM Gateway
- **Port 3010** - MCP Engine Registry API  
- **Port 3050** - MCP Engine Frontend
- **Port 3051** - MCP Engine Delivery System
- **Port 3052** - MCP Engine TUF Repository ⚠️
- **Port 3099** - MCP Engine System Monitor
- **Port 3200-3330+** - MCP Engine Dynamic Regulation Servers

### **TUF (The Update Framework) Services**
- **Port 3052** (TCP) - TUF Repository HTTP Server
  - **Purpose**: Cryptographically secure regulation metadata
  - **Protocol**: HTTP
  - **Endpoints**: `/metadata/root.json`, `/targets/*`
  - **Status**: 🚫 **RESERVED FOR MCP ENGINE**

- **Port 3053** (WebSocket) - TUF WebSocket Notifications  
  - **Purpose**: Real-time TUF update notifications
  - **Protocol**: WebSocket
  - **Status**: 🚫 **RESERVED FOR MCP ENGINE**

---

## **INTEGRATION CONFIGURATION**

### **Environment Variables**
```bash
# EdSteward Configuration
PORT=3000
HOSTNAME=0.0.0.0

# MCP Engine Integration (ACTIVE)
MCP_ENGINE_URL=http://localhost:3003
VITE_MCP_WS_URL=ws://localhost:3003/regulation-updates

# TUF Integration (RESERVED - MCP ENGINE MANAGED)
MCP_ENGINE_TUF_URL=http://localhost:3052
TUF_WEBSOCKET_URL=ws://localhost:3053

# Database (SHARED)
DATABASE_URL=postgresql://user:pass@host:5432/neondb?sslmode=require

# Redis (SHARED WITH PREFIXES)
REDIS_URL=redis://host:6379
```

### **WebSocket Connections**
```javascript
// Active MCP Engine Integration
const ws = new WebSocket('ws://localhost:3003/regulation-updates');

// EdSteward Internal WebSocket
const internalWs = new WebSocket('ws://localhost:3000/ws');
```

---

## **SECURITY & FIREWALL RULES**

### **Inbound (EdSteward Server)**
- ✅ **Allow**: Port 3000 (TCP) - Main application
- ✅ **Allow**: Port 22 (SSH) - Management (if applicable)

### **Outbound (EdSteward Server)**
- ✅ **Allow**: Port 3003 (TCP/WebSocket) - MCP Engine integration
- 🚫 **Block**: Port 3052-3053 (TCP/WebSocket) - Reserved for MCP Engine
- ✅ **Allow**: Port 5432 (TCP) - PostgreSQL database
- ✅ **Allow**: Port 6379 (TCP) - Redis cache
- ✅ **Allow**: Port 443 (HTTPS) - AWS services
- ✅ **Allow**: Port 53 (DNS) - Name resolution

---

## **CIRCUIT BREAKER STATUS**

### **TUF Service Circuit Breaker**
- **Status**: 🔴 **OPEN** (Disabled due to MCP Engine unavailability)
- **Failure Threshold**: 5 consecutive failures
- **Cooldown Period**: 5 minutes
- **Current State**: Automatically disabled when MCP Engine TUF ports unavailable
- **Recovery**: Will attempt reconnection when MCP Engine TUF services become available

### **MCP Engine Integration**
- **Status**: 🟡 **CONFIGURED** (Ready for MCP Engine on port 3003)
- **Fallback**: EdSteward operates independently without MCP Engine
- **Resilience**: Non-blocking integration - server starts without MCP Engine

---

## **DEPLOYMENT CONSIDERATIONS**

### **Load Balancer Configuration**
```yaml
# AWS Application Load Balancer
Frontend: 
  - Port 80/443 (HTTP/HTTPS)
Backend:
  - Port 3000 (EdSteward containers)
Health Check:
  - Path: /api/health
  - Port: 3000
Session Stickiness: 
  - REQUIRED: lb_cookie, 24h duration
```

### **Docker Port Mappings**
```yaml
# Production Docker Compose
services:
  edsteward:
    ports: ["3000:3000"]
  postgres:
    ports: ["5432:5432"] 
  redis:
    ports: ["6379:6379"]
```

---

## **CRITICAL NOTES**

1. **🚨 Port Conflicts**: Never use ports 3002, 3010, 3050-3053, 3099, 3200+ (MCP Engine reserved)
2. **🔄 MCP Integration**: Port 3003 is the **ONLY** active MCP Engine integration point
3. **🛡️ TUF Services**: Ports 3052-3053 are **RESERVED** for MCP Engine TUF Repository
4. **📊 Shared Resources**: Database (default schema) and Redis (prefixed keys) are shared
5. **🔒 Session Stickiness**: **REQUIRED** for authentication to work with load balancers
6. **⚡ Circuit Breaker**: Automatically prevents TUF connection spam when MCP Engine unavailable

---

## **TROUBLESHOOTING**

### **Common Port Issues**
- **EADDRINUSE on 3000**: Kill existing EdSteward processes with `lsof -ti:3000 | xargs kill -9`
- **TUF Connection Errors**: Expected when MCP Engine not running - circuit breaker will handle
- **MCP Engine Integration**: Check port 3003 availability for regulation updates
- **Database Connection**: Verify port 5432 SSL connection to Neon PostgreSQL
- **Redis Connection**: Confirm port 6379 access with proper prefixes

### **Health Checks**
```bash
# EdSteward Health
curl http://localhost:3000/api/health

# MCP Engine Integration (when available)
curl http://localhost:3003/api/health

# Database Connection
curl http://localhost:3000/api/auth/status
```

---

**Last Updated**: September 1, 2025  
**Version**: 2.0 - MCP Engine Port Coordination
