# Dev Environment Setup Plan

## Overview
Add a **dev environment** (dev.edsteward.ai) to create a traditional dev → staging → production workflow for the **multi-tenant SaaS platform**, alongside the existing feature flag system.

## Platform Evolution Context
- **Original**: Bespoke solution built specifically for Moravian University
- **Current**: Transitioning to multi-tenant SaaS platform
- **Moravian**: Now the most mature tenant, but still just one of many clients

## Current Workflow
- **Local**: moravian.edsteward.local (testing multi-tenant functionality locally)
- **Staging**: ES-clientside branch → staging.edsteward.ai (platform testing)
- **Production**: main branch → Multi-tenant platform serving all clients

## Proposed New Workflow
- **Local**: moravian.edsteward.local (testing multi-tenant functionality locally) 
- **Dev**: dev branch → dev.edsteward.ai (platform development environment)
- **Staging**: ES-clientside branch → staging.edsteward.ai (platform staging)  
- **Production**: main branch → Multi-tenant SaaS platform
  - moravian.edsteward.ai (Moravian tenant - most mature)
  - tenant2.edsteward.ai (Future tenants)
  - admin.edsteward.ai (Platform administration)

## Implementation Plan

### 1. AWS Infrastructure Setup

#### A. Create Dev ECS Cluster & Service
```bash
# Create dev cluster
aws ecs create-cluster \
    --cluster-name edsteward-multi-tenant-dev-cluster \
    --capacity-providers FARGATE \
    --default-capacity-provider-strategy capacityProvider=FARGATE,weight=1

# Create dev service (copy from staging, modify names)
```

#### B. Load Balancer Configuration
```bash
# Add dev target group
aws elbv2 create-target-group \
    --name edsteward-dev-tg \
    --protocol HTTP \
    --port 3000 \
    --vpc-id vpc-xxxxxx \
    --target-type ip \
    --health-check-path /health

# Add dev listener rules
# dev.edsteward.ai → dev target group
# moravian-dev.edsteward.ai → dev target group
```

#### C. DNS Configuration
Add DNS records:
- `dev.edsteward.ai` → ALB (platform dev environment)

### 2. Database Strategy

#### Option A: Shared Dev Database (Recommended)
- Use same database as staging
- Add tenant isolation via `environment` field
- Cost-effective, simpler management

#### Option B: Separate Dev Database  
- Create separate Neon database for dev
- Complete isolation
- Higher cost, more management overhead

**Recommendation**: Option A with proper tenant isolation

### 3. GitHub Actions Workflow Updates

#### Update `.github/workflows/deploy.yml`

Add dev deployment job:
```yaml
deploy-dev:
  needs: test
  runs-on: ubuntu-latest
  if: github.ref == 'refs/heads/dev'
  environment: development
  
  steps:
  - uses: actions/checkout@v4
  
  - name: Configure AWS credentials
    uses: aws-actions/configure-aws-credentials@v4
    with:
      aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
      aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
      aws-region: us-east-1
  
  - name: Login to Amazon ECR
    id: login-ecr
    uses: aws-actions/amazon-ecr-login@v2
  
  - name: Build and push Docker image to dev
    env:
      ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
      ECR_REPOSITORY: edsteward-multi-tenant
      IMAGE_TAG: dev-${{ github.sha }}
    run: |
      docker build --platform linux/amd64 -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .
      docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
      
      docker tag $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG $ECR_REGISTRY/$ECR_REPOSITORY:dev-latest
      docker push $ECR_REGISTRY/$ECR_REPOSITORY:dev-latest
  
  - name: Update ECS dev service
    run: |
      aws ecs update-service \
        --cluster edsteward-multi-tenant-dev-cluster \
        --service edsteward-multi-tenant-dev-service \
        --force-new-deployment \
        --region us-east-1
```

### 4. Branch Strategy

#### Create and Configure Dev Branch
```bash
# Create dev branch from ES-clientside
git checkout ES-clientside
git checkout -b dev
git push origin dev

# Set up branch protection rules in GitHub
# Require PR reviews for dev → ES-clientside merges
```

#### Workflow
1. **Feature Development**: Work on feature branches
2. **Dev Testing**: Merge to `dev` branch → auto-deploy to dev.edsteward.ai (platform testing)
3. **Staging Testing**: Merge `dev` to `ES-clientside` → auto-deploy to staging.edsteward.ai (final verification)
4. **Production**: Merge `ES-clientside` to `main` → auto-deploy to multi-tenant SaaS platform
   - All tenants (Moravian, future clients) get updates automatically
   - Feature flags control rollout to specific tenants if needed

### 5. Environment Configuration

#### Environment Variables
```bash
# Dev environment
NODE_ENV=development
DATABASE_URL=dev_database_url
ENVIRONMENT_NAME=dev
TENANT_DETECTION_METHOD=subdomain
CORS_ORIGIN=https://dev.edsteward.ai
```

#### Feature Flag Integration
```typescript
// Dev environment gets all experimental features
const devFeatureFlags = {
  ...defaultFeatureFlags,
  experimentalUI: true,
  betaFeatures: true,
  debugMode: true
}
```

### 6. Cost Optimization

