/**
 * Authentication middleware for role-based access control
 */

/**
 * Middleware to check if user has admin role
 * Expects req.user.roles from JWT authentication
 */
export const requireAdmin = (req, res, next) => {
  // Check if user object exists
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Authentication required' 
    });
  }
  
  // Check if user has admin role
  if (!req.user.roles || !req.user.roles.includes('admin')) {
    return res.status(403).json({ 
      error: 'Admin access required' 
    });
  }
  
  next();
};

/**
 * Middleware to check if NODE_ENV is not production, or debug bypass header is present
 */
export const allowDevOrDebugOnly = (req, res, next) => {
  const isProd = process.env.NODE_ENV === 'production';
  const hasDebugBypass = req.headers['x-debug-bypass'] === 'true';
  
  // Allow if not production or debug bypass header is present
  if (!isProd || hasDebugBypass) {
    return next();
  }
  
  return res.status(403).json({
    error: 'This endpoint is disabled in production'
  });
}; 