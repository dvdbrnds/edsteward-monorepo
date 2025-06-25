-- Quick SQL Fix for Staging Tenant Database Record
-- This corrects the staging tenant ID from 'admin' to 'staging'

-- Check current state
SELECT 'BEFORE FIX:' as status, id, name, subdomain, domain, status as tenant_status 
FROM tenants 
WHERE subdomain = 'staging' OR id = 'staging' OR name LIKE '%Staging%';

-- Fix: Delete incorrect record and insert correct one
DELETE FROM tenants WHERE subdomain = 'staging' AND id != 'staging';

-- Insert correct staging tenant record
INSERT INTO tenants (
  id, 
  name, 
  domain, 
  subdomain, 
  database_name, 
  status, 
  settings,
  created_at,
  updated_at
) VALUES (
  'staging',
  'EdSteward Staging Environment',
  'staging.edsteward.ai',
  'staging',
  'edsteward_staging',
  'active',
  '{"allowedDomains": ["edsteward.ai", "staging.edsteward.ai"], "defaultRole": "admin", "enableAutoProvisioning": true, "features": {"apiAccess": true, "customDomain": false, "ssoEnabled": false, "maxUsers": 1000, "maxRegulations": 10000}}'::jsonb,
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  domain = EXCLUDED.domain,
  subdomain = EXCLUDED.subdomain,
  database_name = EXCLUDED.database_name,
  status = EXCLUDED.status,
  settings = EXCLUDED.settings,
  updated_at = NOW();

-- Verify fix
SELECT 'AFTER FIX:' as status, id, name, subdomain, domain, status as tenant_status 
FROM tenants 
WHERE subdomain = 'staging' OR id = 'staging';

-- Show final confirmation
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM tenants WHERE id = 'staging' AND subdomain = 'staging') 
    THEN '✅ SUCCESS: Staging tenant record is now correct!'
    ELSE '❌ FAILED: Staging tenant record is still incorrect'
  END as fix_result; 