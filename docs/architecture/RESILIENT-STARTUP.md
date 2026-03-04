# MCP Engine - 24/7 Resilient Startup

## 🚀 Quick Start

The MCP Engine now runs with automatic crash recovery for 24/7 operation:

```bash
npm start
```

This will start the resilient system that automatically restarts if any service crashes.

## 🛡️ Why It Won't Crash Anymore

### **Previous Issue:**
- Registry API server would crash (exit code null)
- When Registry crashed → entire system shut down
- No automatic recovery mechanism

### **New Solution:**
- **Automatic Restart**: If any service crashes, the system restarts automatically
- **Up to 50 restarts**: Handles temporary issues and keeps running
- **3-second delay**: Between restarts to prevent rapid cycling
- **Graceful shutdown**: Ctrl+C still works for manual shutdown

## 📋 Available Commands

```bash
# Start resilient system (default)
npm start

# Start original system (no auto-restart)
npm run start:original

# Monitor system health (separate terminal)
npm run monitor

# Stop all services
npm run stop
```

## 🔍 Monitoring

The system includes built-in monitoring:

- **Health Checks**: Monitors ports 3010, 3002, 3050
- **Auto Recovery**: Restarts if services become unhealthy
- **Status Logging**: Shows restart attempts and system health

### Run External Monitor (Optional):
```bash
npm run monitor
```

This runs a separate process that monitors and can restart the main system if needed.

## 📊 System Status

When running, you'll see:
- ✅ Service startup confirmations
- 🔄 Restart attempts (if needed)
- 📊 Statistics on shutdown

## 🛑 Graceful Shutdown

To stop the system:
```bash
# Press Ctrl+C in the terminal running the system
# OR
npm run stop
```

## 🔧 Configuration

Edit `start-resilient.js` to modify:
- `maxRestarts`: Maximum restart attempts (default: 50)
- `restartDelay`: Delay between restarts (default: 3000ms)

## 🎯 Production Deployment

For true production 24/7 operation, consider:

1. **systemd service** (Linux):
   ```bash
   sudo cp mcp-engine.service /etc/systemd/system/
   sudo systemctl enable mcp-engine
   sudo systemctl start mcp-engine
   ```

2. **PM2 process manager**:
   ```bash
   npm install -g pm2
   pm2 start start-resilient.js --name mcp-engine
   pm2 save
   pm2 startup
   ```

3. **Docker with restart policies**:
   ```bash
   docker run --restart=unless-stopped mcp-engine
   ```

## ✅ Verification

After starting, verify the system is running:

```bash
# Check frontend
curl http://localhost:3050

# Check API
curl http://localhost:3010/health

# Check server list (REG-66 should be first)
curl http://localhost:3010/api/mcp/servers | jq '.data[0].name'
```

The system is now designed to run continuously without manual intervention! 🎉
