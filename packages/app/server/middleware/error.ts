import { Request, Response, NextFunction } from 'express';

// Error handler specifically for JSON parsing errors
export function jsonErrorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON' });
  }
  next(err);
}

// API error handler - ensure JSON responses for API routes
export function apiErrorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  if (req.path.startsWith('/api/')) {
    console.error('API error:', err);
    return res.status(500).json({ 
      error: "Server error", 
      message: err.message || "Unknown error",
      path: req.path
    });
  }
  next(err);
}

// Handle deserialization errors
export function deserializationErrorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  if (err && typeof err === 'object' && err !== null && 'message' in err && (err as any).message === 'Failed to deserialize user out of session') {
    // Check if the request expects JSON
    if (req.xhr || req.path.startsWith('/api/')) {
      return req.session.destroy(() => {
        return res.status(401).json({ error: "Session expired, please log in again" });
      });
    } else {
      return req.session.destroy(() => {
        return res.redirect('/');
      });
    }
  }
  next(err);
} 