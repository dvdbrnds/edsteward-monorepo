#!/bin/zsh

# GMM - Good Morning Mode
# Safe system restart script for EdSteward
# Usage: ./GMM.sh

echo "🌅 Good Morning Mode - EdSteward System Restart"
echo "=============================================="

# Function to print status messages
print_status() {
    echo "📋 $1"
}

print_success() {
    echo "✅ $1"
}

print_warning() {
    echo "⚠️  $1"
}

print_error() {
    echo "❌ $1"
}

# Step 1: Navigate to EdSteward directory
print_status "Navigating to EdSteward directory..."
cd "/Users/dvdbrnds/Desktop/ES Clientside/EdSteward" || {
    print_error "Failed to navigate to EdSteward directory"
    exit 1
}
print_success "In EdSteward directory: $(pwd)"

# Step 2: Stop all EdSteward processes safely
print_status "Stopping all EdSteward processes..."

# Find and stop npm processes
NPM_PIDS=$(pgrep -f "npm run dev" 2>/dev/null || true)
if [[ -n "$NPM_PIDS" ]]; then
    print_status "Found npm processes: $NPM_PIDS"
    echo "$NPM_PIDS" | xargs kill -TERM 2>/dev/null || true
    sleep 2
    # Force kill if still running
    echo "$NPM_PIDS" | xargs kill -9 2>/dev/null || true
    print_success "Stopped npm processes"
else
    print_status "No npm processes found"
fi

# Find and stop Node.js processes
NODE_PIDS=$(pgrep -f "tsx server/index.ts" 2>/dev/null || true)
if [[ -n "$NODE_PIDS" ]]; then
    print_status "Found Node.js processes: $NODE_PIDS"
    echo "$NODE_PIDS" | xargs kill -TERM 2>/dev/null || true
    sleep 2
    # Force kill if still running
    echo "$NODE_PIDS" | xargs kill -9 2>/dev/null || true
    print_success "Stopped Node.js processes"
else
    print_status "No Node.js processes found"
fi

# Step 3: Clear port 3000 completely
print_status "Clearing port 3000..."
PORT_PIDS=$(lsof -ti:3000 2>/dev/null || true)
if [[ -n "$PORT_PIDS" ]]; then
    print_status "Found processes on port 3000: $PORT_PIDS"
    echo "$PORT_PIDS" | xargs kill -TERM 2>/dev/null || true
    sleep 2
    # Force kill if still running
    echo "$PORT_PIDS" | xargs kill -9 2>/dev/null || true
    print_success "Cleared port 3000"
else
    print_success "Port 3000 is already clear"
fi

# Step 4: Wait for cleanup
print_status "Waiting for cleanup to complete..."
sleep 3

# Step 5: Verify port is clear
print_status "Verifying port 3000 is available..."
if lsof -i:3000 >/dev/null 2>&1; then
    print_warning "Port 3000 still in use, attempting force cleanup..."
    lsof -ti:3000 | xargs kill -9 2>/dev/null || true
    sleep 2
fi

if ! lsof -i:3000 >/dev/null 2>&1; then
    print_success "Port 3000 is now available"
else
    print_error "Port 3000 is still occupied. Manual intervention may be required."
    print_status "You can try: sudo lsof -ti:3000 | xargs kill -9"
fi

# Step 6: Check system dependencies
print_status "Checking system dependencies..."

# Check if we're in the right directory
if [[ ! -f "package.json" ]]; then
    print_error "package.json not found. Are we in the right directory?"
    exit 1
fi

# Check if node_modules exists
if [[ ! -d "node_modules" ]]; then
    print_warning "node_modules not found. Running npm install..."
    npm install
fi

print_success "System dependencies verified"

# Step 7: Start EdSteward
print_status "Starting EdSteward development server..."
echo ""
echo "🚀 Starting EdSteward..."
echo "📍 URL: http://localhost:3000"
echo "🔐 Login: dvdbrnds / gabadhgabadh"
echo "⏹️  Press Ctrl+C to stop"
echo ""

# Start the server
npm run dev
