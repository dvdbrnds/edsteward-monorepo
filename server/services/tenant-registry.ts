/**
 * Dynamic Tenant Registry Service
 * 
 * Loads tenant configurations from the admin database instead of hardcoded values.
 * This enables new tenants created through the admin console to work immediately.
 */

import { Pool } from 'pg';
import type { Tenant } from '../middleware/tenant';

// Admin database connection (shared with admin console)
let adminPool: Pool | null = null;

// In-memory tenant cache
interface TenantRecord {
  tenant: Tenant;
  databaseUrl: string;
  loadedAt: number;
}

const tenantCache = new Map<string, TenantRecord>();
const CACHE_TTL = 60 * 1000; // 1 minute cache (short for responsiveness)
let lastFullRefresh = 0;
let isInitialized = false;

// Hardcoded fallback tenants (used if database is unavailable)
const FALLBACK_TENANTS: Record<string, { tenant: Partial<Tenant>; databaseUrl: string }> = {
  'moravian': {
    tenant: {
      id: 'moravian',
      name: 'Moravian University',
      domain: 'moravian.edu',
      subdomain: 'moravian',
      databaseName: 'edsteward_moravian',
      status: 'active',
    },
    databaseUrl: process.env.MORAVIAN_DATABASE_URL || process.env.DATABASE_URL || '',
  },
  'template': {
    tenant: {
      id: 'template',
      name: 'EdSteward Template',
      domain: 'template.edsteward.ai',
      subdomain: 'template',
      databaseName: 'edsteward_template',
      status: 'active',
    },
    databaseUrl: process.env.TEMPLATE_DATABASE_URL || process.env.DATABASE_URL || '',
  },
  'wossamotta': {
    tenant: {
      id: 'wossamotta',
      name: 'Wossamotta University',
      domain: 'wossamotta.edu',
      subdomain: 'wossamotta',
      databaseName: 'edsteward_wossamotta',
      status: 'active',
    },
    databaseUrl: process.env.WOSSAMOTTA_DATABASE_URL || process.env.DATABASE_URL || '',
  },
  'staging': {
    tenant: {
      id: 'staging',
      name: 'EdSteward Staging',
      domain: 'staging.edsteward.ai',
      subdomain: 'staging',
      databaseName: 'edsteward_staging',
      status: 'active',
    },
    databaseUrl: process.env.STAGING_DATABASE_URL || process.env.DATABASE_URL || '',
  },
  'admin': {
    tenant: {
      id: 'admin',
      name: 'EdSteward Admin',
      domain: 'admin.edsteward.ai',
      subdomain: 'admin',
      databaseName: 'edsteward_admin',
      status: 'active',
    },
    databaseUrl: process.env.DATABASE_URL || '',
  },
};

/**
 * Initialize the admin database connection
 */
