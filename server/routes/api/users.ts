import express from 'express';
import { getDatabaseStorage } from '../../services/database';
import { syslog, LogLevel, LogFacility } from '../../services/syslog';

// Simple auth middleware
const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

const router = express.Router();

// GET /api/users/me - Get current user info for debugging
router.get("/me", requireAuth, async (req, res) => {
  try {
    res.json({
      id: req.user?.id,
      username: req.user?.username,
      email: req.user?.email,
      role: req.user?.role,
      roles: req.user?.roles,
      firstName: req.user?.firstName,
      lastName: req.user?.lastName,
      department: req.user?.department
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to get user info" });
  }
});

// GET /api/users - Get all users (admin only)
router.get("/", requireAuth, async (req, res) => {
  try {
    // Debug: Log user info
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, 
      `User attempting to access users endpoint: ${JSON.stringify({
        id: req.user?.id,
        username: req.user?.username,
        role: req.user?.role,
        roles: req.user?.roles
      })}`);

    // Check if user is admin - check multiple possible admin values
    const userRole = req.user?.role?.toLowerCase();
    const userRoles = req.user?.roles ? JSON.parse(req.user.roles || '[]') : [];
    
    const isAdmin = userRole === 'admin' || 
                   userRole === 'administrator' ||
                   userRoles.includes('admin') ||
                   userRoles.includes('administrator') ||
                   req.user?.username === 'dvdbrnds'; // Special case for dvdbrnds
    
    if (!isAdmin) {
      syslog.log(LogFacility.LOCAL0, LogLevel.WARNING, 
        `Access denied for user ${req.user?.username} - role: ${req.user?.role}, roles: ${req.user?.roles}`);
      return res.status(403).json({ 
        error: "Access denied. Admin privileges required.",
        debug: {
          userRole: req.user?.role,
          userRoles: req.user?.roles,
          isAdmin: isAdmin
        }
      });
    }

    const tenantStorage = getDatabaseStorage();
    const users = await tenantStorage.getAllUsers();
    
    // Return user data with only necessary fields for notifications
    const userList = users.map(user => ({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      department: user.department || null,
      isActive: user.isActive !== false // Default to true if not specified
    }));

    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, 
      `Admin ${req.user.email} retrieved ${userList.length} users for notifications`);
    
    res.json(userList);
  } catch (error) {
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, 
      `Failed to get users: ${error instanceof Error ? error.message : String(error)}`);
    
    res.status(500).json({ 
      error: "Failed to get users", 
      details: error instanceof Error ? error.message : String(error) 
    });
  }
});

export default router;
