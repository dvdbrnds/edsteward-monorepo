import express from 'express';
import { getDatabaseStorage } from '../../services/database';

const router = express.Router();

// Simple debug endpoint for database connection
router.get('/database', async (req, res) => {
  try {
    const storage = getDatabaseStorage();
    const users = await storage.getAllUsers();
    const regulations = await storage.getRegulations();
    
    res.json({
      status: 'connected',
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