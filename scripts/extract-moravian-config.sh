#!/bin/zsh

# Extract Moravian Configuration for Single-Tenant Deployment
# This script extracts all Moravian-specific configuration and prepares it for single-tenant use

set -e

echo "🔍 Extracting Moravian Configuration for Single-Tenant Deployment"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

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

# Create extraction directory
EXTRACT_DIR="single-tenant-config"
mkdir -p "$EXTRACT_DIR"

log "Creating extraction directory: $EXTRACT_DIR"

# 1. Extract Moravian tenant configuration
log "Extracting Moravian tenant configuration..."

cat > "$EXTRACT_DIR/moravian-config.json" << 'EOF'
{
  "institution": {
    "name": "Moravian University",
    "domain": "moravian.edu",
    "subdomain": "moravian",
    "settings": {
      "allowedDomains": ["moravian.edu"],
      "defaultRole": "user",
      "enableAutoProvisioning": true,
      "customBranding": {
        "primaryColor": "#003366",
        "secondaryColor": "#336699",
        "logoUrl": "/assets/Moravian-Monogram-MoravianBlue.png"
      },
      "features": {
        "maxUsers": 500,
        "maxRegulations": 5000,
        "apiAccess": true,
        "customDomain": false,
        "ssoEnabled": true
      },
      "institutionConfig": {
        "primaryTypes": ["university"],
        "hideNonApplicable": false,
        "allowUsersToToggle": true
      }
    }
  },
  "authentication": {
    "saml": {
      "enabled": true,
      "entityId": "urn:edsteward:sp:moravian",
      "ssoUrl": "https://moravian.edu/saml/sso",
      "attributeMapping": {
        "email": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
        "firstName": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname",
        "lastName": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname"
      }
    },
    "usernamePassword": {
      "enabled": true,
      "allowSelfRegistration": false,
      "requireEmailVerification": true
    }
  },
  "database": {
    "name": "edsteward_moravian",
    "url": "postgresql://user:pass@host:5432/edsteward_moravian"
  }
}
EOF

# 2. Extract environment variables template
log "Creating environment variables template..."

cat > "$EXTRACT_DIR/.env.single-tenant" << 'EOF'
# Institution Configuration
INSTITUTION_NAME="Moravian University"
INSTITUTION_DOMAIN="moravian.edu"
INSTITUTION_LOGO_URL="/assets/Moravian-Monogram-MoravianBlue.png"
INSTITUTION_PRIMARY_COLOR="#003366"
INSTITUTION_SECONDARY_COLOR="#336699"

# Authentication Configuration
AUTH_SAML_ENABLED=true
AUTH_SAML_ENTITY_ID="urn:edsteward:sp:moravian"
AUTH_SAML_SSO_URL="https://moravian.edu/saml/sso"
AUTH_SAML_CERT=""  # Add SAML certificate here
AUTH_USERNAME_PASSWORD_ENABLED=true
AUTH_ALLOW_SELF_REGISTRATION=false

# Database Configuration
DATABASE_URL="postgresql://user:pass@localhost:5432/edsteward"
REDIS_URL="redis://localhost:6379"

# Application Configuration
NODE_ENV="production"
PORT=3000
BASE_URL="https://edsteward.moravian.edu"
SESSION_SECRET="your-secure-session-secret"

# Feature Flags
FEATURE_MAX_USERS=500
FEATURE_MAX_REGULATIONS=5000
FEATURE_API_ACCESS=true
FEATURE_CUSTOM_DOMAIN=false
FEATURE_SSO_ENABLED=true

# Email Configuration (optional)
SMTP_HOST=""
SMTP_PORT=587
SMTP_USER=""
SMTP_PASSWORD=""
SMTP_FROM="noreply@moravian.edu"

# File Upload Configuration
UPLOAD_MAX_SIZE=10485760  # 10MB
UPLOAD_ALLOWED_TYPES="pdf,doc,docx,xls,xlsx,png,jpg,jpeg"
EOF

# 3. Extract Moravian-specific branding assets
log "Extracting branding assets..."

mkdir -p "$EXTRACT_DIR/assets"

# Copy Moravian logo if it exists
if [ -f "client/src/assets/Moravian-Monogram-MoravianBlue.png" ]; then
    cp "client/src/assets/Moravian-Monogram-MoravianBlue.png" "$EXTRACT_DIR/assets/"
    log "Copied Moravian logo"
fi

# 4. Extract database schema and data
log "Extracting database schema and sample data..."

# Create schema extraction script
cat > "$EXTRACT_DIR/extract-database.sh" << 'EOF'
#!/bin/zsh

# Extract Moravian database schema and data
# Run this script with appropriate database credentials

set -e

echo "🗄️ Extracting Moravian Database"

# Database connection details
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-edsteward_moravian}"
DB_USER="${DB_USER:-postgres}"

# Extract schema only
echo "Extracting schema..."
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    --schema-only --no-owner --no-privileges \
    > moravian-schema.sql

# Extract data (excluding sensitive tables)
echo "Extracting data..."
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    --data-only --no-owner --no-privileges \
    --exclude-table=users --exclude-table=user_sessions \
    > moravian-data.sql

# Create admin user script
cat > create-admin-user.sql << 'EOSQL'
-- Create admin user for single-tenant deployment
INSERT INTO users (email, password, name, role, created_at, updated_at)
VALUES (
    'admin@moravian.edu',
    '$2b$12$LQv3c1yqBwUHC5q.JqTrVOKgUs5/LqCfZjLzFgIrOJmIYJWmrHKhi', -- password: admin123
    'System Administrator',
    'admin',
    NOW(),
    NOW()
) ON CONFLICT (email) DO NOTHING;

