import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { tenants } from '@shared/schema';
import { eq } from 'drizzle-orm';

// Extend Express Request to include tenant context
declare global {
  namespace Express {
    interface Request {
      tenant?: Tenant;
      tenantId?: string;
    }
  }
}

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

// Fallback hardcoded tenants for backward compatibility and emergency access
const FALLBACK_TENANTS: Record<string, Tenant> = {
  'admin': {
    id: 'admin',
    name: 'EdSteward Admin',
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
    createdAt: new Date(),
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
    createdAt: new Date(),
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
    createdAt: new Date(),
    updatedAt: new Date()
  },
  'staging': {
    id: 'staging',
    name: 'EdSteward Staging Environment',
    domain: 'staging.edsteward.ai',
    subdomain: 'staging',
    databaseName: 'edsteward_staging', // Use dedicated staging database for proper isolation
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
    createdAt: new Date(),
    updatedAt: new Date()
  }
};

// Enhanced tenant cache with TTL and performance optimization
interface CachedTenant {
  tenant: Tenant;
  cachedAt: number;
}

const tenantCache = new Map<string, CachedTenant>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes (following best practices)
const MAX_CACHE_SIZE = 1000; // Prevent memory leaks

export class TenantService {
  /**
   * Get tenant by subdomain with enhanced caching and fallback
   */
  static async getTenantBySubdomain(subdomain: string): Promise<Tenant | null> {
    const cacheKey = `subdomain:${subdomain}`;
    
    // Check cache first (performance optimization)
    const cached = tenantCache.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
      console.log(`[TENANT] Cache hit for subdomain: ${subdomain}`);
      return cached.tenant;
    }

    try {
      // Try database first
      const [tenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.subdomain, subdomain))
        .limit(1);

      if (tenant) {
        const mappedTenant = this.mapDatabaseTenant(tenant);
        this.setCachedTenant(cacheKey, mappedTenant);
        console.log(`[TENANT] Database lookup successful for subdomain: ${subdomain}`);
        return mappedTenant;
      }

      // Fallback to hardcoded tenants (backward compatibility)
      const fallbackTenant = FALLBACK_TENANTS[subdomain];
      if (fallbackTenant) {
        this.setCachedTenant(cacheKey, fallbackTenant);
        console.log(`[TENANT] Using fallback tenant for subdomain: ${subdomain}`);
        return fallbackTenant;
      }

