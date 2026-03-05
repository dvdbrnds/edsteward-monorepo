#!/bin/zsh

# Setup Single-Tenant EdSteward for Moravian University
# This script sets up the complete single-tenant deployment

set -e

echo "🚀 Setting up Single-Tenant EdSteward"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

# Check prerequisites
log "Checking prerequisites..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    error "Docker is not installed. Please install Docker first."
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    error "Docker Compose is not installed. Please install Docker Compose first."
fi

# Create necessary directories
log "Creating directories..."
mkdir -p uploads logs assets database/init nginx/ssl

# Copy environment template
if [ ! -f ".env" ]; then
    log "Creating .env file from template..."
    cp .env.single-tenant .env
    warn "Please edit .env file with your specific configuration"
fi

# Copy database init scripts
if [ -f "moravian-schema.sql" ]; then
    log "Copying database schema..."
    cp moravian-schema.sql database/init/01-schema.sql
fi

if [ -f "moravian-data.sql" ]; then
    log "Copying database data..."
    cp moravian-data.sql database/init/02-data.sql
fi

if [ -f "create-admin-user.sql" ]; then
    log "Copying admin user script..."
    cp create-admin-user.sql database/init/03-admin-user.sql
fi

# Create nginx configuration
log "Creating nginx configuration..."
cat > nginx/nginx.conf << 'EOCFG'
events {
    worker_connections 1024;
}

http {
    upstream app {
        server app:3000;
    }

    server {
        listen 80;
        server_name _;

        # Redirect HTTP to HTTPS
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl;
        server_name _;

        # SSL configuration
        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;

        # Security headers
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";

        location / {
            proxy_pass http://app;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
EOCFG

# Start services
log "Starting services..."
docker-compose -f docker-compose.single-tenant.yml up -d

# Wait for services to be ready
log "Waiting for services to be ready..."
sleep 30

# Test the deployment
log "Testing deployment..."
if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    log "✅ Single-tenant EdSteward is running successfully!"
    log "🌐 Access your application at: http://localhost:3000"
    log "👤 Admin login: admin@moravian.edu / admin123"
    log "👤 Demo login: demo@moravian.edu / demo123"
else
    warn "⚠️  Application may still be starting up. Please wait a moment and try again."
fi

echo
echo "🎉 Setup complete!"
echo "Next steps:"
echo "  1. Edit .env file with your specific configuration"
echo "  2. Configure SSL certificates in nginx/ssl/"
echo "  3. Update DNS to point to your server"
echo "  4. Configure SAML authentication if needed"
echo
echo "For more information, see the documentation in docs/"
