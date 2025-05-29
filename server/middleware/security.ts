import { Request, Response, NextFunction } from 'express';

// Security headers middleware
export function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction) {
  // Add X-Robots-Tag header to prevent search engine indexing
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  
  // Add other security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  next();
} 