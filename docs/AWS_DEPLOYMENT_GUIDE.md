# AWS Deployment Guide - EdSteward.ai

## 🚀 Quick Start Deployment Guide

This guide will get your EdSteward.ai application running on AWS as quickly as possible. SAML configuration can be done after the basic deployment is complete.

## ⚡ Prerequisites

### 1. AWS Account Setup
- [ ] Active AWS account with billing enabled
- [ ] AWS CLI installed and configured
- [ ] Sufficient permissions (Admin access recommended for initial setup)

### 2. Domain Setup
- [ ] Ownership of `edsteward.ai` domain
- [ ] Access to domain registrar's DNS settings

### 3. Local Tools Required
```bash
# Install required tools
brew install awscli terraform docker jq  # macOS
# or
sudo apt-get install awscli terraform docker.io jq  # Ubuntu
# or
choco install awscli terraform docker-desktop jq  # Windows
```

### 4. AWS CLI Configuration
```bash
# Configure AWS CLI with your credentials
aws configure
# AWS Access Key ID: [Your Access Key]
# AWS Secret Access Key: [Your Secret Key]  
# Default region name: us-east-1
# Default output format: json

# Verify configuration
aws sts get-caller-identity
```

## 📋 Step 1: Prepare Your Environment

### 1.1 Clone and Setup Repository
```bash
cd /path/to/your/projects
git clone <your-repo-url> EdSteward
cd EdSteward

# Install dependencies
npm install
```

### 1.2 Create Environment Configuration
```bash
# Create terraform variables file
cat > infrastructure/terraform/terraform.tfvars << EOF
aws_region    = "us-east-1"
environment   = "production"
app_name      = "edsteward"
base_domain   = "edsteward.ai"
db_password   = "$(openssl rand -base64 32)"
EOF

# Save the database password for later
echo "Database password: $(grep db_password infrastructure/terraform/terraform.tfvars | cut -d'"' -f2)"
```

## 📋 Step 2: Deploy AWS Infrastructure

### 2.1 Initialize Terraform
```bash
cd infrastructure/terraform

# Initialize Terraform
terraform init

# Review the deployment plan
terraform plan

# Deploy infrastructure (takes 10-15 minutes)
terraform apply -auto-approve
```

### 2.2 Save Important Outputs
```bash
# Save these values - you'll need them
terraform output alb_dns_name
terraform output database_endpoint  
terraform output redis_endpoint
terraform output ecr_repository_url
terraform output name_servers
```

## 📋 Step 3: Configure Domain DNS

### 3.1 Update Domain Nameservers
1. Go to your domain registrar (GoDaddy, Namecheap, etc.)
2. Find DNS/Nameserver settings for `edsteward.ai`
3. Replace nameservers with the Route53 values from terraform output:
   ```
   ns-xxxx.awsdns-xx.org
   ns-xxxx.awsdns-xx.co.uk
   ns-xxxx.awsdns-xx.com
   ns-xxxx.awsdns-xx.net
   ```
4. Save changes (propagation takes 5-60 minutes)

### 3.2 Verify DNS Propagation
```bash
# Check if DNS has propagated
dig edsteward.ai NS
nslookup edsteward.ai
```

## 📋 Step 4: Configure AWS SES for Email

### 4.1 Verify Domain in SES
```bash
# Get SES domain verification record
aws sesv2 create-email-identity \
  --email-identity edsteward.ai \
  --region us-east-1

# Get DKIM tokens for DNS
aws sesv2 get-email-identity \
  --email-identity edsteward.ai \
  --region us-east-1
```

### 4.2 Add DNS Records for SES
Add these DNS records in Route53 (or your DNS provider):

```bash
# Add SES verification record (get from SES console)
aws route53 change-resource-record-sets \
  --hosted-zone-id $(terraform output -raw route53_zone_id) \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "_amazonses.edsteward.ai",
        "Type": "TXT",
        "TTL": 300,
        "ResourceRecords": [{"Value": "\"VERIFICATION_TOKEN_FROM_SES\""}]
      }
    }]
  }'
```

### 4.3 Move SES Out of Sandbox (Optional for Production)
```bash
# Request production access for SES
aws sesv2 put-account-sending-enabled \
  --sending-enabled \
  --region us-east-1
```

## 📋 Step 5: Build and Deploy Application

### 5.1 Build Docker Image
```bash
# Return to project root
cd /path/to/EdSteward

# Make deployment script executable
chmod +x scripts/deploy-aws.sh

# Set environment variables
export AWS_REGION=us-east-1
export BASE_DOMAIN=edsteward.ai

# Deploy the application
./scripts/deploy-aws.sh production v1.0
```

### 5.2 Monitor Deployment
```bash
# Watch ECS service deployment
aws ecs describe-services \
  --cluster edsteward-cluster \
  --services edsteward-service \
  --region us-east-1

# Check application logs
aws logs tail /aws/ecs/edsteward --follow --region us-east-1
```

## 📋 Step 6: Setup Database Schema

### 6.1 Connect to Database
```bash
# Get database endpoint
DB_ENDPOINT=$(terraform output -raw database_endpoint)
DB_PASSWORD=$(grep db_password infrastructure/terraform/terraform.tfvars | cut -d'"' -f2)

# Connect to database (install psql if needed)
psql -h $DB_ENDPOINT -U postgres -d edsteward
```

### 6.2 Run Database Migrations
```sql
-- Run your database schema creation here
-- This would typically be automated, but for quick start:

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255),
  role VARCHAR(50) DEFAULT 'user',
  tenant_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add other tables as needed
-- \q to exit
```

