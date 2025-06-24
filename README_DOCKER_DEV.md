# RegulatoryTrackr - Local Docker Development

## 🚀 Quick Start

```bash
# 1. Start development environment (with hot reload)
make -f Makefile.local dev

# 2. Your app is running at http://localhost:3000
# Edit your code - changes appear instantly!

# 3. When ready to test in production-like environment
make -f Makefile.local staging

# 4. When satisfied with testing
make -f Makefile.local staging-approve
```

## 📁 What's Here

- **`Makefile.local`** - Local development commands
- **`docker-compose.dev.yml`** - Development environment with hot reload
- **`docker-compose.local-staging.yml`** - Staging environment for testing
- **`Dockerfile.dev`** - Development container setup
- **`LOCAL_DEVELOPMENT.md`** - Detailed development guide

## 🎯 Development Flow

1. **Develop**: Work in Docker with hot reload (`make -f Makefile.local dev`)
2. **Test**: Verify in staging environment (`make -f Makefile.local staging`)  
3. **Approve**: Mark as production-ready (`make -f Makefile.local staging-approve`)

## 🔧 Key Commands

```bash
make -f Makefile.local help        # Show all commands
make -f Makefile.local dev         # Start development
make -f Makefile.local dev-logs    # View logs
make -f Makefile.local staging     # Test in staging
make -f Makefile.local clean       # Clean up everything
```

## 📊 Environment Details

**Development:**
- Hot reloading enabled
- Source code mounted
- http://localhost:3000
- Database: localhost:5433

**Staging:**
- Production-like build
- No hot reload
- http://localhost:3000  
- Database: localhost:5432

## 🌟 Features

- ✅ **Pure Docker Development** - Everything in containers
- ✅ **Hot Reloading** - See changes instantly
- ✅ **Production Parity** - Staging mirrors production
- ✅ **AWS Ready** - Tagged images for future deployment
- ✅ **Clean Workflow** - Simple dev → staging → approve

## 🚨 AWS Deployment

AWS deployment scripts are archived in `scripts/aws-scripts/` and ready when you need them. For now, focus on local development!

---

**Ready to start?** Run `make -f Makefile.local dev` and begin coding! 🎉 