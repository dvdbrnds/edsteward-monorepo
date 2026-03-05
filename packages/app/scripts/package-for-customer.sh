#!/bin/zsh

# EdSteward Customer Packaging Script
# Creates complete deployment package for single-tenant on-premises installation

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

CUSTOMER_NAME=${1:-"default-customer"}
VERSION=${2:-$(date +%Y%m%d-%H%M%S)}
PACKAGE_NAME="customer-deployment-${CUSTOMER_NAME}"

echo -e "${BLUE}📦 EdSteward Customer Packaging Script${NC}"
echo "=================================================="
echo -e "${YELLOW}Customer: ${CUSTOMER_NAME}${NC}"
echo -e "${YELLOW}Version: ${VERSION}${NC}"
echo "=================================================="

# Validate inputs
if [ -z "$CUSTOMER_NAME" ]; then
    echo -e "${RED}❌ Customer name required${NC}"
    echo "Usage: ./package-for-customer.sh [customer-name] [version]"
    exit 1
fi

# Clean previous package
echo -e "\n${YELLOW}🧹 Cleaning previous packages...${NC}"
rm -rf ${PACKAGE_NAME}
rm -f ${PACKAGE_NAME}.tar.gz

# Create package directory structure
echo -e "\n${YELLOW}📁 Creating package structure...${NC}"
mkdir -p ${PACKAGE_NAME}/{ssl,data,docs,images,scripts}

# Build Docker image
echo -e "\n${YELLOW}🐳 Building Docker image...${NC}"
docker build -f Dockerfile.single-tenant -t edsteward-${CUSTOMER_NAME}:${VERSION} .
docker tag edsteward-${CUSTOMER_NAME}:${VERSION} edsteward-${CUSTOMER_NAME}:latest

# Save Docker image
echo -e "\n${YELLOW}💾 Saving Docker image...${NC}"
docker save edsteward-${CUSTOMER_NAME}:latest > ${PACKAGE_NAME}/images/edsteward-${CUSTOMER_NAME}.tar

# Copy configuration files
echo -e "\n${YELLOW}⚙️ Copying configuration files...${NC}"
cp single-tenant-config/docker-compose.single-tenant.yml ${PACKAGE_NAME}/docker-compose.yml
cp single-tenant-config/.env.single-tenant ${PACKAGE_NAME}/.env.template

# Create customer-specific environment file
echo -e "\n${YELLOW}🎨 Creating customer-specific configuration...${NC}"
cat > ${PACKAGE_NAME}/.env << EOF
# ${CUSTOMER_NAME} EdSteward Configuration
# Generated: $(date)

# Institution Configuration
INSTITUTION_NAME="${CUSTOMER_NAME}"
INSTITUTION_DOMAIN="$(echo ${CUSTOMER_NAME} | tr '[:upper:]' '[:lower:]').edu"
INSTITUTION_LOGO_URL="/assets/$(echo ${CUSTOMER_NAME} | tr '[:upper:]' '[:lower:]')-logo.png"
INSTITUTION_PRIMARY_COLOR="#003366"
INSTITUTION_SECONDARY_COLOR="#336699"

# Authentication Configuration  
AUTH_SAML_ENABLED=true
AUTH_SAML_ENTITY_ID="urn:edsteward:sp:$(echo ${CUSTOMER_NAME} | tr '[:upper:]' '[:lower:]')"
AUTH_SAML_SSO_URL="https://$(echo ${CUSTOMER_NAME} | tr '[:upper:]' '[:lower:]').edu/saml/sso"
AUTH_USERNAME_PASSWORD_ENABLED=true
AUTH_ALLOW_SELF_REGISTRATION=false

# Database Configuration
DATABASE_URL="postgresql://edsteward_user:CHANGE_THIS_PASSWORD@db:5432/edsteward"
REDIS_URL="redis://redis:6379"

