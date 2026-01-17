import express from 'express';
import { getDatabaseStorage } from '../../services/database';

const router = express.Router();

// Simple debug endpoint for database connection
// SECURITY: Now tenant-aware and requires authentication
router.get('/database', async (req, res) => {
  // Require authentication for debug endpoints
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  // Only allow admins to access debug endpoints
  if (req.user?.role?.toLowerCase() !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    // TENANT ISOLATION: Use tenant-specific storage
    const tenantId = (req as any).tenantId || 'default';
    const storage = getDatabaseStorage(tenantId);
    const users = await storage.getAllUsers();
    const regulations = await storage.getRegulations();
    
    res.json({
      status: 'connected',
      tenantId,
      userCount: users.length,
      regulationCount: regulations.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    });
  }
});

export { router as debugRouter }; 