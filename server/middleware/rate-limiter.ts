/**
 * Rate Limiting Middleware
 * Protects API endpoints from abuse and DDoS attacks
 * 
 * TENANT-AWARE: Rate limits are per-tenant + IP combination
 * This prevents one tenant's traffic from affecting others
 */

import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

// =============================================================================
// TENANT-AWARE KEY GENERATOR
// =============================================================================

/**
 * Generate a rate limit key that includes tenant context
 * Format: "tenantId:ip" or "global:ip" if no tenant
 * 
 * This ensures:
 * - Each tenant has separate rate limit buckets
 * - One tenant can't exhaust another tenant's limits
 * - IP-based limiting still works within each tenant
 */
function getTenantAwareKey(req: Request): string {
  const tenantId = req.tenantId || 'global';
  // Use the default IP from express-rate-limit (handles IPv6 properly)
  const ip = req.ip || 'unknown';
  return `${tenantId}:${ip}`;
}

/**
 * Generate key for tenant-wide limits (shared across all IPs in a tenant)
 * Used for tenant-level quotas
 */
function getTenantOnlyKey(req: Request): string {
  return req.tenantId || 'global';
}

// =============================================================================
// RATE LIMITER FACTORY
// =============================================================================

interface TenantRateLimitOptions {
  windowMs: number;
  max: number;
  message: string;
  skipSuccessfulRequests?: boolean;
  tenantWide?: boolean; // If true, limit applies to entire tenant, not per-IP
}

// Check if we're in development mode
const isDevelopment = process.env.NODE_ENV !== 'production';

function createTenantAwareLimiter(options: TenantRateLimitOptions) {
  const { windowMs, max, message, skipSuccessfulRequests = false, tenantWide = false } = options;
  
  return rateLimit({
    windowMs,
    // In development, use 10x the limit
    max: isDevelopment ? max * 10 : max,
    keyGenerator: tenantWide ? getTenantOnlyKey : getTenantAwareKey,
    skipSuccessfulRequests,
    standardHeaders: true,
    legacyHeaders: false,
    // Disable the keyGenerator IPv6 validation - we're combining tenant+IP which is intentional
    validate: { keyGenerator: false },
    // Skip rate limiting entirely for localhost in development
    skip: (req: Request) => {
      // Always skip in development for localhost
      if (isDevelopment) {
        const host = req.get('host') || '';
        const ip = req.ip || '';
        if (host.includes('localhost') || host.includes('127.0.0.1') || 
            ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') {
          return true;
        }
      }
      return false;
    },
    handler: (req: Request, res: Response) => {
      const tenantId = req.tenantId || 'unknown';
      const resetTime = req.rateLimit?.resetTime?.getTime() || Date.now() + windowMs;
      const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);
      
      // Log rate limit hit for monitoring
      console.warn(`[RATE-LIMIT] Tenant: ${tenantId}, IP: ${req.ip}, Endpoint: ${req.path}`);
      
      res.status(429).json({
        error: 'Too many requests',
        message,
        tenant: tenantId,
        retryAfter,
      });
    },
  });
}

// =============================================================================
// PER-TENANT RATE LIMITERS
// =============================================================================

/**
 * Standard API rate limiter - 200 requests per 15 minutes per tenant+IP
 * Higher than before since it's now per-tenant isolated
 */
export const apiLimiter = createTenantAwareLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: 'API rate limit exceeded. Please try again later.',
});

/**
 * Authentication rate limiter - 50 attempts per 15 minutes per tenant+IP
 * (increased from 10 for development flexibility)
 */
export const authLimiter = createTenantAwareLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50,
  message: 'Too many login attempts. Please try again in 15 minutes.',
  skipSuccessfulRequests: true,
});

/**
 * Password reset rate limiter - 3 requests per hour per tenant+IP
 */
export const passwordResetLimiter = createTenantAwareLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: 'Too many password reset requests. Please try again in an hour.',
});

/**
 * File upload rate limiter - 30 uploads per hour per tenant+IP
 */
export const uploadLimiter = createTenantAwareLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30,
  message: 'Upload limit exceeded. Please try again later.',
});

/**
 * Admin operations rate limiter - 100 requests per 15 minutes per tenant+IP
 */
export const adminLimiter = createTenantAwareLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Admin rate limit exceeded. Please slow down.',
});

/**
 * Burst limiter for expensive operations - 20 requests per minute per tenant+IP
 */
export const burstLimiter = createTenantAwareLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  message: 'Please slow down and try again in a minute.',
});

// =============================================================================
// TENANT-WIDE QUOTAS (shared across all users in a tenant)
// =============================================================================

/**
 * Tenant-wide API quota - 10,000 requests per hour for entire tenant
 * Prevents a single tenant from overwhelming the system
 */
export const tenantQuotaLimiter = createTenantAwareLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10000,
  message: 'Tenant API quota exceeded. Contact support if you need higher limits.',
  tenantWide: true,
});

/**
 * Tenant-wide expensive operations quota - 500 per hour
 * For things like PDF generation, exports, bulk operations
 */
export const tenantExpensiveQuotaLimiter = createTenantAwareLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 500,
  message: 'Tenant quota for this operation exceeded. Please try again later.',
  tenantWide: true,
});

// =============================================================================
// LEGACY EXPORTS (for backwards compatibility)
// =============================================================================

// These are the same as the tenant-aware versions now
export { apiLimiter as standardLimiter };
