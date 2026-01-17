import { Request, Response, NextFunction } from 'express';

// Type declaration for passport session - updated for multi-tenant support
declare module 'express-session' {
  interface SessionData {
    passport?: {
      user?: number | { userId: number; tenantId: string };
    };
    tenantId?: string;
  }
}

/**
 * CRITICAL SECURITY MIDDLEWARE: Verifies session tenant matches request tenant
 * Prevents cross-tenant session hijacking when cookies are shared across subdomains
 */
export const tenantSessionVerificationMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Only check if user is authenticated and we're in multi-tenant mode
  if (!req.isAuthenticated?.() || process.env.MULTI_TENANT !== 'true') {
    return next();
  }

  const requestTenantId = (req as any).tenantId;
  const sessionUser = req.user as any;
  const sessionTenantId = sessionUser?._sessionTenantId;

  // If session has tenant info and it doesn't match request tenant, invalidate session
  if (sessionTenantId && requestTenantId && sessionTenantId !== requestTenantId) {
    console.warn(`[SECURITY] Session tenant mismatch! Session: ${sessionTenantId}, Request: ${requestTenantId}. Logging out user.`);
    
    req.logout((err) => {
      if (err) {
        console.error('[SECURITY] Error logging out mismatched tenant session:', err);
      }
      req.session?.destroy((destroyErr) => {
        if (destroyErr) {
          console.error('[SECURITY] Error destroying mismatched tenant session:', destroyErr);
        }
        // Clear user from request
        (req as any).user = null;
        next();
      });
    });
    return;
  }

  next();
};

// Session cleanup middleware - clears invalid sessions
export const sessionCleanupMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Clean up any empty or invalid session data
  if (req.session && Object.keys(req.session).length === 1 && req.session.cookie) {
    // Session only has cookie, consider it empty
    req.session.regenerate((err) => {
      if (err) {
        console.error('Failed to regenerate empty session:', err);
      }
      next();
    });
  } else {
    next();
  }
};

// Session debugging middleware - minimal logging to avoid performance issues
export const sessionDebugMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Only log session debug info for API auth endpoints and only in development
  if (process.env.NODE_ENV === 'development' && req.path.includes('/auth')) {
    console.log('[SESSION DEBUG]', {
      path: req.path,
      sessionId: req.sessionID?.substring(0, 8),
      hasUser: !!req.user,
      tenantId: (req as any).tenantId,
    });
  }
  next();
}; 