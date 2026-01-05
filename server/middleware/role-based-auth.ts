/**
 * Role-Based Access Control Middleware for EdSteward
 * Provides middleware functions for protecting routes based on user roles and permissions
 */

import { Request, Response, NextFunction } from 'express';
import { hasPermission, getCombinedPermissions, type RolePermissions } from '../config/role-mapping';

// Helper function to safely parse user roles
function parseUserRoles(user: any): string[] {
  if (!user) return [];
  
  if (user.roles) {
    try {
      const roles = typeof user.roles === 'string' ? JSON.parse(user.roles) : user.roles;
      const result = Array.isArray(roles) ? roles : [user.role || 'user'];
      // Ensure we always return an array
      return Array.isArray(result) ? result : [user.role || 'user'];
    } catch {
      return [user.role || 'user'];
    }
  }
  
  return [user.role || 'user'];
}

// Extend Express Request type to include user with roles
declare global {
  namespace Express {
    interface User {
      id: number;
      username: string;
      email: string;
      role: string;
      roles?: string[];
      groups?: string[];
      department?: string;
      [key: string]: unknown;
    }
  }
}

/**
 * Middleware to ensure user is authenticated
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.isAuthenticated() || !req.user) {
    res.status(401).json({ 
      error: 'Authentication required',
      message: 'You must be logged in to access this resource'
    });
    return;
  }
  next();
}

/**
 * Middleware to require specific role(s)
 * @param requiredRoles Single role or array of roles that are allowed
 */
export function requireRole(requiredRoles: string | string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.isAuthenticated() || !req.user) {
      res.status(401).json({ 
        error: 'Authentication required',
        message: 'You must be logged in to access this resource'
      });
      return;
    }

    const user = req.user;
    const userRoles = parseUserRoles(user);
    
    const allowedRoles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];

    // Check if user has any of the required roles
    const hasRequiredRole = userRoles.some(role => allowedRoles.includes(role));

    if (!hasRequiredRole) {
      res.status(403).json({
        error: 'Insufficient permissions',
        message: `Access denied. Required role(s): ${allowedRoles.join(', ')}. Your role(s): ${userRoles.join(', ')}`,
        requiredRoles: allowedRoles,
        userRoles: userRoles
      });
      return;
    }

    next();
  };
}

/**
 * Middleware to require specific permission
 * @param permission The permission to check
 */
export function requirePermission(permission: keyof RolePermissions) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.isAuthenticated() || !req.user) {
      res.status(401).json({ 
        error: 'Authentication required',
        message: 'You must be logged in to access this resource'
      });
      return;
    }

    const user = req.user;
    const userRoles = parseUserRoles(user);

    if (!hasPermission(userRoles, permission)) {
      res.status(403).json({
        error: 'Insufficient permissions',
        message: `Access denied. Required permission: ${permission}`,
        requiredPermission: permission,
        userRoles: userRoles
      });
      return;
    }

    next();
  };
}

/**
 * Middleware to require admin role
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  return requireRole('admin')(req, res, next);
}

/**
 * Middleware to require compliance officer or admin role
 */
export function requireComplianceOfficer(req: Request, res: Response, next: NextFunction): void {
  return requireRole(['admin', 'compliance_officer'])(req, res, next);
}

/**
 * Middleware to require department head, compliance officer, or admin role
 */
export function requireDepartmentHead(req: Request, res: Response, next: NextFunction): void {
  return requireRole(['admin', 'compliance_officer', 'department_head'])(req, res, next);
}

/**
 * Middleware to check if user can access department-specific data
 * @param departmentField The field name in the request that contains the department
 */
export function requireDepartmentAccess(departmentField: string = 'department') {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.isAuthenticated() || !req.user) {
      res.status(401).json({ 
        error: 'Authentication required',
        message: 'You must be logged in to access this resource'
      });
      return;
    }

    const user = req.user;
    const userRoles = parseUserRoles(user);
    
    // Admin and compliance officers can access all departments
    if (hasPermission(userRoles, 'canViewAllReports')) {
      next();
      return;
    }

    // Department heads can only access their own department
    const requestedDepartment = req.params[departmentField] || req.body[departmentField] || req.query[departmentField];
    
    if (user.department && requestedDepartment && user.department !== requestedDepartment) {
      res.status(403).json({
        error: 'Department access denied',
        message: `You can only access data for your department: ${user.department}`,
        userDepartment: user.department,
        requestedDepartment: requestedDepartment
      });
      return;
    }

    next();
  };
}

/**
 * Middleware to attach user permissions to request object
 */
export function attachUserPermissions(req: Request, res: Response, next: NextFunction): void {
  if (req.isAuthenticated() && req.user) {
    const user = req.user;
    const userRoles = parseUserRoles(user);
    
    // Attach permissions to request for easy access in route handlers
    (req as Record<string, unknown>).userPermissions = getCombinedPermissions(userRoles);
    (req as Record<string, unknown>).userRoles = userRoles;
  }
  
  next();
}

/**
 * Helper function to check if current user has permission (for use in route handlers)
 */
export function checkUserPermission(req: Request, permission: keyof RolePermissions): boolean {
  if (!req.isAuthenticated() || !req.user) {
    return false;
  }
  
  const user = req.user;
  const userRoles = parseUserRoles(user);
  return hasPermission(userRoles, permission);
}

/**
 * Helper function to get user's combined permissions (for use in route handlers)
 */
export function getUserPermissions(req: Request): RolePermissions | null {
  if (!req.isAuthenticated() || !req.user) {
    return null;
  }
  
  const user = req.user;
  const userRoles = parseUserRoles(user);
  return getCombinedPermissions(userRoles);
}

/**
 * Middleware for role hierarchy enforcement
 * Ensures users can only perform actions on users with lower hierarchy roles
 */
export function requireRoleHierarchy(req: Request, res: Response, next: NextFunction): void {
  if (!req.isAuthenticated() || !req.user) {
    res.status(401).json({ 
      error: 'Authentication required',
      message: 'You must be logged in to access this resource'
    });
    return;
  }

  const currentUser = req.user;
  const currentUserRoles = currentUser.roles || [currentUser.role];
  
  // Get the highest hierarchy level for current user (for future use)
  // const currentUserHierarchy = Math.max(
  //   ...currentUserRoles.map(role => edStewardRoles[role]?.hierarchy || 0)
  // );

  // For user management operations, check target user's role
  const targetUserId = req.params.userId || req.body.userId;
  if (targetUserId) {
    // This would need to be implemented with a user lookup
    // For now, we'll just ensure the user has admin or compliance officer permissions
    if (!hasPermission(currentUserRoles, 'canEditUsers')) {
      res.status(403).json({
        error: 'Insufficient permissions for user management',
        message: 'You do not have permission to manage other users'
      });
      return;
    }
  }

  next();
}

/**
 * Development/Debug middleware to log user roles and permissions
 */
export function debugUserRoles(req: Request, res: Response, next: NextFunction): void {
  if (req.isAuthenticated() && req.user) {
    const user = req.user;
    const userRoles = parseUserRoles(user);
    const permissions = getCombinedPermissions(userRoles);
    // Permissions loaded for user
  }
  
  next();
}

export default {
  requireAuth,
  requireRole,
  requirePermission,
  requireAdmin,
  requireComplianceOfficer,
  requireDepartmentHead,
  requireDepartmentAccess,
  attachUserPermissions,
  checkUserPermission,
  getUserPermissions,
  requireRoleHierarchy,
  debugUserRoles
};
