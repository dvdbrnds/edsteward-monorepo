# 🚀 Local Development Workflow

**Focus**: Pure Docker development with hot reloading, then staging verification. AWS-ready but local-first.

## 🎯 Your Development Process

### 1. Start Development Environment
```bash
make -f Makefile.local dev
```

**What this does:**
- ✅ Starts Docker containers with hot reload
- ✅ Mounts your source code (changes reflect instantly)
- ✅ Sets up database and Redis with complete data
- ✅ Loads 25+ regulations automatically
- ✅ Available at http://localhost:3000

### 2. Develop Your Application
- **Edit code** in your editor - changes appear instantly in Docker
- **View logs**: `make -f Makefile.local dev-logs`
- **Open shell**: `make -f Makefile.local dev-shell`
- **Restart if needed**: `make -f Makefile.local dev-restart`

### 3. Test in Staging
When ready to test your changes in a production-like environment:
```bash
make -f Makefile.local staging
```

**What this does:**
- ✅ Stops dev environment 
- ✅ Builds production-like Docker image
- ✅ Starts staging environment at http://localhost:3000
- ✅ Runs with production settings

### 4. Approve for Production
After thorough testing in staging:
```bash
make -f Makefile.local staging-approve
```

**What this does:**
- ✅ Creates production-ready Docker image
- ✅ Tags it with timestamp
- ✅ Saves tag for future AWS deployment
- ✅ Marks version as deployment-ready

## 📋 Key Commands

### Development
```bash
make -f Makefile.local dev          # Start development with hot reload
make -f Makefile.local dev-logs     # Watch live logs
make -f Makefile.local dev-shell    # Open container shell
make -f Makefile.local dev-stop     # Stop development
```

### Staging & Testing
```bash
make -f Makefile.local staging         # Start staging environment
make -f Makefile.local staging-logs    # View staging logs
make -f Makefile.local staging-approve # Mark as production-ready
make -f Makefile.local staging-stop    # Stop staging
```

### Utilities
```bash
make -f Makefile.local status      # Show what's running
make -f Makefile.local clean       # Clean up everything
make -f Makefile.local help        # Show all commands
```

## 🔄 Typical Workflow

```
┌─────────────────┐
│  1. make dev    │ ← Start here, develop with hot reload
└─────────┬───────┘
          │ (edit code, see changes instantly)
          │
┌─────────▼───────┐
│ 2. make staging │ ← Test when ready
└─────────┬───────┘
          │ (test thoroughly in production-like environment)
          │
┌─────────▼───────────┐
│ 3. staging-approve  │ ← Approve when satisfied
└─────────────────────┘
          │
    (Ready for AWS!)
```

## 🌐 Environment Details

### **Local Development Environment**
- **URLs**: 
  - Admin Console: http://admin.edsteward.local
  - Moravian Tenant: http://moravian.edsteward.local
  - Test Tenant: http://test.edsteward.local
- **Architecture**: Docker containers + nginx proxy
- **Database**: Neon PostgreSQL (tenant-specific databases)
- **Hot Reload**: ✅ Enabled with WebSocket support
- **Source Mounting**: ✅ Code changes reflect instantly
- **Environment**: `NODE_ENV=development`
- **Multi-Tenant**: ✅ Full subdomain routing like production

### **Staging Environment**
- **URL**: https://staging.edsteward.ai
- **Database**: Staging PostgreSQL database
- **Architecture**: AWS ECS + Application Load Balancer
- **Environment**: `NODE_ENV=staging`
- **Purpose**: Production-like testing before deployment

## 💡 Development Tips

### Making Changes
- Just edit your code normally - changes appear instantly in the dev environment
- No need to rebuild or restart for code changes
- If you add new dependencies, restart: `make -f Makefile.local dev-restart`

### Debugging
- Use `make -f Makefile.local dev-logs` to see live application logs
- Use `make -f Makefile.local dev-shell` to explore the container
- Check `make -f Makefile.local status` to see what's running

### Testing
- Develop in dev environment (hot reload)
- Test in staging environment (production-like)
- Only approve when you're completely satisfied

### When You're Ready for AWS
- Run `make -f Makefile.local staging-approve`
- Your Docker image will be tagged and ready
- You can later add AWS deployment scripts using the tagged image

## 🛠️ Environment Variables

The setup uses different configurations for development vs staging:

**Development:**
- Hot reloading enabled
- Debug logging
- External APIs disabled
- Different database/Redis ports (no conflicts)

**Staging:**
- Production-like build
- Production logging
- All features enabled
- Same ports as production would use

## 🚨 Local Development Setup

### **Required /etc/hosts entries:**
```bash
127.0.0.1 admin.edsteward.local
127.0.0.1 moravian.edsteward.local  
127.0.0.1 test.edsteward.local
127.0.0.1 edsteward.local
```

### **Port Usage:**
- **HTTP**: Port 80 (nginx proxy handles subdomain routing)
- **Application**: Port 3000 (internal Docker network)
- **Database**: External Neon PostgreSQL (tenant-specific)

### **Architecture:**
```
nginx (port 80) → Docker App (port 3000) → Neon Database
   ↓
├── admin.edsteward.local → Admin Console
├── moravian.edsteward.local → Moravian Tenant  
└── test.edsteward.local → Test Tenant
```

## 🎉 Ready to Start?

### **1. Setup Local Domains**
```bash
# Add to your /etc/hosts file (requires sudo)
sudo bash -c 'cat >> /etc/hosts << EOF
127.0.0.1 admin.edsteward.local
127.0.0.1 moravian.edsteward.local  
127.0.0.1 test.edsteward.local
127.0.0.1 edsteward.local
EOF'
```

### **2. Start Development Environment**
```bash
# Check you have everything installed
make -f Makefile.local check-tools

# Start Docker containers with nginx proxy
make -f Makefile.local dev
```

### **3. Access Your Application**
- **Admin Console**: http://admin.edsteward.local
- **Moravian Tenant**: http://moravian.edsteward.local  
- **Test Tenant**: http://test.edsteward.local

Your application will be ready with hot reloading enabled and proper multi-tenant subdomain routing!

---

**🔑 Key Benefits:**
- ✅ **Pure Docker**: Everything runs in containers
- ✅ **Hot Reload**: Instant feedback on changes  
- ✅ **Production Parity**: Staging mirrors production
- ✅ **AWS Ready**: Tagged images ready for deployment
- ✅ **No AWS Complexity**: Focus on development first 