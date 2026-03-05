# GMM - Good Morning MCP 🌅

**Safe shutdown and restart script for MCP Engine system**

Perfect for daily morning startup when systems don't run overnight.

## 🚀 Quick Start

### Option 1: Direct Usage
```bash
./gmm.sh
```

### Option 2: Setup Alias (Recommended)
```bash
./setup-gmm-alias.sh    # Run once to setup
gmm                     # Use daily
```

## 📋 What GMM Does

### 🛑 Phase 1: Safe Shutdown
- Gracefully terminates all MCP-related processes
- Kills `mcp-start.js`, registry-api, delivery-server, and Vite processes
- Uses SIGTERM first, then SIGKILL if needed

### 🔓 Phase 2: Port Cleanup
- Frees up required ports: 3010, 3002, 3051, 3050
- Ensures no port conflicts during restart
- Verifies each port is completely free

### ⏳ Phase 3: Cleanup Wait
- Allows system processes to fully terminate
- Prevents race conditions during restart

### 🚀 Phase 4: System Restart
- Launches `npm start` in background
- Starts all MCP Engine services automatically

### 🏥 Phase 5: Health Verification
- Checks Registry API health (15 retry attempts)
- Verifies Delivery System health
- Confirms Frontend and LLM Gateway availability
- Reports final system status

## 🎯 System Services Started

After GMM completes, these services will be running:

| Service | Port | URL | Status Check |
|---------|------|-----|--------------|
| **Registry API** | 3010 | http://localhost:3010 | ✅ Health endpoint |
| **LLM Gateway** | 3002 | http://localhost:3002 | ✅ Response check |
| **Delivery System** | 3051 | http://localhost:3051 | ✅ Health endpoint |
| **Frontend** | 3050 | http://localhost:3050 | ✅ Response check |

## 🔗 Quick Access Links

After GMM startup:
- **REG-66 Console**: http://localhost:3050/reg-66-advanced-console.html
- **Registry API**: http://localhost:3010/health
- **Delivery System**: http://localhost:3051/health

## 🛠️ Technical Details

### Requirements
- **Shell**: zsh (macOS compatible)
- **Node.js**: v24.6.0+ 
- **Dependencies**: lsof, curl, ps, kill
- **Directory**: Must run from MCP Engine project root

### Process Management
- Uses `lsof` to identify processes on specific ports
- Implements graceful shutdown with SIGTERM → SIGKILL escalation
- Background process management for npm start
- PID tracking and reporting

### Error Handling
- Comprehensive error checking at each phase
- Graceful handling of missing processes/ports
- Retry logic for service health checks
- Clear error messages with colored output

## 🎨 Output Features

- **Colored Output**: Blue info, Green success, Yellow warnings, Red errors
- **Progress Phases**: Clear 5-phase startup process
- **Health Monitoring**: Real-time service availability checks
- **Final Status**: Complete system overview with URLs

## 🔧 Troubleshooting

### Common Issues

**"Not in MCP Engine directory"**
- Ensure you're in the project root with `package.json` and `mcp-start.js`

**"Failed to free port"**
- Some processes may require manual termination
- Check with: `lsof -ti:PORT` and `kill -9 PID`

**"Service failed to become healthy"**
- Check system logs in the npm start output
- Verify dependencies are installed: `npm install`

### Manual Cleanup
If GMM fails, you can manually clean up:
```bash
pkill -f "node.*mcp-start.js"
lsof -ti:3010,3002,3051,3050 | xargs kill -9
```

## 📝 Daily Usage

**Perfect Morning Routine:**
1. Open terminal in MCP Engine directory
2. Run `gmm` (if alias is setup) or `./gmm.sh`
3. Wait for "GMM startup complete!" message
4. System is ready for your work session!

**End of Day:**
- Use Ctrl+C in the npm start terminal to stop services
- Or run `pkill -f "node.*mcp-start.js"` to stop everything

## 🎉 Success Indicators

When GMM completes successfully, you'll see:
- ✅ All ports freed and services healthy
- 🎉 "MCP Engine Successfully Started!" banner
- 📊 Service URLs displayed
- 🔗 Direct link to REG-66 console
- 📝 npm start process PID for reference

**GMM makes your daily MCP Engine startup effortless and reliable!** 🚀
