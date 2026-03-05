Wossamotta University Demo Tenant (January 2026):

Created a demo tenant "Wossamotta University" as a tribute to Rocky and Bullwinkle cartoon.

Configuration:
- Subdomain: `wossamotta.edsteward.ai`
- Tenant ID: `wossamotta`
- Database: Neon branch `ep-shy-bread-a5rp7twf` (branched from lingering-frost-58607516)
- Environment variable: `WOSSAMOTTA_DATABASE_URL`

Branding (Rocky & Bullwinkle inspired):
- Primary Color: #8B4513 (Saddle Brown)
- Secondary Color: #DAA520 (Goldenrod)
- Accent Color: #FFD700 (Gold)
- Background: #FFF8DC (Cornsilk)

Files modified:
- `server/middleware/tenant.ts` - Added wossamotta to TENANT_REGISTRY
- `server/services/database.ts` - Added WOSSAMOTTA_DATABASE_URL mapping
- `.env` - Added WOSSAMOTTA_DATABASE_URL

To create a new tenant, follow this pattern:
1. Create Neon branch: `POST /api/v2/projects/{project_id}/branches`
2. Add tenant to TENANT_REGISTRY in tenant.ts
3. Add DATABASE_URL mapping in database.ts
4. Insert branding into branding_configurations table
5. Add env var to ECS task definition
6. Build and deploy