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
export function sessionCleanupMiddleware(req: Request, res: Response, next: NextFunction) {
  if (req.session && req.session.passport && req.session.passport.user) {
    // Check for invalid user ID (not a number or NaN)
    if (typeof req.session.passport.user !== 'number' || isNaN(req.session.passport.user)) {
      console.log(`Invalid user ID in session, destroying session`);
      return req.session.destroy(err => {
        if (err) console.error('Session destruction error:', err);
        // Redirect to home page or login after destroying session
        return res.redirect('/');
      });
    }
  }
  next();
} 