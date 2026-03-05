CRITICAL: MCP-Engine Docker Resilience Transition Instructions

## SITUATION OVERVIEW
User is experiencing Docker crashes that require machine reboots when running MCP-Engine SaaS. We've created resilient configurations but need to transition from current setup to new resilient setup.

## CURRENT STATE
- User is inside devcontainer (/workspaces/MCP-Engine)
- Cannot access Docker commands from inside container
- Need to transition from HOST MACHINE (macOS)
- All resilient configuration files are ready and saved

## FILES CREATED (All ready in /workspaces/MCP-Engine):
1. `docker-compose.resilient.yml` - Main resilient configuration with resource limits
2. `docker-compose.yml` - Enhanced original configuration  
3. `Dockerfile.resilient` - Enhanced container with graceful shutdown
4. `scripts/docker-monitor.sh` - Resource monitoring script
5. `scripts/quick-restart.sh` - Safe restart script
6. `host-transition-commands.sh` - Automated transition script
7. `DOCKER_RESILIENCE_GUIDE.md` - Complete troubleshooting guide
8. `TRANSITION_GUIDE.md` - Step-by-step transition instructions

## CRITICAL TRANSITION STEPS (Run from HOST MACHINE):

### Step 1: Exit Devcontainer
```bash
# User must exit devcontainer first
exit
```

### Step 2: Navigate to Project Directory
```bash
# On macOS host machine
cd /path/to/MCP-Engine  # User needs to provide actual path
```

### Step 3: Run Automated Transition
```bash
# Make script executable
chmod +x host-transition-commands.sh

# Run automated transition
./host-transition-commands.sh
```

### Step 4: Manual Alternative (if automated fails)
```bash
# Stop current containers
docker-compose down --timeout 60

# Clean up resources  
docker system prune -f

# Start resilient configuration
docker-compose -f docker-compose.resilient.yml up -d

# Monitor startup
docker-compose -f docker-compose.resilient.yml logs -f

# Check status
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

## RESOURCE LIMITS IMPLEMENTED:
- PostgreSQL: 1GB memory, 1.0 CPU
- Kafka: 1GB memory, 1.0 CPU  
- MCP-Engine: 3GB memory, 2.0 CPU
- Redis: 512MB memory, 0.5 CPU
- Zookeeper: 512MB memory, 0.5 CPU
- Debezium: 512MB memory, 0.5 CPU
- Total: ~6.5GB max memory vs unlimited before

## VERIFICATION COMMANDS:
```bash
# Check containers are running
docker ps

# Check resource usage
docker stats

# Test key endpoints
curl http://localhost:3002/api/llm/health
curl http://localhost:3050/
curl http://localhost:3366/health

# Start monitoring
./scripts/docker-monitor.sh continuous 60 &
```

## EXPECTED CONTAINER NAMES (after transition):
- mcp-engine-resilient
- postgres-resilient
- kafka-resilient  
- redis-resilient
- zookeeper-resilient
- debezium-resilient
- system-monitor

## TROUBLESHOOTING:
If transition fails:
```bash
# Emergency cleanup
docker-compose kill
docker system prune -f

# Restart Docker Desktop if needed
# Then retry transition
```

## SUCCESS INDICATORS:
1. All containers show "healthy" status
2. Resource usage stays within limits
3. Key endpoints respond (3002, 3050, 3366)
4. No more system crashes requiring reboots
5. Built-in monitoring shows controlled resource usage

## CRITICAL NOTES:
- Must run from HOST MACHINE (macOS terminal), not devcontainer
- Docker Desktop must be running
- Requires ~8GB+ available RAM
- Transition will temporarily stop all services
- User can restart devcontainer after transition completes

## POST-TRANSITION:
- System will be resilient to crashes
- Resource usage capped and monitored
- Graceful shutdowns implemented
- Real-time monitoring available
- User can safely restart devcontainer for development