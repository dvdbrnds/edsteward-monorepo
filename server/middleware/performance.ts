import { Request, Response, NextFunction } from 'express';
import compression from 'compression';
import { createHash } from 'crypto';

/**
 * Compression middleware with intelligent configuration
 * Compresses responses based on content type and size
 */
export function compressionMiddleware() {
  return compression({
    // Only compress responses larger than 1KB
    threshold: 1024,
    
    // Compression level (1-9, higher = better compression but slower)
    level: 6,
    
    // Memory level (1-9, higher = more memory but faster)
    memLevel: 8,
    
    // Filter function to determine what to compress
    filter: (req: Request, res: Response) => {
      // Don't compress if client doesn't support it
      if (req.headers['x-no-compression']) {
        return false;
      }
      
      // Only compress specific content types
      const contentType = res.getHeader('Content-Type') as string;
      if (contentType) {
        return /json|text|javascript|css|xml|svg/.test(contentType);
      }
      
      // Use compression's default filter
      return compression.filter(req, res);
    }
  });
}

/**
 * Response caching middleware with intelligent cache headers
 */
export function cacheMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const originalSend = res.send;
    const originalJson = res.json;
    
    // Override res.send to add cache headers
    res.send = function(body: any) {
      setCacheHeaders(this, req.path, body);
      return originalSend.call(this, body);
    };
    
    // Override res.json to add cache headers
    res.json = function(body: any) {
      setCacheHeaders(this, req.path, body);
      return originalJson.call(this, body);
    };
    
    next();
  };
}

/**
 * Set appropriate cache headers based on route and content
 */
function setCacheHeaders(res: Response, path: string, body: any) {
  // Static assets - long cache
  if (/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/.test(path)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); // 1 year
    return;
  }
  
  // API routes with different caching strategies
  if (path.startsWith('/api/')) {
    // Health checks - short cache
    if (path.includes('/health')) {
      res.setHeader('Cache-Control', 'public, max-age=30'); // 30 seconds
      return;
    }
    
    // Regulations data - medium cache with revalidation
    if (path.includes('/regulations') && !path.includes('notes')) {
      res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate'); // 5 minutes
      res.setHeader('Vary', 'Accept-Encoding, X-Tenant-ID');
      
      // Add ETag for better caching
      const etag = generateETag(body);
      res.setHeader('ETag', etag);
      return;
    }
    
    // User-specific data - no cache
    if (path.includes('/user') || path.includes('/auth')) {
      res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      return;
    }
    
    // Default API cache - short cache with revalidation
    res.setHeader('Cache-Control', 'public, max-age=60, must-revalidate'); // 1 minute
    res.setHeader('Vary', 'Accept-Encoding, X-Tenant-ID');
  } else {
    // HTML pages - no cache to ensure tenant detection works
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
}

/**
 * Generate ETag for response body
 */
function generateETag(body: any): string {
  const content = typeof body === 'string' ? body : JSON.stringify(body);
  return `"${createHash('md5').update(content).digest('hex')}"`;
}

/**
 * Response timing middleware for performance monitoring
 */
export function responseTimeMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    
    // Add response time header when response finishes
    res.on('finish', () => {
      const responseTime = Date.now() - startTime;
      res.setHeader('X-Response-Time', `${responseTime}ms`);
      
      // Log slow requests
      if (responseTime > 1000) {
        console.warn(`[PERFORMANCE] Slow request: ${req.method} ${req.path} - ${responseTime}ms`);
      }
    });
    
    next();
  };
}

/**
 * Request size limiting middleware
 */
export function requestSizeLimitMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Set size limits based on route
    if (req.path.includes('/upload')) {
      // File uploads - larger limit
      req.headers['content-length-limit'] = '50mb';
    } else if (req.path.startsWith('/api/')) {
      // API requests - standard limit
      req.headers['content-length-limit'] = '1mb';
    }
    
    next();
  };
}

/**
 * Database query optimization middleware
 * Adds query hints and monitoring to requests
 */
export function queryOptimizationMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Add query optimization context to request
    (req as any).queryContext = {
      startTime: Date.now(),
      path: req.path,
      method: req.method,
      tenantId: (req as any).tenantId,
      // Add query optimization hints
      hints: {
        useIndex: req.path.includes('/regulations'),
        enablePagination: req.query.page !== undefined,
        enableFiltering: Object.keys(req.query).length > 0
      }
    };
    
    next();
  };
}

/**
 * Memory usage monitoring middleware
 */
export function memoryMonitoringMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const memoryBefore = process.memoryUsage();
    
    res.on('finish', () => {
      const memoryAfter = process.memoryUsage();
      const memoryDiff = {
        heapUsed: memoryAfter.heapUsed - memoryBefore.heapUsed,
        heapTotal: memoryAfter.heapTotal - memoryBefore.heapTotal,
        rss: memoryAfter.rss - memoryBefore.rss
      };
      
      // Log memory-intensive requests
      if (memoryDiff.heapUsed > 10 * 1024 * 1024) { // 10MB
        console.warn(`[MEMORY] High memory usage: ${req.method} ${req.path} - ${Math.round(memoryDiff.heapUsed / 1024 / 1024)}MB`);
      }
    });
    
    next();
  };
}

/**
 * Performance metrics collection middleware
 */
export function performanceMetricsMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const memoryStart = process.memoryUsage();
    
    res.on('finish', () => {
      const endTime = Date.now();
      const memoryEnd = process.memoryUsage();
      
      const metrics = {
        path: req.path,
        method: req.method,
        statusCode: res.statusCode,
        responseTime: endTime - startTime,
        memoryUsage: memoryEnd.heapUsed - memoryStart.heapUsed,
        timestamp: new Date().toISOString(),
        tenantId: (req as any).tenantId,
        userAgent: req.headers['user-agent'],
        contentLength: res.getHeader('content-length')
      };
      
      // Store metrics (in production, send to monitoring service)
      if (process.env.NODE_ENV === 'development') {
      }
      
      // Add performance headers
      res.setHeader('X-Response-Time', `${metrics.responseTime}ms`);
      res.setHeader('X-Memory-Usage', `${Math.round(metrics.memoryUsage / 1024)}KB`);
    });
    
    next();
  };
} 