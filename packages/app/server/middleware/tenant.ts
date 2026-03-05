import { Request, Response, NextFunction } from 'express';
import { getTenantConfig, getAllCachedTenants, isRegistryInitialized } from '../services/tenant-registry';

// ===== CONSOLIDATED TENANT ARCHITECTURE =====
// Following Context7 best practices and Laravel Spatie multitenancy patterns
// Single responsibility: tenant resolution with proper fallback chain
// NOW USES DYNAMIC REGISTRY - tenants loaded from admin database

// Extend Express Request to include tenant context
declare global {
  namespace Express {
    interface Request {
      tenant?: Tenant;
      tenantId?: string;
      tenantContext?: TenantContext;
    }
  }
}

// ===== CORE INTERFACES =====

// SSO Provider types
export type SSOProvider = 'saml' | 'oidc' | 'cas';

// Unified SSO configuration structure
export interface SSOConfig {
  provider: SSOProvider;
  autoProvisioning: boolean;
  defaultRole: string;
  allowedDomains?: string[];
  saml?: SAMLConfigDetails;
  oidc?: OIDCConfigDetails;
  cas?: CASConfigDetails;
}

// SAML configuration details
export interface SAMLConfigDetails {
  entityId: string;
  ssoUrl: string;
  sloUrl?: string;
  certificate: string;
  attributeMapping?: Record<string, string>;
  eduPersonEnabled?: boolean;
  incommonMetadataUrl?: string;
}

// OIDC configuration details (Azure AD, Google, etc.)
export interface OIDCConfigDetails {
  issuerUrl: string;
  clientId: string;
  clientSecret: string;
  scopes: string[];
  attributeMapping?: Record<string, string>;
  preset?: 'azure-ad' | 'google' | 'auth0' | 'okta' | 'custom';
}

// CAS configuration details
export interface CASConfigDetails {
  serverUrl: string;
  serviceValidateUrl?: string;
  version: '2.0' | '3.0';
  attributeMapping?: Record<string, string>;
}

export interface Tenant {
  id: string;
  name: string;
  domain: string;
  subdomain: string;
  databaseName: string;
  
  // Legacy SAML config (for backward compatibility)
  samlConfig?: {
    entityId: string;
    ssoUrl: string;
    sloUrl?: string;
    certificate: string;
    attributeMapping?: Record<string, string>;
    eduPersonEnabled?: boolean;
  };
  
  // New unified SSO config (supports SAML, OIDC, CAS)
  ssoConfig?: SSOConfig;
  
  // Individual provider configs (populated from ssoConfig)
  oidcConfig?: OIDCConfigDetails;
  casConfig?: CASConfigDetails;
  
  settings: {
    allowedDomains: string[];
    defaultRole: 'user' | 'compliance_officer' | 'admin' | 'viewer';
    enableAutoProvisioning: boolean;
    enableLocalAuth?: boolean;
    region?: string;
    timeZone?: string;
    customBranding?: {
      logo?: string;
      primaryColor?: string;
      secondaryColor?: string;
      logoUrl?: string;
    };
    features?: {
      maxUsers?: number;
      maxRegulations?: number;
      apiAccess?: boolean;
      customDomain?: boolean;
      ssoEnabled?: boolean;
    };
    institutionConfig?: {
      primaryTypes: string[];
      hideNonApplicable: boolean;
      allowUsersToToggle: boolean;
    };
    featureFlags?: Record<string, boolean>;
  };
  status: 'active' | 'inactive' | 'suspended';
  createdAt: Date;
  updatedAt: Date;
}

export interface TenantContext {
  tenant: Tenant;
  detectionMethod: 'subdomain' | 'domain' | 'header' | 'fallback';
  detectionSource: string;
  isActive: boolean;
  switchedAt: Date;
}

export interface TenantDetectionResult {
  subdomain?: string;
  domain?: string;
  method: 'subdomain' | 'domain' | 'header' | 'localhost' | 'unknown';
  source: string;
}

// ===== TENANT REGISTRY =====
// Authoritative source of truth for tenant configurations
// Following Context7 pattern: single source with proper fallback

