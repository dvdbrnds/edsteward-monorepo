-- Admin Console Database Schema
-- This creates the tables needed for managing EdSteward tenants

-- Tenants table - stores all customer tenant configurations
CREATE TABLE IF NOT EXISTS tenants (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    subdomain VARCHAR(100) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('active', 'inactive', 'pending', 'suspended', 'deleted')),
    
    -- Database connection
    database_url TEXT NOT NULL,
    
    -- Contact information
    contact_email VARCHAR(255),  -- Nullable: not all tenants have a contact email at creation time
    contact_name VARCHAR(255),
    organization_url VARCHAR(500),
    
    -- Subscription/Plan
    plan VARCHAR(50) DEFAULT 'starter' CHECK (plan IN ('starter', 'professional', 'enterprise')),
    max_users INTEGER DEFAULT 10,
    max_regulations INTEGER DEFAULT 100,
    
    -- Deployment info
    deployment_type VARCHAR(20) DEFAULT 'cloud' CHECK (deployment_type IN ('cloud', 'on-premises')),
    aws_region VARCHAR(50),
    health_check_url VARCHAR(500),
    
    -- SSO Configuration
    sso_enabled BOOLEAN DEFAULT FALSE,
    sso_provider VARCHAR(50),  -- 'saml' | 'oidc' | 'cas'
    sso_entity_id VARCHAR(500),
    sso_sso_url VARCHAR(500),
    sso_certificate TEXT,
    -- New: Flexible SSO config for all providers (JSONB)
    -- SAML: { entityId, ssoUrl, sloUrl, certificate, attributeMapping, eduPersonEnabled }
    -- OIDC: { issuerUrl, clientId, clientSecret, scopes, attributeMapping }
    -- CAS:  { serverUrl, serviceValidateUrl, version }
    sso_config JSONB DEFAULT '{}',
    
    -- Branding
    primary_color VARCHAR(20) DEFAULT '#1e40af',
    logo_url VARCHAR(500),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_health_check TIMESTAMP WITH TIME ZONE,
    
    -- Soft-delete tracking
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by VARCHAR(255),
    deletion_reason TEXT,
    
    -- Cached stats (updated periodically)
    cached_user_count INTEGER DEFAULT 0,
    cached_regulation_count INTEGER DEFAULT 0,
    cached_last_activity TIMESTAMP WITH TIME ZONE
);

-- Create index for common queries
CREATE INDEX IF NOT EXISTS idx_tenants_subdomain ON tenants(subdomain);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);

-- ===== MIGRATIONS FOR EXISTING DATABASES =====
-- These ALTER statements are safe to re-run (use IF NOT EXISTS / exception handling)

-- Add soft-delete columns if they don't exist
DO $$ BEGIN
    ALTER TABLE tenants ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE tenants ADD COLUMN deleted_by VARCHAR(255);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE tenants ADD COLUMN deletion_reason TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Make contact_email nullable if it was NOT NULL
ALTER TABLE tenants ALTER COLUMN contact_email DROP NOT NULL;

-- Update status CHECK constraint to include 'deleted'
-- (DROP + re-ADD is the only way to modify a CHECK constraint)
DO $$ BEGIN
    ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_status_check;
    ALTER TABLE tenants ADD CONSTRAINT tenants_status_check 
        CHECK (status IN ('active', 'inactive', 'pending', 'suspended', 'deleted'));
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- Admin users table
CREATE TABLE IF NOT EXISTS admin_users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'admin' CHECK (role IN ('super_admin', 'admin', 'support')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE
);

-- Audit log for admin actions
CREATE TABLE IF NOT EXISTS admin_audit_log (
    id SERIAL PRIMARY KEY,
    admin_user_id INTEGER REFERENCES admin_users(id),
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50), -- 'tenant', 'user', 'system'
    target_id VARCHAR(100),
    details JSONB,
    ip_address VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert Moravian as the initial tenant (the only real one)
INSERT INTO tenants (
    id, name, subdomain, status, database_url, contact_email, 
    plan, deployment_type, health_check_url, created_at
) VALUES (
    'moravian',
    'Moravian University',
    'moravian',
    'active',
    '${DATABASE_URL}', -- Will be replaced with actual URL
    'admin@moravian.edu',
    'enterprise',
    'cloud',
    'https://moravian.edsteward.ai/api/health',
    CURRENT_TIMESTAMP
) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    status = EXCLUDED.status,
    updated_at = CURRENT_TIMESTAMP;
