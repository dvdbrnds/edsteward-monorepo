# RegulatoryTrackr AWS Infrastructure

This Terraform configuration deploys RegulatoryTrackr as a multi-tenant SaaS application on AWS using ECS Fargate.

## Architecture Overview

- **ECS Fargate**: Containerized application hosting with auto-scaling
- **Application Load Balancer**: Traffic routing with SSL termination
- **RDS PostgreSQL**: Multi-tenant database with row-level security
- **ElastiCache Redis**: Session storage and caching
- **Route53**: DNS management for multi-tenant subdomains
- **S3**: File upload storage
- **SES**: Email notifications
- **Parameter Store**: Secure configuration management

## Prerequisites

1. **AWS CLI** configured with appropriate permissions
2. **Terraform** >= 1.0 installed
3. **Domain ownership** (e.g., edsteward.ai)
4. **Docker** for building and pushing images

## Quick Start

### 1. Configure Variables

```bash
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values
```

Required variables:
- `base_domain`: Your domain (e.g., "edsteward.ai")
- `db_password`: Secure database password
- `session_secret`: 64+ character session secret

### 2. Initialize and Deploy

```bash
terraform init
terraform plan
terraform apply
```

### 3. Configure DNS

Update your domain registrar to use Route53 name servers:

```bash
terraform output name_servers
```

### 4. Deploy Application

```bash
# Get ECR repository URL
export ECR_URL=$(terraform output -raw ecr_repository_url)

# Login to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin $ECR_URL

# Build and push
docker build -t regulatorytrackr ../../
docker tag regulatorytrackr:latest $ECR_URL:latest
docker push $ECR_URL:latest

# Update ECS service
aws ecs update-service --cluster regulatorytrackr-cluster --service regulatorytrackr-service --force-new-deployment
```

## Multi-Tenant Configuration

### Tenant Onboarding

Use the included script to onboard new tenants:

```bash
../../scripts/tenant-onboarding.sh acme-corp "ACME Corporation" acme
```

This creates:
- Parameter Store configuration
- DNS CNAME record
- Database tenant entry

### Tenant Configuration Structure

```json
{
  "id": "tenant-id",
  "name": "Tenant Name",
  "subdomain": "tenant",
  "domain": "tenant.edsteward.ai",
  "samlConfig": {
    "entityId": "https://idp.example.com",
    "ssoUrl": "https://idp.example.com/sso",
    "certificate": "-----BEGIN CERTIFICATE-----..."
  },
  "settings": {
    "allowedDomains": ["company.com"],
    "defaultRole": "user",
    "enableAutoProvisioning": true
  }
}
```

## Environment Variables

The ECS task includes these environment variables:

### Required
- `NODE_ENV=production`
- `DATABASE_URL`: PostgreSQL connection string
- `SESSION_SECRET`: Session encryption key
- `BASE_DOMAIN`: Multi-tenant base domain

### Multi-Tenant
- `ENABLE_MULTI_TENANCY=true`
- `TENANT_CACHE_TTL=300000`
- `AWS_PARAMETER_STORE_PREFIX=/regulatorytrackr/tenants`

### AWS Services
- `S3_BUCKET_NAME`: File upload bucket
- `SES_FROM_EMAIL`: Email sender address
- `REDIS_HOST/PORT`: Session storage

### Optional Integrations
- `OPENAI_API_KEY`: AI features (stored in Parameter Store)
- `TWILIO_*`: SMS notifications (stored in Parameter Store)

## Security Features

### Network Security
- Private subnets for database and cache
- Security groups with least-privilege access
- VPC with NAT gateways for outbound traffic

### Data Security
- RDS encryption at rest
- S3 bucket encryption
- Parameter Store SecureString for secrets
- SSL/TLS everywhere with ACM certificates

### Multi-Tenant Security
- Row-level security in PostgreSQL
- Tenant isolation middleware
- SAML authentication per tenant
- Domain-based tenant identification

## Monitoring & Logging

### CloudWatch Integration
- ECS container logs
- RDS performance insights
- Application metrics
- Custom dashboards

### Health Checks
- Application health endpoint `/health`
- ECS service health checks
- RDS monitoring
- Redis connectivity checks

## Scaling Configuration

### Horizontal Scaling
- ECS service auto-scaling based on CPU/memory
- Application Load Balancer distributes traffic
- Multiple AZ deployment

### Vertical Scaling
- Database instance can be upgraded
- ECS task CPU/memory can be increased
- Cache cluster can be upgraded

## Cost Optimization

### Resource Sizing
- `db.t3.small` database (upgradeable)
- `1024 CPU / 2048 MB` ECS tasks
- `cache.t3.micro` Redis

### Storage
- S3 lifecycle policies for old uploads
- RDS automated backups (14 days)
- CloudWatch log retention (30 days)

## Deployment Checklist

- [ ] Configure `terraform.tfvars`
- [ ] Run `terraform apply`
- [ ] Update domain name servers
- [ ] Build and push Docker image
- [ ] Deploy ECS service
- [ ] Configure first tenant
- [ ] Test multi-tenant access
- [ ] Set up monitoring alerts

## Troubleshooting

### Common Issues

1. **Domain not accessible**: Check Route53 name servers
2. **SSL certificate pending**: DNS validation required
3. **Database connection failed**: Check security groups
4. **Container not starting**: Check CloudWatch logs

### Useful Commands

```bash
# Check ECS service status
aws ecs describe-services --cluster regulatorytrackr-cluster --services regulatorytrackr-service

# View application logs
aws logs tail /aws/ecs/regulatorytrackr --follow

# Check database connectivity
aws rds describe-db-instances --db-instance-identifier regulatorytrackr-db

# Test tenant configuration
aws ssm get-parameter --name "/regulatorytrackr/tenants/tenant-id/config"
```

## Outputs

After deployment, Terraform provides:

- `alb_dns_name`: Load balancer DNS name
- `database_endpoint`: RDS endpoint
- `ecr_repository_url`: Container registry URL
- `name_servers`: Route53 name servers
- `s3_bucket_name`: Upload bucket name

## Support

For deployment issues or questions:
1. Check CloudWatch logs
2. Review security group rules
3. Validate DNS configuration
4. Confirm Parameter Store values 