# Application Configuration
NODE_ENV="production"
PORT=3000
BASE_URL="https://edsteward.$(echo ${CUSTOMER_NAME} | tr '[:upper:]' '[:lower:]').edu"
SESSION_SECRET="CHANGE_THIS_TO_RANDOM_SECRET_$(openssl rand -hex 32)"

# Feature Configuration
FEATURE_MAX_USERS=500
FEATURE_MAX_REGULATIONS=5000
FEATURE_API_ACCESS=true
FEATURE_SSO_ENABLED=true

# Email Configuration (Configure with customer SMTP)
SMTP_HOST=""
SMTP_PORT=587
SMTP_USER=""
SMTP_PASSWORD=""
SMTP_FROM="noreply@$(echo ${CUSTOMER_NAME} | tr '[:upper:]' '[:lower:]').edu"

# File Upload Configuration
UPLOAD_MAX_SIZE=10485760
UPLOAD_ALLOWED_TYPES="pdf,doc,docx,xls,xlsx,png,jpg,jpeg"
EOF

# Create installation script
echo -e "\n${YELLOW}🚀 Creating installation script...${NC}"
cat > ${PACKAGE_NAME}/install.sh << 'EOF'
#!/bin/bash

# EdSteward Installation Script
set -e

echo "🚀 Installing EdSteward..."

# Check prerequisites
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is required but not installed"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is required but not installed"
    exit 1
fi

# Load Docker image
echo "📦 Loading Docker image..."
docker load < images/edsteward-*.tar

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p data/postgres data/redis logs uploads ssl

# Set permissions
chmod 755 data logs uploads
chmod 700 ssl

# Check configuration
if [ ! -f .env ]; then
    echo "❌ Configuration file .env not found"
    echo "Please copy .env.template to .env and customize it"
    exit 1
fi

# Start services
echo "🚀 Starting EdSteward..."
docker-compose up -d

# Wait for services
echo "⏳ Waiting for services to start..."
sleep 30

# Health check
echo "🔍 Checking health..."
if curl -f http://localhost:3000/health >/dev/null 2>&1; then
    echo "✅ EdSteward is running successfully!"
    echo "🌐 Access your application at: http://localhost:3000"
    echo ""
    echo "📋 Next steps:"
    echo "1. Configure SSL certificate"
    echo "2. Set up domain name (edsteward.yourdomain.edu)"
    echo "3. Create admin user"
    echo "4. Configure SAML authentication"
    echo ""
    echo "📖 See docs/ folder for detailed guides"
else
    echo "❌ Health check failed. Check logs:"
    echo "   docker-compose logs"
fi
EOF

chmod +x ${PACKAGE_NAME}/install.sh

# Create update script
echo -e "\n${YELLOW}🔄 Creating update script...${NC}"
cat > ${PACKAGE_NAME}/update.sh << 'EOF'
#!/bin/bash

# EdSteward Update Script
set -e

NEW_VERSION=${1:-"latest"}

echo "🔄 Updating EdSteward to version: $NEW_VERSION"

# Backup current data
echo "💾 Creating backup..."
./backup.sh

# Stop services
echo "🛑 Stopping services..."
docker-compose down

# Load new image
if [ -f "images/edsteward-$NEW_VERSION.tar" ]; then
    echo "📦 Loading new Docker image..."
    docker load < images/edsteward-$NEW_VERSION.tar
else
    echo "❌ Image file not found: images/edsteward-$NEW_VERSION.tar"
    exit 1
fi

# Start services
echo "🚀 Starting updated services..."
docker-compose up -d

# Wait and health check
sleep 30
if curl -f http://localhost:3000/health >/dev/null 2>&1; then
    echo "✅ Update completed successfully!"
else
    echo "❌ Update failed. Rolling back..."
    docker-compose down
    # Restore would go here
    exit 1
fi
EOF

chmod +x ${PACKAGE_NAME}/update.sh

# Create backup script
echo -e "\n${YELLOW}💾 Creating backup script...${NC}"
cat > ${PACKAGE_NAME}/backup.sh << 'EOF'
#!/bin/bash

