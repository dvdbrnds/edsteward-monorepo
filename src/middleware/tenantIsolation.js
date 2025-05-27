/**
 * Tenant Isolation Middleware
 * 
 * Sets PostgreSQL session variables for Row-Level Security (RLS)
 * and provides tenant context throughout the application.
 */
import { pool } from '../database/connection.js';
import { setupLogger } from '../utils/logger.js';

// Initialize logger
const logger = setupLogger('tenant-isolation');

/**
 * Validate tenant ID format
 * @param {string} tenantId Tenant ID to validate
 * @returns {boolean} Whether the tenant ID is valid
 */
function isValidTenantId(tenantId) {
  // Tenant ID should be alphanumeric with dashes and underscores
  // and between 3-50 characters
  if (!tenantId || typeof tenantId !== 'string') {
    return false;
  }
  
  const regex = /^[a-z0-9_-]{3,50}$/i;
  return regex.test(tenantId);
}

/**
 * Extract tenant ID from various sources in the request
 * @param {Object} req Express request object
 * @returns {string|null} Extracted tenant ID or null if not found/valid
 */
function extractTenantId(req) {
  let tenantId = null;
  
  // Try to extract from JWT token if available
  if (req.user && req.user.tenantId) {
    tenantId = req.user.tenantId;
  } 
  // Extract from header
  else if (req.headers['x-tenant-id']) {
    tenantId = req.headers['x-tenant-id'];
  } 
  // Extract from query parameter
  else if (req.query.tenant_id) {
    tenantId = req.query.tenant_id;
  } 
  // Extract from path parameter
  else if (req.params.tenantId) {
    tenantId = req.params.tenantId;
  }
  // Extract from body
  else if (req.body && req.body.tenant_id) {
    tenantId = req.body.tenant_id;
  }
  
  // Validate tenant ID
  if (tenantId && isValidTenantId(tenantId)) {
    return tenantId;
  }
  
  return null;
}

/**
 * Middleware to extract tenant ID and make it available in request
 * @param {Object} options Middleware options
 * @param {boolean} options.required Whether tenant ID is required
 * @param {string} options.defaultTenantId Default tenant ID to use if not found
 * @returns {Function} Express middleware function
 */
export function tenantMiddleware(options = {}) {
  const { required = true, defaultTenantId = null } = options;
  
  return (req, res, next) => {
    const tenantId = extractTenantId(req) || defaultTenantId;
    
    if (!tenantId && required) {
      logger.warn('Tenant ID required but not found in request', {
        path: req.path,
        method: req.method,
        ip: req.ip
      });
      
      return res.status(400).json({
        error: 'Tenant ID is required',
        message: 'Please provide a valid tenant ID'
      });
    }
    
    // Set tenant ID in request object for use in route handlers
    req.tenantId = tenantId;
    
    // Log tenant context for debugging
    logger.debug('Tenant context set', {
      tenantId,
      path: req.path,
      method: req.method
    });
    
    next();
  };
}

/**
 * Express middleware to enforce tenant isolation
 * - Requires tenant ID
 * - Rejects invalid tenant IDs
 */
export const requireTenant = tenantMiddleware({ required: true });

/**
 * Express middleware for optional tenant context
 * - Does not require tenant ID
 * - Continues without tenant context if not provided
 */
export const optionalTenant = tenantMiddleware({ required: false });

/**
 * Express middleware for system-level operations
 * - Uses system tenant ID
 * - Used for admin operations that need to bypass tenant isolation
 */
export const systemTenant = tenantMiddleware({
  required: false,
  defaultTenantId: 'system'
});

/**
 * Database query wrapper that applies tenant context
 * Use this for all DB queries to ensure tenant isolation
 */
export const withTenant = async (client, query, params = [], tenantId) => {
  // Begin transaction
  await client.query('BEGIN');
  
  // Set tenant context
  await client.query(`SET app.tenant_id = '${tenantId}'`);
  
  try {
    // Execute the actual query
    const result = await client.query(query, params);
    
    // Commit transaction
    await client.query('COMMIT');
    
    return result;
  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');
    throw error;
  }
}; 