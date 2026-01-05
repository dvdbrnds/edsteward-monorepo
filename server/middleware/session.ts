import { Request, Response, NextFunction } from 'express';

// Type declaration for passport session
declare module 'express-session' {
  interface SessionData {
    passport?: {
      user?: number;
    };
  }
}

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

// Add comprehensive session debugging middleware
export const sessionDebugMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const originalSend = res.send;
  const originalJson = res.json;
  
  // Log session state before request
    sessionId: req.sessionID,
    hasSession: !!req.session,
    sessionKeys: req.session ? Object.keys(req.session) : [],
    userId: (req.session as any)?.userId,
    passport: req.session?.passport,
    cookieHeader: req.headers.cookie,
    userAgent: req.headers['user-agent']?.substring(0, 50)
  });

  // Intercept response to log Set-Cookie headers
  res.send = function(body) {
      statusCode: res.statusCode,
      setCookieHeaders: res.getHeaders()['set-cookie'],
      sessionAfterResponse: req.session ? {
        id: req.sessionID,
        userId: (req.session as any).userId,
        keys: Object.keys(req.session)
      } : null
    });
    return originalSend.call(this, body);
  };

  res.json = function(body) {
      statusCode: res.statusCode,
      setCookieHeaders: res.getHeaders()['set-cookie'],
      sessionAfterResponse: req.session ? {
        id: req.sessionID,
        userId: (req.session as any).userId,
        keys: Object.keys(req.session)
      } : null
    });
    return originalJson.call(this, body);
  };

  next();
}; 