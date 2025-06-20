import { Request, Response, NextFunction } from 'express';

// Extended Request interface to include tenant context
export interface EdStewardTenantRequest extends Request {
  tenant?: TenantConfig;
  tenantId?: string;
}

export interface TenantConfig {
  id: string;
  name: string;
  domain: string;
  database: string;
  samlConfig?: {
    entryPoint: string;
    cert: string;
    issuer: string;
  };
}

// Registry of available tenants
const TENANT_REGISTRY: Record<string, TenantConfig> = {
  'admin': {
    id: 'admin',
    name: 'EdSteward Admin',
    domain: 'edsteward.ai',
    database: 'edsteward_admin'
  },
  'moravian': {
    id: 'moravian',
    name: 'Moravian University',
    domain: 'moravian.edu',
    database: 'edsteward_moravian',
    samlConfig: {
      entryPoint: process.env.MORAVIAN_SAML_ENTRY_POINT || '',
      cert: process.env.MORAVIAN_SAML_CERT || '',
      issuer: 'moravian-edsteward'
    }
  }
};

function extractTenantFromEmail(email: string): TenantConfig | null {
  if (!email) return null;
  
  const domain = email.split('@')[1]?.toLowerCase();
  
  // Look for tenant by domain
  for (const tenant of Object.values(TENANT_REGISTRY)) {
    if (tenant.domain === domain) {
      return tenant;
    }
  }
  
  // Default to admin tenant for edsteward.ai emails
  if (domain === 'edsteward.ai') {
    return TENANT_REGISTRY['admin'];
  }
  
  return null;
}

/**
 * Tenant detection middleware
 * Detects tenant from:
 * 1. Email domain (user@moravian.edu → moravian tenant)
 * 2. Session-based tenant selection
 * 3. Admin URL parameters (?tenant=university1)
 * 4. Default to admin tenant
 */
export function tenantDetection(req: EdStewardTenantRequest, res: Response, next: NextFunction): void {
  try {
    let tenant: TenantConfig | null = null;

    // Method 1: Admin URL parameter (for admin operations)
    if (req.query.tenant && typeof req.query.tenant === 'string') {
      const requestedTenant = TENANT_REGISTRY[req.query.tenant];
      if (requestedTenant && req.user && (req.user as any).role === 'admin') {
        tenant = requestedTenant;
        console.log(`[TENANT] Admin selected tenant: ${tenant.id}`);
      }
    }

    // Method 2: Session-based tenant selection
    if (!tenant && req.session && (req.session as any).selectedTenant) {
      const sessionTenant = TENANT_REGISTRY[(req.session as any).selectedTenant];
      if (sessionTenant) {
        tenant = sessionTenant;
        console.log(`[TENANT] Session tenant: ${tenant.id}`);
      }
    }

    // Method 3: Email domain detection
    if (!tenant && req.user && (req.user as any).email) {
      tenant = extractTenantFromEmail((req.user as any).email);
      if (tenant) {
        console.log(`[TENANT] Email domain tenant: ${tenant.id} for ${(req.user as any).email}`);
      }
    }

    // Method 4: Default to admin tenant
    if (!tenant) {
      tenant = TENANT_REGISTRY['admin'];
      console.log(`[TENANT] Default tenant: ${tenant.id}`);
    }

    // Set tenant context
    req.tenant = tenant;
    req.tenantId = tenant.id;

    // Add tenant info to response headers (for debugging)
    res.set('X-Tenant-ID', tenant.id);
    res.set('X-Tenant-Name', tenant.name);

    next();
  } catch (error) {
    console.error('[TENANT] Error in tenant detection:', error);
    // Continue with admin tenant on error
    req.tenant = TENANT_REGISTRY['admin'];
    req.tenantId = 'admin';
    next();
  }
}

/**
 * Get tenant configuration by ID
 */
export function getTenantConfig(tenantId: string): TenantConfig | null {
  return TENANT_REGISTRY[tenantId] || null;
}

/**
 * Get all available tenants
 */
export function getAllTenants(): TenantConfig[] {
  return Object.values(TENANT_REGISTRY);
}

/**
 * Register a new tenant
 */
export function registerTenant(tenant: TenantConfig): void {
  TENANT_REGISTRY[tenant.id] = tenant;
  console.log(`[TENANT] Registered new tenant: ${tenant.id} (${tenant.name})`);
}

/**
 * Require tenant middleware - ensures tenant is detected
 */
export const requireTenant = (req: EdStewardTenantRequest, res: Response, next: NextFunction) => {
  if (!req.tenantId) {
    return res.status(400).json({
      error: 'Tenant not detected',
      message: 'Please select a tenant or ensure your email domain is registered'
    });
  }
  next();
};

/**
 * Tenant management functions
 */
export const TenantManager = {
  /**
   * Register a new tenant
   */
  registerTenant(config: TenantConfig): void {
    TENANT_REGISTRY[config.id] = config;
    console.log(`[TENANT] Registered new tenant: ${config.id} (${config.name})`);
  },

  /**
   * Get all registered tenants
   */
  getAllTenants(): TenantConfig[] {
    return Object.values(TENANT_REGISTRY);
  },

  /**
   * Get tenant by ID
   */
  getTenant(tenantId: string): TenantConfig | null {
    return getTenantConfig(tenantId);
  },

  /**
   * Update tenant configuration
   */
  updateTenant(tenantId: string, updates: Partial<TenantConfig>): boolean {
    const config = getTenantConfig(tenantId);
    if (!config) return false;

    Object.assign(config, updates);
    TENANT_REGISTRY[tenantId] = config;
    console.log(`[TENANT] Updated tenant: ${tenantId}`, { updates });
    return true;
  }
}; 