const TENANT_REGISTRY: Record<string, Tenant> = {
  'admin': {
    id: 'admin',
    name: 'EdSteward Admin Console',
    domain: 'edsteward.ai',
    subdomain: 'admin',
    databaseName: 'edsteward_admin',
    status: 'active',
    settings: {
      allowedDomains: ['edsteward.ai'],
      defaultRole: 'admin',
      enableAutoProvisioning: false,
      features: {
        apiAccess: true,
        customDomain: true,
        ssoEnabled: true,
        maxUsers: 1000,
        maxRegulations: 10000
      },
      institutionConfig: {
        primaryTypes: ['public-universities', 'private-universities'],
        hideNonApplicable: true,
        allowUsersToToggle: true
      }
    },
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date()
  },
  'staging': {
    id: 'staging',
    name: 'EdSteward Staging Environment',
    domain: 'staging.edsteward.ai',
    subdomain: 'staging',
    databaseName: 'edsteward_staging',
    status: 'active',
    settings: {
      allowedDomains: ['edsteward.ai', 'staging.edsteward.ai'],
      defaultRole: 'admin',
      enableAutoProvisioning: true,
      features: {
        apiAccess: true,
        customDomain: false,
        ssoEnabled: false,
        maxUsers: 1000,
        maxRegulations: 10000
      }
    },
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date()
  },
  'moravian': {
    id: 'moravian',
    name: 'Moravian University',
    domain: 'moravian.edu',
    subdomain: 'moravian',
    databaseName: 'edsteward_moravian',
    status: 'active',
    settings: {
      allowedDomains: ['moravian.edu'],
      defaultRole: 'user',
      enableAutoProvisioning: true,
      features: {
        apiAccess: true,
        customDomain: false,
        ssoEnabled: true,
        maxUsers: 500,
        maxRegulations: 5000
      },
      institutionConfig: {
        primaryTypes: ['private-universities', 'religious-institutions'],
        hideNonApplicable: true,
        allowUsersToToggle: true
      }
    },
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date()
  },
  'test': {
    id: 'test',
    name: 'EdSteward Test Environment',
    domain: 'test.edsteward.local',
    subdomain: 'test',
    databaseName: 'edsteward_test',
    status: 'active',
    settings: {
      allowedDomains: ['edsteward.ai', 'test.edsteward.local'],
      defaultRole: 'admin',
      enableAutoProvisioning: true,
      features: {
        apiAccess: true,
        customDomain: false,
        ssoEnabled: false,
        maxUsers: 100,
        maxRegulations: 1000
      }
    },
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date()
  },
  'wossamotta': {
    id: 'wossamotta',
    name: 'Wossamotta University',
    domain: 'wossamotta.edu',
    subdomain: 'wossamotta',
    databaseName: 'edsteward_wossamotta',
    status: 'active',
    settings: {
      allowedDomains: ['wossamotta.edu'],
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
    createdAt: new Date('2026-01-06'),
    updatedAt: new Date()
  },
  'template': {
    id: 'template',
    name: 'EdSteward Template',
    domain: 'template.edsteward.ai',
    subdomain: 'template',
    databaseName: 'edsteward_template',
    status: 'active',
    settings: {
      allowedDomains: ['edsteward.ai'],
      defaultRole: 'admin',
      enableAutoProvisioning: false,
      features: {
        apiAccess: true,
        customDomain: false,
        ssoEnabled: false,
        maxUsers: 999,
        maxRegulations: 9999
      },
      institutionConfig: {
        primaryTypes: ['public-universities', 'private-universities'],
        hideNonApplicable: false,
        allowUsersToToggle: true
      }
    },
    createdAt: new Date('2026-01-17'),
    updatedAt: new Date()
  }
};

// ===== TENANT CACHE =====
// Performance optimization with TTL and memory management

interface CachedTenant {
  tenant: Tenant;
  cachedAt: number;
  source: 'database' | 'registry';
}

const tenantCache = new Map<string, CachedTenant>();
const CACHE_TTL = 60 * 1000; // 1 minute (matches tenant-registry.ts TTL)
const MAX_CACHE_SIZE = 1000;

// ===== TENANT FINDER =====
// Following Context7 pattern: single finder with clear responsibility

export class TenantFinder {
  /**
   * Find tenant for incoming request
   * Follows Context7 best practice: single method with clear contract
   */
  static async findForRequest(req: Request): Promise<Tenant | null> {
    const detection = this.extractTenantFromRequest(req);

    // Method 1: Subdomain-based detection (primary)
    if (detection.subdomain) {
      const tenant = await this.getTenantBySubdomain(detection.subdomain);
      if (tenant) {
        return tenant;
      }
    }

    // Method 2: Custom domain detection
    if (detection.domain && detection.domain !== 'edsteward.ai') {
      const tenant = await this.getTenantByDomain(detection.domain);
      if (tenant) {
        return tenant;
      }
    }

    // Method 3: Development/localhost (simulate Moravian tenant for testing)
    if (detection.method === 'localhost') {
      return TENANT_REGISTRY['moravian'] || null;
    }

    // Method 4: Unknown/root domain (no tenant required)
    if (detection.method === 'unknown') {
      return null;
    }

    return null;
  }

  /**
   * Extract tenant detection information from request
   * Follows Next.js middleware patterns
   */
  static extractTenantFromRequest(req: Request): TenantDetectionResult {
    const host = req.get('host') || req.get('x-forwarded-host') || '';
    const _protocol = req.get('x-forwarded-proto') || req.protocol || 'http';
    
    
    // Method 1: Subdomain detection (tenant.edsteward.ai or tenant.edsteward.local)
    const subdomainMatch = host.match(/^([^.]+)\.edsteward\.(ai|local)(?::\d+)?$/);
    if (subdomainMatch && subdomainMatch[1] !== 'www' && subdomainMatch[1] !== 'api') {
      return {
        subdomain: subdomainMatch[1],
        domain: subdomainMatch[2] === 'local' ? 'edsteward.local' : 'edsteward.ai',
        method: 'subdomain',
        source: host
      };
    }

    // Method 2: Custom domain (customer-domain.com)
    if (host && 
        !host.includes('edsteward.ai') && 
        !host.includes('localhost') && 
        !host.includes('127.0.0.1') &&
        !host.includes('0.0.0.0')) {
      return {
        domain: host.split(':')[0],
        method: 'domain',
        source: host
      };
    }

    // Method 3: Header-based (for API calls and load balancers)
    const tenantHeader = req.get('x-tenant-id') || req.get('x-tenant-subdomain');
    if (tenantHeader) {
      return {
        subdomain: tenantHeader,
        method: 'header',
        source: `header:${tenantHeader}`
      };
    }

    // Method 4: Localhost development
    if (host.includes('localhost') || host.includes('127.0.0.1') || host.includes('0.0.0.0')) {
      return { 
        method: 'localhost',
        source: host
      };
    }

    // Method 5: Root domain or unknown
    return { 
      method: 'unknown',
      source: host
    };
  }

  /**
   * Get tenant by subdomain with proper fallback chain
   * Following Context7 pattern: database first, then registry fallback
   */
  static async getTenantBySubdomain(subdomain: string): Promise<Tenant | null> {
    const cacheKey = `subdomain:${subdomain}`;
    
    // Check local cache first
    const cached = tenantCache.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
      return cached.tenant;
    }

    // Try dynamic registry (loads from admin database)
    if (isRegistryInitialized()) {
      const dynamicTenant = await getTenantConfig(subdomain);
      if (dynamicTenant) {
        this.setCachedTenant(cacheKey, dynamicTenant, 'database');
        return dynamicTenant;
      }
    }

    // Fallback to hardcoded registry (for backwards compatibility)
    const registryTenant = TENANT_REGISTRY[subdomain];
    if (registryTenant) {
      this.setCachedTenant(cacheKey, registryTenant, 'registry');
      return registryTenant;
    }

    return null;
  }

  /**
   * Get tenant by custom domain
   */
  static async getTenantByDomain(domain: string): Promise<Tenant | null> {
    const cacheKey = `domain:${domain}`;
    
    const cached = tenantCache.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
      return cached.tenant;
    }

    // Search dynamic registry first
    if (isRegistryInitialized()) {
      const allTenants = getAllCachedTenants();
      for (const tenant of allTenants) {
        if (tenant.domain === domain) {
          this.setCachedTenant(cacheKey, tenant, 'database');
          return tenant;
        }
      }
    }

    // Fallback to hardcoded registry
    for (const tenant of Object.values(TENANT_REGISTRY)) {
      if (tenant.domain === domain) {
        this.setCachedTenant(cacheKey, tenant, 'registry');
        return tenant;
      }
    }
    
    return null;
  }

  /**
   * Set cached tenant with memory management
   */
  private static setCachedTenant(cacheKey: string, tenant: Tenant, source: 'database' | 'registry'): void {
    // Prevent cache from growing too large
    if (tenantCache.size >= MAX_CACHE_SIZE) {
      const oldestKey = tenantCache.keys().next().value;
      if (oldestKey) {
        tenantCache.delete(oldestKey);
      }
    }

    tenantCache.set(cacheKey, {
      tenant,
      cachedAt: Date.now(),
      source
    });
  }

  /**
   * Clear cache (for testing and invalidation)
   */
  static clearCache(tenantId?: string): void {
    if (tenantId) {
      tenantCache.forEach((value, key) => {
        if (key.includes(tenantId)) {
          tenantCache.delete(key);
        }
      });
    } else {
      tenantCache.clear();
    }
  }

  /**
   * Get tenant registry (for admin operations)
   */
  static getTenantRegistry(): Record<string, Tenant> {
    return { ...TENANT_REGISTRY };
  }

  /**
   * Register new tenant (runtime)
   */
  static registerTenant(tenant: Tenant): void {
    TENANT_REGISTRY[tenant.id] = tenant;
    this.clearCache(tenant.id); // Invalidate cache
  }

  /**
   * Get all tenants (combines dynamic and hardcoded)
   */
  static getAllTenants(): Tenant[] {
    const tenants = new Map<string, Tenant>();
    
    // Add dynamic tenants first (higher priority)
    if (isRegistryInitialized()) {
      for (const tenant of getAllCachedTenants()) {
        tenants.set(tenant.id, tenant);
      }
    }
    
    // Add hardcoded tenants as fallback (won't overwrite dynamic)
    for (const tenant of Object.values(TENANT_REGISTRY)) {
      if (!tenants.has(tenant.id)) {
        tenants.set(tenant.id, tenant);
      }
    }
    
    return Array.from(tenants.values());
  }

  /**
   * Get tenant by ID (sync - checks hardcoded registry and cache)
   */
  static getTenant(tenantId: string): Tenant | null {
    // Check dynamic registry cache first (higher priority)
    if (isRegistryInitialized()) {
      const allTenants = getAllCachedTenants();
      const dynamicTenant = allTenants.find(t => t.id === tenantId);
      if (dynamicTenant) return dynamicTenant;
    }
    
    // Fallback to hardcoded registry
    return TENANT_REGISTRY[tenantId] || null;
  }

  /**
   * Get tenant by ID (async - full lookup including database)
   * This is the preferred method for SSO and auth flows
   */
  static async getTenantById(tenantId: string): Promise<Tenant | null> {
    const cacheKey = `id:${tenantId}`;
    
    // Check local cache first
    const cached = tenantCache.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
      return cached.tenant;
    }

    // Try dynamic registry (loads from admin database)
    if (isRegistryInitialized()) {
      const dynamicTenant = await getTenantConfig(tenantId);
      if (dynamicTenant) {
        this.setCachedTenant(cacheKey, dynamicTenant, 'database');
        return dynamicTenant;
      }
    }

    // Fallback to hardcoded registry
    const registryTenant = TENANT_REGISTRY[tenantId];
    if (registryTenant) {
      this.setCachedTenant(cacheKey, registryTenant, 'registry');
      return registryTenant;
    }

    return null;
  }

  /**
   * Update tenant configuration
   */
  static updateTenant(tenantId: string, updates: Partial<Tenant>): boolean {
    const tenant = TENANT_REGISTRY[tenantId];
    if (!tenant) return false;

    Object.assign(tenant, updates);
    TENANT_REGISTRY[tenantId] = tenant;
    this.clearCache(tenantId);
    return true;
  }
}