# EdSteward Backup Script
BACKUP_DIR="backups/$(date +%Y%m%d-%H%M%S)"
mkdir -p $BACKUP_DIR

echo "💾 Creating backup in $BACKUP_DIR..."

# Backup database
echo "📊 Backing up database..."
docker-compose exec -T db pg_dump -U postgres edsteward > $BACKUP_DIR/database.sql

# Backup uploads
echo "📁 Backing up uploads..."
cp -r uploads $BACKUP_DIR/

# Backup configuration
echo "⚙️ Backing up configuration..."
cp .env $BACKUP_DIR/
cp docker-compose.yml $BACKUP_DIR/

# Create info file
cat > $BACKUP_DIR/backup-info.txt << BACKUP_EOF
EdSteward Backup
Created: $(date)
Version: $(docker-compose images | grep edsteward | awk '{print $2}')
Database: PostgreSQL dump included
Uploads: Complete uploads directory included
Configuration: .env and docker-compose.yml included
BACKUP_EOF

echo "✅ Backup completed: $BACKUP_DIR"
echo "💡 Test backup regularly with restore procedures"
EOF

chmod +x ${PACKAGE_NAME}/backup.sh

# Copy documentation
echo -e "\n${YELLOW}📚 Copying documentation...${NC}"
cp ON_PREMISES_DEPLOYMENT_GUIDE.md ${PACKAGE_NAME}/docs/INSTALLATION.md

cat > ${PACKAGE_NAME}/docs/MAINTENANCE.md << 'EOF'
# EdSteward Maintenance Guide

## Daily Operations

### Health Monitoring
```bash
# Check service status
docker-compose ps

# Check application health
curl http://localhost:3000/health

# View logs
docker-compose logs --tail=100
```

### Backup Verification
```bash
# Run daily backup
./backup.sh

# Verify backup integrity
ls -la backups/
```

## Weekly Operations

### Security Updates
```bash
# Update host system
sudo apt update && sudo apt upgrade -y

# Check for Docker updates
docker version
```

### Log Cleanup
```bash
# Clean old Docker logs
docker system prune -f

# Archive old backups (keep last 30 days)
find backups/ -type d -mtime +30 -exec rm -rf {} \;
```

## Monthly Operations

### Full System Review
- Review disk usage
- Update SSL certificates if needed
- Test disaster recovery procedures
- Review user access and permissions

### Performance Monitoring
- Check database performance
- Review application logs for errors
- Monitor resource usage

## Troubleshooting

### Common Issues

**Application won't start:**
```bash
docker-compose logs app
# Check database connectivity
# Verify environment configuration
```

**Database issues:**
```bash
docker-compose logs db
# Check disk space
# Verify database credentials
```

**SSL certificate issues:**
```bash
# Renew Let's Encrypt certificate
sudo certbot renew
```

### Getting Help

1. Check logs: `docker-compose logs`
2. Review documentation in docs/ folder
3. Contact support with logs and error details
EOF

cat > ${PACKAGE_NAME}/docs/TROUBLESHOOTING.md << 'EOF'
# EdSteward Troubleshooting Guide

## Installation Issues

### Docker not starting
- Ensure Docker daemon is running
- Check user permissions for Docker
- Verify system resources (RAM, disk space)

### Port conflicts
- Check if ports 80/443/3000 are available
- Modify docker-compose.yml if needed
- Use `netstat -tulpn` to check port usage

## Runtime Issues

### Application unreachable
1. Check service status: `docker-compose ps`
2. Check logs: `docker-compose logs app`
3. Verify network configuration
4. Check firewall settings

### Database connection errors
1. Check database status: `docker-compose logs db`
2. Verify database credentials in .env
3. Check database disk space
4. Restart database: `docker-compose restart db`

### Performance Issues
1. Check system resources: `htop` or `top`
2. Monitor Docker stats: `docker stats`
3. Review application logs for slow queries
4. Consider increasing container resources

## Backup & Recovery

