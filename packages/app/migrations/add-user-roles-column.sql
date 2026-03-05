-- Migration: Add roles column to users table for multi-role support
-- This enables Okta group-to-role mapping with multiple roles per user

-- Add roles column to store JSON array of roles
ALTER TABLE users ADD COLUMN IF NOT EXISTS roles TEXT;

-- Update existing users to have roles array based on their current role
UPDATE users 
SET roles = CASE 
  WHEN role = 'admin' THEN '["admin"]'
  WHEN role = 'compliance_officer' THEN '["compliance_officer"]'
  WHEN role = 'user' THEN '["viewer"]'
  ELSE '["viewer"]'
END
WHERE roles IS NULL;

-- Update default role from 'user' to 'viewer' for new users
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'viewer';

-- Create index on roles column for efficient querying
CREATE INDEX IF NOT EXISTS idx_users_roles ON users USING GIN ((roles::jsonb));

-- Create index on role column (if not exists)
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);

-- Add comment to document the roles column
COMMENT ON COLUMN users.roles IS 'JSON array of role names for multi-role support from Okta groups';
COMMENT ON COLUMN users.role IS 'Primary role for backwards compatibility, should match highest priority role in roles array';
