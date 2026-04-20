import express from 'express';
import { hashPassword } from '../../auth';
import { getDatabaseStorage } from '../../services/database';
import { syslog, LogLevel, LogFacility } from '../../services/syslog';

// Simple auth middleware
const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

// Admin check helper
const checkIsAdmin = (req: express.Request): boolean => {
  const userRole = req.user?.role?.toLowerCase();
  const userRoles = req.user?.roles ? JSON.parse(req.user.roles || '[]') : [];
  
  return userRole === 'admin' || 
         userRole === 'administrator' ||
         userRoles.includes('admin') ||
         userRoles.includes('administrator');
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
  } catch (_error) {
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
                   userRoles.includes('administrator');
    
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

    const tenantStorage = getDatabaseStorage(req.tenantId);
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

// GET /api/users/:id - Get specific user (admin only)
router.get("/:id", requireAuth, async (req, res) => {
  try {
    if (!checkIsAdmin(req)) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const userId = parseInt(req.params.id);
    const tenantStorage = getDatabaseStorage(req.tenantId);
    const user = await tenantStorage.getUserById(userId);
    
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Don't return password hash
    const { password: _password, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (error) {
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, 
      `Failed to get user: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ error: "Failed to get user" });
  }
});

// POST /api/users - Create new user (admin only)
router.post("/", requireAuth, async (req, res) => {
  try {
    if (!checkIsAdmin(req)) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { username, email, password, firstName, lastName, role, department } = req.body;

    // Validate required fields
    if (!username || !email || !firstName || !lastName) {
      return res.status(400).json({ error: "Username, email, first name, and last name are required" });
    }

    // Validate role
    const validRoles = ['admin', 'compliance_officer', 'department_head', 'viewer', 'user'];
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
    }

    const tenantStorage = getDatabaseStorage(req.tenantId);

    // Check if username or email already exists
    const existingUser = await tenantStorage.getUserByUsername(username);
    if (existingUser) {
      return res.status(400).json({ error: "Username already exists" });
    }

    // Hash password if provided (optional for SSO users)
    const hashedPassword = password ? await hashPassword(password) : await hashPassword(Math.random().toString(36));

    // Create user
    const newUser = await tenantStorage.createUser({
      username,
      email,
      password: hashedPassword,
      firstName,
      lastName,
      role: role || 'user',
      department: department || null,
      isActive: true,
    });

    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, 
      `Admin ${req.user?.email} created new user: ${email} with role ${role || 'user'}`);

    // Don't return password
    const { password: _password, ...userWithoutPassword } = newUser;
    res.status(201).json(userWithoutPassword);
  } catch (error) {
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, 
      `Failed to create user: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ error: "Failed to create user" });
  }
});

// PATCH /api/users/:id - Update user (admin only)
router.patch("/:id", requireAuth, async (req, res) => {
  try {
    if (!checkIsAdmin(req)) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const userId = parseInt(req.params.id);
    const { firstName, lastName, email, role, department, isActive, password } = req.body;

    const tenantStorage = getDatabaseStorage(req.tenantId);
    
    // Check user exists
    const existingUser = await tenantStorage.getUserById(userId);
    if (!existingUser) {
      return res.status(404).json({ error: "User not found" });
    }

    // Validate role if provided
    const validRoles = ['admin', 'compliance_officer', 'department_head', 'viewer', 'user'];
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
    }

    // Build update object
    const updates: Record<string, any> = {};
    if (firstName !== undefined) updates.firstName = firstName;
    if (lastName !== undefined) updates.lastName = lastName;
    if (email !== undefined) updates.email = email;
    if (role !== undefined) updates.role = role;
    if (department !== undefined) updates.department = department;
    if (isActive !== undefined) updates.isActive = isActive;
    if (password) updates.password = await hashPassword(password);

    const updatedUser = await tenantStorage.updateUser(userId, updates);

    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, 
      `Admin ${req.user?.email} updated user ${userId}: ${JSON.stringify(Object.keys(updates))}`);

    // Don't return password
    const { password: _password, ...userWithoutPassword } = updatedUser;
    res.json(userWithoutPassword);
  } catch (error) {
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, 
      `Failed to update user: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ error: "Failed to update user" });
  }
});

// DELETE /api/users/:id - Deactivate user (admin only)
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    if (!checkIsAdmin(req)) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const userId = parseInt(req.params.id);
    
    // Don't allow deleting yourself
    if (userId === req.user?.id) {
      return res.status(400).json({ error: "Cannot delete your own account" });
    }

    const tenantStorage = getDatabaseStorage(req.tenantId);
    
    // Soft delete - just deactivate
    await tenantStorage.updateUser(userId, { isActive: false });

    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, 
      `Admin ${req.user?.email} deactivated user ${userId}`);

    res.json({ success: true, message: "User deactivated" });
  } catch (error) {
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, 
      `Failed to delete user: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

export default router;
