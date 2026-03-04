/**
 * Simple Test Routes
 */
import express from 'express';

const router = express.Router();

// Simple test endpoint
router.get('/test', (req, res) => {
  res.json({
    message: 'Test route working!',
    timestamp: new Date().toISOString()
  });
});

// Health check without services
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'test-routes',
    timestamp: new Date().toISOString()
  });
});

export default router; 