#!/bin/bash

# Process Monitoring Script
# Runs automatically on container start via postStartCommand
# Provides protection against zombie processes and resource exhaustion

set -e

echo "🔍 Starting MCP Engine process monitoring..."

# Create monitor log directory
mkdir -p /workspace/logs

# Function to log with timestamp
log_with_timestamp() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') $1" | tee -a /workspace/logs/monitor.log
}

# Function to check and cleanup zombie processes
cleanup_zombies() {
    local zombie_count=$(ps aux | awk '$8 ~ /^Z/ { print $2 }' | wc -l)
    if [ "$zombie_count" -gt 0 ]; then
        log_with_timestamp "⚠️  Found $zombie_count zombie processes"
        ps aux | awk '$8 ~ /^Z/ { print "Zombie process PID:", $2, "PPID:", $3, "CMD:", $11 }' | tee -a /workspace/logs/monitor.log
        # Note: Zombies are cleaned up by their parent process or init, we just log them
    fi
}

# Function to check Node.js process count
check_node_processes() {
    local node_count=$(ps aux | grep -c '[n]ode' || echo "0")
    log_with_timestamp "📊 Active Node.js processes: $node_count"
    
    # Emergency cleanup if too many Node.js processes
    if [ "$node_count" -gt 50 ]; then
        log_with_timestamp "🚨 EMERGENCY: Too many Node.js processes ($node_count > 50)"
        log_with_timestamp "🧹 Performing emergency cleanup..."
        
        # Kill orphaned Node.js processes (excluding current shell and essential processes)
        ps aux | grep '[n]ode' | awk '$11 !~ /(mcp-|regulation-|start-)/ { print $2 }' | head -20 | xargs -r kill -TERM 2>/dev/null || true
        sleep 2
        ps aux | grep '[n]ode' | awk '$11 !~ /(mcp-|regulation-|start-)/ { print $2 }' | head -10 | xargs -r kill -KILL 2>/dev/null || true
        
        log_with_timestamp "🧹 Emergency cleanup completed"
    fi
}

# Function to check resource usage
check_resources() {
    local mem_usage=$(free | awk 'NR==2{printf "%.1f", $3*100/$2}')
    local cpu_load=$(uptime | awk -F'load average:' '{ print $2 }' | awk '{ print $1 }' | sed 's/,//')
    
    log_with_timestamp "💾 Memory usage: ${mem_usage}%"
    log_with_timestamp "⚡ CPU load: ${cpu_load}"
    
    # Alert on high resource usage
    if (( $(echo "$mem_usage > 90" | bc -l) )); then
        log_with_timestamp "⚠️  HIGH MEMORY USAGE: ${mem_usage}%"
    fi
}

# Function to check service health
check_service_health() {
    # Check if MCP config exists
    if [ -f "/home/vscode/.cursor/mcp.json" ]; then
        log_with_timestamp "✅ MCP configuration present"
    else
        log_with_timestamp "❌ MCP configuration missing - running setup..."
        /workspace/.devcontainer/setup-mcp.sh
    fi
    
    # Check key ports
    for port in 3002 3010 3050; do
        if netstat -tuln | grep -q ":$port "; then
            log_with_timestamp "🌐 Port $port: Active"
        else
            log_with_timestamp "⚪ Port $port: Available"
        fi
    done
}

# Main monitoring function
run_monitoring_cycle() {
    log_with_timestamp "🔄 Running monitoring cycle..."
    
    cleanup_zombies
    check_node_processes
    check_resources
    check_service_health
    
    log_with_timestamp "✅ Monitoring cycle completed"
    echo "---" >> /workspace/logs/monitor.log
}

# Initial setup
log_with_timestamp "🚀 MCP Engine process monitor started"
log_with_timestamp "📍 Environment: devcontainer"
log_with_timestamp "📝 Log file: /workspace/logs/monitor.log"

# Run initial health check
check_service_health

# Set up background monitoring (every 2 minutes)
(
    while true; do
        sleep 120  # 2 minutes
        run_monitoring_cycle
    done
) &

MONITOR_PID=$!
log_with_timestamp "🔍 Background monitor started (PID: $MONITOR_PID)"

# Set up cleanup trap
cleanup_monitor() {
    log_with_timestamp "🛑 Stopping process monitor..."
    kill $MONITOR_PID 2>/dev/null || true
    log_with_timestamp "✅ Process monitor stopped"
}

trap cleanup_monitor EXIT

# Function to handle SIGTERM
handle_shutdown() {
    log_with_timestamp "📡 Received shutdown signal"
    
    # Graceful shutdown of MCP servers
    log_with_timestamp "🔌 Shutting down MCP servers..."
    pkill -TERM -f "mcp-" 2>/dev/null || true
    sleep 2
    pkill -KILL -f "mcp-" 2>/dev/null || true
    
    # Clean up any remaining Node.js processes
    log_with_timestamp "🧹 Final cleanup..."
    ps aux | grep '[n]ode.*regulation\|[n]ode.*mcp' | awk '{ print $2 }' | xargs -r kill -TERM 2>/dev/null || true
    sleep 1
    ps aux | grep '[n]ode.*regulation\|[n]ode.*mcp' | awk '{ print $2 }' | xargs -r kill -KILL 2>/dev/null || true
    
    cleanup_monitor
    exit 0
}

trap handle_shutdown SIGTERM SIGINT

# Create a simple status command
cat > /workspace/scripts/monitor-status.sh << 'EOF'
#!/bin/bash
echo "📊 MCP Engine Monitor Status"
echo "============================"
tail -20 /workspace/logs/monitor.log 2>/dev/null || echo "No monitor log found"
echo "============================"
echo "🔍 Current processes:"
ps aux | grep -E '[n]ode|[m]cp' | head -10
echo "============================"
EOF

chmod +x /workspace/scripts/monitor-status.sh

log_with_timestamp "✅ Process monitoring initialized"
log_with_timestamp "📊 Use 'scripts/monitor-status.sh' to check status"

# Keep the script running (it will be managed by the container lifecycle)
wait $MONITOR_PID
