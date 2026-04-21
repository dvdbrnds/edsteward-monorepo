/**
 * Tenant-Aware Logging Middleware
 * 
 * Adds tenant context to all log messages for:
 * - Debugging multi-tenant issues
 * - Per-tenant usage analytics
 * - Audit trails
 * - Performance monitoring per tenant
 */

import { Request, Response, NextFunction } from 'express';

// =============================================================================
// TENANT METRICS TRACKING
// =============================================================================

interface TenantMetrics {
  requests: number;
  errors: number;
  totalResponseTime: number;
  lastRequest: Date;
  endpoints: Map<string, number>;
}

// In-memory metrics (reset on server restart)
// For production, you'd want to persist these to a time-series DB
const tenantMetrics = new Map<string, TenantMetrics>();

function getOrCreateMetrics(tenantId: string): TenantMetrics {
  if (!tenantMetrics.has(tenantId)) {
    tenantMetrics.set(tenantId, {
      requests: 0,
      errors: 0,
      totalResponseTime: 0,
      lastRequest: new Date(),
      endpoints: new Map(),
    });
  }
  return tenantMetrics.get(tenantId)!;
}

// =============================================================================
// STRUCTURED LOGGER
// =============================================================================

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  tenant: string;
  message: string;
  data?: Record<string, any>;
  request?: {
    method: string;
    path: string;
    ip: string;
    userAgent?: string;
    userId?: number;
  };
  response?: {
    statusCode: number;
    duration: number;
  };
}

function formatLog(entry: LogEntry): string {
  const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}] [tenant:${entry.tenant}]`;
  
  if (entry.request) {
    return `${prefix} ${entry.request.method} ${entry.request.path} - ${entry.message}`;
  }
  
  return `${prefix} ${entry.message}`;
}

function log(level: LogLevel, tenant: string, message: string, data?: Record<string, any>) {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    tenant,
    message,
    data,
  };

  const formatted = formatLog(entry);
  
  switch (level) {
    case 'error':
      console.error(formatted, data || '');
      break;
    case 'warn':
      console.warn(formatted, data || '');
      break;
    case 'debug':
      if (process.env.NODE_ENV === 'development') {
        console.log(formatted, data || '');
      }
      break;
    default:
      console.log(formatted, data || '');
  }
}

// =============================================================================
// TENANT LOGGER UTILITY
// =============================================================================

/**
 * Create a logger bound to a specific tenant
 * Usage: const logger = createTenantLogger(req.tenantId);
 */
export function createTenantLogger(tenantId: string | undefined) {
  const tenant = tenantId || 'global';
  
  return {
    debug: (message: string, data?: Record<string, any>) => log('debug', tenant, message, data),
    info: (message: string, data?: Record<string, any>) => log('info', tenant, message, data),
    warn: (message: string, data?: Record<string, any>) => log('warn', tenant, message, data),
    error: (message: string, data?: Record<string, any>) => log('error', tenant, message, data),
  };
}

// =============================================================================
// REQUEST LOGGING MIDDLEWARE
// =============================================================================

/**
 * Middleware that logs all requests with tenant context
 */
export function tenantRequestLogger(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  const tenantId = req.tenantId || 'global';
  const metrics = getOrCreateMetrics(tenantId);
  
  // Track request
  metrics.requests++;
  metrics.lastRequest = new Date();
  
  // Track endpoint usage
  const endpoint = `${req.method} ${req.path}`;
  metrics.endpoints.set(endpoint, (metrics.endpoints.get(endpoint) || 0) + 1);

  // Log request start (debug level)
  if (process.env.NODE_ENV === 'development') {
    log('debug', tenantId, `→ ${req.method} ${req.path}`, {
      ip: req.ip,
      userAgent: req.get('user-agent'),
      userId: (req as any).user?.id,
    });
  }

  // Capture response
  const originalSend = res.send;
  res.send = function(body) {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;
    
    // Update metrics
    metrics.totalResponseTime += duration;
    if (statusCode >= 400) {
      metrics.errors++;
    }

    // Log based on status code
    if (statusCode >= 500) {
      log('error', tenantId, `← ${statusCode} ${req.method} ${req.path} (${duration}ms)`, {
        error: typeof body === 'string' ? body.substring(0, 200) : undefined,
      });
    } else if (statusCode >= 400) {
      log('warn', tenantId, `← ${statusCode} ${req.method} ${req.path} (${duration}ms)`);
    } else if (duration > 1000) {
      // Log slow requests
      log('warn', tenantId, `← ${statusCode} ${req.method} ${req.path} (${duration}ms) SLOW`);
    } else if (process.env.NODE_ENV === 'development') {
      log('debug', tenantId, `← ${statusCode} ${req.method} ${req.path} (${duration}ms)`);
    }

    return originalSend.call(this, body);
  };

  next();
}

// =============================================================================
// METRICS API
// =============================================================================

/**
 * Get metrics for a specific tenant
 */
export function getTenantMetrics(tenantId: string): TenantMetrics | null {
  return tenantMetrics.get(tenantId) || null;
}

/**
 * Get metrics for all tenants
 */
export function getAllTenantMetrics(): Record<string, TenantMetrics & { avgResponseTime: number }> {
  const result: Record<string, TenantMetrics & { avgResponseTime: number }> = {};
  
  for (const [tenantId, metrics] of Array.from(tenantMetrics.entries())) {
    result[tenantId] = {
      ...metrics,
      avgResponseTime: metrics.requests > 0 
        ? Math.round(metrics.totalResponseTime / metrics.requests) 
        : 0,
      endpoints: metrics.endpoints, // Keep the Map
    };
  }
  
  return result;
}

/**
 * Get top endpoints for a tenant
 */
export function getTopEndpoints(tenantId: string, limit = 10): Array<{ endpoint: string; count: number }> {
  const metrics = tenantMetrics.get(tenantId);
  if (!metrics) return [];
  
  return Array.from(metrics.endpoints.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([endpoint, count]) => ({ endpoint, count }));
}

/**
 * Reset metrics (for testing)
 */
export function resetMetrics(tenantId?: string): void {
  if (tenantId) {
    tenantMetrics.delete(tenantId);
  } else {
    tenantMetrics.clear();
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  tenantRequestLogger,
  createTenantLogger,
  getTenantMetrics,
  getAllTenantMetrics,
  getTopEndpoints,
  resetMetrics,
};
