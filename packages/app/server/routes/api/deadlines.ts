import express from 'express';
import { syslog, LogLevel, LogFacility } from '../../services/syslog';
import { getDatabaseStorage } from '../../services/database';
import { sendDeadlineCreationNotification } from '../../services/deadline-notifications';

const router = express.Router();

// GET /api/deadlines/my-deadlines - Get deadlines assigned to current user (requires auth)
router.get("/my-deadlines", async (req, res) => {
  try {
    // Require authentication for personal deadlines
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User ID not found in session' });
    }

    const tenantStorage = getDatabaseStorage(req.tenantId);
    const allDeadlines = await tenantStorage.getDeadlines();
    
    // Filter deadlines assigned to the current user
    const myDeadlines = allDeadlines.filter(d => d.assignedTo === userId);
    
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, `Fetched ${myDeadlines.length} deadlines for user ${userId}`);
    res.json(myDeadlines);
  } catch (error) {
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, `Failed to fetch my deadlines: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ 
      error: "Failed to fetch my deadlines", 
      details: error instanceof Error ? error.message : String(error) 
    });
  }
});

// GET /api/deadlines - Get all deadlines with regulation names (public access like regulations)
router.get("/", async (req, res) => {
  try {
    // Use direct database storage for single-tenant mode
    const tenantStorage = getDatabaseStorage(req.tenantId);
    
    
    const deadlines = await tenantStorage.getDeadlines();
    
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, `Fetched ${deadlines.length} deadlines`);
    res.json(deadlines);
  } catch (error) {
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, `Failed to fetch deadlines: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ 
      error: "Failed to fetch deadlines", 
      details: error instanceof Error ? error.message : String(error) 
    });
  }
});

// POST /api/deadlines - Create a new deadline (requires auth)
router.post("/", async (req, res) => {
  try {
    // Simple auth check
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Use direct database storage for single-tenant mode
    const tenantStorage = getDatabaseStorage(req.tenantId);
    
    const deadline = await tenantStorage.createDeadline(req.body);
    
    // Send immediate notification to assigned user and compliance officers
    try {
      await sendDeadlineCreationNotification(deadline);
      syslog.log(LogFacility.LOCAL0, LogLevel.INFO, `Sent creation notification for deadline ${deadline.id}`);
    } catch (notificationError) {
      syslog.log(LogFacility.LOCAL0, LogLevel.WARNING, `Failed to send creation notification for deadline ${deadline.id}: ${notificationError instanceof Error ? notificationError.message : String(notificationError)}`);
    }
    
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, `Created deadline ${deadline.id}`);
    res.status(201).json(deadline);
  } catch (error) {
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, `Failed to create deadline: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ 
      error: "Failed to create deadline", 
      details: error instanceof Error ? error.message : String(error) 
    });
  }
});

// PUT /api/deadlines/:id - Update a deadline (requires auth)
router.put("/:id", async (req, res) => {
  try {
    // Simple auth check
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const deadlineId = parseInt(req.params.id);
    if (isNaN(deadlineId)) {
      return res.status(400).json({ error: "Invalid deadline ID" });
    }

    // Use direct database storage for single-tenant mode
    const tenantStorage = getDatabaseStorage(req.tenantId);
    
    const updatedDeadline = await tenantStorage.updateDeadline(deadlineId, req.body);
    
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, `Updated deadline ${deadlineId}`);
    res.json(updatedDeadline);
  } catch (error) {
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, `Failed to update deadline: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ 
      error: "Failed to update deadline", 
      details: error instanceof Error ? error.message : String(error) 
    });
  }
});

// DELETE /api/deadlines/:id - Delete a deadline (requires auth)
router.delete("/:id", async (req, res) => {
  try {
    // Simple auth check
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const deadlineId = parseInt(req.params.id);
    if (isNaN(deadlineId)) {
      return res.status(400).json({ error: "Invalid deadline ID" });
    }

    // Use direct database storage for single-tenant mode
    const tenantStorage = getDatabaseStorage(req.tenantId);
    
    await tenantStorage.deleteDeadline(deadlineId);
    
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, `Deleted deadline ${deadlineId}`);
    res.status(204).send();
  } catch (error) {
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, `Failed to delete deadline: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ 
      error: "Failed to delete deadline", 
      details: error instanceof Error ? error.message : String(error) 
    });
  }
});

export default router; 