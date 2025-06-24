# 🚀 Complete Step-by-Step AWS Deployment Guide
## EdSteward → EdSteward.ai Production Deployment

This guide will take you from your current development environment to a fully deployed AWS production system in approximately 60-90 minutes.

---

## 📋 **PHASE 1: Pre-Deployment Preparation (15 minutes)**

### Step 1.1: Verify Prerequisites ✅
```bash
# Check all required tools are installed
aws --version        # Should show AWS CLI v2.x
terraform --version  # Should show Terraform v1.x
docker --version     # Should show Docker v20.x+
jq --version        # Should show jq v1.6+

# Verify AWS credentials
aws sts get-caller-identity
# Should return your AWS account ID, user ARN, etc.
```

### Step 1.2: Commit Current Changes ⚠️
```bash
# You have uncommitted changes - let's commit them first
git add .
git commit -m "Pre-deployment: Add AWS infrastructure and authentication components"
git push origin ES-clientside
```

### Step 1.3: Secure Domain Access 🌐
- [ ] Log into your domain registrar for `edsteward.ai`
- [ ] Verify you have DNS management access
- [ ] Keep the registrar tab open - you'll need it in Phase 3

---

## 📋 **PHASE 2: AWS Infrastructure Deployment (20 minutes)**

### Step 2.1: Create Terraform Configuration
```bash
cd infrastructure/terraform

# Create terraform.tfvars with your specific configuration
cat > terraform.tfvars << 'EOF'
aws_region    = "us-east-1"
environment   = "production"
app_name      = "edsteward"
base_domain   = "edsteward.ai"
db_password   = "REPLACE_WITH_SECURE_PASSWORD"
EOF

# Generate a secure database password
echo "Use this secure password:" $(openssl rand -base64 32)
# Copy the generated password and replace REPLACE_WITH_SECURE_PASSWORD in terraform.tfvars
```

### Step 2.2: Initialize and Deploy Infrastructure
```bash
# Initialize Terraform
terraform init

# Review what will be created (500+ resources)
terraform plan

# Deploy everything (THIS WILL INCUR AWS COSTS - ~$75/month)
# Confirm you want to proceed, then run:
terraform apply

# When prompted, type 'yes' to confirm
# ⏱️ This takes 10-15 minutes - grab a coffee!
```

### Step 2.3: Save Critical Information
```bash
# IMPORTANT: Save these outputs immediately
echo "=== SAVE THESE VALUES ==="
echo "ALB DNS: $(terraform output -raw alb_dns_name)"
echo "Database: $(terraform output -raw database_endpoint)"
echo "ECR Repository: $(terraform output -raw ecr_repository_url)"
echo "S3 Bucket: $(terraform output -raw s3_bucket_name)"
echo ""
echo "=== ROUTE53 NAMESERVERS (for domain registrar) ==="
terraform output -raw name_servers
echo ""
echo "=== SES CONFIGURATION ==="
echo "Domain Identity: $(terraform output -raw ses_domain_identity)"
terraform output -raw ses_dkim_tokens
```

**📝 Copy all these values to a text file - you'll need them in the next steps!**

---

## 📋 **PHASE 3: Domain Configuration (10 minutes)**

### Step 3.1: Update Domain Nameservers
1. **Go to your domain registrar** (GoDaddy, Namecheap, etc.)
2. **Find DNS/Nameserver settings** for `edsteward.ai`
3. **Replace existing nameservers** with the 4 Route53 nameservers from Step 2.3
4. **Save changes** (propagation takes 5-60 minutes)

### Step 3.2: Verify DNS Propagation
```bash
# Check DNS propagation (may take several minutes)
watch -n 30 'dig edsteward.ai NS +short'

# When you see your Route53 nameservers, DNS is ready
# Example output should show:
# ns-xxxx.awsdns-xx.org.
# ns-xxxx.awsdns-xx.co.uk.
# etc.
```

---

## 📋 **PHASE 4: Email Configuration (10 minutes)**

### Step 4.1: Set Up SES Domain Verification
```bash
# Add SES verification DNS record
aws route53 change-resource-record-sets \
  --hosted-zone-id $(terraform output -raw route53_zone_id) \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "_amazonses.edsteward.ai",
        "Type": "TXT",
        "TTL": 300,
        "ResourceRecords": [{"Value": "\"'$(terraform output -raw ses_domain_identity)'\""}]
      }
    }]
  }'
```

### Step 4.2: Add DKIM Records
```bash
# Get DKIM tokens and add them
DKIM_TOKENS=$(terraform output -json ses_dkim_tokens | jq -r '.[]')

# Add each DKIM record (you'll have 3 of these)
for token in $DKIM_TOKENS; do
  aws route53 change-resource-record-sets \
    --hosted-zone-id $(terraform output -raw route53_zone_id) \
    --change-batch '{
      "Changes": [{
        "Action": "CREATE",
        "ResourceRecordSet": {
          "Name": "'$token'._domainkey.edsteward.ai",
          "Type": "CNAME",
          "TTL": 300,
          "ResourceRecords": [{"Value": "'$token'.dkim.amazonses.com"}]
        }
      }]
    }'
done
```

### Step 4.3: Verify SES Setup
```bash
# Check SES verification status
aws sesv2 get-email-identity --email-identity edsteward.ai --region us-east-1
```

---

## 📋 **PHASE 5: Application Deployment (15 minutes)**

### Step 5.1: Prepare Environment Variables
```bash
# Return to project root
cd /path/to/your/project/EdSteward

# Set required environment variables
export AWS_REGION=us-east-1
export BASE_DOMAIN=edsteward.ai
```

