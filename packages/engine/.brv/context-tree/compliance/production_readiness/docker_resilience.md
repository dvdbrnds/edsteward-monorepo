MCP-Engine Docker Resilience - Complete File Contents and Commands

## AUTOMATED TRANSITION SCRIPT CONTENT:
File: `host-transition-commands.sh`
```bash
#!/bin/bash
# Host Machine Transition Script - Run from HOST MACHINE (not devcontainer)
set -euo pipefail

# Colors
RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'; BLUE='\033[0;34m'; NC='\033[0m'

log() { echo -e "${BLUE}[Transition]${NC} [$(date '+%Y-%m-%d %H:%M:%S')] $1"; }
error() { echo -e "${RED}[Transition ERROR]${NC} [$(date '+%Y-%m-%d %H:%M:%S')] $1" >&2; }
warn() { echo -e "${YELLOW}[Transition WARN]${NC} [$(date '+%Y-%m-%d %H:%M:%S')] $1"; }
success() { echo -e "${GREEN}[Transition SUCCESS]${NC} [$(date '+%Y-%m-%d %H:%M:%S')] $1"; }

# Check environment
check_environment() {
    log "Checking environment..."
    if [ ! -f "/.dockerenv" ] && command -v docker >/dev/null 2>&1; then
        success "Running on host machine with Docker available"
        return 0
    else
        error "This script must be run from the HOST MACHINE, not inside a container"
        exit 1
    fi
}

# Main transition
main() {
    echo "🔄 MCP-Engine SaaS Resilient Transition"
    check_environment
    
    # Stop current containers
    log "Stopping current containers..."
    docker-compose down --timeout 60 2>/dev/null || true
    docker-compose -f docker-compose.phase4.yml down --timeout 60 2>/dev/null || true
    
    # Clean up
    log "Cleaning up resources..."
    docker system prune -f >/dev/null 2>&1 || true
    
    # Start resilient config
    log "Starting resilient configuration..."
    docker-compose -f docker-compose.resilient.yml up -d
    
    # Wait and check
    log "Waiting for services (60s)..."
    sleep 60
    
    # Show status
    log "Service status:"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    
    # Test endpoints
    log "Testing endpoints..."
    curl -f --connect-timeout 10 http://localhost:3002/api/llm/health && success "✓ LLM Gateway" || warn "✗ LLM Gateway"
    curl -f --connect-timeout 10 http://localhost:3050/ && success "✓ Frontend" || warn "✗ Frontend"
    
    success "🎉 Transition completed!"
}

main "$@"
```

## KEY DOCKER COMPOSE CONFIGURATIONS:

### Resilient Configuration (docker-compose.resilient.yml) - Key sections:
```yaml
services:
  mcp-engine:
    build: 
      context: .
      dockerfile: Dockerfile.resilient
    container_name: mcp-engine-resilient
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 3G
          cpus: '2.0'
        reservations:
          memory: 1.5G
          cpus: '1.0'
    environment:
      - NODE_OPTIONS=--max-old-space-size=2048 --max-semi-space-size=128 --expose-gc
    healthcheck:
      test: ["CMD-SHELL", "curl -f --connect-timeout 10 --max-time 15 http://localhost:3002/api/llm/health"]
      interval: 60s
      timeout: 20s
      retries: 3
      start_period: 300s
    stop_grace_period: 45s
    stop_signal: SIGTERM

  postgres:
    image: postgres:14-alpine
    container_name: postgres-resilient
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '1.0'
        reservations:
          memory: 512M
          cpus: '0.5'
```

## MONITORING SCRIPT COMMANDS:
```bash
# Real-time monitoring
./scripts/docker-monitor.sh continuous 60

# Single check
./scripts/docker-monitor.sh monitor

# Emergency cleanup
./scripts/docker-monitor.sh cleanup

# Container stats
./scripts/docker-monitor.sh stats
```

## VERIFICATION CHECKLIST:
1. Run from HOST MACHINE (not devcontainer)
2. Docker Desktop running
3. Navigate to MCP-Engine directory
4. Execute: `./host-transition-commands.sh`
5. Verify containers: `docker ps`
6. Test endpoints: `curl http://localhost:3002/api/llm/health`
7. Check resources: `docker stats`
8. Start monitoring: `./scripts/docker-monitor.sh continuous 60 &`

## EMERGENCY RECOVERY:
```bash
# If anything goes wrong
docker-compose -f docker-compose.resilient.yml down --timeout 30
docker system prune -f
# Restart Docker Desktop if needed
# Then retry transition
```

This setup prevents Docker crashes that require machine reboots by implementing strict resource limits, graceful shutdowns, and real-time monitoring.