      console.log(`[TENANT] No tenant found for subdomain: ${subdomain}`);
      return null;
    } catch (error) {
      console.error(`[TENANT] Database error for subdomain ${subdomain}:`, error);
      
      // Try fallback on database error (resilience)
      const fallbackTenant = FALLBACK_TENANTS[subdomain];
      if (fallbackTenant) {
        console.log(`[TENANT] Using fallback due to DB error for subdomain: ${subdomain}`);
        return fallbackTenant;
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
      console.log(`[TENANT] Cache hit for domain: ${domain}`);
      return cached.tenant;
    }

    try {
      const [tenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.domain, domain))
        .limit(1);

      if (tenant) {
        const mappedTenant = this.mapDatabaseTenant(tenant);
        this.setCachedTenant(cacheKey, mappedTenant);
        console.log(`[TENANT] Database lookup successful for domain: ${domain}`);
        return mappedTenant;
      }
      return null;
    } catch (error) {
      console.error(`[TENANT] Database error for domain ${domain}:`, error);
      return null;
    }
  }

  /**
   * Extract tenant information from request (Following Next.js best practices)
   */
  static extractTenantFromRequest(req: Request): {
    subdomain?: string;
    domain?: string;
    method: 'subdomain' | 'domain' | 'header' | 'localhost' | 'unknown';
  } {
    const host = req.get('host') || req.get('x-forwarded-host') || '';
    const protocol = req.get('x-forwarded-proto') || req.protocol || 'http';
    
    console.log(`[TENANT] Extracting tenant from host: ${host} (protocol: ${protocol})`);
    
    // Method 1: Subdomain detection (tenant.edsteward.ai or tenant.edsteward.local) - PRIMARY METHOD
    const subdomainMatch = host.match(/^([^.]+)\.edsteward\.(ai|local)(?::\d+)?$/);
    if (subdomainMatch && subdomainMatch[1] !== 'www' && subdomainMatch[1] !== 'api') {
      console.log(`[TENANT] ✓ Detected subdomain: ${subdomainMatch[1]} (domain: ${subdomainMatch[2]})`);
      return {
        subdomain: subdomainMatch[1],
        domain: subdomainMatch[2] === 'local' ? 'edsteward.local' : 'edsteward.ai',
        method: 'subdomain'
      };
    }

    // Method 2: Custom domain (customer-domain.com)
    if (host && 
        !host.includes('edsteward.ai') && 
        !host.includes('localhost') && 
        !host.includes('127.0.0.1') &&
        !host.includes('0.0.0.0')) {
      console.log(`[TENANT] ✓ Detected custom domain: ${host}`);
      return {
        domain: host.split(':')[0], // Remove port if present
        method: 'domain'
      };
    }

    // Method 3: Header-based (for API calls and load balancers)
    const tenantHeader = req.get('x-tenant-id') || req.get('x-tenant-subdomain');
    if (tenantHeader) {
      console.log(`[TENANT] ✓ Detected tenant from header: ${tenantHeader}`);
      return {
        subdomain: tenantHeader,
        method: 'header'
      };
    }

    // Method 4: Localhost development (localhost:3000, 127.0.0.1, etc.)
    if (host.includes('localhost') || host.includes('127.0.0.1') || host.includes('0.0.0.0')) {
      console.log(`[TENANT] Development environment detected: ${host}`);
      return { method: 'localhost' };
    }

    // Method 5: Root domain (edsteward.ai) - Landing page
    if (host === 'edsteward.ai' || host.startsWith('edsteward.ai:')) {
      console.log(`[TENANT] Root domain access - landing page`);
      return { method: 'unknown' };
    }

    console.log(`[TENANT] No tenant detection method matched for host: ${host}`);
    return { method: 'unknown' };
  }

  /**
   * Map database tenant to interface (data transformation)
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
  private static setCachedTenant(cacheKey: string, tenant: Tenant): void {
    // Prevent cache from growing too large (memory management)
    if (tenantCache.size >= MAX_CACHE_SIZE) {
      const oldestKey = tenantCache.keys().next().value;
      if (oldestKey) {
        tenantCache.delete(oldestKey);
        console.log(`[TENANT] Cache evicted oldest entry: ${oldestKey}`);
      }
    }

    tenantCache.set(cacheKey, {
      tenant,
      cachedAt: Date.now()
    });
  }

  /**
   * Clear cache (for testing and cache invalidation)
   */
  static clearCache(tenantId?: string): void {
    if (tenantId) {
      // Clear specific tenant cache entries
      tenantCache.forEach((value, key) => {
        if (key.includes(tenantId)) {
          tenantCache.delete(key);
        }
      });
      console.log(`[TENANT] Cleared cache for tenant: ${tenantId}`);
    } else {
      // Clear all cache
      tenantCache.clear();
      console.log(`[TENANT] Cleared all tenant cache`);
    }
  }

  /**
   * Get cache statistics (for monitoring)
   */
  static getCacheStats(): { size: number; maxSize: number; hitRate?: number } {
    return {
      size: tenantCache.size,
      maxSize: MAX_CACHE_SIZE
    };
  }
}

/**
 * Primary tenant middleware - subdomain-based detection with best practices
 * Follows Next.js middleware patterns and SaaS architecture standards
 */
