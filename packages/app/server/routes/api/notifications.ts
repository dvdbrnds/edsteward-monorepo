import express from 'express';
// Removed unused storage import - using getDatabaseStorage(req.tenantId) directly
import { syslog, LogLevel, LogFacility } from '../../services/syslog';
import { getDatabaseStorage } from '../../services/database';

const router = express.Router();

// Simple auth middleware
const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

// GET /api/notifications - Get notifications for the current user
router.get("/", requireAuth, async (req, res) => {
  try {
    // Use direct database storage for single-tenant mode
    const tenantStorage = getDatabaseStorage(req.tenantId);
    
    
    const notifications = await tenantStorage.getNotificationsByUser(req.user!.id);
    
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, `Fetched ${notifications.length} notifications for user ${req.user?.id}`);
    res.json(notifications);
  } catch (error) {
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, `Failed to fetch notifications: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ 
      error: "Failed to fetch notifications", 
      details: error instanceof Error ? error.message : String(error) 
    });
  }
});

// POST /api/notifications - Create a new notification
router.post("/", requireAuth, async (req, res) => {
  try {
    // Use direct database storage for single-tenant mode
    const tenantStorage = getDatabaseStorage(req.tenantId);
    
    const notification = await tenantStorage.createNotification(req.body);
    
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, `Created notification ${notification.id}`);
    res.status(201).json(notification);
  } catch (error) {
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, `Failed to create notification: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ 
      error: "Failed to create notification", 
      details: error instanceof Error ? error.message : String(error) 
    });
  }
});

// PATCH /api/notifications/:id - Mark notification as read
router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const notificationId = parseInt(req.params.id);
    
    if (isNaN(notificationId)) {
      return res.status(400).json({ error: "Invalid notification ID" });
    }

    // Use direct database storage for single-tenant mode
    const tenantStorage = getDatabaseStorage(req.tenantId);
    
    const notification = await tenantStorage.updateNotification(notificationId, req.body);
    
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, `Updated notification ${notificationId}`);
    res.json(notification);
  } catch (error) {
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, `Failed to update notification: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ 
      error: "Failed to update notification", 
      details: error instanceof Error ? error.message : String(error) 
    });
  }
});

// DELETE /api/notifications/:id - Delete notification
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const notificationId = parseInt(req.params.id);
    
    if (isNaN(notificationId)) {
      return res.status(400).json({ error: "Invalid notification ID" });
    }

    // Use direct database storage for single-tenant mode
    const tenantStorage = getDatabaseStorage(req.tenantId);
    
    await tenantStorage.deleteNotification(notificationId);
    
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, `Deleted notification ${notificationId}`);
    res.json({ success: true });
  } catch (error) {
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, `Failed to delete notification: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ 
      error: "Failed to delete notification", 
      details: error instanceof Error ? error.message : String(error) 
    });
  }
});

export default router; 