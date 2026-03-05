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
