**CRITICAL EdSteward Authentication Issue - September 5, 2025**

**Problem**: Authentication failing on AWS production (moravian.edsteward.ai) with "Email and password required" error despite correct credentials.

**Root Causes Found**:
1. **Frontend/Backend Endpoint Mismatch**: Frontend was calling `/api/login` but working endpoint is `/api/authenticate` 
2. **Historical ALB Session Stickiness Issue**: July 28, 2025 - users bounced between servers losing sessions
3. **Password Hash Corruption**: Database passwords were corrupted, required reset with proper scrypt hashing
4. **Multiple Conflicting Auth Endpoints**: 
   - `/api/authenticate` in `server/index.ts` (working)
   - `/api/login` in `server/routes/index.ts` 
   - `/api/login` in `server/auth/single-tenant-auth.ts` (Passport LocalStrategy)

**Working Solution Pattern**:
```javascript
// Frontend: client/src/hooks/use-auth.tsx
return await apiRequest("POST", "/api/authenticate", credentials);

// Backend: server/index.ts  
app.post('/api/authenticate', async (req, res) => {
  const { email, username, password } = req.body;
  const loginEmail = email || username; // Accept both
  // ... scrypt password verification
});
```

**Critical Commands**:
```bash
# Reset passwords with proper scrypt hashing
node -e "const crypto = require('crypto'); /* scrypt hash generation */"

# Check ALB session stickiness
aws elbv2 describe-target-group-attributes --target-group-arn arn:aws:elasticloadbalancing:us-east-1:259661441422:targetgroup/edsteward-tg-alb/664e01592a97845a

# Deploy fixes
./scripts/deploy-app.sh
```

**Git History Reference**: Commits 6125265, 9c06bff show the working authentication fixes from July 28, 2025.