export async function initializeTenantRegistry(): Promise<void> {
  if (isInitialized) return;

  const adminDbUrl = process.env.ADMIN_DATABASE_URL || process.env.DATABASE_URL;
  
  if (!adminDbUrl) {
    console.warn('[TENANT-REGISTRY] No ADMIN_DATABASE_URL configured, using fallback tenants');
    loadFallbackTenants();
    isInitialized = true;
    return;
  }

  try {
    adminPool = new Pool({
      connectionString: adminDbUrl,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    // Test connection
    const client = await adminPool.connect();
    await client.query('SELECT 1');
    client.release();

    console.log('[TENANT-REGISTRY] Connected to admin database');
    
    // Load all tenants
    await refreshAllTenants();
    isInitialized = true;

    // Set up periodic refresh
    setInterval(() => {
      refreshAllTenants().catch(err => {
        console.error('[TENANT-REGISTRY] Periodic refresh failed:', err.message);
      });
    }, 5 * 60 * 1000); // Refresh every 5 minutes

  } catch (error) {
    console.error('[TENANT-REGISTRY] Failed to connect to admin database:', error);
    console.warn('[TENANT-REGISTRY] Using fallback tenants');
    loadFallbackTenants();
    isInitialized = true;
  }
}

/**
 * Load fallback tenants when database is unavailable
 */
function loadFallbackTenants(): void {
  for (const [id, data] of Object.entries(FALLBACK_TENANTS)) {
    const tenant = createTenantFromPartial(id, data.tenant);
    tenantCache.set(id, {
      tenant,
      databaseUrl: data.databaseUrl,
      loadedAt: Date.now(),
    });
  }
  console.log(`[TENANT-REGISTRY] Loaded ${tenantCache.size} fallback tenants`);
}

/**
 * Create a full Tenant object from partial data
 */
function createTenantFromPartial(id: string, partial: Partial<Tenant>): Tenant {
  return {
    id,
    name: partial.name || id,
    domain: partial.domain || `${id}.edsteward.ai`,
    subdomain: partial.subdomain || id,
    databaseName: partial.databaseName || `edsteward_${id}`,
    status: partial.status || 'active',
    settings: partial.settings || {
      allowedDomains: [partial.domain || `${id}.edsteward.ai`],
      defaultRole: 'user',
      enableAutoProvisioning: true,
      features: {
        apiAccess: true,
        customDomain: false,
        ssoEnabled: false,
        maxUsers: 500,
        maxRegulations: 5000,
      },
      institutionConfig: {
        primaryTypes: ['public-universities', 'private-universities'],
        hideNonApplicable: true,
        allowUsersToToggle: true,
      },
    },
    samlConfig: partial.samlConfig,
    createdAt: partial.createdAt || new Date(),
    updatedAt: partial.updatedAt || new Date(),
  };
}

/**
 * Refresh all tenants from the admin database
 */
export async function refreshAllTenants(): Promise<void> {
  if (!adminPool) {
    console.warn('[TENANT-REGISTRY] No admin pool, cannot refresh');
    return;
  }

  try {
    const result = await adminPool.query(`
      SELECT 
        id, name, subdomain, status, database_url,
        contact_email, plan, deployment_type,
        sso_enabled, sso_provider, sso_entity_id, sso_sso_url, sso_certificate,
        sso_config,
        primary_color, logo_url, max_users, max_regulations,
        created_at, updated_at
      FROM tenants
      WHERE status != 'deleted'
    `);

    const loadedCount = result.rows.length;
    
    for (const row of result.rows) {
      const tenant = mapDatabaseRowToTenant(row);
      tenantCache.set(row.subdomain, {
        tenant,
        databaseUrl: row.database_url,
        loadedAt: Date.now(),
      });
      
      // Also cache by ID if different from subdomain
      if (row.id !== row.subdomain) {
        tenantCache.set(row.id, {
          tenant,
          databaseUrl: row.database_url,
          loadedAt: Date.now(),
        });
      }
    }

    lastFullRefresh = Date.now();
    console.log(`[TENANT-REGISTRY] Refreshed ${loadedCount} tenants from database`);

  } catch (error) {
    console.error('[TENANT-REGISTRY] Failed to refresh tenants:', error);
  }
}

/**
 * Map a database row to a Tenant object
 */
function mapDatabaseRowToTenant(row: any): Tenant {
  // Parse sso_config JSONB field
  let ssoConfig: any = null;
  if (row.sso_config) {
    try {
      ssoConfig = typeof row.sso_config === 'string' 
        ? JSON.parse(row.sso_config) 
        : row.sso_config;
    } catch (e) {
      console.warn(`[TENANT-REGISTRY] Failed to parse sso_config for ${row.id}:`, e);
    }
  }

  const tenant: Tenant = {
    id: row.id,
    name: row.name,
    domain: `${row.subdomain}.edsteward.ai`,
    subdomain: row.subdomain,
    databaseName: `edsteward_${row.subdomain}`,
    status: row.status || 'active',
    settings: {
      allowedDomains: ssoConfig?.allowedDomains || [row.contact_email?.split('@')[1] || `${row.subdomain}.edsteward.ai`],
      defaultRole: ssoConfig?.defaultRole || 'user',
      enableAutoProvisioning: ssoConfig?.autoProvisioning !== false,
      enableLocalAuth: true, // Local auth always available unless explicitly disabled
      features: {
        apiAccess: true,
        customDomain: false,
        ssoEnabled: row.sso_enabled || false,
        maxUsers: row.max_users || 500,
        maxRegulations: row.max_regulations || 5000,
      },
      customBranding: row.primary_color || row.logo_url ? {
        primaryColor: row.primary_color,
        logoUrl: row.logo_url,
      } : undefined,
      institutionConfig: {
        primaryTypes: ['public-universities', 'private-universities'],
        hideNonApplicable: true,
        allowUsersToToggle: true,
      },
    },
    createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
  };

  // Add unified SSO config if present
  if (ssoConfig && ssoConfig.provider) {
    tenant.ssoConfig = ssoConfig;
  }

  // Add legacy SAML config if enabled (for backward compatibility)
  if (row.sso_enabled && row.sso_entity_id && row.sso_sso_url && row.sso_certificate) {
    tenant.samlConfig = {
      entityId: row.sso_entity_id,
      ssoUrl: row.sso_sso_url,
      certificate: row.sso_certificate,
      sloUrl: ssoConfig?.saml?.sloUrl,
      attributeMapping: ssoConfig?.saml?.attributeMapping,
      eduPersonEnabled: ssoConfig?.saml?.eduPersonEnabled,
    };
  }

  // If ssoConfig has provider-specific configs, add them
  if (ssoConfig?.oidc) {
    tenant.oidcConfig = ssoConfig.oidc;
  }
  if (ssoConfig?.cas) {
    tenant.casConfig = ssoConfig.cas;
  }

  return tenant;
}

/**
 * Get a tenant by subdomain or ID
 */
export async function getTenant(identifier: string): Promise<TenantRecord | null> {
  // Check cache first
  const cached = tenantCache.get(identifier);
  if (cached && Date.now() - cached.loadedAt < CACHE_TTL) {
    return cached;
  }

  // Try to load from database
  if (adminPool) {
    try {
      const result = await adminPool.query(`
        SELECT 
          id, name, subdomain, status, database_url,
          contact_email, plan, deployment_type,
          sso_enabled, sso_provider, sso_entity_id, sso_sso_url, sso_certificate,
          sso_config,
          primary_color, logo_url, max_users, max_regulations,
          created_at, updated_at
        FROM tenants
        WHERE (subdomain = $1 OR id = $1) AND status != 'deleted'
        LIMIT 1
      `, [identifier]);

      if (result.rows.length > 0) {
        const row = result.rows[0];
        const tenant = mapDatabaseRowToTenant(row);
        const record: TenantRecord = {
          tenant,
          databaseUrl: row.database_url,
          loadedAt: Date.now(),
        };
        
        tenantCache.set(identifier, record);
        return record;
      }
    } catch (error) {
      console.error(`[TENANT-REGISTRY] Failed to load tenant '${identifier}':`, error);
    }
  }

  // Return cached even if expired, as fallback
  return cached || null;
}

/**
 * Get tenant configuration only (for middleware)
 */
export async function getTenantConfig(identifier: string): Promise<Tenant | null> {
  const record = await getTenant(identifier);
  return record?.tenant || null;
}

/**
 * Get tenant database URL
 */
export async function getTenantDatabaseUrl(identifier: string): Promise<string | null> {
  const record = await getTenant(identifier);
  return record?.databaseUrl || null;
}

/**
 * Get all cached tenants
 */
export function getAllCachedTenants(): Tenant[] {
  const seen = new Set<string>();
  const tenants: Tenant[] = [];
  
  for (const [key, record] of tenantCache) {
    if (!seen.has(record.tenant.id)) {
      seen.add(record.tenant.id);
      tenants.push(record.tenant);
    }
  }
  
  return tenants;
}

/**
 * Get all tenant database URLs (for database service)
 */
export function getAllTenantDatabaseUrls(): Record<string, string> {
  const urls: Record<string, string> = {};
  
  for (const [key, record] of tenantCache) {
    if (record.databaseUrl && !urls[record.tenant.subdomain]) {
      urls[record.tenant.subdomain] = record.databaseUrl;
    }
  }
  
  return urls;
}

/**
 * Invalidate cache for a specific tenant
 */
export function invalidateTenantCache(identifier: string): void {
  tenantCache.delete(identifier);
  console.log(`[TENANT-REGISTRY] Invalidated cache for '${identifier}'`);
}

/**
 * Clear all cached tenants
 */
export function clearAllCache(): void {
  tenantCache.clear();
  console.log('[TENANT-REGISTRY] Cleared all tenant cache');
}

/**
 * Check if registry is initialized
 */
export function isRegistryInitialized(): boolean {
  return isInitialized;
}

/**
 * Get registry stats
 */
export function getRegistryStats() {
  return {
    initialized: isInitialized,
    cachedTenants: tenantCache.size,
    lastRefresh: lastFullRefresh ? new Date(lastFullRefresh).toISOString() : null,
    hasAdminPool: !!adminPool,
  };
}

/**
 * Close the admin pool connection
 */
export async function closeTenantRegistry(): Promise<void> {
  if (adminPool) {
    await adminPool.end();
    adminPool = null;
    isInitialized = false;
    console.log('[TENANT-REGISTRY] Closed admin database connection');
  }
}
