# Customer Onboarding Process

This document describes how to onboard a new paying customer with a fully
isolated Neon database project.

## Overview

Each customer gets their own **dedicated Neon project**, which provides:

- ✅ **Complete data isolation** - No shared tables or schemas
- ✅ **Unique credentials** - Each customer has their own database password
- ✅ **Independent scaling** - Each project can be scaled independently
- ✅ **Separate billing** - Easy to track usage per customer
- ✅ **Enhanced security** - No possibility of cross-tenant data leakage

## Prerequisites

Before starting, ensure you have:

1. **Neon API Key**: `$NEON_API_KEY`
2. **Neon Organization ID**: `org-young-mouse-05097443`
3. **AWS credentials** configured for ECS deployment
4. **Customer information**:
   - Customer name (e.g., "Lehigh University")
   - Subdomain (e.g., "lehigh")
   - Admin user email
   - Branding preferences (logo, colors)

## Step 1: Create Dedicated Neon Project

```bash
#!/bin/zsh
# provision-customer.sh

CUSTOMER_NAME="lehigh-university"  # lowercase with hyphens
ORG_ID="org-young-mouse-05097443"
NEON_API_KEY="${NEON_API_KEY}"

# Create the project
RESPONSE=$(curl -s -X POST "https://console.neon.tech/api/v2/projects" \
  -H "Authorization: Bearer $NEON_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"project\": {
      \"name\": \"$CUSTOMER_NAME\",
      \"region_id\": \"aws-us-east-2\",
      \"org_id\": \"$ORG_ID\"
    }
  }")

# Extract connection info
PROJECT_ID=$(echo "$RESPONSE" | jq -r '.project.id')
CONNECTION_URI=$(echo "$RESPONSE" | jq -r '.connection_uris[0].connection_uri')
PASSWORD=$(echo "$RESPONSE" | jq -r '.roles[0].password')
POOLER_HOST=$(echo "$RESPONSE" | jq -r '.connection_uris[0].connection_parameters.pooler_host')

echo "Project created: $PROJECT_ID"
echo "Connection URI: $CONNECTION_URI"
```

## Step 2: Apply Database Schema

```bash
# Using Drizzle to push schema
DATABASE_URL="$CONNECTION_URI" npx drizzle-kit push
```

## Step 3: Import Regulation Data

Regulations are shared public data and should be imported from an existing
database:

```bash
# Export from Moravian (or any reference DB)
psql "$MORAVIAN_DATABASE_URL" -c "\copy regulations TO '/tmp/regulations.csv' WITH CSV HEADER"

# Temporarily disable FK constraints
psql "$NEW_DATABASE_URL" -c "ALTER TABLE regulations DROP CONSTRAINT IF EXISTS regulations_owner_id_users_id_fk;"
psql "$NEW_DATABASE_URL" -c "ALTER TABLE regulations DROP CONSTRAINT IF EXISTS regulations_notifications_disabled_by_users_id_fk;"

# Import
psql "$NEW_DATABASE_URL" -c "\copy regulations FROM '/tmp/regulations.csv' WITH CSV HEADER"

# Clear user references and restore constraints
psql "$NEW_DATABASE_URL" -c "UPDATE regulations SET owner_id = NULL, notifications_disabled_by = NULL;"
psql "$NEW_DATABASE_URL" -c "ALTER TABLE regulations ADD CONSTRAINT regulations_owner_id_users_id_fk FOREIGN KEY (owner_id) REFERENCES users(id);"
psql "$NEW_DATABASE_URL" -c "ALTER TABLE regulations ADD CONSTRAINT regulations_notifications_disabled_by_users_id_fk FOREIGN KEY (notifications_disabled_by) REFERENCES users(id);"
```

## Step 4: Create Admin User

```bash
# Create the customer's admin user
psql "$NEW_DATABASE_URL" -c "
INSERT INTO users (username, email, password, \"firstName\", \"lastName\", role, mfa_enabled, created_at, updated_at)
VALUES ('admin', 'admin@lehigh.edu', 'SCRYPT_HASHED_PASSWORD_HERE', 'Admin', 'User', 'admin', false, NOW(), NOW());
"
```

## Step 5: Configure Branding

```bash
psql "$NEW_DATABASE_URL" -c "
CREATE TABLE IF NOT EXISTS branding_configurations (
  id SERIAL PRIMARY KEY,
  config_data JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO branding_configurations (id, config_data, created_at, updated_at)
VALUES (1, '{
  \"institutionName\": \"Lehigh University\",
  \"title\": \"Lehigh Compliance\",
  \"logoUrl\": \"/assets/lehigh-logo.png\",
  \"faviconUrl\": \"/favicon.ico\",
  \"primaryColor\": \"#502D0E\",
  \"secondaryColor\": \"#8B7355\",
  \"accentColor\": \"#FFD700\"
}'::jsonb, NOW(), NOW());
"
```

