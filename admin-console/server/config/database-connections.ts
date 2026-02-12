/**
 * Admin Console Database Manager
 * Handles connections to the admin database and tenant databases
 * 
 * REBUILT: Tenants are now stored in the database, not hardcoded
 */

import dotenv from 'dotenv';
import { Pool } from 'pg';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables - only if DATABASE_URL is not already set (allows ECS env vars to take precedence)
if (!process.env.DATABASE_URL) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  // When compiled, we're in dist/config, so go up to server/ where .env lives
  // In source: config/ -> server/.env (one level up)
  // In dist: dist/config/ -> server/.env (two levels up)
  const envPath = __dirname.includes('dist') 
    ? join(__dirname, '..', '..', '.env')
    : join(__dirname, '..', '.env');
  dotenv.config({ path: envPath });
}

// SSO Provider types
export type SSOProvider = 'saml' | 'oidc' | 'cas';

// SAML-specific configuration
export interface SAMLConfig {
  entityId: string;
  ssoUrl: string;
  sloUrl?: string;
  certificate: string;
  attributeMapping?: Record<string, string>;
  eduPersonEnabled?: boolean;  // For InCommon/Shibboleth
  incommonMetadataUrl?: string;
}

// OIDC-specific configuration (Azure AD, Google, etc.)
export interface OIDCConfig {
  issuerUrl: string;
  clientId: string;
  clientSecret: string;
  scopes: string[];
  attributeMapping?: Record<string, string>;
  // Common presets
  preset?: 'azure-ad' | 'google' | 'auth0' | 'okta' | 'custom';
}

// CAS-specific configuration
export interface CASConfig {
  serverUrl: string;
  serviceValidateUrl?: string;
  version: '2.0' | '3.0';
  attributeMapping?: Record<string, string>;
}

// Unified SSO configuration
export interface SSOConfig {
  provider: SSOProvider;
  autoProvisioning: boolean;
  defaultRole: string;
  allowedDomains?: string[];
  // Provider-specific config (only one will be set)
  saml?: SAMLConfig;
  oidc?: OIDCConfig;
  cas?: CASConfig;
}

// Tenant interface - matches database schema
export interface Tenant {
  id: string;
  name: string;
  subdomain: string;
  status: 'active' | 'inactive' | 'pending' | 'suspended';
  database_url: string;
  contact_email: string;
  contact_name?: string;
  organization_url?: string;
  plan: 'starter' | 'professional' | 'enterprise';
  max_users: number;
  max_regulations: number;
  deployment_type: 'cloud' | 'on-premises';
  aws_region?: string;
  health_check_url?: string;
  sso_enabled: boolean;
  sso_provider?: SSOProvider;
  sso_config?: SSOConfig;  // New: flexible SSO configuration
  primary_color: string;
  logo_url?: string;
  created_at: Date;
  updated_at: Date;
  last_health_check?: Date;
  cached_user_count: number;
  cached_regulation_count: number;
  cached_last_activity?: Date;
}

// Admin database connection (where tenants table lives)
const adminPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('neon.tech') ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

// Tenant database connection pools (cached)
const tenantPools = new Map<string, Pool>();

/**
 * Get the admin database pool (for tenant provisioning)
 */
export function getAdminPool(): Pool {
  return adminPool;
}

/**
 * Initialize admin database - create tables if needed
 */
