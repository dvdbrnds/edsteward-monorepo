-- Add MFA fields to users table for Google Authenticator support
-- Migration: add-mfa-fields.sql

BEGIN;

-- Add MFA columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_secret TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_backup_codes TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_setup_at TIMESTAMP;

-- Create index for faster MFA lookups
CREATE INDEX IF NOT EXISTS idx_users_mfa_enabled ON users(mfa_enabled) WHERE mfa_enabled = true;

-- Add comments for documentation
COMMENT ON COLUMN users.mfa_secret IS 'Encrypted TOTP secret key for Google Authenticator';
COMMENT ON COLUMN users.mfa_enabled IS 'Whether MFA is enabled for this user';
COMMENT ON COLUMN users.mfa_backup_codes IS 'Encrypted JSON array of backup codes';
COMMENT ON COLUMN users.mfa_setup_at IS 'Timestamp when MFA was first set up';

COMMIT;
