## Multi-Tenant Database Architecture - Wossamotta Dedicated Project

### Problem Solved
Created a dedicated Neon database project for Wossamotta University demo tenant, ensuring complete data isolation from other customers.

### Key Implementation Details

1. **Neon Project Creation via API**:
```bash
curl -s -X POST "https://console.neon.tech/api/v2/projects" \
  -H "Authorization: Bearer $NEON_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "project": {
      "name": "wossamotta-university",
      "region_id": "aws-us-east-2",
      "org_id": "org-young-mouse-05097443"
    }
  }'
```

2. **Database Migration Steps**:
   - Apply schema with `DATABASE_URL="$NEW_URL" npx drizzle-kit push`
   - Create `branding_configurations` table manually (not in Drizzle schema)
   - Drop FK constraints before importing regulations
   - Update regulations to clear orphan user references
   - Restore FK constraints

3. **Critical ECS Environment Variables**:
   - `MULTI_TENANT=true` - REQUIRED for tenant routing
   - `WOSSAMOTTA_DATABASE_URL` - Points to dedicated project
   - Each customer needs their own `{TENANT}_DATABASE_URL`

4. **Customer Database Projects**:
   - Moravian: `lucky-base-96749457` (dedicated project)
   - Wossamotta: `frosty-scene-90808540` (dedicated project)  
   - Test: Branch from `lingering-frost-58607516`

5. **Image Platform Requirements**:
   - Must build with `--platform linux/amd64` for AWS ECS
   - ARM builds fail with "image Manifest does not contain descriptor matching platform 'linux/amd64'"

### Files Created
- `docs/CUSTOMER_ONBOARDING.md` - Complete customer provisioning guide