#### Resource Sizing for Dev
- **ECS Tasks**: 0.25 vCPU, 0.5 GB RAM (minimal)
- **Auto Scaling**: Min 1, Max 2 tasks
- **Database**: Shared with staging (cost-effective)

#### Estimated Monthly Cost
- ECS Fargate: ~$15-20/month
- Load Balancer: Shared (no additional cost)
- Database: Shared (no additional cost)
- **Total Additional**: ~$15-20/month

### 7. Manual Setup Script

Create `scripts/setup-dev-environment.sh`:
```bash
#!/bin/zsh
set -e

echo "🚀 Setting up dev environment..."

# 1. Create ECS cluster
echo "📦 Creating ECS cluster..."
aws ecs create-cluster --cluster-name edsteward-multi-tenant-dev-cluster

# 2. Create target group  
echo "🎯 Creating target group..."
# ... target group creation commands

# 3. Create ECS service
echo "⚙️ Creating ECS service..."
# ... service creation commands

# 4. Update load balancer rules
echo "🔀 Updating load balancer..."
# ... listener rule creation

echo "✅ Dev environment setup complete!"
echo "🌐 Dev environment will be available at:"
echo "  • https://dev.edsteward.ai (platform development)"
echo ""
echo "🏢 Multi-tenant SaaS platform serves all clients:"
echo "  • moravian.edsteward.ai (most mature tenant)"
echo "  • Future tenants get same platform updates"
echo "  • Feature flags control tenant-specific rollouts"
```

### 8. Documentation Updates

#### Update Makefile.local
Add dev environment commands:
```makefile
dev-deploy: ## Deploy current branch to dev environment
	@echo "🚀 Deploying to dev environment..."
	@git push origin dev

dev-status: ## Check dev environment status  
	@./scripts/check-dev-status.sh

dev-logs: ## View dev environment logs
	@aws logs tail /ecs/edsteward-multi-tenant-dev --follow
```

### 9. Testing Strategy

#### Dev Environment Testing
- **Automated**: All unit/integration tests
- **Manual**: Quick smoke tests
- **Purpose**: Catch issues before staging

#### Staging Environment Testing  
- **Automated**: Full test suite
- **Manual**: Comprehensive testing
- **Purpose**: Final verification before production

### 10. Implementation Timeline

#### Phase 1: Infrastructure (1-2 hours)
- [ ] Create ECS cluster and service
- [ ] Configure load balancer rules
- [ ] Set up DNS records

#### Phase 2: CI/CD Pipeline (30 minutes)
- [ ] Update GitHub Actions workflow
- [ ] Create dev branch
- [ ] Test deployment pipeline

#### Phase 3: Documentation (30 minutes)
- [ ] Update README and workflow docs
- [ ] Create troubleshooting guides
- [ ] Update Makefile commands

#### Phase 4: Testing (1 hour)
- [ ] Test full dev → staging → production flow
- [ ] Verify multi-tenant functionality
- [ ] Test feature flag integration

**Total Estimated Time**: 3-4 hours

## Multi-Tenant Architecture Considerations

### Current State (Bespoke → SaaS Transition)
- **Database**: Already multi-tenant ready with tenant isolation
- **Feature Flags**: Perfect for gradual SaaS rollouts
- **Moravian**: Most mature tenant with full feature set
- **New Tenants**: Can start with basic features, grow over time

### Dev Environment Benefits for SaaS
1. **Tenant Isolation Testing**: Test how changes affect different tenant configurations
2. **Feature Flag Validation**: Verify tenant-specific feature rollouts work correctly
3. **Performance Testing**: Ensure platform scales with multiple tenants
4. **Migration Testing**: Test how Moravian's bespoke features work in multi-tenant context

### Platform vs Tenant-Specific Development
```typescript
// Platform-wide features (affect all tenants)
const platformFeatures = {
  coreCompliance: true,      // All tenants get this
  basicReporting: true,      // Standard across platform
  securityUpdates: true      // Critical for all
}

// Tenant-specific features (controlled rollout)
const tenantFeatures = {
  moravian: {
    advancedReporting: true,    // Mature tenant gets advanced features
    customWorkflows: true,      // Bespoke features maintained
    betaFeatures: true          // Early access for testing
  },
  newTenant: {
    advancedReporting: false,   // Start with basics
    customWorkflows: false,     // Standard workflows only
    betaFeatures: false         // Stable features only
  }
}
```

## Benefits of This Setup

### 1. **Traditional Workflow**
- Clear dev → staging → production progression
- Familiar to most development teams
- Easy to understand and follow

### 2. **Risk Reduction**
- Dev environment catches issues early
- Staging remains stable for final testing
- Production deployments are safer

### 3. **Multi-Tenant SaaS Development**
- Test features across different tenant configurations
- Use feature flags for tenant-specific rollouts
- Moravian (mature tenant) vs new tenants with different needs

### 4. **Team Collaboration**
- Multiple developers can use dev environment
- Platform-wide changes tested before affecting all tenants
- Clear separation between platform development and tenant-specific needs

## Next Steps

1. **Confirm Approach**: Approve this plan
2. **Create Infrastructure**: Run setup scripts
3. **Update CI/CD**: Modify GitHub Actions
4. **Test Pipeline**: Deploy test changes
5. **Document**: Update team documentation

Would you like me to proceed with implementing this dev environment setup? 