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
  };
  status: 'active' | 'inactive' | 'suspended';
  createdAt: Date;
  updatedAt: Date;
}

// Cache for tenant lookups to reduce database queries
const tenantCache = new Map<string, Tenant>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export class TenantService {
  static async getTenantBySubdomain(subdomain: string): Promise<Tenant | null> {
    const cacheKey = `subdomain:${subdomain}`;
    
    // Check cache first
    if (tenantCache.has(cacheKey)) {
      const cached = tenantCache.get(cacheKey);
      if (cached && Date.now() - cached.updatedAt.getTime() < CACHE_TTL) {
        return cached;
      }
    }

    try {
      const [tenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.subdomain, subdomain))
        .limit(1);

      if (tenant) {
        tenantCache.set(cacheKey, tenant as Tenant);
        return tenant as Tenant;
      }
      return null;
    } catch (error) {
      console.error(`Error fetching tenant for subdomain ${subdomain}:`, error);
      return null;
    }
  }

  static async getTenantByDomain(domain: string): Promise<Tenant | null> {
    const cacheKey = `domain:${domain}`;
    
    if (tenantCache.has(cacheKey)) {
      const cached = tenantCache.get(cacheKey);
      if (cached && Date.now() - cached.updatedAt.getTime() < CACHE_TTL) {
        return cached;
      }
    }

    try {
      const [tenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.domain, domain))
        .limit(1);

      if (tenant) {
        tenantCache.set(cacheKey, tenant as Tenant);
        return tenant as Tenant;
      }
      return null;
    } catch (error) {
      console.error(`Error fetching tenant for domain ${domain}:`, error);
      return null;
    }
  }

  static async getTenantById(tenantId: string): Promise<Tenant | null> {
    const cacheKey = `id:${tenantId}`;
    
    if (tenantCache.has(cacheKey)) {
      const cached = tenantCache.get(cacheKey);
      if (cached && Date.now() - cached.updatedAt.getTime() < CACHE_TTL) {
        return cached;
      }
    }

    try {
      const [tenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1);

      if (tenant) {
        tenantCache.set(cacheKey, tenant as Tenant);
        return tenant as Tenant;
      }
      return null;
    } catch (error) {
      console.error(`Error fetching tenant for ID ${tenantId}:`, error);
      return null;
    }
  }

  static extractTenantFromRequest(req: Request): {
    subdomain?: string;
    domain?: string;
    method: 'subdomain' | 'domain' | 'header' | 'unknown';
  } {
    const host = req.get('host') || req.get('x-forwarded-host') || '';
    
    // Try subdomain first (tenant.edsteward.ai)
    const subdomainMatch = host.match(/^([^.]+)\.([^.]+\.[^.]+)$/);
    if (subdomainMatch && subdomainMatch[1] !== 'www') {
      return {
        subdomain: subdomainMatch[1],
        domain: subdomainMatch[2],
        method: 'subdomain'
      };
    }

    // Try custom domain (customer-domain.com)
    if (host && !host.includes('edsteward.ai')) {
      return {
        domain: host,
        method: 'domain'
      };
    }

    // Try tenant header (for API calls)
    const tenantHeader = req.get('x-tenant-id') || req.get('x-tenant-subdomain');
    if (tenantHeader) {
      return {
        subdomain: tenantHeader,
        method: 'header'
      };
    }

    return { method: 'unknown' };
  }

  static clearCache(tenantId?: string) {
    if (tenantId) {
      // Clear specific tenant cache entries
      for (const [key] of tenantCache) {
        if (key.includes(tenantId)) {
          tenantCache.delete(key);
        }
      }
    } else {
      // Clear all cache
      tenantCache.clear();
    }
  }
}

// Middleware to identify and load tenant context
export async function tenantMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantInfo = TenantService.extractTenantFromRequest(req);
    let tenant: Tenant | null = null;

    // Try to identify tenant
    if (tenantInfo.subdomain) {
      tenant = await TenantService.getTenantBySubdomain(tenantInfo.subdomain);
    } else if (tenantInfo.domain) {
      tenant = await TenantService.getTenantByDomain(tenantInfo.domain);
    }

    if (tenant) {
      if (tenant.status !== 'active') {
        return res.status(403).json({
          error: 'Tenant access suspended',
          code: 'TENANT_SUSPENDED'
        });
      }

      req.tenant = tenant;
      req.tenantId = tenant.id;

      // Set tenant context headers for downstream services
      res.set('x-tenant-id', tenant.id);
      res.set('x-tenant-subdomain', tenant.subdomain);

      console.log(`Request authenticated for tenant: ${tenant.name} (${tenant.id})`);
    } else if (tenantInfo.method !== 'unknown') {
      // Tenant identification attempted but failed
      return res.status(404).json({
        error: 'Tenant not found',
        code: 'TENANT_NOT_FOUND',
        method: tenantInfo.method,
        identifier: tenantInfo.subdomain || tenantInfo.domain
      });
    }

    next();
  } catch (error) {
    console.error('Tenant middleware error:', error);
    res.status(500).json({
      error: 'Internal server error during tenant identification',
      code: 'TENANT_ERROR'
    });
  }
}

// Middleware to require tenant context (for protected routes)
export function requireTenant(req: Request, res: Response, next: NextFunction) {
  if (!req.tenant) {
    return res.status(400).json({
      error: 'Tenant context required',
      code: 'TENANT_REQUIRED'
    });
  }
  next();
}

// Middleware to extract tenant from SAML response
export function extractTenantFromSAML(samlProfile: any): string | null {
  // Try to extract tenant identifier from SAML assertion attributes
  const orgDomain = samlProfile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/organization'] ||
                   samlProfile['urn:oid:2.5.4.10'] || // o (organization)
                   samlProfile.organization;

  const emailDomain = samlProfile.email ? samlProfile.email.split('@')[1] : null;
  
  const entityId = samlProfile.issuer || samlProfile.nameQualifier;

  // Return the most specific identifier available
  return orgDomain || emailDomain || entityId;
}

export default {
  TenantService,
  tenantMiddleware,
  requireTenant,
  extractTenantFromSAML
}; 