export async function initializeAdminDatabase(): Promise<void> {
  const client = await adminPool.connect();
  try {
    // Create tenants table
    await client.query(`
      CREATE TABLE IF NOT EXISTS tenants (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        subdomain VARCHAR(100) UNIQUE NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        database_url TEXT NOT NULL,
        contact_email VARCHAR(255) NOT NULL,
        contact_name VARCHAR(255),
        organization_url VARCHAR(500),
        plan VARCHAR(50) DEFAULT 'starter',
        max_users INTEGER DEFAULT 10,
        max_regulations INTEGER DEFAULT 100,
        deployment_type VARCHAR(20) DEFAULT 'cloud',
        aws_region VARCHAR(50),
        health_check_url VARCHAR(500),
        sso_enabled BOOLEAN DEFAULT FALSE,
        sso_provider VARCHAR(50),
        sso_entity_id VARCHAR(500),
        sso_sso_url VARCHAR(500),
        sso_certificate TEXT,
        sso_config JSONB DEFAULT '{}',
        primary_color VARCHAR(20) DEFAULT '#1e40af',
        logo_url VARCHAR(500),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        last_health_check TIMESTAMP WITH TIME ZONE,
        cached_user_count INTEGER DEFAULT 0,
        cached_regulation_count INTEGER DEFAULT 0,
        cached_last_activity TIMESTAMP WITH TIME ZONE
      )
    `);

    // Insert Moravian if not exists (the only real tenant currently)
    const moravianExists = await client.query(
      'SELECT id FROM tenants WHERE id = $1',
      ['moravian']
    );
    
    // Migration: Add sso_config column if it doesn't exist
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'tenants' AND column_name = 'sso_config'
        ) THEN
          ALTER TABLE tenants ADD COLUMN sso_config JSONB DEFAULT '{}';
        END IF;
      END $$;
    `);

    if (moravianExists.rows.length === 0 && process.env.DATABASE_URL) {
      await client.query(`
        INSERT INTO tenants (id, name, subdomain, status, database_url, contact_email, plan, deployment_type, health_check_url)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        'moravian',
        'Moravian University',
        'moravian',
        'active',
        process.env.DATABASE_URL,
        'admin@moravian.edu',
        'enterprise',
        'cloud',
        'https://moravian.edsteward.ai/api/health'
      ]);
      console.log('✅ Inserted Moravian University as initial tenant');
    }

    console.log('✅ Admin database initialized');
  } finally {
    client.release();
  }
}

/**
 * Get all tenants from database
 */
export async function getAllTenants(): Promise<Tenant[]> {
  const result = await adminPool.query('SELECT * FROM tenants ORDER BY created_at DESC');
  return result.rows;
}

/**
 * Get a single tenant by ID
 */
export async function getTenantById(tenantId: string): Promise<Tenant | null> {
  const result = await adminPool.query('SELECT * FROM tenants WHERE id = $1', [tenantId]);
  return result.rows[0] || null;
}

/**
 * Get a tenant by subdomain
 */
export async function getTenantBySubdomain(subdomain: string): Promise<Tenant | null> {
  const result = await adminPool.query('SELECT * FROM tenants WHERE subdomain = $1', [subdomain]);
  return result.rows[0] || null;
}

/**
 * Create a new tenant
 */
export async function createTenant(tenant: Partial<Tenant>): Promise<Tenant> {
  const id = tenant.id || tenant.subdomain?.toLowerCase().replace(/[^a-z0-9]/g, '-');
  
  const result = await adminPool.query(`
    INSERT INTO tenants (
      id, name, subdomain, status, database_url, contact_email, contact_name,
      organization_url, plan, max_users, max_regulations, deployment_type,
      aws_region, health_check_url, sso_enabled, primary_color, logo_url
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
    RETURNING *
  `, [
    id,
    tenant.name,
    tenant.subdomain,
    tenant.status || 'pending',
    tenant.database_url,
    tenant.contact_email,
    tenant.contact_name || null,
    tenant.organization_url || null,
    tenant.plan || 'starter',
    tenant.max_users || 10,
    tenant.max_regulations || 100,
    tenant.deployment_type || 'cloud',
    tenant.aws_region || null,
    tenant.health_check_url || `https://${tenant.subdomain}.edsteward.ai/api/health`,
    tenant.sso_enabled || false,
    tenant.primary_color || '#1e40af',
    tenant.logo_url || null
  ]);

  return result.rows[0];
}

/**
 * Update a tenant
 */