## 📋 Step 7: Configure Load Balancer and SSL

### 7.1 Update ALB Listener for HTTPS
```bash
# Get certificate ARN (should be created by Terraform)
CERT_ARN=$(aws acm list-certificates \
  --region us-east-1 \
  --query 'CertificateSummaryList[?DomainName==`edsteward.ai`].CertificateArn' \
  --output text)

echo "Certificate ARN: $CERT_ARN"

# Add HTTPS listener to ALB (if not already done by Terraform)
ALB_ARN=$(aws elbv2 describe-load-balancers \
  --names edsteward-alb \
  --region us-east-1 \
  --query 'LoadBalancers[0].LoadBalancerArn' \
  --output text)

TARGET_GROUP_ARN=$(aws elbv2 describe-target-groups \
  --names edsteward-tg \
  --region us-east-1 \
  --query 'TargetGroups[0].TargetGroupArn' \
  --output text)
```

### 7.2 Add DNS Record for Root Domain
```bash
# Point edsteward.ai to ALB
ALB_DNS=$(terraform output -raw alb_dns_name)
ZONE_ID=$(terraform output -raw route53_zone_id)

aws route53 change-resource-record-sets \
  --hosted-zone-id $ZONE_ID \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "edsteward.ai",
        "Type": "CNAME",
        "TTL": 300,
        "ResourceRecords": [{"Value": "'$ALB_DNS'"}]
      }
    }]
  }'
```

## 📋 Step 8: Test Your Deployment

### 8.1 Health Check
```bash
# Test application health
curl -I https://edsteward.ai/health

# Should return HTTP 200
```

### 8.2 Access Application
1. Open browser to `https://edsteward.ai`
2. You should see the EdSteward application
3. Create an admin user account

### 8.3 Test Subdomain Routing
```bash
# Test tenant subdomain (will be configured later)
curl -I https://demo.edsteward.ai
```

## 📋 Step 9: Create First Admin User

### 9.1 Direct Database Method (Quick Start)
```bash
# Connect to database
psql -h $DB_ENDPOINT -U postgres -d edsteward

# Create admin user (replace with your details)
INSERT INTO users (username, email, password, role, tenant_id) 
VALUES ('admin', 'admin@edsteward.ai', 'temp_password', 'admin', 'system');
```

### 9.2 Test Login
1. Go to `https://edsteward.ai/login`
2. Login with admin credentials
3. Change password immediately

## 📋 Step 10: Basic Configuration

### 10.1 Environment Variables Check
```bash
# Verify ECS task has correct environment
aws ecs describe-task-definition \
  --task-definition edsteward-task \
  --region us-east-1 \
  --query 'taskDefinition.containerDefinitions[0].environment'
```

### 10.2 Application Settings
1. Login to admin panel
2. Configure basic settings:
   - Company name: EdSteward
   - Support email: support@edsteward.ai
   - Base URL: https://edsteward.ai

## 🔧 Troubleshooting

### Common Issues

#### 1. DNS Not Resolving
```bash
# Check nameserver propagation
dig +trace edsteward.ai
```

#### 2. SSL Certificate Issues
```bash
# Check certificate status
aws acm describe-certificate \
  --certificate-arn $CERT_ARN \
  --region us-east-1
```

#### 3. Application Not Starting
```bash
# Check ECS service events
aws ecs describe-services \
  --cluster edsteward-cluster \
  --services edsteward-service \
  --region us-east-1 \
  --query 'services[0].events'

# Check application logs
aws logs tail /aws/ecs/edsteward --follow
```

#### 4. Database Connection Issues
```bash
# Test database connectivity
telnet $DB_ENDPOINT 5432
```

## 💰 Cost Optimization

### Initial Setup Costs (Estimated Monthly)
- **ALB**: ~$18/month
- **ECS Fargate**: ~$30/month (2 tasks)
- **RDS t3.micro**: ~$13/month
- **Route53**: ~$0.50/month
- **ElastiCache**: ~$13/month
- **Total**: ~$75/month

### Cost Reduction Tips
1. Use RDS t3.micro for development
2. Reduce ECS task count to 1 for testing
3. Use spot instances for non-production
4. Enable ALB idle timeout

## 🔐 Security Checklist

- [ ] Database in private subnets ✅
- [ ] Security groups properly configured ✅
- [ ] SSL/TLS encryption enabled ✅
- [ ] IAM roles with least privilege ✅
- [ ] VPC with proper network isolation ✅
- [ ] Session store using Redis ✅
- [ ] Change default passwords ⚠️ 
- [ ] Enable CloudTrail logging (recommended)
- [ ] Setup backup strategy (recommended)

## 🎯 Next Steps (Post-Deployment)

1. **SAML Configuration**: Setup tenant-specific SAML authentication
2. **Monitoring**: Configure CloudWatch dashboards and alerts
3. **Backup Strategy**: Setup automated RDS backups
4. **CI/CD Pipeline**: Automate future deployments
5. **Tenant Onboarding**: Use tenant onboarding script
6. **Documentation**: Create user guides and admin documentation

## 📞 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review CloudWatch logs for detailed error messages
3. Verify all environment variables are set correctly
4. Ensure DNS propagation is complete (can take up to 24 hours)

Your EdSteward.ai application should now be running on AWS! 🎉

---

**Total Deployment Time**: 45-90 minutes (depending on DNS propagation)
**Next**: Configure SAML authentication for your tenants using the tenant onboarding script. 