## Step 6: Update Tenant Registry

Add the new tenant to `server/middleware/tenant.ts`:

```typescript
// In TENANT_REGISTRY
'lehigh': {
  id: 'lehigh',
  name: 'Lehigh University',
  domain: 'lehigh.edsteward.ai',
  subdomain: 'lehigh',
  databaseName: 'edsteward_lehigh',
  status: 'active',
  settings: {
    allowedDomains: ['lehigh.edsteward.ai'],
    defaultRole: 'user',
    enableAutoProvisioning: true,
    features: {
      apiAccess: true,
      customDomain: false,
      ssoEnabled: false,
      maxUsers: 500,
      maxRegulations: 5000
    },
    institutionConfig: {
      primaryTypes: ['private-universities'],
      hideNonApplicable: true,
      allowUsersToToggle: true
    }
  },
  createdAt: new Date(),
  updatedAt: new Date()
},
```

## Step 7: Update Database URL Mapping

Add to `server/services/database.ts`:

```typescript
const TENANT_DATABASE_URLS: Record<string, string> = {
  // ... existing tenants
  lehigh: process.env.LEHIGH_DATABASE_URL || process.env.DATABASE_URL || '',
};
```

## Step 8: Add Environment Variables

Add to `.env`:

```bash
# Lehigh University - Dedicated Isolated Project
LEHIGH_DATABASE_URL=postgresql://neondb_owner:PASSWORD@ep-ENDPOINT-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require
LEHIGH_PROJECT_ID=project-id-here
```

## Step 9: Deploy to AWS ECS

```bash
# Build with new tenant config
docker build -t edsteward-multi-tenant:lehigh -f Dockerfile .

# Push to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 259661441422.dkr.ecr.us-east-1.amazonaws.com
docker tag edsteward-multi-tenant:lehigh 259661441422.dkr.ecr.us-east-1.amazonaws.com/edsteward:lehigh
docker push 259661441422.dkr.ecr.us-east-1.amazonaws.com/edsteward:lehigh

# Update ECS task definition
aws ecs describe-task-definition --task-definition edsteward-fixed --query 'taskDefinition' > /tmp/task-def.json

# Add new environment variable and update image
cat /tmp/task-def.json | jq --arg url "$LEHIGH_DATABASE_URL" '
  del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .compatibilities, .registeredAt, .registeredBy) |
  .containerDefinitions[0].image = "259661441422.dkr.ecr.us-east-1.amazonaws.com/edsteward:lehigh" |
  .containerDefinitions[0].environment += [{"name": "LEHIGH_DATABASE_URL", "value": $url}]
' > /tmp/updated-task-def.json

# Register and deploy
aws ecs register-task-definition --cli-input-json file:///tmp/updated-task-def.json
aws ecs update-service --cluster edsteward-cluster --service edsteward-service --task-definition edsteward-fixed --force-new-deployment
```

## Step 10: Configure DNS

Add a CNAME record:

```
lehigh.edsteward.ai -> edsteward-alb-123456789.us-east-1.elb.amazonaws.com
```

## Step 11: Verify Deployment

```bash
# Test the endpoint
curl -I https://lehigh.edsteward.ai/api/health

# Verify branding
curl https://lehigh.edsteward.ai/api/branding

# Test login
curl -X POST https://lehigh.edsteward.ai/api/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "initial-password"}'
```

## Security Checklist

- [ ] Unique database credentials per customer
- [ ] Password changed from default by customer
- [ ] MFA enabled for admin users
- [ ] SSL/TLS certificates valid
- [ ] DNS propagation complete
- [ ] Branding verified
- [ ] Data isolation verified (check no cross-tenant data)

## Current Customer Database Projects

| Customer              | Neon Project ID                     | Subdomain  |
| --------------------- | ----------------------------------- | ---------- |
| Moravian University   | `lucky-base-96749457`               | moravian   |
| Wossamotta University | `frosty-scene-90808540`             | wossamotta |
| Test (internal)       | `lingering-frost-58607516` (branch) | test       |

## Rollback Procedure

If something goes wrong:

1. **Revert ECS task definition**:

   ```bash
   aws ecs update-service --cluster edsteward-cluster --service edsteward-service --task-definition edsteward-fixed:PREVIOUS_REVISION
   ```

2. **Delete Neon project** (if completely new customer):

   ```bash
   curl -X DELETE "https://console.neon.tech/api/v2/projects/$PROJECT_ID" \
     -H "Authorization: Bearer $NEON_API_KEY"
   ```

3. **Remove from tenant registry** (revert code changes)

## Support Contacts

- Infrastructure issues: [Your DevOps contact]
- Database issues: Neon support
- Application issues: EdSteward engineering team
