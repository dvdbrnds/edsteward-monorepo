Fixed React Error #310 on EdSteward Public Dashboard

**Problem**: React error #310 (hydration mismatch) on https://moravian.edsteward.ai/public-dashboard
**Root Cause**: Public dashboard was using useAuth() hook but conditionally redirecting users, causing inconsistent hook calls between server and client rendering

**Solution Applied**:
1. **Removed useAuth() hook** from public dashboard to prevent hydration mismatch
2. **Replaced with manual auth check** using fetch('/api/auth/status') in useEffect
3. **Added public API endpoint** /api/public/regulations for unauthenticated access
4. **Fixed component naming** from DashboardPage to PublicDashboardPage for clarity

**Key Changes**:
- `client/src/pages/public-dashboard-page.tsx`: Removed useAuth hook, added manual auth state
- `server/routes/index.ts`: Added public regulations endpoint
- Fixed conditional rendering that caused hook count mismatch

**Result**: Public dashboard now works without authentication requirements while maintaining functionality for authenticated users. Prevents React error #310 hydration issues.