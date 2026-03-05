# MCP Engine - Unified Startup System

## Overview

The MCP Engine now features a **consolidated startup system** that orchestrates all components seamlessly. No more juggling multiple scripts or dealing with port conflicts!

## 🚀 Quick Start

### Start Everything
```bash
npm start
# or
npm run start:all
# or
node mcp-start.js
```

### Stop Everything
```bash
npm stop
# or
npm run stop:all
# or
node mcp-stop.js
```

## 📋 What Gets Started

The unified startup script automatically starts all MCP Engine components in the correct order:

1. **Registry API Server** (Port 3010)
   - Manages regulation data and metadata
   - Health check: `http://localhost:3010/health`

2. **LLM Gateway** (Port 3002)  
   - AI-powered compliance processing
   - Health check: `http://localhost:3002/api/llm/health`

3. **Frontend Development Server** (Port 3050)
   - React-based user interface
   - Available at: `http://localhost:3050`

## ✨ Features

### 🔧 **Automatic Setup**
- **Dependency Installation**: Automatically checks and installs missing dependencies
- **Port Conflict Resolution**: Kills conflicting processes on required ports
- **Health Monitoring**: Verifies each service is healthy before proceeding

### 📊 **Real-time Status**
- **Timestamped Logging**: Each log entry includes service name and timestamp
- **Health Checks**: Automatic verification that services are responding
- **Process Monitoring**: Tracks all running processes and their PIDs

### 🛡️ **Error Handling**
- **Graceful Shutdown**: Proper cleanup when stopping services
- **Failure Recovery**: Automatic restart attempts for failed services
- **Signal Handling**: Responds to SIGINT (Ctrl+C) and SIGTERM

### 🔄 **Process Management**
- **Process Tracking**: Maintains registry of all running processes
- **Automatic Cleanup**: Kills orphaned processes from previous runs
- **Resource Management**: Ensures clean port usage

## 🎯 Available Commands

### Primary Commands
```bash
npm start          # Start all services
npm stop           # Stop all services
npm run dev        # Same as start (development mode)
```

### Individual Component Commands
```bash
npm run start:registry   # Start only Registry API
npm run start:llm        # Start only LLM Gateway  
npm run start:frontend   # Start only Frontend
npm run dev:client       # Start only Frontend (Vite dev mode)
```

### Legacy Commands (Still Available)
```bash
npm run start:app        # Legacy app server
npm run start:admin      # Admin interface
npm run start:mock       # Mock server for testing
```

## 🔍 Monitoring & Logs

### Real-time Status Display
The startup script provides detailed status information:

```
🚀 MCP Engine - Starting All Services

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Model Context Protocol Engine - Enterprise Compliance Platform
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[10:47:25 AM] [MAIN] Cleaning up existing processes...
[10:47:25 AM] [MAIN] Releasing required ports...
[10:47:26 AM] [MAIN] Checking dependencies...
[10:47:26 AM] [MAIN] Dependencies already installed for root project
[10:47:26 AM] [MAIN] Starting services...

[10:47:26 AM] [REGISTRY] Starting Registry API Server...
[10:47:26 AM] [REGISTRY] Registry Server PID: 12345
[10:47:27 AM] [REGISTRY] ✅ Registry API is healthy!

[10:47:28 AM] [LLM] Starting LLM Gateway...
[10:47:28 AM] [LLM] LLM Gateway PID: 12346
[10:47:29 AM] [LLM] ✅ LLM Gateway available at http://localhost:3002

[10:47:30 AM] [FRONTEND] Starting Frontend Development Server...
[10:47:30 AM] [FRONTEND] Frontend Server PID: 12347
[10:47:33 AM] [FRONTEND] ✅ Frontend available at http://localhost:3050

🎉 MCP Engine Successfully Started!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Registry API:     http://localhost:3010
🤖 LLM Gateway:      http://localhost:3002
🌐 Frontend:         http://localhost:3050
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✨ All services are ready for compliance management!
📝 Press Ctrl+C to gracefully stop all services
```

### Log Format
- **Timestamp**: `[10:47:25 AM]`
- **Service**: `[REGISTRY]`, `[LLM]`, `[FRONTEND]`, `[MAIN]`
- **Status Icons**: ✅ Success, ⚠️ Warning, ❌ Error

## 🛠️ Troubleshooting

### Common Issues

#### Port Already in Use
The script automatically handles port conflicts, but if you encounter issues:
```bash
npm stop          # Stop all services
npm start         # Restart clean
```

#### Service Won't Start
Check the logs for specific error messages. Common fixes:
```bash
# Clear node_modules and reinstall
rm -rf node_modules src/client/node_modules
npm install
cd src/client && npm install
```

#### Health Check Failures
If health checks fail:
1. Check if the service process is actually running
2. Verify the port is accessible
3. Check firewall settings
4. Review service-specific logs

### Manual Process Management
If you need to manually manage processes:

```bash
# Find processes using MCP Engine ports
lsof -i :3010   # Registry
lsof -i :3002   # LLM Gateway  
lsof -i :3050   # Frontend

# Kill specific processes
kill -TERM <PID>   # Graceful shutdown
kill -9 <PID>      # Force kill
```

## 🔧 Configuration

### Port Configuration
Edit `mcp-start.js` to change default ports:
```javascript
const CONFIG = {
  ports: {
    registry: 3010,     // Registry API
    llmGateway: 3002,   // LLM Gateway
    frontend: 3050      // Frontend
  }
};
```

### Health Check Settings
Adjust health check behavior:
```javascript
healthCheck: {
  maxRetries: 15,      // Number of retry attempts
  retryDelay: 1000,    // Delay between retries (ms)
  timeout: 30000       // Overall timeout (ms)
}
```

## 📝 Migration from Old Scripts

### Old Way
```bash
# Multiple commands needed
node start-all.js
npm run dev:client
node src/llm-gateway/start-llm-gateway.js
```

### New Way
```bash
# Single command
npm start
```

### Breaking Changes
- `npm run dev` now starts all services (not just LLM Gateway)
- Individual service scripts still work but use new unified logging
- Old `start-all.js` is deprecated in favor of `mcp-start.js`

## 🎯 Development Workflow

### Recommended Development Flow
1. **Start Everything**: `npm start`
2. **Open Frontend**: Browser automatically opens to `http://localhost:3050`
3. **Make Changes**: Edit code, services auto-reload
4. **Stop Everything**: `Ctrl+C` or `npm stop`

### Frontend Development
For frontend-only development:
```bash
npm run dev:client   # Start only Vite dev server
```

### API Development  
For backend-only development:
```bash
npm run start:registry   # Registry API only
npm run start:llm        # LLM Gateway only
```

## 🏗️ Architecture Benefits

### Before: Multiple Scripts
- ❌ Port conflicts
- ❌ Manual dependency management
- ❌ No health checks
- ❌ Inconsistent logging
- ❌ Manual process tracking

### After: Unified System
- ✅ Automatic port management
- ✅ Dependency verification
- ✅ Health monitoring  
- ✅ Structured logging
- ✅ Process orchestration
- ✅ Graceful shutdown
- ✅ Error recovery

The new unified startup system makes MCP Engine development faster, more reliable, and easier to manage! 