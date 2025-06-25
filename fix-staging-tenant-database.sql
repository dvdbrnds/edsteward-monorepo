-- Fix Staging Tenant Database Record
-- This script corrects the staging tenant record in the database

-- First, let's see what's currently in the database
SELECT id, name, subdomain, domain, status 
FROM tenants 
WHERE subdomain = 'staging' OR id = 'staging' OR name LIKE '%Staging%';

-- Update the staging tenant record to have the correct ID
-- If there's a record with subdomain='staging' but id='admin', fix it
UPDATE tenants 
SET id = 'staging'
WHERE subdomain = 'staging' AND id != 'staging';

-- If no staging record exists, insert the correct one
INSERT INTO tenants (
  id, 
  name, 
  domain, 
  subdomain, 
  "databaseName", 
  status, 
  settings,
  "createdAt",
  "updatedAt"
) 
SELECT 
  'staging',
  'EdSteward Staging Environment',
  'staging.edsteward.ai',
  'staging',
  'edsteward_staging',
  'active',
  '{
    "allowedDomains": ["edsteward.ai", "staging.edsteward.ai"],
    "defaultRole": "admin",
    "enableAutoProvisioning": true,
    "features": {
      "apiAccess": true,
      "customDomain": false,
      "ssoEnabled": false,
      "maxUsers": 1000,
      "maxRegulations": 10000
    }
  }'::jsonb,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM tenants WHERE id = 'staging'
);

-- Verify the fix
SELECT id, name, subdomain, domain, status 
FROM tenants 
WHERE subdomain = 'staging' OR id = 'staging';

-- Expected result: id='staging', subdomain='staging', name='EdSteward Staging Environment' 