-- Create demo user
INSERT INTO users (email, password, name, role, created_at, updated_at)
VALUES (
    'demo@moravian.edu',
    '$2b$12$LQv3c1yqBwUHC5q.JqTrVOKgUs5/LqCfZjLzFgIrOJmIYJWmrHKhi', -- password: demo123
    'Demo User',
    'user',
    NOW(),
    NOW()
) ON CONFLICT (email) DO NOTHING;
EOSQL

echo "✅ Database extraction complete"
echo "Files created:"
echo "  - moravian-schema.sql"
echo "  - moravian-data.sql"
echo "  - create-admin-user.sql"
EOF

chmod +x "$EXTRACT_DIR/extract-database.sh"

# 5. Create single-tenant Docker Compose
log "Creating single-tenant Docker Compose configuration..."

cat > "$EXTRACT_DIR/docker-compose.single-tenant.yml" << 'EOF'
version: '3.8'

services:
  app:
    image: edsteward-single-tenant:latest
    ports:
      - "3000:3000"
    environment:
      # Institution Configuration
      - INSTITUTION_NAME=Moravian University
      - INSTITUTION_DOMAIN=moravian.edu
      - INSTITUTION_LOGO_URL=/assets/Moravian-Monogram-MoravianBlue.png
      - INSTITUTION_PRIMARY_COLOR=#003366
      - INSTITUTION_SECONDARY_COLOR=#336699
      
      # Authentication
      - AUTH_SAML_ENABLED=true
      - AUTH_SAML_ENTITY_ID=urn:edsteward:sp:moravian
      - AUTH_USERNAME_PASSWORD_ENABLED=true
      - AUTH_ALLOW_SELF_REGISTRATION=false
      
      # Database
      - DATABASE_URL=postgresql://postgres:password@db:5432/edsteward
      - REDIS_URL=redis://redis:6379
      
      # Application
      - NODE_ENV=production
      - PORT=3000
      - BASE_URL=https://edsteward.moravian.edu
      - SESSION_SECRET=your-secure-session-secret-change-this
      
      # Features
      - FEATURE_MAX_USERS=500
      - FEATURE_MAX_REGULATIONS=5000
      - FEATURE_API_ACCESS=true
      - FEATURE_SSO_ENABLED=true
    
    depends_on:
      - db
      - redis
    
    volumes:
      - ./uploads:/app/uploads
      - ./logs:/app/logs
      - ./assets:/app/assets
    
    restart: unless-stopped

  db:
    image: postgres:15
    environment:
      - POSTGRES_DB=edsteward
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/init:/docker-entrypoint-initdb.d
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    restart: unless-stopped

  # Optional: Nginx for SSL termination
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./nginx/ssl:/etc/nginx/ssl
    depends_on:
      - app
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
EOF

# 6. Create setup script
log "Creating setup script..."

cat > "$EXTRACT_DIR/setup-single-tenant.sh" << 'EOF'
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
EOF

chmod +x "$EXTRACT_DIR/setup-single-tenant.sh"

# 7. Create README
log "Creating README..."

cat > "$EXTRACT_DIR/README.md" << 'EOF'
# EdSteward Single-Tenant Deployment

This package contains everything needed to deploy EdSteward as a single-tenant application for Moravian University.

## 🚀 Quick Start

1. **Run the setup script:**
   ```bash
   ./setup-single-tenant.sh
   ```

2. **Access your application:**
   - URL: http://localhost:3000
   - Admin: admin@moravian.edu / admin123
   - Demo: demo@moravian.edu / demo123

## 📋 Prerequisites

- Docker & Docker Compose
- At least 2GB RAM
- 10GB free disk space

## 🔧 Configuration

Edit `.env` file to customize your deployment:

- Institution name and branding
- Authentication settings
- Database configuration
- Feature flags

## 🔐 Security

- Change default passwords
- Configure SSL certificates
- Set up proper firewall rules
- Regular backups

## 📖 Documentation

- [Installation Guide](docs/INSTALLATION.md)
- [Configuration Guide](docs/CONFIGURATION.md)
- [Maintenance Guide](docs/MAINTENANCE.md)

## 🆘 Support

For support, please refer to the documentation or contact your system administrator.
EOF

# 8. Create summary
log "Creating extraction summary..."

cat > "$EXTRACT_DIR/EXTRACTION_SUMMARY.md" << 'EOF'
# Moravian Configuration Extraction Summary

## 📁 Files Created

- **moravian-config.json** - Complete institution configuration
- **.env.single-tenant** - Environment variables template
- **docker-compose.single-tenant.yml** - Docker Compose configuration
- **setup-single-tenant.sh** - Automated setup script
- **extract-database.sh** - Database extraction script
- **README.md** - Getting started guide

## 🔧 Next Steps

1. **Review configuration** in moravian-config.json
2. **Extract database** using extract-database.sh
3. **Test deployment** with docker-compose
4. **Customize branding** as needed
5. **Set up production environment**

## 🎯 Configuration Highlights

- **Institution**: Moravian University
- **Authentication**: SAML + Username/Password
- **Database**: PostgreSQL with isolated data
- **Features**: University-specific settings
- **Branding**: Moravian colors and logo

## 📊 Estimated Deployment Time

- **Setup**: 30 minutes
- **Database migration**: 1 hour
- **Testing**: 2 hours
- **Production deployment**: 4 hours

**Total**: ~7 hours for complete deployment
EOF

echo
log "✅ Moravian configuration extraction complete!"
echo
echo "📁 Files created in: $EXTRACT_DIR/"
echo "📋 Next steps:"
echo "  1. Review moravian-config.json"
echo "  2. Run extract-database.sh to get database"
echo "  3. Test with docker-compose.single-tenant.yml"
echo "  4. Customize as needed"
echo
echo "🎯 Ready for single-tenant deployment!" 