### Backup fails
- Check disk space in backup directory
- Verify database connectivity
- Ensure backup script has proper permissions

### Restore from backup
```bash
# Stop services
docker-compose down

# Restore database
cat backups/BACKUP_DATE/database.sql | docker-compose exec -T db psql -U postgres edsteward

# Restore uploads
rm -rf uploads && cp -r backups/BACKUP_DATE/uploads .

# Restart services
docker-compose up -d
```

## Security Issues

### Suspected breach
1. Immediately change all passwords
2. Review access logs
3. Update all components
4. Contact security team

### SSL certificate expired
```bash
# Manual certificate renewal
sudo certbot renew --nginx

# Or replace certificate files in ssl/ directory
```

## Getting Support

Include this information when contacting support:

```bash
# System information
uname -a
docker version
docker-compose version

# Service status
docker-compose ps
docker-compose logs --tail=50

# Resource usage
df -h
free -h
```

**Support Contact**: support@edsteward.com
**Emergency**: Include "URGENT" in subject line
EOF

# Create README
echo -e "\n${YELLOW}📖 Creating README...${NC}"
cat > ${PACKAGE_NAME}/README.md << EOF
# EdSteward On-Premises Deployment - ${CUSTOMER_NAME}

Welcome to your EdSteward single-tenant deployment package.

## Quick Start

1. **Install Prerequisites**
   - Docker 20.10+
   - Docker Compose 2.0+
   - Ubuntu 20.04+ or similar

2. **Extract and Install**
   \`\`\`bash
   tar -xzf customer-deployment-${CUSTOMER_NAME}.tar.gz
   cd customer-deployment-${CUSTOMER_NAME}/
   ./install.sh
   \`\`\`

3. **Configure for Your Institution**
   - Edit .env file with your institution details
   - Add your logo to assets/
   - Configure SAML authentication
   - Set up SSL certificate

4. **Access Your Application**
   - http://localhost:3000 (initially)
   - Configure domain: edsteward.$(echo ${CUSTOMER_NAME} | tr '[:upper:]' '[:lower:]').edu

## Package Contents

- **docker-compose.yml** - Production configuration
- **.env** - Institution-specific settings
- **install.sh** - Automated installer
- **update.sh** - Update procedures  
- **backup.sh** - Backup utilities
- **docs/** - Complete documentation
- **images/** - Docker images

## Support

- **Installation Guide**: docs/INSTALLATION.md
- **Maintenance Guide**: docs/MAINTENANCE.md
- **Troubleshooting**: docs/TROUBLESHOOTING.md
- **Support Email**: support@edsteward.com

## Next Steps

After installation:
1. Create admin user
2. Configure institution branding
3. Set up SAML authentication
4. Import initial data (if provided)
5. Configure SSL/domain
6. Set up automated backups

---

**EdSteward Version**: ${VERSION}
**Package Created**: $(date)
**Customer**: ${CUSTOMER_NAME}
EOF

# Package everything
echo -e "\n${YELLOW}📦 Creating deployment package...${NC}"
tar -czf ${PACKAGE_NAME}.tar.gz ${PACKAGE_NAME}/

# Cleanup
rm -rf ${PACKAGE_NAME}

# Summary
echo -e "\n${GREEN}✅ Customer package created successfully!${NC}"
echo "=================================================="
echo -e "${BLUE}Package: ${PACKAGE_NAME}.tar.gz${NC}"
echo -e "${BLUE}Size: $(du -h ${PACKAGE_NAME}.tar.gz | cut -f1)${NC}"
echo -e "${BLUE}Customer: ${CUSTOMER_NAME}${NC}"
echo -e "${BLUE}Version: ${VERSION}${NC}"
echo "=================================================="
echo -e "${YELLOW}📋 Next steps:${NC}"
echo "1. Test the package in a clean environment"
echo "2. Send package to customer"
echo "3. Schedule installation support call"
echo "4. Provide customer with docs and credentials"
echo ""
echo -e "${GREEN}🎉 Ready for customer deployment!${NC}" 