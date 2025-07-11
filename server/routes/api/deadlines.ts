import express from 'express';
import { storage } from '../../storage';
import { syslog, LogLevel, LogFacility } from '../../services/syslog';
import { getDatabaseStorage } from '../../services/database';

const router = express.Router();

// GET /api/deadlines - Get all deadlines with regulation names (public access like regulations)
router.get("/", async (req, res) => {
  try {
    // Use direct database storage for single-tenant mode
    const tenantStorage = getDatabaseStorage();
    
    console.log('[DEADLINES] Fetching deadlines for single-tenant mode');
    
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
    const tenantStorage = getDatabaseStorage();
    
    const deadline = await tenantStorage.createDeadline(req.body);
    
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

export default router; 