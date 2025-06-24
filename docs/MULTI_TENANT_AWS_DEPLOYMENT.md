# Multi-Tenant SAML Deployment on AWS

This guide covers deploying EdSteward as a multi-tenant SaaS application on AWS with SAML authentication support.

## Architecture Overview

### Multi-Tenant Strategy
- **Subdomain-based tenant identification**: `tenant1.edsteward.ai`, `tenant2.edsteward.ai`
- **Row-level security (RLS)**: Single database with tenant isolation
- **Tenant-specific SAML configurations**: Each tenant can have their own Identity Provider
- **Shared infrastructure**: Cost-effective scaling

### AWS Services Used
- **ECS Fargate**: Containerized application hosting
- **RDS PostgreSQL**: Multi-tenant database with row-level security
- **ElastiCache Redis**: Session storage and caching
- **Application Load Balancer**: Traffic routing and SSL termination
- **Route53**: DNS management for subdomains
- **ACM**: SSL certificate management
- **Parameter Store**: Tenant configuration storage
- **ECR**: Container image registry

## Prerequisites

1. **AWS Account** with appropriate permissions
2. **Domain name** (e.g., `edsteward.ai`)
3. **Docker** installed locally
4. **Terraform** >= 1.0
5. **AWS CLI** configured

## Deployment Steps

### 1. Clone and Prepare Repository

```bash
git clone <your-repo-url>
cd EdSteward
```

### 2. Configure Environment Variables

Create `infrastructure/terraform/terraform.tfvars`:

```hcl
aws_region    = "us-east-1"
environment   = "production"
app_name      = "edsteward"
base_domain   = "edsteward.ai"
db_password   = "your-secure-database-password"
```

### 3. Deploy Infrastructure

```bash
cd infrastructure/terraform
terraform init
terraform plan
terraform apply
```

This creates:
- VPC with public/private subnets
- RDS PostgreSQL database
- ElastiCache Redis cluster
- ECS cluster and services
- Application Load Balancer
- Route53 hosted zone
- SSL certificates

### 4. Build and Deploy Application

```bash
# Get ECR login token
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com

# Build and tag Docker image
docker build -t edsteward .
docker tag edsteward:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/edsteward:latest

# Push to ECR
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/edsteward:latest

# Update ECS service
aws ecs update-service --cluster edsteward-cluster --service edsteward-service --force-new-deployment
```

### 5. Configure DNS

Update your domain registrar to use the Route53 name servers output by Terraform:

```bash
terraform output name_servers
```

### 6. Set Up Database Schema

Run the multi-tenant database migration:

```bash
# Connect to RDS instance
psql -h <rds-endpoint> -U postgres -d edsteward

# Run multi-tenant schema setup
\i database/multi-tenant-schema.sql
```

## Multi-Tenant Configuration

### Database Schema

The application uses row-level security (RLS) for tenant isolation:

```sql
-- Enable RLS on all tenant-aware tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE regulations ENABLE ROW LEVEL SECURITY;
-- ... other tables

-- Create tenant isolation policies
CREATE POLICY tenant_isolation_users ON users
    USING (tenant_id = current_setting('app.current_tenant_id')::text);

CREATE POLICY tenant_isolation_regulations ON regulations
    USING (tenant_id = current_setting('app.current_tenant_id')::text);
```

### Tenant Configuration via Parameter Store

Store tenant-specific configurations in AWS Parameter Store:

```bash
# Example tenant configuration
aws ssm put-parameter \
  --name "/edsteward/tenants/acme-corp/config" \
  --value '{
    "id": "acme-corp",
    "name": "ACME Corporation",
    "subdomain": "acme",
    "domain": "acme-corp.com",
    "samlConfig": {
      "entityId": "https://acme.okta.com",
      "ssoUrl": "https://acme.okta.com/app/saml/sso",
      "certificate": "-----BEGIN CERTIFICATE-----..."
    },
    "settings": {
      "allowedDomains": ["acme-corp.com"],
      "defaultRole": "user",
      "enableAutoProvisioning": true
    }
  }' \
  --type "String"
```

### Adding New Tenants

1. **Create tenant configuration in Parameter Store**
2. **Add DNS record for subdomain**
3. **Configure tenant's Identity Provider**

```bash
# Add Route53 record for new tenant
aws route53 change-resource-record-sets \
  --hosted-zone-id <zone-id> \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "newtenant.edsteward.ai",
        "Type": "CNAME",
        "TTL": 300,
        "ResourceRecords": [{"Value": "<alb-dns-name>"}]
      }
    }]
  }'
```

## SAML Configuration per Tenant

### Service Provider Metadata