### Step 5.2: Deploy Application
```bash
# Make deployment script executable
chmod +x scripts/deploy-aws.sh

# Deploy the application (this builds Docker image and deploys to ECS)
./scripts/deploy-aws.sh production v1.0

# Monitor the deployment
echo "Monitoring deployment progress..."
aws ecs describe-services \
  --cluster edsteward-cluster \
  --services edsteward-service \
  --region us-east-1 \
  --query 'services[0].{Status:status,Running:runningCount,Desired:desiredCount}'
```

### Step 5.3: Wait for Deployment Completion
```bash
# Wait for service to be stable (5-10 minutes)
aws ecs wait services-stable \
  --cluster edsteward-cluster \
  --services edsteward-service \
  --region us-east-1

echo "✅ Application deployment completed!"
```

---

## 📋 **PHASE 6: Database Setup (10 minutes)**

### Step 6.1: Connect to Database
```bash
# Get database connection info
DB_ENDPOINT=$(terraform output -raw database_endpoint)
DB_PASSWORD=$(grep db_password infrastructure/terraform/terraform.tfvars | cut -d'"' -f2)

echo "Database endpoint: $DB_ENDPOINT"
echo "Connect with: psql -h $DB_ENDPOINT -U postgres -d edsteward"
```

### Step 6.2: Run Database Migrations
```bash
# If you have existing schema/migration files, run them here
# For now, your application should auto-create tables via Drizzle ORM

# Test database connectivity
psql -h $DB_ENDPOINT -U postgres -d edsteward -c "\dt"
```

---

## 📋 **PHASE 7: SSL & Final Configuration (10 minutes)**

### Step 7.1: Add Root Domain CNAME
```bash
# Add root domain CNAME to ALB
ALB_DNS=$(terraform output -raw alb_dns_name)

aws route53 change-resource-record-sets \
  --hosted-zone-id $(terraform output -raw route53_zone_id) \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "edsteward.ai",
        "Type": "A",
        "AliasTarget": {
          "DNSName": "'$ALB_DNS'",
          "EvaluateTargetHealth": false,
          "HostedZoneId": "Z35SXDOTRQ7X7K"
        }
      }
    }]
  }'
```

### Step 7.2: Verify SSL Certificate
```bash
# Check certificate status
aws acm list-certificates --region us-east-1 --query 'CertificateSummaryList[?DomainName==`edsteward.ai`]'

# SSL certificate should auto-provision via ACM
```

---

## 📋 **PHASE 8: Final Testing & Verification (10 minutes)**

### Step 8.1: Test Application Access
```bash
# Test health endpoint
curl -I https://edsteward.ai/health

# Should return 200 OK
```

### Step 8.2: Verify All Services
```bash
echo "=== DEPLOYMENT VERIFICATION ==="
echo "🌐 Domain: https://edsteward.ai"
echo "⚡ Health: $(curl -s https://edsteward.ai/health | jq -r '.status // "CHECKING..."')"
echo "🗄️  Database: $DB_ENDPOINT"
echo "📧 Email: $(aws sesv2 get-email-identity --email-identity edsteward.ai --region us-east-1 --query 'VerificationStatus' --output text)"
echo "🏗️  ECS Tasks: $(aws ecs describe-services --cluster edsteward-cluster --services edsteward-service --region us-east-1 --query 'services[0].runningCount')"
```

### Step 8.3: Create Admin User (Optional)
```bash
# Access your application and create the first admin user
open https://edsteward.ai
```

---

## 📋 **PHASE 9: Post-Deployment Security (5 minutes)**

### Step 9.1: Security Checklist
- [ ] Change any default passwords
- [ ] Review security group rules
- [ ] Enable CloudTrail (recommended)
- [ ] Set up billing alerts

### Step 9.2: Set Up Monitoring
```bash
# Enable detailed monitoring
aws logs create-log-group --log-group-name /aws/ecs/edsteward --region us-east-1
```

---

## 🎉 **DEPLOYMENT COMPLETE!**

### 📊 **What You Now Have:**
- ✅ **Production AWS Infrastructure**: VPC, ECS, RDS, ALB, Route53
- ✅ **Fully Deployed Application**: Running on ECS with auto-scaling
- ✅ **Custom Domain**: https://edsteward.ai with SSL
- ✅ **Email Services**: SES configured for transactional emails
- ✅ **File Storage**: S3 bucket for uploads
- ✅ **Database**: PostgreSQL RDS with automated backups
- ✅ **Monitoring**: CloudWatch logs and metrics

### 💰 **Monthly Cost Estimate**: ~$75-100
- ECS Tasks: ~$25
- RDS PostgreSQL: ~$30
- Load Balancer: ~$18
- Data Transfer: ~$5-10
- Other services: ~$5-10

### 🔧 **Next Steps:**
1. **Configure SAML** (if needed) using your existing auth components
2. **Import your data** from development environment
3. **Set up monitoring alerts**
4. **Configure backup strategies**
5. **Test all functionality**

### 🆘 **If Something Goes Wrong:**
```bash
# Check ECS service status
aws ecs describe-services --cluster edsteward-cluster --services edsteward-service --region us-east-1

# Check application logs
aws logs tail /aws/ecs/edsteward --follow --region us-east-1

# Check ALB health
curl -I $(terraform output -raw alb_dns_name)/health
```

**🎊 Congratulations! Your EdSteward is now EdSteward.ai in production!** 