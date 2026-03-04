/**
 * Authentication middleware
 * Handles JWT verification and role-based access control
 */
import jwt from 'jsonwebtoken';
import { setupLogger } from '../utils/logger.js';

// Initialize logger
const logger = setupLogger('authentication');

/**
 * JWT verification middleware
 * Verifies JWT token in Authorization header
 * @param {Object} req Express request
 * @param {Object} res Express response
 * @param {Function} next Express next function
 */
export function verifyToken(req, res, next) {
  // Get auth header
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'No authorization token provided'
    });
  }
  
  // Extract token (Bearer format)
  const tokenParts = authHeader.split(' ');
  if (tokenParts.length !== 2 || tokenParts[0] !== 'Bearer') {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid token format'
    });
  }
  
  const token = tokenParts[1];
  
  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret-key');
    
    // Set user data in request
    req.user = decoded;
    
    // Log authentication
    logger.debug('User authenticated', {
      userId: decoded.sub,
      tenantId: decoded.tenantId
    });
    
    next();
  } catch (error) {
    logger.warn('JWT verification failed', {
      error: error.message
    });
    
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired token'
    });
  }
}

/**
 * Check if user has admin role
 * @param {Object} req Express request
 * @param {Object} res Express response
 * @param {Function} next Express next function
 */
export function verifyAdmin(req, res, next) {
  // Development bypass for local testing
  if (process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === 'true') {
    logger.warn('Auth bypassed in development mode');
    
    // Set a default admin user
    req.user = {
      sub: 'dev-admin',
      tenantId: 'system',
      roles: ['admin']
    };
    
    return next();
  }
  
  // Verify token first
  verifyToken(req, res, (err) => {
    if (err) return next(err);
    
    // Check if user has admin role
    if (!req.user.roles || !req.user.roles.includes('admin')) {
      logger.warn('Admin access denied', {
        userId: req.user.sub,
        roles: req.user.roles
      });
      
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Admin role required'
      });
    }
    
    logger.info('Admin access granted', {
      userId: req.user.sub
    });
    
    next();
  });
}

/**
 * Check if user has a specific role
 * @param {string} role The role to check
 * @returns {Function} Express middleware function
 */
export function hasRole(role) {
  return (req, res, next) => {
    // Verify token first
    verifyToken(req, res, (err) => {
      if (err) return next(err);
      
      // Check if user has the required role
      if (!req.user.roles || !req.user.roles.includes(role)) {
        logger.warn(`${role} role access denied`, {
          userId: req.user.sub,
          roles: req.user.roles
        });
        
        return res.status(403).json({
          error: 'Forbidden',
          message: `${role} role required`
        });
      }
      
      next();
    });
  };
} 