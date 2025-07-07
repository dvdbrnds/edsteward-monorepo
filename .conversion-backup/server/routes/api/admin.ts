import express from "express";
import { storage } from "../../storage";
import { getTenantStorage } from "../../services/multi-tenant-database";
import { hashPassword } from "../../auth";
import { db } from "../../db";
import { systemLogs } from "@shared/schema";
import { desc, and, gte, lte, ilike, eq, count } from "drizzle-orm";
import featureManagementRoutes from "./admin-feature-management";

const router = express.Router();

// Get tenant-aware storage for user operations
function getTenantAwareStorage(req: any) {
  const tenantId = req.tenantId || req.tenant?.id;
  return tenantId ? getTenantStorage(tenantId) : storage;
}

// Middleware to check admin access
const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const user = req.user as any;
  if (user.role !== 'admin' && !user.email?.endsWith('@edsteward.ai')) {
    return res.status(403).json({ error: "Admin access required" });
  }

  next();
};

// User management endpoints - now tenant-aware
router.get('/users', requireAdmin, async (req, res) => {
  try {
    // Use tenant-aware storage to get users for this tenant only
    const tenantStorage = getTenantAwareStorage(req);
    const users = await tenantStorage.getAllUsers();
    
    // Filter out password field for security
    const safeUsers = users.map(user => {
      const { password, ...safeUser } = user;
      return {
        ...safeUser,
        tenantId: req.tenantId,
        subdomain: req.tenant?.subdomain
      };
    });
    
    return res.json(safeUsers);
  } catch (error) {
    console.error("Error fetching users:", error);
    return res.status(500).json({ 
      error: "Failed to fetch users",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

router.post('/update-user', requireAdmin, async (req, res) => {
  try {
    const { id, username, role } = req.body;

    if (!id || !username || !role) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Use tenant-aware storage to update user in this tenant only
    const tenantStorage = getTenantAwareStorage(req);
    
    // Verify user exists in this tenant
    const existingUser = await tenantStorage.getUser(id);
    if (!existingUser) {
      return res.status(404).json({ error: "User not found in this tenant" });
    }

    const updatedUser = await tenantStorage.updateUser(id, { username, role });
    
    // Remove password field for security
    const { password, ...safeUser } = updatedUser;
    
    return res.json({
      ...safeUser,
      tenantId: req.tenantId,
      subdomain: req.tenant?.subdomain
    });
  } catch (error) {
    console.error("Error updating user:", error);
    return res.status(500).json({ 
      error: "Failed to update user",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

router.post('/reset-password', requireAdmin, async (req, res) => {
  try {
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({ error: "User ID is required" });
    }

    // Use tenant-aware storage to reset password for user in this tenant only
    const tenantStorage = getTenantAwareStorage(req);
    
    // Verify user exists in this tenant
    const existingUser = await tenantStorage.getUser(id);
    if (!existingUser) {
      return res.status(404).json({ error: "User not found in this tenant" });
    }

    // Generate a temporary password
    const temporaryPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = await hashPassword(temporaryPassword);
    
    const updatedUser = await tenantStorage.updateUser(id, { password: hashedPassword });
    
    return res.json({ 
      message: "Password reset successfully",
      temporaryPassword: temporaryPassword,
      tenantId: req.tenantId,
      userId: updatedUser.id
    });
  } catch (error) {
    console.error("Error resetting password:", error);
    return res.status(500).json({ 
      error: "Failed to reset password",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Create new user endpoint - tenant-aware
router.post('/create-user', requireAdmin, async (req, res) => {
  try {
    const { username, email, role, firstName, lastName, department } = req.body;

    if (!username || !email || !role) {
      return res.status(400).json({ error: "Username, email, and role are required" });
    }

    // Use tenant-aware storage
    const tenantStorage = getTenantAwareStorage(req);
    
    // Check if user already exists in this tenant
    const existingUser = await tenantStorage.getUserByUsername(username);
    if (existingUser) {
      return res.status(400).json({ error: "Username already exists in this tenant" });
    }

    const existingEmailUser = await tenantStorage.getUserByEmail(email);
    if (existingEmailUser) {
      return res.status(400).json({ error: "Email already exists in this tenant" });
    }

    // Generate a temporary password
    const temporaryPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = await hashPassword(temporaryPassword);

    const newUser = await tenantStorage.createUser({
      username,
      email,
      password: hashedPassword,
      role: role.toLowerCase(),
      firstName: firstName || '',
      lastName: lastName || '',
      department: department || ''
    });

    // Remove password field for security
    const { password, ...safeUser } = newUser;

    return res.status(201).json({
      ...safeUser,
      temporaryPassword,
      tenantId: req.tenantId,
      subdomain: req.tenant?.subdomain,
      message: "User created successfully"
    });
  } catch (error) {
    console.error("Error creating user:", error);
    return res.status(500).json({ 
      error: "Failed to create user",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Delete user endpoint - tenant-aware
router.delete('/users/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = parseInt(id);

    if (isNaN(userId)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    // Use tenant-aware storage
    const tenantStorage = getTenantAwareStorage(req);
    
    // Verify user exists in this tenant
    const existingUser = await tenantStorage.getUser(userId);
    if (!existingUser) {
      return res.status(404).json({ error: "User not found in this tenant" });
    }

    // Prevent deleting the last admin user
    if (existingUser.role === 'admin') {
      const allUsers = await tenantStorage.getAllUsers();
      const adminUsers = allUsers.filter(u => u.role === 'admin');
      if (adminUsers.length <= 1) {
        return res.status(400).json({ error: "Cannot delete the last admin user" });
      }
    }

    await tenantStorage.deleteUser(userId);

    return res.json({ 
      message: "User deleted successfully",
      tenantId: req.tenantId,
      deletedUserId: userId
    });
  } catch (error) {
    console.error("Error deleting user:", error);
    return res.status(500).json({ 
      error: "Failed to delete user",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Configuration endpoints (placeholder - would need actual implementation)
router.get('/email-config', requireAdmin, async (req, res) => {
  try {
    // Return empty config for now - would be tenant-specific in the future
    return res.json({
      tenantId: req.tenantId,
      subdomain: req.tenant?.subdomain,
      emailConfig: {}
    });
  } catch (error) {
    console.error("Error fetching email config:", error);
    return res.status(500).json({ 
      error: "Failed to fetch email configuration",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

router.post('/email-config', requireAdmin, async (req, res) => {
  try {
    // Placeholder - would need actual email config storage per tenant
    return res.json({ 
      message: "Email configuration updated",
      tenantId: req.tenantId,
      subdomain: req.tenant?.subdomain
    });
  } catch (error) {
    console.error("Error updating email config:", error);
    return res.status(500).json({ 
      error: "Failed to update email configuration",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

router.get('/twilio-config', requireAdmin, async (req, res) => {
  try {
    // Return empty config for now
    return res.json({});
  } catch (error) {
    console.error("Error fetching Twilio config:", error);
    return res.status(500).json({ 
      error: "Failed to fetch Twilio configuration",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

router.post('/twilio-config', requireAdmin, async (req, res) => {
  try {
    // Placeholder - would need actual Twilio config storage
    return res.json({ message: "Twilio configuration updated" });
  } catch (error) {
    console.error("Error updating Twilio config:", error);
    return res.status(500).json({ 
      error: "Failed to update Twilio configuration",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Logs endpoint - read from actual systemLogs table
router.get('/logs', requireAdmin, async (req, res) => {
  try {
    const { 
      search, 
      level, 
      facility, 
      startDate, 
      endDate, 
      page = 1,
      limit = 50 
    } = req.query;
    
    const pageNumber = parseInt(page as string) || 1;
    const limitNumber = Math.min(parseInt(limit as string) || 50, 100); // Cap at 100
    const offset = (pageNumber - 1) * limitNumber;

    // Build filter conditions
    const conditions = [];
    
    if (search) {
      conditions.push(ilike(systemLogs.message, `%${search}%`));
    }
    
    if (level && level !== 'all') {
      conditions.push(eq(systemLogs.severity, parseInt(level as string)));
    }
    
    if (facility && facility !== 'all') {
      conditions.push(eq(systemLogs.facility, parseInt(facility as string)));
    }
    
    if (startDate) {
      conditions.push(gte(systemLogs.timestamp, new Date(startDate as string)));
    }
    
    if (endDate) {
      conditions.push(lte(systemLogs.timestamp, new Date(endDate as string)));
    }

    // Get total count for pagination
    const totalCountResult = await db
      .select({ count: count() })
      .from(systemLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined);
    
    const totalLogs = totalCountResult[0]?.count || 0;
    const totalPages = Math.ceil(totalLogs / limitNumber);

    // Fetch logs with filters and pagination
    const logs = await db
      .select({
        id: systemLogs.id,
        timestamp: systemLogs.timestamp,
        facility: systemLogs.facility,
        severity: systemLogs.severity,
        hostname: systemLogs.hostname,
        appName: systemLogs.appName,
        procId: systemLogs.procId,
        msgId: systemLogs.msgId,
        message: systemLogs.message,
        structuredData: systemLogs.structuredData
      })
      .from(systemLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(systemLogs.timestamp))
      .limit(limitNumber)
      .offset(offset);

    // Format logs for frontend consumption
    const formattedLogs = logs.map(log => ({
      id: log.id,
      timestamp: log.timestamp,
      level: log.severity,
      facility: log.facility,
      severity: log.severity,
      hostname: log.hostname,
      appName: log.appName,
      procId: log.procId,
      msgId: log.msgId,
      message: log.message,
      username: log.structuredData?.username || 'system',
      userId: log.structuredData?.userId || null,
      ip: log.structuredData?.ip || 'N/A',
      userAgent: log.structuredData?.userAgent || 'N/A',
      metadata: log.structuredData
    }));
    
    return res.json({
      logs: formattedLogs,
      pagination: {
        page: pageNumber,
        totalPages,
        totalLogs,
        hasMore: pageNumber < totalPages,
        limit: limitNumber
      }
    });
  } catch (error) {
    console.error("Error fetching logs:", error);
    return res.status(500).json({ 
      error: "Failed to fetch logs",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// System metrics endpoint for admin console
router.get('/metrics', requireAdmin, async (req, res) => {
  try {
    const tenantIds = ['admin', 'moravian', 'test'];
    let totalUsers = 0;
    let totalRegulations = 0;
    let totalTenants = tenantIds.length;
    let activeTenants = 0;
    const recentActivity: Array<{
      tenant: string;
      action: string;
      timestamp: string;
      user: string;
    }> = [];

    // Collect metrics from all tenants
    for (const tenantId of tenantIds) {
      try {
        const tenantStorage = getTenantStorage(tenantId);
        
        // Get user count for this tenant
        const users = await tenantStorage.getAllUsers();
        totalUsers += users.length;
        
        // Get regulation count for this tenant
        const regulations = await tenantStorage.getRegulations();
        totalRegulations += regulations.length;
        
        // Count as active if it has data
        if (users.length > 0 || regulations.length > 0) {
          activeTenants++;
        }

        // Add some mock recent activity (in production, this would come from audit logs)
        if (users.length > 0) {
          recentActivity.push({
            tenant: tenantId,
            action: 'User login',
            timestamp: new Date().toISOString(),
            user: users[0].email || users[0].username || 'Unknown'
          });
        }
      } catch (error) {
        console.warn(`Failed to get metrics for tenant ${tenantId}:`, error);
      }
    }

    // Sort recent activity by timestamp (newest first)
    recentActivity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const metrics = {
      totalTenants,
      activeTenants,
      totalUsers,
      totalRegulations,
      systemHealth: 'healthy' as const,
      recentActivity: recentActivity.slice(0, 10) // Return last 10 activities
    };

    return res.json(metrics);
  } catch (error) {
    console.error("Error fetching system metrics:", error);
    return res.status(500).json({ 
      error: "Failed to fetch system metrics",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Tenant statistics endpoint for admin console
router.get('/tenants', requireAdmin, async (req, res) => {
  try {
    const tenantIds = ['admin', 'moravian', 'test'];
    const tenantStats = [];

    for (const tenantId of tenantIds) {
      try {
        const tenantStorage = getTenantStorage(tenantId);
        
        // Get user and regulation counts
        const users = await tenantStorage.getAllUsers();
        const regulations = await tenantStorage.getRegulations();
        
        // Determine status based on data presence
        let status: 'active' | 'inactive' | 'suspended' = 'inactive';
        if (users.length > 0 && regulations.length > 0) {
          status = 'active';
        } else if (users.length > 0 || regulations.length > 0) {
          status = 'active'; // Has some data
        }

        // Get last activity (mock for now - in production would come from audit logs)
        const lastActivity = users.length > 0 ? new Date().toISOString() : 'Never';

        tenantStats.push({
          id: tenantId,
          name: getTenantDisplayName(tenantId),
          userCount: users.length,
          regulationCount: regulations.length,
          status,
          lastActivity
        });
      } catch (error) {
        console.warn(`Failed to get stats for tenant ${tenantId}:`, error);
        // Add tenant with zero stats if there's an error
        tenantStats.push({
          id: tenantId,
          name: getTenantDisplayName(tenantId),
          userCount: 0,
          regulationCount: 0,
          status: 'inactive' as const,
          lastActivity: 'Never'
        });
      }
    }

    return res.json(tenantStats);
  } catch (error) {
    console.error("Error fetching tenant statistics:", error);
    return res.status(500).json({ 
      error: "Failed to fetch tenant statistics",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Helper function to get display names for tenants
function getTenantDisplayName(tenantId: string): string {
  switch (tenantId) {
    case 'admin': return 'EdSteward Admin';
    case 'moravian': return 'Moravian University';
    case 'test': return 'Test Environment';
    default: return tenantId;
  }
}

/**
 * Institution Configuration Management
 */

// GET institution configuration for current tenant
router.get('/institution-config', async (req, res) => {
  try {
    const tenantId = req.tenantId || 'admin';
    
    // For now, return default configuration since we're focusing on the frontend
    // In a production system, this would read from the tenant settings in the database
    const institutionConfig = {
      primaryTypes: [],
      hideNonApplicable: true,
      allowUsersToToggle: true
    };

    return res.json({ 
      success: true,
      institutionConfig,
      tenantId
    });
  } catch (error) {
    console.error("Error getting institution config:", error);
    return res.status(500).json({ 
      error: "Failed to get institution configuration",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// PUT institution configuration for current tenant
router.put('/institution-config', async (req, res) => {
  try {
    const tenantId = req.tenantId || 'admin';
    const { primaryTypes, hideNonApplicable, allowUsersToToggle } = req.body;
    
    // Validate input
    if (!Array.isArray(primaryTypes)) {
      return res.status(400).json({
        error: 'Invalid data',
        message: 'primaryTypes must be an array'
      });
    }

    // For now, just return success since we're focusing on the frontend
    // In a production system, this would update the tenant settings in the database
    console.log(`Institution config update for tenant ${tenantId}:`, {
      primaryTypes,
      hideNonApplicable,
      allowUsersToToggle
    });

    return res.json({ 
      success: true,
      message: "Institution configuration updated successfully",
      institutionConfig: {
        primaryTypes,
        hideNonApplicable,
        allowUsersToToggle
      },
      tenantId
    });
  } catch (error) {
    console.error("Error updating institution config:", error);
    return res.status(500).json({ 
      error: "Failed to update institution configuration",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Mount feature management routes
router.use('/feature-management', featureManagementRoutes);

export default router; 