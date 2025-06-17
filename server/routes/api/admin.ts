import express from "express";
import { storage } from "../../storage";
import { hashPassword } from "../../auth";
import { db } from "../../db";
import { systemLogs } from "@shared/schema";
import { desc, and, gte, lte, ilike, eq, count } from "drizzle-orm";

const router = express.Router();

// Middleware to check admin access
const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  if (req.user.role?.toLowerCase() !== 'admin') {
    return res.status(403).json({ error: "Admin access required" });
  }

  next();
};

// User management endpoints
router.get('/users', requireAdmin, async (req, res) => {
  try {
    const users = await storage.getAllUsers();
    return res.json(users);
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

    const updatedUser = await storage.updateUser(id, { username, role });
    return res.json(updatedUser);
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

    // Generate a temporary password
    const temporaryPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = await hashPassword(temporaryPassword);
    
    const updatedUser = await storage.updateUser(id, { password: hashedPassword });
    return res.json({ 
      message: "Password reset successfully",
      temporaryPassword: temporaryPassword
    });
  } catch (error) {
    console.error("Error resetting password:", error);
    return res.status(500).json({ 
      error: "Failed to reset password",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Configuration endpoints (placeholder - would need actual implementation)
router.get('/email-config', requireAdmin, async (req, res) => {
  try {
    // Return empty config for now
    return res.json({});
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
    // Placeholder - would need actual email config storage
    return res.json({ message: "Email configuration updated" });
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

export default router; 