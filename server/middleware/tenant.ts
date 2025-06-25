import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { tenants } from '@shared/schema';
import { eq } from 'drizzle-orm';

// ===== CONSOLIDATED TENANT ARCHITECTURE =====
// Following Context7 best practices and Laravel Spatie multitenancy patterns
// Single responsibility: tenant resolution with proper fallback chain

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

export interface Tenant {
  id: string;
  name: string;
  domain: string;
  subdomain: string;
  databaseName: string;
  samlConfig?: {
    entityId: string;
    ssoUrl: string;
    sloUrl?: string;
    certificate: string;
    attributeMapping?: Record<string, string>;
  };
  settings: {
    allowedDomains: string[];
    defaultRole: 'user' | 'compliance_officer' | 'admin';
    enableAutoProvisioning: boolean;
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
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
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
    
    console.log(`[TENANT-FINDER] Detection result:`, {
      method: detection.method,
      subdomain: detection.subdomain,
      domain: detection.domain,
      source: detection.source
    });

    // Method 1: Subdomain-based detection (primary)
    if (detection.subdomain) {
      const tenant = await this.getTenantBySubdomain(detection.subdomain);
      if (tenant) {
        console.log(`[TENANT-FINDER] ✓ Found tenant by subdomain: ${tenant.id}`);
        return tenant;
      }
    }

    // Method 2: Custom domain detection
    if (detection.domain && detection.domain !== 'edsteward.ai') {
      const tenant = await this.getTenantByDomain(detection.domain);
      if (tenant) {
        console.log(`[TENANT-FINDER] ✓ Found tenant by domain: ${tenant.id}`);
        return tenant;
      }
    }

    // Method 3: Development/localhost (no tenant required)
    if (detection.method === 'localhost') {
      console.log(`[TENANT-FINDER] Development environment - no tenant required`);
      return null;
    }

    // Method 4: Unknown/root domain (no tenant required)
    if (detection.method === 'unknown') {
      console.log(`[TENANT-FINDER] Root domain or unknown - no tenant required`);
      return null;
    }

    console.log(`[TENANT-FINDER] ✗ No tenant found for detection:`, detection);
    return null;
  }

  /**
   * Extract tenant detection information from request
   * Follows Next.js middleware patterns
   */
  static extractTenantFromRequest(req: Request): TenantDetectionResult {
    const host = req.get('host') || req.get('x-forwarded-host') || '';
    const protocol = req.get('x-forwarded-proto') || req.protocol || 'http';
    
    console.log(`[TENANT-FINDER] Extracting from host: ${host} (protocol: ${protocol})`);
    
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
    
    // Check cache first
    const cached = tenantCache.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
      console.log(`[TENANT-FINDER] Cache hit for subdomain: ${subdomain} (source: ${cached.source})`);
      return cached.tenant;
    }

    try {
      // Try database first
      const [dbTenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.subdomain, subdomain))
        .limit(1);

      if (dbTenant) {
        const mappedTenant = this.mapDatabaseTenant(dbTenant);
        this.setCachedTenant(cacheKey, mappedTenant, 'database');
        console.log(`[TENANT-FINDER] Database lookup successful for subdomain: ${subdomain}`);
        return mappedTenant;
      }

      // Fallback to registry
      const registryTenant = TENANT_REGISTRY[subdomain];
      if (registryTenant) {
        this.setCachedTenant(cacheKey, registryTenant, 'registry');
        console.log(`[TENANT-FINDER] Registry fallback successful for subdomain: ${subdomain}`);
        return registryTenant;
      }

      console.log(`[TENANT-FINDER] No tenant found for subdomain: ${subdomain}`);
      return null;
    } catch (error) {
      console.error(`[TENANT-FINDER] Database error for subdomain ${subdomain}:`, error);
      
      // Fallback to registry on database error
      const registryTenant = TENANT_REGISTRY[subdomain];
      if (registryTenant) {
        console.log(`[TENANT-FINDER] Registry fallback due to DB error for subdomain: ${subdomain}`);
        return registryTenant;
      }
      
      return null;
    }
  }

  /**
   * Get tenant by custom domain
   */
  static async getTenantByDomain(domain: string): Promise<Tenant | null> {
    const cacheKey = `domain:${domain}`;
    
    const cached = tenantCache.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
      console.log(`[TENANT-FINDER] Cache hit for domain: ${domain}`);
      return cached.tenant;
    }

    try {
      const [dbTenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.domain, domain))
        .limit(1);

      if (dbTenant) {
        const mappedTenant = this.mapDatabaseTenant(dbTenant);
        this.setCachedTenant(cacheKey, mappedTenant, 'database');
        console.log(`[TENANT-FINDER] Database lookup successful for domain: ${domain}`);
        return mappedTenant;
      }
      
      return null;
    } catch (error) {
      console.error(`[TENANT-FINDER] Database error for domain ${domain}:`, error);
      return null;
    }
  }

  /**
   * Map database tenant to interface
   */
  private static mapDatabaseTenant(dbTenant: any): Tenant {
    return {
      ...dbTenant,
      settings: dbTenant.settings || {
        allowedDomains: [],
        defaultRole: 'user' as const,
        enableAutoProvisioning: false
      }
    } as Tenant;
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
      console.log(`[TENANT-FINDER] Cleared cache for tenant: ${tenantId}`);
    } else {
      tenantCache.clear();
      console.log(`[TENANT-FINDER] Cleared all tenant cache`);
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
    console.log(`[TENANT-FINDER] Registered new tenant: ${tenant.id} (${tenant.name})`);
  }

  /**
   * Get all tenants
   */
  static getAllTenants(): Tenant[] {
    return Object.values(TENANT_REGISTRY);
  }

  /**
   * Get tenant by ID
   */
  static getTenant(tenantId: string): Tenant | null {
    return TENANT_REGISTRY[tenantId] || null;
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
    console.log(`[TENANT-FINDER] Updated tenant: ${tenantId}`, { updates });
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
        console.log(`[TENANT-MIDDLEWARE] ✗ Access denied - tenant ${tenant.id} status: ${tenant.status}`);
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

      const duration = Date.now() - startTime;
      console.log(`[TENANT-MIDDLEWARE] ✓ Tenant context set: ${tenant.name} (${tenant.id}) in ${duration}ms`);
    } else {
      // No tenant context (valid for public routes)
      console.log(`[TENANT-MIDDLEWARE] No tenant context required`);
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
    console.log(`[TENANT-MIDDLEWARE] ✗ Tenant context required but not found`);
    return res.status(400).json({
      error: 'Tenant context required',
      code: 'TENANT_REQUIRED',
      suggestion: 'Access this resource via a tenant subdomain (e.g., moravian.edsteward.ai)'
    });
  }
  console.log(`[TENANT-MIDDLEWARE] ✓ Tenant context verified: ${req.tenant.id}`);
  next();
}

export function extractTenantFromSAML(samlProfile: any): string | null {
  const orgDomain = samlProfile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/organization'] ||
                   samlProfile['urn:oid:2.5.4.10'] ||
                   samlProfile.organization;

  const emailDomain = samlProfile.email ? samlProfile.email.split('@')[1] : null;
  
  // Map email domain to tenant subdomain
  if (emailDomain === 'moravian.edu') return 'moravian';
  if (emailDomain === 'edsteward.ai') return 'admin';
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