# EdSteward On-Premises Deployment Guide

## 🏢 **Single-Tenant Architecture**

EdSteward is now delivered as **single-tenant, on-premises deployments**. Each customer gets their own dedicated server installation with complete data isolation and customized branding.

## 🎯 **Deployment Model**

- **One Installation Per Customer** - Dedicated server/VM for each institution
- **Complete Data Isolation** - No shared infrastructure between customers
- **Custom Branding** - Institution-specific logos, colors, and domain
- **On-Premises Control** - Customer controls their own infrastructure
- **Docker-Based** - Consistent deployment across different environments

---

## 🚀 **Development to Deployment Workflow**

### **1. Local Development (Docker)**
```bash
# Start single-tenant development environment
docker-compose -f single-tenant-config/docker-compose.single-tenant.yml up -d

# Access at http://localhost:3000
# Edit code with hot reloading enabled
```

### **2. Customer Packaging**
```bash
# Build customer-specific image
docker build -f Dockerfile.single-tenant -t edsteward-[customer]:latest .

# Package complete deployment bundle
./scripts/package-for-customer.sh [customer-name]

# This creates: customer-deployment-[customer].tar.gz
```

### **3. Customer Installation**
```bash
# On customer infrastructure:
tar -xzf customer-deployment-[customer].tar.gz
cd customer-deployment-[customer]/
./install.sh
```

---

## 📦 **Customer Deployment Package**

Each customer receives a complete deployment package containing:

```
customer-deployment-[customer]/
├── docker-compose.yml          # Production configuration
├── .env                        # Customer-specific settings
├── install.sh                  # Automated installer
├── backup.sh                   # Backup scripts
├── update.sh                   # Update procedures
├── ssl/                        # SSL certificate templates
├── data/                       # Initial data and migrations
├── docs/                       # Customer documentation
│   ├── INSTALLATION.md
│   ├── MAINTENANCE.md
│   └── TROUBLESHOOTING.md
└── images/                     # Docker images
    └── edsteward-[customer].tar
```

---

## 🔧 **Customer Configuration**

### **Institution Branding**
```env
INSTITUTION_NAME="Customer University"
INSTITUTION_DOMAIN="customer.edu"
INSTITUTION_LOGO_URL="/assets/customer-logo.png"
INSTITUTION_PRIMARY_COLOR="#003366"
INSTITUTION_SECONDARY_COLOR="#336699"
```

### **Authentication**
```env
# SAML Integration
AUTH_SAML_ENABLED=true
AUTH_SAML_ENTITY_ID="urn:edsteward:sp:customer"
AUTH_SAML_SSO_URL="https://customer.edu/saml/sso"

# Local Authentication Fallback
AUTH_USERNAME_PASSWORD_ENABLED=true
AUTH_ALLOW_SELF_REGISTRATION=false
```

### **Database & Infrastructure**
```env
DATABASE_URL="postgresql://user:pass@localhost:5432/edsteward"
REDIS_URL="redis://localhost:6379"
BASE_URL="https://edsteward.customer.edu"
```

---

## 💽 **Customer Infrastructure Requirements**

### **Minimum System Requirements**
- **CPU**: 4 cores
- **RAM**: 8GB
- **Storage**: 100GB SSD
- **OS**: Ubuntu 20.04 LTS or CentOS 8+
- **Docker**: 20.10+ and Docker Compose 2.0+

### **Recommended Production**
- **CPU**: 8 cores
- **RAM**: 16GB
- **Storage**: 500GB SSD
- **Network**: 1Gbps
- **Backup**: External storage for daily backups

### **Network Requirements**
- **Ports**: 80 (HTTP), 443 (HTTPS)
- **Domain**: Customer provides subdomain (e.g., edsteward.customer.edu)
- **SSL**: Customer provides SSL certificate or we include Let's Encrypt

---

## 🛠️ **Installation Process**

### **Customer Side Installation**
```bash
# 1. Prepare server
sudo apt update && sudo apt upgrade -y
sudo apt install docker.io docker-compose nginx certbot -y

# 2. Extract deployment package
tar -xzf customer-deployment-package.tar.gz
cd customer-deployment/

# 3. Configure environment
cp .env.template .env
nano .env  # Edit customer-specific settings

# 4. Run installer
chmod +x install.sh
sudo ./install.sh

# 5. Access application
# https://edsteward.customer.edu
```

### **Post-Installation**
```bash
# Create admin user
docker-compose exec app npm run create-admin

# Import initial data (if provided)
docker-compose exec app npm run import-data

# Setup SSL (if using Let's Encrypt)
sudo ./setup-ssl.sh customer.edu

# Configure backups
sudo crontab -e
# Add: 0 2 * * * /path/to/backup.sh
```

---

## 🔒 **Security & Maintenance**

### **Security Checklist**
- ✅ SSL/TLS certificates configured
- ✅ Database passwords changed from defaults
- ✅ Firewall rules configured (only 80/443 open)
- ✅ Regular OS security updates
- ✅ Docker images updated monthly
- ✅ Backup verification weekly

### **Maintenance Tasks**
- **Daily**: Automated backups
- **Weekly**: Health checks and log review
- **Monthly**: Security updates and dependency updates
- **Quarterly**: Full system backup and disaster recovery test

---

## 📈 **Updates & Support**

### **Update Process**
```bash
# 1. Receive new version from vendor
docker load < edsteward-customer-v2.1.0.tar

# 2. Run update script
./update.sh v2.1.0

# 3. Verify deployment
docker-compose ps
curl https://edsteward.customer.edu/health
```

### **Support Model**
- **Installation Support**: Included during initial deployment
- **Documentation**: Comprehensive guides and troubleshooting
- **Updates**: Regular security and feature updates
- **Custom Support**: Available through support contract

---

## 🎉 **Benefits for Customers**

✅ **Complete Control** - Customer owns and controls their data
✅ **Compliance Ready** - Meets data residency requirements
✅ **Custom Branding** - Fully customized to institution
✅ **Scalable** - Grows with institution needs
✅ **Secure** - No shared infrastructure risks
✅ **Reliable** - Proven Docker-based deployment

---

## 📞 **Getting Started**

Ready to deploy EdSteward on-premises?

1. **Contact Sales** - Discuss requirements and customization
2. **Receive Package** - Get your custom deployment bundle
3. **Install** - Follow the installation guide
4. **Launch** - Go live with your compliance platform

**Support**: support@edsteward.com  
**Documentation**: docs.edsteward.com  
**Emergency**: +1-555-SUPPORT 