# EdSteward Local Development Standard - Single-Tenant On-Premises

## 🐳 **Docker-First Development Policy**

**IMPORTANT**: All local development for EdSteward MUST be done inside Docker containers. We develop single-tenant, per-customer on-premises deployments.

## 🎯 **Why Docker-First Single-Tenant?**

✅ **Production Parity** - Your local environment matches customer on-premises deployments exactly
✅ **Customer Simulation** - Test with specific institution configurations
✅ **Dependency Management** - No conflicts with system-installed packages
✅ **Easy Onboarding** - New developers get running in minutes
✅ **Isolation** - Project dependencies don't interfere with your system
✅ **Per-Customer Testing** - Validate customer-specific features and branding

## 🚀 **Standard Local Workflow**

### **Start Development (Every Time)**
```bash
# 1. Start Docker Desktop (if not running)
open -a Docker

# 2. Start single-tenant development environment
docker-compose -f single-tenant-config/docker-compose.single-tenant.yml up -d

# 3. Your app is now running at http://localhost:3000
# Configured for single institution (Moravian University by default)
# Hot reload enabled - edit files and see changes instantly!
```

### **Testing Your Changes**
```bash
# Test in production-like environment
make -f Makefile.local staging

# If satisfied, mark as production-ready
make -f Makefile.local staging-approve
```

### **Deploy to Customer On-Premises**
```bash
# 1. Build customer-specific Docker image
docker build -f Dockerfile.single-tenant -t edsteward-[customer]:latest .

# 2. Package for customer deployment
./scripts/package-for-customer.sh [customer-name]

# 3. Commit for version control
git add .
git commit -m "Your changes"
git push origin main

# 4. Ship to customer infrastructure
# (Customer deploys using their docker-compose.yml)
```

## 🚫 **What NOT to Do**

❌ **Never run** `npm run dev` directly on macOS
❌ **Never install** Node dependencies on macOS for this project  
❌ **Never develop** outside Docker containers
❌ **Never use** "local" to mean macOS environment

## ✅ **What "Local" Means**

When we say "develop locally" or "test locally", we mean:

- **✅ Local = Docker Container** on your machine
- **❌ Local ≠ macOS Terminal** or system Node.js

## 🔧 **Quick Commands**

```bash
make -f Makefile.local help          # Show all commands
make -f Makefile.local dev           # Start development
make -f Makefile.local dev-logs      # View logs
make -f Makefile.local dev-shell     # Open container shell
make -f Makefile.local staging       # Test in staging
make -f Makefile.local clean         # Clean up everything
```

## 📁 **Single-Tenant Local URLs**

Your Docker environment provides:
- **Application**: http://localhost:3000
- **Database**: PostgreSQL on localhost:5432
- **Redis**: Redis on localhost:6379

Configure for different institutions by editing `.env.single-tenant`

## 🎉 **Benefits You'll Love**

- 🔥 **Hot Reloading** - Edit code, see changes instantly
- 🚀 **Fast Startup** - Development environment ready in seconds
- 🔄 **Easy Reset** - `make clean` removes everything cleanly
- 🏠 **Home Anywhere** - Same environment on any machine
- 🛡️ **No Conflicts** - Your system stays clean

---

**Remember**: Docker containers ARE your local development environment. Embrace the container! 🐳 