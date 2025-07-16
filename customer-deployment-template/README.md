# EdSteward Customer Deployment Template

This template system allows deploying EdSteward to any customer's AWS environment with complete isolation and custom branding.

## Overview

Each customer deployment is completely isolated with:

- **Separate AWS infrastructure** (ECS cluster, service, ECR repository)
- **Separate database** (Neon PostgreSQL or customer's database)
- **Custom branding** (colors, logos, institution name)
- **Custom domain** (customer's domain or subdomain)
- **Custom configuration** (authentication, features, limits)

## Quick Start

1. **Create customer configuration**:

   ```bash
   cp customer-deployment-template/examples/acme-university.json my-customer.json
   # Edit my-customer.json with customer details
   ```

2. **Deploy to customer's AWS environment**:

   ```bash
   chmod +x customer-deployment-template/deploy-customer.sh
   ./customer-deployment-template/deploy-customer.sh my-customer.json
   ```

3. **Verify deployment**:

   ```bash
   curl -f https://customer-domain.com/health
   ```

## Configuration File Structure

### Customer Information

```json
{
  "customer": {
    "name": "Customer Name",
    "domain": "customer.edu",
    "subdomain": "customer",
    "contact": {
      "supportEmail": "support@customer.edu",
      "adminEmail": "admin@customer.edu",
      "organizationUrl": "https://customer.edu"
    }
  }
}
```

### AWS Infrastructure

```json
{
  "aws": {
    "region": "us-east-1",
    "accountId": "123456789012",
    "clusterName": "customer-edsteward-cluster",
    "serviceName": "customer-edsteward-service",
    "ecrRepository": "customer-edsteward",
    "logGroup": "/aws/ecs/customer-edsteward"
  }
}
```

### Database Configuration

```json
{
  "database": {
    "type": "neon",
    "connectionString": "postgresql://user:pass@host/db?sslmode=require",
    "name": "customer_edsteward"
  }
}
```

### Branding & UI

```json
{
  "branding": {
    "institutionName": "Customer University",
    "title": "Customer Compliance Portal",
    "logoUrl": "/assets/customer-logo.png",
    "faviconUrl": "/assets/customer-favicon.ico",
    "primaryColor": "#003366",
    "secondaryColor": "#0066cc",
    "accentColor": "#0099ff",
    "loginScreenBackgroundColor": "#f0f4f8",
    "loginScreenAccentColor": "#003366",
    "loginScreenTextColor": "#1f2937",
    "loginScreenHeroColor": "#003366"
  }
}
```

### Authentication

```json
{
  "authentication": {
    "samlEnabled": true,
    "samlEntityId": "urn:edsteward:sp:customer",
    "samlSsoUrl": "https://sso.customer.edu/saml",
    "samlCertificate": "-----BEGIN CERTIFICATE-----...",
    "usernamePasswordEnabled": true,
    "allowSelfRegistration": false
  }
}
```

### Features & Limits

```json
{
  "features": {
    "maxUsers": 500,
    "maxRegulations": 5000,
    "apiAccess": true,
    "customDomain": true,
    "ssoEnabled": true
  }
}
```

## Deployment Process

The deployment script performs these steps:

1. **Validate** AWS credentials and configuration
2. **Create ECS cluster** for the customer
3. **Create ECR repository** for Docker images
4. **Build & push** customer-specific Docker image
5. **Create task definition** with customer environment variables
6. **Create ECS service** with load balancer configuration
7. **Setup database** with schema and customer data
8. **Configure domain** and SSL certificates
9. **Health check** deployment
10. **Generate summary** for customer handoff

## File Structure

```
customer-deployment-template/
├── deploy-customer.sh              # Main deployment script
├── customer-config.template.json   # Configuration template
├── create-task-definition.sh       # ECS task definition generator
├── setup-customer-database.sh      # Database setup script
├── create-ecs-service.sh           # ECS service creation
├── setup-domain-ssl.sh             # Domain and SSL setup
├── health-check.sh                 # Deployment health check
├── generate-deployment-summary.sh  # Summary generator
├── examples/
│   ├── acme-university.json        # Example configuration
│   └── beta-test.json              # Beta test configuration
└── README.md                       # This file
```

## Prerequisites

### Tools Required

- `jq` - JSON processing
- `aws` - AWS CLI v2
- `docker` - Docker engine
- `psql` - PostgreSQL client

### AWS Requirements

- AWS account with appropriate permissions
- ECS cluster creation permissions
- ECR repository creation permissions
- Load balancer and SSL certificate permissions
- CloudWatch logs permissions

### Database Requirements

- Neon PostgreSQL instance OR customer's PostgreSQL
- Database connection string
- Schema import permissions

## Environment Variables

The deployment creates these environment variables for each customer:

### Core Application

- `NODE_ENV` - Application environment (production)
- `PORT` - Application port (3000)
- `DATABASE_URL` - Customer database connection
- `SESSION_SECRET` - Session encryption key
- `MULTI_TENANT` - Always false for customer deployments

### Institution Configuration

- `INSTITUTION_NAME` - Customer institution name
- `INSTITUTION_TITLE` - Application title
- `INSTITUTION_LOGO_URL` - Customer logo URL
- `INSTITUTION_FAVICON_URL` - Customer favicon URL
- `INSTITUTION_PRIMARY_COLOR` - Primary brand color
- `INSTITUTION_SECONDARY_COLOR` - Secondary brand color
- `INSTITUTION_ACCENT_COLOR` - Accent color

### Authentication

- `AUTH_SAML_ENABLED` - Enable SAML authentication
- `AUTH_SAML_ENTITY_ID` - SAML entity identifier
- `AUTH_SAML_SSO_URL` - SAML SSO endpoint
- `AUTH_USERNAME_PASSWORD_ENABLED` - Enable username/password auth
- `AUTH_ALLOW_SELF_REGISTRATION` - Allow user self-registration

### Features

- `FEATURE_MAX_USERS` - Maximum users allowed
- `FEATURE_MAX_REGULATIONS` - Maximum regulations
- `FEATURE_API_ACCESS` - Enable API access
- `FEATURE_CUSTOM_DOMAIN` - Enable custom domain
- `FEATURE_SSO_ENABLED` - Enable SSO features

## Customer Onboarding Checklist

### Pre-Deployment

- [ ] Customer provides AWS account ID and region
- [ ] Customer provides domain name and SSL certificate
- [ ] Customer provides database connection string
- [ ] Customer provides branding assets (logo, colors)
- [ ] Customer provides authentication configuration
- [ ] Customer provides admin contact information

### Deployment

- [ ] Configure customer deployment file
- [ ] Validate AWS credentials
- [ ] Run deployment script
- [ ] Verify health checks pass
- [ ] Test login functionality
- [ ] Verify branding appears correctly

### Post-Deployment

- [ ] Send customer deployment summary
- [ ] Provide admin credentials (change immediately)
- [ ] Schedule training session
- [ ] Set up monitoring and alerts
- [ ] Configure backup procedures
- [ ] Document customer-specific settings

## Security Considerations

### Isolation

- Each customer has separate AWS resources
- No shared infrastructure between customers
- Separate databases with no cross-customer access
- Separate Docker images with customer-specific configuration

### Access Control

- Default admin credentials must be changed immediately
- Customer controls their own AWS account
- No shared authentication between customers
- Customer manages their own SSL certificates

### Data Protection

- All data stored in customer's environment
- Database encryption at rest (Neon default)
- SSL/TLS encryption in transit
- Customer controls data retention policies

## Troubleshooting

### Common Issues

**Database Connection Failed**

```bash
# Test database connection
psql "customer-database-url" -c "SELECT 1;"
```

**Docker Build Failed**

```bash
# Check Docker daemon
docker info
# Rebuild with verbose output
docker build --no-cache -t customer-image .
```

**ECS Service Not Starting**

```bash
# Check ECS service logs
aws ecs describe-services --cluster customer-cluster --services customer-service
aws logs tail /aws/ecs/customer-edsteward --follow
```

**Health Check Failing**

```bash
# Test health endpoint
curl -f https://customer-domain.com/health
# Check application logs
aws logs tail /aws/ecs/customer-edsteward --follow
```

### Support

For deployment issues:

1. Check deployment logs in `/tmp/deployment-logs-customer.txt`
2. Verify AWS credentials: `aws sts get-caller-identity`
3. Check database connectivity: `psql "database-url" -c "SELECT 1;"`
4. Review ECS service events in AWS Console

## Examples

### Deploy Beta Test Instance

```bash
./customer-deployment-template/deploy-customer.sh \
  customer-deployment-template/examples/beta-test.json
```

### Deploy New Customer

```bash
# 1. Create customer configuration
cp customer-deployment-template/examples/acme-university.json newcustomer.json
# 2. Edit configuration
vim newcustomer.json
# 3. Deploy
./customer-deployment-template/deploy-customer.sh newcustomer.json
```

### Update Existing Customer

```bash
# 1. Update configuration
vim existing-customer.json
# 2. Redeploy
./customer-deployment-template/deploy-customer.sh existing-customer.json
```

## Architecture

```
Customer AWS Account
├── ECS Cluster (customer-edsteward-cluster)
│   └── ECS Service (customer-edsteward-service)
│       └── Tasks running customer Docker image
├── ECR Repository (customer-edsteward)
│   └── Customer-specific Docker images
├── Application Load Balancer
│   └── SSL Certificate (customer domain)
├── CloudWatch Logs
│   └── Application logs
└── Database (Neon PostgreSQL)
    ├── Customer schema
    ├── Customer data
    └── Customer branding
```

Each customer deployment is completely isolated with no shared resources.

---

**🎯 Goal**: Enable rapid deployment of EdSteward to any customer environment with complete isolation and custom branding.

**🚀 Usage**: `./deploy-customer.sh customer-config.json`

**📧 Support**: Contact development team for deployment assistance.
