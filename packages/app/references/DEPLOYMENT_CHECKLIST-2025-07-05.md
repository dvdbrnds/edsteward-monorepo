# 🚀 EdSteward.ai Deployment Checklist

## Pre-Deployment Setup ⚡
- [ ] AWS account with admin access
- [ ] AWS CLI installed and configured (`aws sts get-caller-identity`)
- [ ] Terraform installed (`terraform --version`)
- [ ] Docker installed (`docker --version`)
- [ ] jq installed (`jq --version`)
- [ ] `edsteward.ai` domain owned and accessible

## Infrastructure Deployment 🏗️
- [ ] Clone repository and install dependencies (`npm install`)
- [ ] Create `infrastructure/terraform/terraform.tfvars` with:
  ```hcl
  aws_region    = "us-east-1"
  environment   = "production"
  app_name      = "edsteward"
  base_domain   = "edsteward.ai"
  db_password   = "SECURE_RANDOM_PASSWORD"
  ```
- [ ] Run `terraform init` in `infrastructure/terraform/`
- [ ] Run `terraform plan` to review changes
- [ ] Run `terraform apply -auto-approve` (takes 10-15 minutes)
- [ ] Save all terraform outputs (ALB DNS, nameservers, etc.)

## Domain Configuration 🌐
- [ ] Copy Route53 nameservers from terraform output
- [ ] Update `edsteward.ai` nameservers at domain registrar
- [ ] Wait for DNS propagation (5-60 minutes)
- [ ] Verify with `dig edsteward.ai NS`

## SES Email Setup 📧
- [ ] Run SES domain verification commands
- [ ] Add SES verification DNS records
- [ ] Wait for SES domain verification
- [ ] Optional: Move SES out of sandbox for production

## Application Deployment 🚀
- [ ] Make deployment script executable (`chmod +x scripts/deploy-aws.sh`)
- [ ] Set environment variables:
  ```bash
  export AWS_REGION=us-east-1
  export BASE_DOMAIN=edsteward.ai
  ```
- [ ] Deploy application (`./scripts/deploy-aws.sh production v1.0`)
- [ ] Monitor deployment logs
- [ ] Verify ECS service is running

## Database Setup 💾
- [ ] Connect to RDS database
- [ ] Run database schema creation
- [ ] Create admin user account
- [ ] Test database connectivity

## DNS & SSL Configuration 🔒
- [ ] Add root domain CNAME to ALB
- [ ] Verify SSL certificate is issued
- [ ] Test HTTPS access (`curl -I https://edsteward.ai/health`)

## Final Testing ✅
- [ ] Access `https://edsteward.ai` in browser
- [ ] Login with admin account
- [ ] Verify application functionality
- [ ] Test subdomain routing (if configured)

## Post-Deployment Security 🔐
- [ ] Change default passwords
- [ ] Review security group rules
- [ ] Enable CloudTrail (recommended)
- [ ] Setup monitoring alerts

## Cost Optimization 💰
- [ ] Review resource sizes (RDS, ECS tasks)
- [ ] Set up billing alerts
- [ ] Consider reserved instances for production

---

## Quick Commands Reference

### Check Deployment Status
```bash
# ECS Service
aws ecs describe-services --cluster edsteward-cluster --services edsteward-service --region us-east-1

# Application Logs
aws logs tail /aws/ecs/edsteward --follow --region us-east-1

# ALB Health
curl -I https://edsteward.ai/health
```

### Troubleshooting
```bash
# DNS Check
dig edsteward.ai

# Certificate Status
aws acm list-certificates --region us-east-1

# Database Connection
telnet $(terraform output -raw database_endpoint) 5432
```

---

**Expected Total Time**: 45-90 minutes
**Monthly Cost**: ~$75 (can be reduced for development) 