// ===== TENANT MIDDLEWARE =====
// Following Context7 pattern: single middleware with clear responsibilities

export async function tenantMiddleware(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  
  try {
    const tenant = await TenantFinder.findForRequest(req);

    if (tenant) {
      // Validate tenant status
      if (tenant.status !== 'active') {
        return res.status(403).json({
          error: 'Tenant access suspended',
          code: 'TENANT_SUSPENDED',
          tenant: tenant.id,
          status: tenant.status
        });
      }

      // Set tenant context
      req.tenant = tenant;
      req.tenantId = tenant.id;
      req.tenantContext = {
        tenant,
        detectionMethod: 'subdomain', // Will be enhanced
        detectionSource: req.get('host') || '',
        isActive: true,
        switchedAt: new Date()
      };

      // Set response headers for downstream services
      res.set('x-tenant-id', tenant.id);
      res.set('x-tenant-subdomain', tenant.subdomain);
      res.set('x-tenant-name', tenant.name);

      // Tenant resolved successfully
    } else {
      // No tenant context (valid for public routes)
    }

    next();
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[TENANT-MIDDLEWARE] Error after ${duration}ms:`, error);
    res.status(500).json({
      error: 'Internal server error during tenant identification',
      code: 'TENANT_ERROR',
      timestamp: new Date().toISOString()
    });
  }
}

// ===== TENANT UTILITIES =====

export function requireTenant(req: Request, res: Response, next: NextFunction) {
  if (!req.tenant) {
    return res.status(400).json({
      error: 'Tenant context required',
      code: 'TENANT_REQUIRED',
      suggestion: 'Access this resource via a tenant subdomain (e.g., moravian.edsteward.ai)'
    });
  }
  next();
}

export function extractTenantFromSAML(samlProfile: any): string | null {
  const orgDomain = samlProfile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/organization'] ||
                   samlProfile['urn:oid:2.5.4.10'] ||
                   samlProfile.organization;

  const emailDomain = samlProfile.email ? samlProfile.email.split('@')[1] : null;
  
  // Try to match email domain against all registered tenants (dynamic + hardcoded)
  if (emailDomain) {
    const allTenants = TenantFinder.getAllTenants();
    for (const tenant of allTenants) {
      // Match against tenant's allowed domains
      if (tenant.settings.allowedDomains.includes(emailDomain)) {
        return tenant.id;
      }
      // Match against tenant's primary domain
      if (tenant.domain === emailDomain) {
        return tenant.id;
      }
    }
    // Hardcoded fallbacks for known domains
    if (emailDomain === 'edsteward.ai') return 'admin';
  }
  
  if (orgDomain) return orgDomain.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  
  return null;
}

// ===== TENANT MANAGER =====
// Legacy compatibility wrapper

export const TenantManager = {
  /**
   * Register a new tenant
   */
  registerTenant(config: Tenant): void {
    TenantFinder.registerTenant(config);
  },

  /**
   * Get all registered tenants
   */
  getAllTenants(): Tenant[] {
    return TenantFinder.getAllTenants();
  },

  /**
   * Get tenant by ID
   */
  getTenant(tenantId: string): Tenant | null {
    return TenantFinder.getTenant(tenantId);
  },

  /**
   * Update tenant configuration
   */
  updateTenant(tenantId: string, updates: Partial<Tenant>): boolean {
    return TenantFinder.updateTenant(tenantId, updates);
  }
};

// ===== EXPORTS =====

export default {
  TenantFinder,
  tenantMiddleware,
  requireTenant,
  extractTenantFromSAML
};

// Legacy compatibility (will be removed in next phase)
export { TenantFinder as TenantService };

// Legacy interfaces for backward compatibility
export interface LegacyTenantConfig {
  id: string;
  name: string;
  domain: string;
  database: string; // Legacy property - maps to databaseName
  samlConfig?: {
    entryPoint: string;
    cert: string;
    issuer: string;
  };
}

// Request type for backward compatibility
export interface ConsolidatedTenantRequest extends Request {
  tenant?: Tenant;
  tenantId?: string;
  tenantContext?: TenantContext;
}

// Helper function to convert between interfaces
export function tenantToLegacyConfig(tenant: Tenant): LegacyTenantConfig {
  return {
    id: tenant.id,
    name: tenant.name,
    domain: tenant.domain,
    database: tenant.databaseName,
    samlConfig: tenant.samlConfig ? {
      entryPoint: tenant.samlConfig.ssoUrl,
      cert: tenant.samlConfig.certificate,
      issuer: tenant.samlConfig.entityId
    } : undefined
  };
} 