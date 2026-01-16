-- Admin Console Database Schema
-- This creates the tables needed for managing EdSteward tenants

-- Tenants table - stores all customer tenant configurations
CREATE TABLE IF NOT EXISTS tenants (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    subdomain VARCHAR(100) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('active', 'inactive', 'pending', 'suspended')),
    
    -- Database connection
    database_url TEXT NOT NULL,
    
    -- Contact information
    contact_email VARCHAR(255) NOT NULL,
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
    sso_provider VARCHAR(50),
    sso_entity_id VARCHAR(500),
    sso_sso_url VARCHAR(500),
    sso_certificate TEXT,
    
    -- Branding
    primary_color VARCHAR(20) DEFAULT '#1e40af',
    logo_url VARCHAR(500),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_health_check TIMESTAMP WITH TIME ZONE,
    
    -- Cached stats (updated periodically)
    cached_user_count INTEGER DEFAULT 0,
    cached_regulation_count INTEGER DEFAULT 0,
    cached_last_activity TIMESTAMP WITH TIME ZONE
);

-- Create index for common queries
CREATE INDEX IF NOT EXISTS idx_tenants_subdomain ON tenants(subdomain);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);

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
