import express from "express";
import { storage } from "../../storage";
import { hashPassword } from "../../auth";

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

// Logs endpoint (placeholder - would need actual log implementation)
router.get('/logs', requireAdmin, async (req, res) => {
  try {
    const { search, level, facility, startDate, endDate, page = 1 } = req.query;
    
    // Return empty logs for now
    return res.json({
      logs: [],
      pagination: {
        page: parseInt(page as string) || 1,
        totalPages: 0,
        totalLogs: 0,
        hasMore: false
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