export async function tenantMiddleware(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  
  try {
    const tenantInfo = TenantService.extractTenantFromRequest(req);
    let tenant: Tenant | null = null;

    console.log(`[TENANT] Detection - method: ${tenantInfo.method}, subdomain: ${tenantInfo.subdomain}, domain: ${tenantInfo.domain}`);

    // Try to identify tenant based on detection method
    if (tenantInfo.subdomain) {
      tenant = await TenantService.getTenantBySubdomain(tenantInfo.subdomain);
    } else if (tenantInfo.domain && tenantInfo.domain !== 'edsteward.ai') {
      tenant = await TenantService.getTenantByDomain(tenantInfo.domain);
    }

    if (tenant) {
      // Check tenant status (security)
      if (tenant.status !== 'active') {
        console.log(`[TENANT] ✗ Access denied - tenant ${tenant.id} status: ${tenant.status}`);
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

      // Set tenant context headers for downstream services
      res.set('x-tenant-id', tenant.id);
      res.set('x-tenant-subdomain', tenant.subdomain);
      res.set('x-tenant-name', tenant.name);

      const duration = Date.now() - startTime;
      console.log(`[TENANT] ✓ Authenticated for tenant: ${tenant.name} (${tenant.id}) in ${duration}ms`);
    } else if (tenantInfo.method === 'subdomain' || tenantInfo.method === 'domain') {
      // Tenant identification attempted but failed (specific error)
      console.log(`[TENANT] ✗ Tenant not found - method: ${tenantInfo.method}, identifier: ${tenantInfo.subdomain || tenantInfo.domain}`);
      return res.status(404).json({
        error: 'Tenant not found',
        code: 'TENANT_NOT_FOUND',
        method: tenantInfo.method,
        identifier: tenantInfo.subdomain || tenantInfo.domain,
        suggestion: tenantInfo.method === 'subdomain' 
          ? `Available subdomains: admin.edsteward.ai, moravian.edsteward.ai`
          : 'Please check the domain configuration'
      });
    } else if (tenantInfo.method === 'localhost') {
      // Development environment - allow access without tenant context
      console.log(`[TENANT] Development environment - proceeding without tenant context`);
    } else {
      // Root domain (edsteward.ai) or unknown - no tenant context needed
      console.log(`[TENANT] Root domain or unknown - no tenant context required`);
    }

    next();
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[TENANT] Middleware error after ${duration}ms:`, error);
    res.status(500).json({
      error: 'Internal server error during tenant identification',
      code: 'TENANT_ERROR',
      timestamp: new Date().toISOString()
    });
  }
}

// Middleware to require tenant context (for protected routes)
export function requireTenant(req: Request, res: Response, next: NextFunction) {
  if (!req.tenant) {
    console.log(`[TENANT] ✗ Tenant context required but not found`);
    return res.status(400).json({
      error: 'Tenant context required',
      code: 'TENANT_REQUIRED',
      suggestion: 'Access this resource via a tenant subdomain (e.g., moravian.edsteward.ai)'
    });
  }
  console.log(`[TENANT] ✓ Tenant context verified: ${req.tenant.id}`);
  next();
}

// Middleware to extract tenant from SAML response
export function extractTenantFromSAML(samlProfile: any): string | null {
  // Try to extract tenant identifier from SAML assertion attributes
  const orgDomain = samlProfile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/organization'] ||
                   samlProfile['urn:oid:2.5.4.10'] || // o (organization)
                   samlProfile.organization;

  const emailDomain = samlProfile.email ? samlProfile.email.split('@')[1] : null;
  
  // Map email domain to tenant subdomain
  if (emailDomain === 'moravian.edu') return 'moravian';
  if (emailDomain === 'edsteward.ai') return 'admin';
  if (orgDomain) return orgDomain.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  
  return null;
}

export default {
  TenantService,
  tenantMiddleware,
  requireTenant,
  extractTenantFromSAML
}; // Force deployment Wed Jun 25 13:56:05 EDT 2025
