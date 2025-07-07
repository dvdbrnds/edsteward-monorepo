// Single-tenant compatibility stub - replaces tenant middleware
import { Request, Response, NextFunction } from 'express';

// Single-tenant middleware - set up request for single-tenant mode
export function tenantMiddleware(req: Request, res: Response, next: NextFunction) {
  // In single-tenant mode, ensure the request has the expected properties
  const tenantReq = req as any;
  tenantReq.tenantId = null; // Force null to use default storage
  tenantReq.tenant = null;
  next();
}

// Single-tenant finder - no tenant detection needed
export class TenantFinder {
  static extractTenantFromRequest(req: Request) {
    return {
      subdomain: null,
      domain: req.get('host'),
      method: 'single-tenant'
    };
  }
}

// Single-tenant auth requirement stub
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

// Additional compatibility exports
export function requireTenant(req: Request, res: Response, next: NextFunction) {
  // In single-tenant mode, just pass through
  next();
}

export class TenantManager {
  static async getAllTenants() {
    return [];
  }
}

export interface ConsolidatedTenantRequest extends Request {
  tenantId?: string;
}

export interface Tenant {
  id: string;
  name: string;
  subdomain: string;
}

export interface LegacyTenantConfig {
  subdomain: string;
  name: string;
}

export function tenantToLegacyConfig(tenant: Tenant): LegacyTenantConfig {
  return {
    subdomain: tenant.subdomain,
    name: tenant.name
  };
}

export default {
  tenantMiddleware,
  TenantFinder,
  requireAuth,
  requireTenant,
  TenantManager
}; 