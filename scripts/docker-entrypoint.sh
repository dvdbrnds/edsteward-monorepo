#!/bin/zsh
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1"
}

success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] SUCCESS:${NC} $1"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"
}

# Function to wait for database
wait_for_database() {
    log "Waiting for database connection..."
    local retries=30
    local count=0
    
    while [ $count -lt $retries ]; do
        if node -e "
            const { testDatabaseConnection } = require('./server/config/database.ts');
            testDatabaseConnection(1).then(() => {
                console.log('Database connected');
                process.exit(0);
            }).catch(() => {
                process.exit(1);
            });
        " 2>/dev/null; then
            success "Database connection established"
            return 0
        fi
        
        count=$((count + 1))
        log "Database connection attempt $count/$retries failed, retrying in 2 seconds..."
        sleep 2
    done
    
    error "Failed to connect to database after $retries attempts"
    return 1
}

# Function to ensure required directories exist
ensure_directories() {
    log "Ensuring required directories exist..."
    mkdir -p /app/uploads /app/logs /app/dist /app/public/downloads
    
    # Set proper permissions if running as root
    if [ "$(id -u)" = "0" ]; then
        chown -R nextjs:nodejs /app/uploads /app/logs /app/dist /app/public/downloads 2>/dev/null || true
    fi
    
    success "Directories ensured"
}

# Function to run pre-startup checks
pre_startup_checks() {
    log "Running pre-startup checks..."
    
    # Check if package.json exists
    if [ ! -f "/app/package.json" ]; then
        error "package.json not found"
        exit 1
    fi
    
    # Check if node_modules exists
    if [ ! -d "/app/node_modules" ]; then
        warn "node_modules not found, running npm install..."
        npm ci --legacy-peer-deps
    fi
    
    # Check required environment variables
    if [ -z "$DATABASE_URL" ]; then
        error "DATABASE_URL environment variable is required"
        exit 1
    fi
    
    if [ -z "$SESSION_SECRET" ]; then
        error "SESSION_SECRET environment variable is required"
        exit 1
    fi
    
    success "Pre-startup checks passed"
}

# Function to handle graceful shutdown
cleanup() {
    log "Received shutdown signal, cleaning up..."
    
    # Kill background processes
    jobs -p | xargs -r kill 2>/dev/null || true
    
    # Wait a moment for processes to clean up
    sleep 2
    
    success "Cleanup completed"
    exit 0
}

# Set up signal handlers for graceful shutdown
trap cleanup SIGTERM SIGINT

# Main startup sequence
main() {
    log "Starting EdSteward container..."
    log "Node version: $(node --version)"
    log "NPM version: $(npm --version)"
    log "Environment: ${NODE_ENV:-development}"
    
    # Run startup checks
    pre_startup_checks
    ensure_directories
    
    # Wait for database (with timeout)
    if ! wait_for_database; then
        warn "Database connection failed, but continuing startup..."
        warn "Application will handle database connection errors gracefully"
    fi
    
    # Initialize test users if in development
    if [ "${NODE_ENV:-development}" = "development" ]; then
        log "Setting up development test users..."
        if python3 create-test-user-local.py 2>/dev/null; then
            success "Test users initialized"
        else
            warn "Failed to initialize test users (continuing anyway)"
        fi
    fi
    
    success "Container initialization completed successfully"
    log "Starting application with: $@"
    
    # Execute the main command
    exec "$@"
}

# Run main function with all arguments
main "$@" 