export async function updateTenant(tenantId: string, updates: Partial<Tenant>): Promise<Tenant | null> {
  const fields: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  // Build dynamic update query
  const updateableFields = [
    'name', 'status', 'database_url', 'contact_email', 'contact_name',
    'organization_url', 'plan', 'max_users', 'max_regulations', 'deployment_type',
    'aws_region', 'health_check_url', 'sso_enabled', 'sso_provider', 'sso_config',
    'sso_entity_id', 'sso_sso_url', 'sso_certificate', 'primary_color', 'logo_url'
  ];

  for (const field of updateableFields) {
    if (updates[field as keyof Tenant] !== undefined) {
      fields.push(`${field} = $${paramIndex}`);
      // Handle JSONB fields - need to stringify objects
      const value = updates[field as keyof Tenant];
      if (field === 'sso_config' && typeof value === 'object') {
        values.push(JSON.stringify(value));
      } else {
        values.push(value);
      }
      paramIndex++;
    }
  }

  if (fields.length === 0) return getTenantById(tenantId);

  fields.push(`updated_at = CURRENT_TIMESTAMP`);
  values.push(tenantId);

  const result = await adminPool.query(
    `UPDATE tenants SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );

  return result.rows[0] || null;
}

/**
 * Delete a tenant
 */
export async function deleteTenant(tenantId: string): Promise<boolean> {
  const result = await adminPool.query('DELETE FROM tenants WHERE id = $1', [tenantId]);
  
  // Clean up connection pool
  if (tenantPools.has(tenantId)) {
    await tenantPools.get(tenantId)?.end();
    tenantPools.delete(tenantId);
  }
  
  return (result.rowCount || 0) > 0;
}

/**
 * Get database pool for a specific tenant
 */
export function getTenantDatabasePool(tenant: Tenant): Pool {
  if (tenantPools.has(tenant.id)) {
    return tenantPools.get(tenant.id)!;
  }

  const pool = new Pool({
    connectionString: tenant.database_url,
    ssl: tenant.database_url.includes('neon.tech') ? { rejectUnauthorized: false } : false,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
  });

  tenantPools.set(tenant.id, pool);
  return pool;
}

/**
 * Query a tenant's database
 */
export async function queryTenantDatabase(tenant: Tenant, query: string, params: any[] = []): Promise<any> {
  const pool = getTenantDatabasePool(tenant);
  return pool.query(query, params);
}

/**
 * Get real-time stats for a tenant by querying their database
 */
export async function getTenantStats(tenant: Tenant): Promise<{
  userCount: number;
  regulationCount: number;
  lastActivity: string | null;
  error?: string;
}> {
  try {
    const pool = getTenantDatabasePool(tenant);
    
    const [usersResult, regulationsResult, activityResult] = await Promise.all([
      pool.query('SELECT COUNT(*) as count FROM users'),
      pool.query('SELECT COUNT(*) as count FROM regulations'),
      pool.query(`
        SELECT GREATEST(
          (SELECT MAX(last_login) FROM users WHERE last_login IS NOT NULL),
          (SELECT MAX(created_at) FROM users)
        ) as last_activity
      `)
    ]);

    const stats = {
      userCount: parseInt(usersResult.rows[0]?.count || '0'),
      regulationCount: parseInt(regulationsResult.rows[0]?.count || '0'),
      lastActivity: activityResult.rows[0]?.last_activity?.toISOString() || null
    };

    // Update cached stats in admin database
    await adminPool.query(`
      UPDATE tenants 
      SET cached_user_count = $1, 
          cached_regulation_count = $2, 
          cached_last_activity = $3,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
    `, [stats.userCount, stats.regulationCount, stats.lastActivity, tenant.id]);

    return stats;
  } catch (error) {
    console.error(`Error getting stats for tenant ${tenant.id}:`, error);
    return {
      userCount: tenant.cached_user_count || 0,
      regulationCount: tenant.cached_regulation_count || 0,
      lastActivity: tenant.cached_last_activity?.toISOString() || null,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Check database health for a tenant
 */
export async function checkTenantDatabaseHealth(tenant: Tenant): Promise<{
  status: 'healthy' | 'unhealthy';
  connected: boolean;
  responseTimeMs: number;
  error?: string;
}> {
  const startTime = Date.now();
  try {
    const pool = getTenantDatabasePool(tenant);
    await pool.query('SELECT 1');
    
    return {
      status: 'healthy',
      connected: true,
      responseTimeMs: Date.now() - startTime
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      connected: false,
      responseTimeMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Check application health by calling health endpoint
 */
export async function checkTenantApplicationHealth(tenant: Tenant): Promise<{
  status: 'healthy' | 'unhealthy' | 'unknown';
  responding: boolean;
  responseTimeMs: number;
  serverStatus?: string;
  error?: string;
}> {
  if (!tenant.health_check_url) {
    return { status: 'unknown', responding: false, responseTimeMs: 0 };
  }

  const startTime = Date.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(tenant.health_check_url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'EdSteward-Admin/2.0' }
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const data = await response.json();
      return {
        status: 'healthy',
        responding: true,
        responseTimeMs: Date.now() - startTime,
        serverStatus: data.server || 'running'
      };
    } else {
      return {
        status: 'unhealthy',
        responding: false,
        responseTimeMs: Date.now() - startTime,
        error: `HTTP ${response.status}`
      };
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      responding: false,
      responseTimeMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Comprehensive health check for a tenant
 */
export async function checkTenantHealth(tenant: Tenant): Promise<{
  overall: 'healthy' | 'degraded' | 'unhealthy';
  database: Awaited<ReturnType<typeof checkTenantDatabaseHealth>>;
  application: Awaited<ReturnType<typeof checkTenantApplicationHealth>>;
}> {
  const [database, application] = await Promise.all([
    checkTenantDatabaseHealth(tenant),
    checkTenantApplicationHealth(tenant)
  ]);

  let overall: 'healthy' | 'degraded' | 'unhealthy';
  if (database.status === 'healthy' && application.status === 'healthy') {
    overall = 'healthy';
  } else if (database.status === 'unhealthy') {
    overall = 'unhealthy';
  } else {
    overall = 'degraded';
  }

  // Update last health check timestamp
  await adminPool.query(
    'UPDATE tenants SET last_health_check = CURRENT_TIMESTAMP WHERE id = $1',
    [tenant.id]
  );

  return { overall, database, application };
}

/**
 * Get users from a tenant's database
 */
export async function getTenantUsers(tenant: Tenant, limit: number = 50): Promise<any[]> {
  try {
    const pool = getTenantDatabasePool(tenant);
    const result = await pool.query(`
      SELECT id, email, username, "firstName", "lastName", role, department, created_at, last_login 
      FROM users 
      ORDER BY created_at DESC 
      LIMIT $1
    `, [limit]);
    
    return result.rows.map(user => ({
      id: user.id,
      email: user.email,
      username: user.username,
      name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username,
      role: user.role,
      department: user.department,
      createdAt: user.created_at,
      lastLogin: user.last_login,
      tenantId: tenant.id,
      tenantName: tenant.name
    }));
  } catch (error) {
    console.error(`Error getting users for tenant ${tenant.id}:`, error);
    return [];
  }
}

/**
 * Close all database connections
 */
export async function closeAllConnections(): Promise<void> {
  // Close tenant pools
  for (const [tenantId, pool] of tenantPools) {
    try {
      await pool.end();
      console.log(`Closed connection pool for tenant: ${tenantId}`);
    } catch (error) {
      console.error(`Error closing pool for tenant ${tenantId}:`, error);
    }
  }
  tenantPools.clear();

  // Close admin pool
  await adminPool.end();
  console.log('Closed admin database connection');
}

// Legacy exports for backward compatibility
export const customerTenants: Tenant[] = []; // Will be populated from database
export const closeTenantConnections = closeAllConnections;
