# 🚀 EdSteward Deployment Quick Reference

## 🎯 Most Common Operations

### Development
```bash
make dev                    # Start development environment
make dev-logs              # View development logs
make dev-stop              # Stop development environment
```

### Safe Production Deployment
```bash
make pipeline              # Complete staged pipeline (recommended)
```

### Fast Production Deployment
```bash
./scripts/deploy-app.sh    # Direct production deployment (3-5 min)
```

### Emergency Rollback
```bash
./scripts/rollback-app.sh  # Immediate rollback
```

---

## 🔧 Environment URLs

| Environment | URL | Purpose |
|-------------|-----|---------|
| **Development** | http://localhost:3000 | Hot reload development |
| **Staging** | http://localhost:3000 | Pre-production testing |
| **Production** | https://edsteward.ai | Live production |

---

## 📋 Deployment Decision Matrix

| Situation | Use | Command | Time |
|-----------|-----|---------|------|
| **New Feature** | Staging Pipeline | `make pipeline` | 15 min |
| **Bug Fix** | Fast Deploy | `./scripts/deploy-app.sh` | 3 min |
| **Emergency** | Rollback | `./scripts/rollback-app.sh` | 2 min |
| **Infrastructure** | Terraform | `cd infrastructure/terraform && terraform apply` | 20 min |

---

## 🚨 Emergency Procedures

### Production Issue
1. **Immediate**: `./scripts/rollback-app.sh`
2. **Verify**: `curl https://edsteward.ai/health`
3. **Investigate**: `make logs-staging`
4. **Fix**: Develop fix locally
5. **Deploy**: `make pipeline`

### Staging Issues
```bash
make stop-staging          # Stop staging
make clean                 # Clean up
make pipeline              # Restart pipeline
```

---

## 📊 Health Checks

```bash
# Production health
curl https://edsteward.ai/health

# Staging health
curl http://localhost:3000/health

# AWS ECS status
aws ecs describe-services --cluster edsteward-cluster --services edsteward-service
```

---

## 🛠️ Common Fixes

### Docker Issues
```bash
make clean                 # Clean containers
docker system prune -f    # Clean Docker cache
```

### AWS Authentication
```bash
aws configure              # Reconfigure AWS CLI
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 259661441422.dkr.ecr.us-east-1.amazonaws.com
```

### ECS Deployment Stuck
```bash
aws ecs update-service --cluster edsteward-cluster --service edsteward-service --force-new-deployment
```

---

## 📚 Need More Help?

- **Full Guide**: [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)
- **All Commands**: `make help`
- **AWS Console**: https://console.aws.amazon.com/ecs/
- **Logs**: `make logs-staging` 