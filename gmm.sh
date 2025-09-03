#!/bin/zsh

# GMM - Good Morning MCP
# Safe shutdown and restart script for MCP Engine system
# Usage: ./gmm.sh

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[GMM]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[GMM]${NC} ✅ $1"
}

print_warning() {
    echo -e "${YELLOW}[GMM]${NC} ⚠️  $1"
}

print_error() {
    echo -e "${RED}[GMM]${NC} ❌ $1"
}

print_header() {
    echo -e "${PURPLE}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  🌅 Good Morning MCP (GMM) - Safe System Restart"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${NC}"
}

# Function to safely kill processes on a specific port
kill_port() {
    local port=$1
    local service_name=$2
    
    print_status "Checking for processes on port $port ($service_name)..."
    
    # Find processes using the port
    local pids=$(lsof -ti:$port 2>/dev/null || true)
    
    if [[ -n "$pids" ]]; then
        print_warning "Found processes on port $port: $pids"
        
        # Try graceful shutdown first (SIGTERM)
        echo "$pids" | xargs -r kill -TERM 2>/dev/null || true
        sleep 3
        
        # Check if processes are still running
        local remaining_pids=$(lsof -ti:$port 2>/dev/null || true)
        
        if [[ -n "$remaining_pids" ]]; then
            print_warning "Processes still running, forcing shutdown (SIGKILL)..."
            echo "$remaining_pids" | xargs -r kill -KILL 2>/dev/null || true
            sleep 2
        fi
        
        # Final check
        local final_check=$(lsof -ti:$port 2>/dev/null || true)
        if [[ -z "$final_check" ]]; then
            print_success "Port $port ($service_name) is now free"
        else
            print_error "Failed to free port $port ($service_name)"
            return 1
        fi
    else
        print_success "Port $port ($service_name) is already free"
    fi
}

# Function to kill MCP-related processes by name
kill_mcp_processes() {
    print_status "Searching for MCP-related processes..."
    
    # Kill mcp-start.js processes
    local mcp_start_pids=$(ps aux | grep -E "node.*mcp-start\.js" | grep -v grep | awk '{print $2}' || true)
    if [[ -n "$mcp_start_pids" ]]; then
        print_warning "Found mcp-start.js processes: $mcp_start_pids"
        echo "$mcp_start_pids" | xargs -r kill -TERM 2>/dev/null || true
        sleep 2
        print_success "Terminated mcp-start.js processes"
    fi
    
    # Kill any remaining node processes that might be MCP-related
    local node_processes=$(ps aux | grep -E "node.*(registry-api|delivery-server|llm-gateway)" | grep -v grep | awk '{print $2}' || true)
    if [[ -n "$node_processes" ]]; then
        print_warning "Found MCP service processes: $node_processes"
        echo "$node_processes" | xargs -r kill -TERM 2>/dev/null || true
        sleep 2
        print_success "Terminated MCP service processes"
    fi
    
    # Kill Vite processes (frontend)
    local vite_pids=$(ps aux | grep -E "vite.*--port 3050" | grep -v grep | awk '{print $2}' || true)
    if [[ -n "$vite_pids" ]]; then
        print_warning "Found Vite frontend processes: $vite_pids"
        echo "$vite_pids" | xargs -r kill -TERM 2>/dev/null || true
        sleep 2
        print_success "Terminated Vite frontend processes"
    fi
}

# Function to wait for a service to be healthy
wait_for_service() {
    local url=$1
    local service_name=$2
    local max_attempts=15
    local attempt=1
    
    print_status "Waiting for $service_name to be healthy..."
    
    while [[ $attempt -le $max_attempts ]]; do
        if curl -s "$url" >/dev/null 2>&1; then
            print_success "$service_name is healthy!"
            return 0
        fi
        
        print_status "Health check $attempt/$max_attempts for $service_name..."
        sleep 2
        ((attempt++))
    done
    
    print_error "$service_name failed to become healthy after $max_attempts attempts"
    return 1
}

# Function to display final status
show_final_status() {
    echo -e "${CYAN}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  🎉 MCP Engine Successfully Started!"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📊 Registry API:     http://localhost:3010"
    echo "🤖 LLM Gateway:      http://localhost:3002"
    echo "🚀 Delivery System:  http://localhost:3051"
    echo "🌐 Frontend:         http://localhost:3050"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "✨ All services are ready for compliance management!"
    echo "🔗 REG-66 Console: http://localhost:3050/reg-66-advanced-console.html"
    echo "📝 Use Ctrl+C in the npm start terminal to stop services"
    echo -e "${NC}"
}

# Main execution
main() {
    print_header
    
    print_status "Starting safe shutdown and restart procedure..."
    
    # Step 1: Kill MCP-related processes
    print_status "🛑 Phase 1: Shutting down existing MCP processes..."
    kill_mcp_processes
    
    # Step 2: Free up required ports
    print_status "🔓 Phase 2: Freeing up required ports..."
    kill_port 3010 "Registry API"
    kill_port 3002 "LLM Gateway"
    kill_port 3051 "Delivery System"
    kill_port 3050 "Frontend"
    
    # Step 3: Wait a moment for cleanup
    print_status "⏳ Phase 3: Waiting for cleanup to complete..."
    sleep 3
    
    # Step 4: Start the system
    print_status "🚀 Phase 4: Starting MCP Engine system..."
    
    # Check if we're in the right directory
    if [[ ! -f "package.json" ]] || [[ ! -f "mcp-start.js" ]]; then
        print_error "Not in MCP Engine directory! Please run from the project root."
        exit 1
    fi
    
    # Start the system in background
    print_status "Launching npm start..."
    npm start &
    local npm_pid=$!
    
    # Step 5: Wait for services to be healthy
    print_status "🏥 Phase 5: Waiting for services to become healthy..."
    
    # Wait a bit for initial startup
    sleep 8
    
    # Check each service
    wait_for_service "http://localhost:3010/health" "Registry API"
    wait_for_service "http://localhost:3051/health" "Delivery System"
    
    # Check if frontend is responding (it doesn't have a health endpoint)
    print_status "Checking Frontend availability..."
    if curl -s "http://localhost:3050/" >/dev/null 2>&1; then
        print_success "Frontend is responding!"
    else
        print_warning "Frontend may still be starting up..."
    fi
    
    # Check LLM Gateway (it responds but doesn't have a health endpoint)
    print_status "Checking LLM Gateway availability..."
    if curl -s "http://localhost:3002/" >/dev/null 2>&1; then
        print_success "LLM Gateway is responding!"
    else
        print_warning "LLM Gateway may still be starting up..."
    fi
    
    # Step 6: Show final status
    show_final_status
    
    print_success "GMM startup complete! System is ready for your morning work session."
    print_status "The system is now running in the background. Check the terminal for live logs."
    
    # Keep the script running to show the npm process info
    print_status "npm start process PID: $npm_pid"
    print_status "GMM script completed successfully. System is operational!"
}

# Handle Ctrl+C gracefully
trap 'print_warning "GMM interrupted. System may still be starting in background."; exit 0' INT

# Run main function
main "$@"