Each tenant gets unique SP metadata at:
```
https://tenant.edsteward.ai/auth/saml/metadata
```

### Identity Provider Setup

For each tenant's IdP (Okta, Shibboleth, etc.):

1. **Create new SAML application** in the IdP
2. **Configure SP Entity ID**: `urn:edsteward:sp:{tenant-id}`
3. **Set Assertion Consumer Service URL**: `https://{tenant}.edsteward.ai/auth/saml/callback`
4. **Configure attribute mappings**:
   - Email: `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress`
   - First Name: `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname`
   - Last Name: `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname`
   - Groups: `http://schemas.microsoft.com/ws/2008/06/identity/claims/groups`

### Authentication Flow

1. User visits `https://tenant.edsteward.ai`
2. Application identifies tenant from subdomain
3. User clicks "SSO Login"
4. Redirected to tenant's configured IdP
5. After authentication, returned to application with tenant context
6. User provisioned/updated in tenant's namespace

## Monitoring and Logging

### CloudWatch Logs

- Application logs: `/aws/ecs/edsteward`
- Database logs: RDS CloudWatch integration
- Load balancer logs: ALB access logs

### Metrics

Monitor key metrics:
- **Request count per tenant**
- **Authentication success/failure rates**
- **Database connection pools**
- **Redis cache hit rates**

### Alerts

Set up CloudWatch alarms for:
- High CPU/memory usage
- Database connection issues
- Authentication failures
- Certificate expiration

## Security Considerations

### Data Isolation

- **Row-Level Security** ensures tenant data separation
- **Encrypted storage** for RDS and Redis
- **VPC isolation** for network security
- **IAM roles** with least privilege access

### SAML Security

- **Certificate validation** for IdP signatures
- **Assertion encryption** where supported
- **Request signing** for enhanced security
- **Session management** with Redis

### Access Control

- **Tenant-specific role mapping** from SAML assertions
- **Domain validation** for user provisioning
- **Audit logging** for all authentication events

## Scaling Considerations

### Horizontal Scaling

- **ECS service scaling** based on CPU/memory
- **Database read replicas** for read-heavy workloads
- **Redis clustering** for session storage scaling

### Performance Optimization

- **CDN integration** for static assets
- **Database connection pooling**
- **Tenant configuration caching**
- **SAML metadata caching**

## Backup and Disaster Recovery

### Database Backups

- **Automated RDS backups** with 7-day retention
- **Point-in-time recovery** capability
- **Cross-region backup replication** for DR

### Application Recovery

- **Multi-AZ deployment** for high availability
- **ECS service auto-recovery**
- **Load balancer health checks**

## Troubleshooting

### Common Issues

1. **Tenant not found**: Check Parameter Store configuration
2. **SAML authentication fails**: Validate IdP certificate and configuration
3. **Database connection issues**: Check security groups and RLS policies
4. **DNS resolution problems**: Verify Route53 configuration

### Debug Commands

```bash
# Check ECS service status
aws ecs describe-services --cluster edsteward-cluster --services edsteward-service

# View application logs
aws logs tail /aws/ecs/edsteward --follow

# Test database connectivity
psql -h <rds-endpoint> -U postgres -d edsteward -c "SELECT current_database();"

# Check Parameter Store values
aws ssm get-parameters-by-path --path "/edsteward/tenants" --recursive
```

## Cost Optimization

### Resource Right-Sizing

- **ECS tasks**: Start with smaller instances, scale as needed
- **RDS instance**: Use t3.micro for development, scale for production
- **ElastiCache**: Single node for small deployments

### Cost Monitoring

- **AWS Cost Explorer** for usage analysis
- **Budget alerts** for cost control
- **Reserved instances** for predictable workloads

## Maintenance

### Regular Tasks

- **Certificate renewal** (automated with ACM)
- **Database maintenance windows**
- **Security patch application**
- **Tenant configuration reviews**

### Updates

```bash
# Update application
docker build -t edsteward:v2.0 .
docker tag edsteward:v2.0 <account-id>.dkr.ecr.us-east-1.amazonaws.com/edsteward:v2.0
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/edsteward:v2.0

# Update ECS task definition and service
aws ecs update-service --cluster edsteward-cluster --service edsteward-service --task-definition edsteward-task:v2
```

## Support and Documentation

For additional support:
- AWS Documentation: https://docs.aws.amazon.com/
- SAML 2.0 Specification: https://docs.oasis-open.org/security/saml/
- Application logs and monitoring dashboards

This architecture provides a scalable, secure, and cost-effective multi-tenant SAML solution on AWS that can grow with your customer base while maintaining strong security and data isolation. 