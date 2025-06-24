import express from "express";
import { storage } from "../../storage";
import type { InsertNotification } from "@shared/schema";

const router = express.Router();

// Helper function to get tenant-aware storage
async function getTenantStorage(tenantId: string) {
  const { TenantStorage } = await import('../../services/tenantStorage');
  const tenantConfig = { 
    id: tenantId, 
    name: tenantId, 
    domain: `${tenantId}.edsteward.local`,
    database: tenantId 
  };
  return new TenantStorage(tenantConfig);
}

// GET /api/notifications - Get notifications for the current user ONLY (for dashboard)
router.get("/", async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Get tenant-aware storage for data isolation
    const tenantReq = req as any;
    const tenantStorage = tenantReq.tenantId ? await getTenantStorage(tenantReq.tenantId) : storage;
    
    console.log(`[NOTIFICATIONS] Using tenant: ${tenantReq.tenantId || 'default'} with isolation: ${!!tenantReq.tenantId}`);

    // Debug logging
    console.log("🔍 Notifications API Debug:", {
      userId: req.user.id,
      username: req.user.username,
      role: req.user.role,
      tenantId: tenantReq.tenantId
    });

    // Always get user-specific notifications for dashboard
    console.log("🔍 Fetching user-specific notifications for dashboard");
    const notifications = await tenantStorage.getNotificationsByUser(req.user.id);
    
    console.log("🔍 Notifications result:", {
      userId: req.user.id,
      totalReturned: notifications.length,
      tenantId: tenantReq.tenantId
    });
    
    return res.json(notifications);
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return res.status(500).json({ 
      error: "Failed to fetch notifications",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// GET /api/notifications/admin - Get ALL notifications (admin only)
router.get("/admin", async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Check for admin role
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: "Admin access required" });
    }

    // Get tenant-aware storage for data isolation
    const tenantReq = req as any;
    const tenantStorage = tenantReq.tenantId ? await getTenantStorage(tenantReq.tenantId) : storage;
    
    console.log("🔍 Admin fetching ALL notifications");
    const notifications = await tenantStorage.getAllNotifications();
    
    console.log("🔍 Admin notifications result:", {
      totalReturned: notifications.length,
      userIdDistribution: notifications.reduce((acc: Record<number, number>, n: any) => {
        acc[n.userId] = (acc[n.userId] || 0) + 1;
        return acc;
      }, {} as Record<number, number>),
      tenantId: tenantReq.tenantId
    });
    
    return res.json(notifications);
  } catch (error) {
    console.error("Error fetching admin notifications:", error);
    return res.status(500).json({ 
      error: "Failed to fetch admin notifications",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// POST /api/notifications - Create a new notification
router.post("/", async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Get tenant-aware storage for data isolation
    const tenantReq = req as any;
    const tenantStorage = tenantReq.tenantId ? await getTenantStorage(tenantReq.tenantId) : storage;

    const { regulationId, type, frequency, enabled, phoneNumber } = req.body;

    if (!regulationId || !type || !frequency) {
      return res.status(400).json({ error: "Missing required fields: regulationId, type, frequency" });
    }

    const notification: InsertNotification = {
      regulationId,
      userId: req.user.id,
      type,
      frequency,
      enabled: enabled !== undefined ? enabled : true,
      phoneNumber,
    };

    const createdNotification = await tenantStorage.createNotification(notification);
    console.log(`[NOTIFICATIONS] Created notification for tenant ${tenantReq.tenantId || 'default'}: ${createdNotification.id}`);
    return res.json(createdNotification);
  } catch (error) {
    console.error("Error creating notification:", error);
    return res.status(500).json({ 
      error: "Failed to create notification",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router; 