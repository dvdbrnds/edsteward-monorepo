#!/bin/zsh

# EdSteward Local Development Setup Script
# Sets up proper subdomain routing and Docker environment

set -e

echo "🚀 EdSteward Local Development Setup"
echo "==================================="

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop and try again."
    exit 1
fi

# Function to add hosts entries
setup_hosts() {
    echo ""
    echo "📝 Setting up local domain entries..."
    
    # Check if entries already exist
    if grep -q "edsteward.local" /etc/hosts; then
        echo "✅ Hosts entries already exist"
        return 0
    fi
    
    echo "Adding entries to /etc/hosts (requires sudo):"
    echo "  - admin.edsteward.local"
    echo "  - moravian.edsteward.local" 
    echo "  - test.edsteward.local"
    echo "  - edsteward.local"
    
    sudo bash -c 'cat >> /etc/hosts << EOF

# EdSteward Local Development
127.0.0.1 admin.edsteward.local
127.0.0.1 moravian.edsteward.local  
127.0.0.1 test.edsteward.local
127.0.0.1 edsteward.local
EOF'
    
    echo "✅ Hosts entries added successfully"
}

# Function to start development environment
start_development() {
    echo ""
    echo "🐳 Starting Docker development environment..."
    
    # Stop any existing containers
    docker-compose -f docker-compose.local.yml down 2>/dev/null || true
    
    # Start fresh containers
    docker-compose -f docker-compose.local.yml up -d
    
    echo "✅ Docker containers started"
}

# Function to wait for application to be ready
wait_for_app() {
    echo ""
    echo "⏳ Waiting for application to be ready..."
    
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s -f http://admin.edsteward.local/api/health >/dev/null 2>&1; then
            echo "✅ Application is ready!"
            return 0
        fi
        
        echo "  Attempt $attempt/$max_attempts - waiting..."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    echo "⚠️  Application may still be starting. Check logs with: make -f Makefile.local dev-logs"
}

# Function to show access information
show_access_info() {
    echo ""
    echo "🎉 Local Development Environment Ready!"
    echo "======================================"
    echo ""
    echo "📱 Access your application:"
    echo "  • Admin Console:    http://admin.edsteward.local"
    echo "  • Moravian Tenant:  http://moravian.edsteward.local"
    echo "  • Test Tenant:      http://test.edsteward.local"
    echo ""
    echo "🛠️  Development commands:"
    echo "  • View logs:        make -f Makefile.local dev-logs"
    echo "  • Restart:          make -f Makefile.local dev-restart"
    echo "  • Stop:             make -f Makefile.local dev-stop"
    echo "  • Shell access:     make -f Makefile.local dev-shell"
    echo ""
    echo "📊 Monitor your application:"
    echo "  • Container status: docker-compose -f docker-compose.local.yml ps"
    echo "  • Application logs: docker-compose -f docker-compose.local.yml logs -f app"
    echo "  • Nginx logs:       docker-compose -f docker-compose.local.yml logs -f nginx"
    echo ""
}

# Main execution
main() {
    setup_hosts
    start_development
    wait_for_app
    show_access_info
    
    echo "🎯 Your local development environment is ready!"
    echo "   Open http://admin.edsteward.local to test the new brand colors!"
}

# Run main function
main "$@" 