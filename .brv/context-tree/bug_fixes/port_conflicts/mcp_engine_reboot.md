SUCCESSFUL MCP ENGINE REBOOT PROCEDURE

**Problem**: After power loss, MCP Engine services had port conflicts and multiple duplicate processes running, causing EADDRINUSE errors on port 3051 and other services failing to start properly.

**Root Cause**: Multiple `npm start` processes and old Vite instances were still running, creating port conflicts when trying to restart services.

**Solution Process**:
1. **Check First**: Always run `lsof -i :3002 -i :3010 -i :3050 -i :3051` to see what's actually using the ports
2. **Identify Processes**: Use `ps aux | grep -E "node.*mcp|node.*registry|node.*delivery|node.*llm|node.*vite"` to find all MCP Engine processes
3. **Clean Selective Kill**: Kill only conflicting processes by PID, not blanket `pkill -f node`
4. **Proper Startup**: Use `npm start` first, then manually start missing services if needed

**Working Commands**:
```bash
# Check what's running first
lsof -i :3002 -i :3010 -i :3050 -i :3051

# Identify specific processes
ps aux | grep -E "node.*mcp|node.*registry|node.*delivery|node.*llm|node.*vite" | grep -v grep

# Kill specific PIDs (not blanket kill)
kill -9 [specific_pids]

# Start properly
npm start

# Start missing services individually if needed
node src/delivery-system/delivery-server.js &
npm run dev &
```

**Final Status**: All services operational - LLM Gateway (3002), Registry API (3010), Delivery System (3051), Frontend (3050). EdSteward integration working, WebSocket connections established.