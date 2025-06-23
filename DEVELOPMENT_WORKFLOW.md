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

## GitHub-Based Deployment

### 1. Commit and Push Changes
```bash
# Add your changes
git add .

# Commit with a meaningful message
git commit -m "Add regulation count display to dashboard"

# Push to trigger automatic deployment
git push origin ES-clientside
```

### 2. Automatic Deployment
- ✅ GitHub Actions automatically runs tests
- ✅ Builds Docker image for AWS (AMD64)
- ✅ Pushes to ECR registry
- ✅ Updates ECS service
- ✅ Your changes are live in production!

## Development vs Production

| Environment | Command | Purpose | Access |
|-------------|---------|---------|--------|
| **Development** | `docker-compose -f docker-compose.dev.yml up -d` | Hot reloading, instant changes | http://localhost:3000 |
| **Production** | Automatic via GitHub Actions | Deployed to AWS ECS | https://your-production-url.com |

## Benefits of This Workflow

### ⚡ **Instant Feedback**
- No more 2-minute container rebuilds
- See changes in < 1 second
- Professional development experience

### 🔄 **Automatic Deployment**
- Push to GitHub = automatic deployment
- No manual AWS commands
- Consistent, reliable deployments

### 🛡️ **Safety**
- Tests run before deployment
- Failed tests block deployment
- Easy rollbacks via GitHub

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
1. Check GitHub Actions tab in your repository
2. Look at the failed step logs
3. Fix the issue and push again

## Next Steps

1. **Set up GitHub Secrets** for AWS deployment:
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`

2. **Configure branch protection** for main branch

3. **Set up Pull Request reviews** for team collaboration

---

**🎉 You now have a modern, professional development workflow!**
- Instant hot reloading for development
- Automatic deployment via GitHub
- No more manual container rebuilds
- Professional CI/CD pipeline 