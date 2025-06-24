# Domain Configuration - EdSteward.ai

## Overview

The RegulatoryTrackr application has been configured to use `edsteward.ai` as the primary domain for multi-tenant deployment on AWS.

## Domain Structure

### Multi-Tenant Subdomains
- **Primary Domain**: `edsteward.ai`
- **Tenant Format**: `{tenant}.edsteward.ai`
- **Examples**: 
  - `university1.edsteward.ai`
  - `college2.edsteward.ai`
  - `acme-corp.edsteward.ai`

### Email Configuration
- **Default SES From Email**: `noreply@edsteward.ai`
- **Support Email**: `support@edsteward.ai`
- **Organization Name**: EdSteward

## DNS Configuration Required

### Route53 Hosted Zone
The Terraform configuration will create a hosted zone for `edsteward.ai` with the following records:

1. **Root Domain (A/AAAA)**: Points to ALB
2. **Wildcard (*.edsteward.ai)**: CNAME to ALB for tenant subdomains
3. **Mail (mail.edsteward.ai)**: MX record for SES

### SSL Certificate
- **Primary**: `edsteward.ai`
- **SAN**: `*.edsteward.ai` (wildcard for all tenant subdomains)

## SAML Configuration

### Service Provider Metadata
Each tenant will have metadata available at:
```
https://{tenant}.edsteward.ai/auth/saml/metadata
```

### Entity IDs
- **Format**: `urn:regulatorytrackr:sp:{tenant-id}`
- **Example**: `urn:regulatorytrackr:sp:university1`

### Callback URLs
- **Format**: `https://{tenant}.edsteward.ai/auth/saml/callback`
- **Example**: `https://university1.edsteward.ai/auth/saml/callback`

## Environment Variables

### Required for Deployment
```bash
BASE_DOMAIN=edsteward.ai
SES_FROM_EMAIL=noreply@edsteward.ai
AWS_REGION=us-east-1
```

### Terraform Variables
```hcl
base_domain = "edsteward.ai"
```

## Implementation Files Updated

The following files have been updated to use `edsteward.ai`:

1. **Infrastructure**:
   - `infrastructure/terraform/main.tf`
   - `infrastructure/aws/docker-compose.yml`

2. **Server Configuration**:
   - `server/middleware/tenant.ts`
   - `server/auth/tenant-saml.ts`
   - `server/config/saml.ts`
   - `server/services/email-aws.ts`

3. **Scripts and Documentation**:
   - `scripts/tenant-onboarding.sh`
   - `docs/MULTI_TENANT_AWS_DEPLOYMENT.md`

## Deployment Steps

1. **Update DNS**: Point `edsteward.ai` nameservers to Route53
2. **Deploy Infrastructure**: Run Terraform with updated domain
3. **Configure SES**: Verify domain identity in AWS SES
4. **Deploy Application**: Use deployment script with new domain
5. **Test Tenant Access**: Verify subdomain routing works

## Security Considerations

- SSL certificates automatically cover all tenant subdomains
- SES domain verification required for email sending
- Cross-origin policies configured for subdomain access
- Session cookies scoped to parent domain for SSO

## Cost Implications

- Single Route53 hosted zone covers all tenants
- Wildcard SSL certificate covers unlimited subdomains
- Shared ALB serves all tenant traffic efficiently
- SES charges based on email volume, not domain count 