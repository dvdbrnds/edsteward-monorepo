# EdSteward Docker Development Verification Checklist

> **Purpose:** Prevent regression from Docker-first development environment back to problematic macOS development.

## 🔒 Pre-Development Verification

### ✅ Environment Setup

- [ ] Docker Desktop is installed and running
- [ ] `./dev.sh verify` passes all checks
- [ ] `docker-compose.dev.yml` file exists
- [ ] `Dockerfile.dev` file exists
- [ ] `.vscode/settings.json` contains Docker-first configuration
- [ ] Terminal shows "🐳 EdSteward Docker Development Environment" message

### ✅ Dependencies Verification

- [ ] `package.json` contains ONLY `bcryptjs` (NO `bcrypt`)
- [ ] `package.json` does NOT contain `@types/bcrypt`
- [ ] All server imports use `bcryptjs` not `bcrypt`
- [ ] No native binary dependencies that could cause architecture issues

## 🚀 Development Workflow Verification

### ✅ Starting Development

- [ ] **NEVER** run `npm run dev` on macOS
- [ ] **NEVER** run `npm start` on macOS
- [ ] **NEVER** run `node server/index.ts` on macOS
- [ ] **ALWAYS** use `./dev.sh up` or `docker-compose -f docker-compose.dev.yml up`
- [ ] Application starts without bcrypt architecture errors
- [ ] Application accessible at <http://localhost:3000>
- [ ] Database connections work correctly

### ✅ During Development

- [ ] Code changes trigger automatic reload in container
- [ ] No errors in `./dev.sh logs`
- [ ] Hot reload working for both client and server changes
- [ ] File uploads work correctly (if applicable)
- [ ] Database operations work correctly

### ✅ Before Committing Code

- [ ] Application tested in Docker development environment
- [ ] No `npm run dev` commands in any scripts or documentation
- [ ] All team members instructed to use Docker development
- [ ] `./dev.sh verify` passes
- [ ] Container starts cleanly with `./dev.sh up`

## 🚢 Pre-Deployment Verification

### ✅ Code Quality

- [ ] No console errors in browser
- [ ] No Docker container errors in logs
- [ ] All features working as expected
- [ ] Database migrations run successfully (if any)
- [ ] Environment variables properly configured

### ✅ Architecture Consistency

- [ ] Development environment (Docker) matches production (AWS ECS)
- [ ] Same Node.js version in dev and production
- [ ] Same Linux Alpine environment
- [ ] No macOS-specific dependencies

### ✅ Deployment Pipeline

- [ ] Code tested thoroughly in Docker development
- [ ] No architecture mismatches
- [ ] `./scripts/deploy-production.sh` used for deployment
- [ ] Never deploy code that hasn't been tested in Docker

## 🆘 Regression Prevention

### ❌ RED FLAGS - Never Allow These

**Commands that should NEVER be used:**

```bash
npm run dev          # ❌ NEVER on macOS
npm start           # ❌ NEVER on macOS  
node server/index.ts # ❌ NEVER on macOS
```

**Dependencies that should NEVER be added:**

```json
{
  "bcrypt": "any-version",           // ❌ NEVER - use bcryptjs
  "@types/bcrypt": "any-version"     // ❌ NEVER - use @types/bcryptjs
}
```

**Documentation that should NEVER mention:**

- "Run `npm run dev` to start development"
- "Use local Node.js for development"
- "Install dependencies with npm install and run"

### ✅ GREEN FLAGS - Always Enforce These

**Required Commands:**

```bash
./dev.sh up         # ✅ ALWAYS use for development
./dev.sh logs       # ✅ ALWAYS use for debugging
./dev.sh shell      # ✅ ALWAYS use for container access
```

**Required Dependencies:**

```json
{
  "bcryptjs": "^3.0.2",           // ✅ ALWAYS use instead of bcrypt
  "@types/bcryptjs": "^2.4.6"    // ✅ ALWAYS use for TypeScript
}
```

**Required Documentation:**

- "Use Docker development environment only"
- "Run `./dev.sh up` to start development"
- "Never use npm run dev on macOS"

## 🔧 Troubleshooting Verification

### If Someone Reports Issues

**Step 1: Verify They're Using Docker**

```bash
# Ask them to run:
./dev.sh status

# Should show running containers, not "No containers"
```

**Step 2: Check for macOS Development Regression**

```bash
# Check if they accidentally started macOS development:
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

# Then start Docker properly:
./dev.sh up
```

**Step 3: Verify Dependencies**

```bash
# Check for bcrypt issues:
grep -r "from 'bcrypt'" server/
grep -r "import bcrypt" server/

# Should return NO results
```

## 📋 Weekly Team Verification

### Team Lead Checklist

- [ ] All team members using Docker development
- [ ] No one reporting "bcrypt architecture errors"  
- [ ] No one using `npm run dev` on macOS
- [ ] Deployment success rate high (no architecture conflicts)
- [ ] New team members properly onboarded to Docker workflow

### Monthly System Check

- [ ] Update Docker development guide if needed
- [ ] Verify all documentation mentions Docker-first approach
- [ ] Check that no legacy macOS development instructions exist
- [ ] Ensure VS Code/Cursor settings enforce Docker workflow
- [ ] Review and update this checklist based on any new issues

## 🎯 Success Metrics

### Development Environment

- **100%** of developers using Docker for local development
- **0** bcrypt architecture errors reported
- **0** instances of `npm run dev` usage on macOS
- **>95%** successful container startups with `./dev.sh up`

### Deployment Success

- **>95%** successful deployments to AWS
- **0** architecture-related deployment failures
- **<5 minutes** average deployment time
- **0** rollbacks due to environment inconsistencies

---

**Remember:** This checklist exists because Docker development environment is the ONLY reliable way to develop EdSteward. Any deviation leads to deployment failures and wasted time.
