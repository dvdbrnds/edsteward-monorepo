# 🚀 Modern Development Workflow

## Quick Start for Development

### 1. Start Development Environment (Hot Reloading)
```bash
# Start with hot reloading - NO MORE REBUILDS!
docker-compose -f docker-compose.dev.yml up -d

# Check logs if needed
docker-compose -f docker-compose.dev.yml logs -f
```

**✨ Now you can edit files and see changes instantly!**
- Frontend changes: Automatic hot reload via Vite
- Backend changes: Automatic restart via nodemon
- No container rebuilds needed!

### 2. Access Your App
- **Local Development**: http://localhost:3000
- **With Domain**: http://moravian.edsteward.local (if nginx is running)

### 3. Make Changes
1. Edit any file in your IDE
2. Save the file
3. See changes immediately in browser
4. No rebuilds, no waiting!

## AWS-Based Deployment (Staging → Production)

### 1. Deploy to Staging (Test Your Changes)
```bash
# Add your changes
git add .

# Commit with a meaningful message
git commit -m "Add regulation count display to dashboard"

# Deploy to staging
./scripts/deploy-staging.sh
```

### 2. Staging Deployment
- ✅ AWS deployment script automatically runs tests
- ✅ Builds Docker image for AWS (AMD64)
- ✅ Pushes to ECR registry with `staging-` tag
- ✅ Updates ECS staging service
- ✅ Your changes are live in **STAGING** for testing!

### 3. Promote to Production (When Ready)
```bash
# Merge to main branch to deploy to production
git checkout main
git merge ES-clientside
./scripts/deploy-production.sh
```

### 4. Production Deployment
- ✅ Same process but deploys to production
- ✅ Uses `prod-` tags and production ECS service
- ✅ Your changes are live for real users!

## Development → Staging → Production

| Environment | Command | Purpose | Access |
|-------------|---------|---------|--------|
| **Development** | `docker-compose -f docker-compose.dev.yml up -d` | Hot reloading, instant changes | http://localhost:3000 |
| **Staging** | `./scripts/deploy-staging.sh` | Test changes safely | https://staging.your-domain.com |
| **Production** | `./scripts/deploy-production.sh` | Live for real users | https://your-production-url.com |

## Benefits of This Workflow

### ⚡ **Instant Feedback**
- No more 2-minute container rebuilds
- See changes in < 1 second
- Professional development experience

### 🔄 **Streamlined Deployment**
- Single command deployment scripts
- Direct AWS integration
- Consistent, reliable deployments

### 🛡️ **Safety**
- Tests run before deployment
- Failed tests block deployment
- Easy rollbacks via deployment scripts

### 👥 **Team Collaboration**
- All changes tracked in Git
- Easy code reviews via Pull Requests
- Shared development environment

## Common Commands

```bash
# Start development (most common)
docker-compose -f docker-compose.dev.yml up -d

# Stop development
docker-compose -f docker-compose.dev.yml down

# View logs
docker-compose -f docker-compose.dev.yml logs -f app

# Restart if needed (rare)
docker-compose -f docker-compose.dev.yml restart app

# Check status
docker-compose -f docker-compose.dev.yml ps
```

## Troubleshooting

### If changes aren't reflecting:
1. Check if container is running: `docker-compose -f docker-compose.dev.yml ps`
2. Check logs: `docker-compose -f docker-compose.dev.yml logs -f app`
3. Restart container: `docker-compose -f docker-compose.dev.yml restart app`

### If deployment fails:
1. Check the deployment script logs
2. Look at the failed step output
3. Fix the issue and run the deployment script again

## Next Steps

1. **Configure AWS credentials** for local deployment:
   - Run `aws configure` to set up your credentials
   - Verify with `aws sts get-caller-identity`

2. **Configure branch protection** for main branch

3. **Set up Pull Request reviews** for team collaboration

---

**🎉 You now have a modern, professional development workflow!**
- Instant hot reloading for development
- Streamlined deployment via AWS scripts
- No more manual container rebuilds
- Professional AWS-only deployment pipeline 