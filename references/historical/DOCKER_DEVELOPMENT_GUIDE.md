# EdSteward Docker Development Guide

> **CRITICAL:** This is the ONLY approved development environment for EdSteward. Never use `npm run dev` on macOS.

## 🎯 Overview

EdSteward has transitioned to a **Docker-first development environment** to ensure perfect parity between development and production environments. This eliminates architecture conflicts, shell inconsistencies, and AWS CLI issues that were causing deployment failures.

## ✅ Benefits of Docker Development

- **🐳 Perfect Dev/Production Parity** - Same Linux Alpine environment
- **🔧 No Shell Issues** - Standard bash, no more zsh/macOS conflicts  
- **☁️ No AWS CLI Pager Issues** - Clean Linux environment
- **🏗️ Reliable Deployments** - Identical container technology
- **⚡ Hot Reload** - Code changes reload automatically
- **🛡️ Architecture Safety** - No ARM64/x86_64 mismatches

## 🚀 Quick Start

### Prerequisites
- Docker Desktop installed and running
- EdSteward repository cloned locally

### Start Development
```bash
# Navigate to project root
cd /path/to/EdSteward

# Start Docker development environment
./dev.sh up

# OR use docker-compose directly
docker-compose -f docker-compose.dev.yml up
```

### Access Application
- **Application:** http://localhost:3000
- **Docker Desktop:** View container logs and status
- **VS Code/Cursor:** Edit files normally, changes auto-reload

## 📋 Development Workflow Commands

### Essential Commands

```bash
# Start development environment
./dev.sh up
./dev.sh start          # Alias for up

# Stop development environment  
./dev.sh down
./dev.sh stop           # Alias for down

# View real-time logs
./dev.sh logs

# Restart after major changes
./dev.sh restart

# Check container status
./dev.sh status

# Access container shell (debugging)
./dev.sh shell

# Rebuild container (after dependency changes)
./dev.sh build
```

### Direct Docker Compose Commands

```bash
# Start (with auto-rebuild)
docker-compose -f docker-compose.dev.yml up --build

# Start in background
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f app

# Stop and remove containers
docker-compose -f docker-compose.dev.yml down

# Rebuild containers
docker-compose -f docker-compose.dev.yml build --no-cache
```

## 🔧 Development Environment Details

### Container Configuration

- **Base Image:** `node:18-alpine`
- **Working Directory:** `/app`
- **Port Mapping:** `3000:3000`
- **User:** `nextjs:nodejs` (non-root for security)
- **Dependencies:** Only `bcryptjs` (no native bcrypt)

### Volume Mounts

The following directories are mounted for live development:

```yaml
volumes:
  - ./server:/app/server           # Server code
  - ./client:/app/client           # Client code
  - ./shared:/app/shared           # Shared utilities
  - ./package.json:/app/package.json
  - ./.env:/app/.env
  - ./uploads:/app/uploads         # File uploads
```

### Environment Variables

Development environment uses the same `.env` file as local development with these key variables:

```bash
NODE_ENV=development
DATABASE_URL=your_neon_database_url
SESSION_SECRET=your_session_secret
```

## 🛠️ Development Tasks

### Making Code Changes

1. **Edit files normally** in VS Code/Cursor
2. **Save changes** - auto-reload happens automatically
3. **View logs** with `./dev.sh logs` if needed
4. **Access application** at http://localhost:3000

### Adding Dependencies

```bash
# Stop container
./dev.sh down

# Edit package.json (add new dependency)
# Then rebuild and restart
./dev.sh build
./dev.sh up
```

### Database Changes

Database changes work seamlessly since the container connects to the same Neon database as local development.

### Debugging Issues

```bash
# Access container shell
./dev.sh shell

# Check container logs
./dev.sh logs

# Check container status
docker-compose -f docker-compose.dev.yml ps

# Restart with fresh build
./dev.sh down
./dev.sh build  
./dev.sh up
```

## 🚢 Deployment Integration

### Development → Production Pipeline

The Docker development environment ensures seamless deployment:

1. **Development**: Docker container (Linux Alpine)
2. **Build**: Same Docker container built for production
3. **Deploy**: `./scripts/deploy-production.sh`
4. **Production**: AWS ECS Fargate (Linux containers)

### Pre-Deployment Verification

Before deploying, verify your changes work in Docker:

```bash
# Test in Docker development
./dev.sh up

# Verify functionality at http://localhost:3000
# Run tests if available
npm test

# Deploy when satisfied
./scripts/deploy-production.sh
```

## ⚠️ Important Guidelines

### DO NOT Use Local macOS Development

❌ **NEVER run these commands:**
```bash
npm run dev          # Don't run on macOS
npm start           # Don't run on macOS  
node server/index.ts # Don't run on macOS
```

✅ **ALWAYS use Docker:**
```bash
./dev.sh up         # Correct way
docker-compose -f docker-compose.dev.yml up  # Also correct
```

### Port Conflicts

If you get `EADDRINUSE` errors:

```bash
# Kill any processes on port 3000
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

# Then start Docker development
./dev.sh up
```

### Container Issues

If containers won't start:

```bash
# Clean restart
./dev.sh down
docker system prune -f
./dev.sh build
./dev.sh up
```

## 🔍 Verification Checklist

### Before Committing Code

- [ ] Application starts successfully with `./dev.sh up`
- [ ] No errors in `./dev.sh logs`
- [ ] Application accessible at http://localhost:3000
- [ ] All features working as expected
- [ ] Database connections successful
- [ ] File uploads working (if applicable)

### Before Deployment

- [ ] Code tested in Docker development environment
- [ ] No architecture-specific dependencies
- [ ] All imports use `bcryptjs` (never `bcrypt`)
- [ ] Environment variables configured correctly
- [ ] Application builds without errors

## 🆘 Troubleshooting

### Common Issues

**Issue: Container won't start**
```bash
# Solution: Clean rebuild
./dev.sh down
rm -rf node_modules
./dev.sh build
./dev.sh up
```

**Issue: Database connection errors**
```bash
# Solution: Check environment variables
./dev.sh shell
echo $DATABASE_URL
# Verify .env file is correct
```

**Issue: bcrypt architecture errors**
```bash
# Solution: Verify only bcryptjs is used
grep -r "from 'bcrypt'" server/
grep -r "import bcrypt" server/
# Replace any bcrypt imports with bcryptjs
```

**Issue: Port already in use**
```bash
# Solution: Kill conflicting processes
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
./dev.sh up
```

### Getting Help

1. **Check logs first:** `./dev.sh logs`
2. **Verify container status:** `./dev.sh status` 
3. **Access container shell:** `./dev.sh shell`
4. **Clean restart:** `./dev.sh down && ./dev.sh build && ./dev.sh up`

## 📚 Additional Resources

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Docker Development Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [EdSteward Architecture Guide](./docs/ARCHITECTURE.md)
- [Deployment Guide](./DEPLOYMENT_GUIDE.md)

---

**Remember:** Docker development environment is the ONLY supported method. This ensures consistency, reliability, and successful deployments to production. 