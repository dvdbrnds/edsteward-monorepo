import { Request, Response, NextFunction } from 'express';

// Security headers middleware
export function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction) {
  // Add X-Robots-Tag header to prevent search engine indexing
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  
  // Core security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Content Security Policy - always applied (for blob: support in development)
  res.setHeader('Content-Security-Policy', 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https: blob:; " +
    "font-src 'self' https:; " +
    "connect-src 'self' https:; " +
    (req.secure || req.headers['x-forwarded-proto'] === 'https' ? "upgrade-insecure-requests" : "")
  );

  // HTTPS enforcement headers (only for secure connections)
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    // Strict Transport Security - forces HTTPS for 1 year
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  
  next();
} 