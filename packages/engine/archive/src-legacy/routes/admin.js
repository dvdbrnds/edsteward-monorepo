/**
 * Admin routes for system management and debugging
 */
import express from 'express';
import { requireAdmin, allowDevOrDebugOnly } from '../middleware/authMiddleware.js';
import { pool, query } from '../database/connection.js';
import { setupLogger } from '../utils/logger.js';

const router = express.Router();
const logger = setupLogger('admin-routes');

/**
 * POST /v1/admin/inject-test-reg
 * Injects a test regulation into the database to trigger CDC
 * 
 * Body schema:
 * {
 *   "tenant_id": "moravian",
 *   "reg_id": "TEST-42CFR999",
 *   "title": "🚧 Dummy Regulation",
 *   "revision": "2025-05-22",
 *   "payload": { "summary": "This is only a drill." }
 * }
 */
router.post('/inject-test-reg', requireAdmin, allowDevOrDebugOnly, async (req, res) => {
  try {
    const { tenant_id, reg_id, title, revision, payload } = req.body;
    
    // Validate required fields
    if (!tenant_id || !reg_id || !title || !revision || !payload) {
      return res.status(400).json({
        error: 'Missing required fields',
        requiredFields: ['tenant_id', 'reg_id', 'title', 'revision', 'payload']
      });
    }
    
    // Connect to database with client from pool
    const client = await pool.connect();
    
    try {
      // Start transaction
      await client.query('BEGIN');
      
      // Set tenant context for the operation
      await client.query(`SET app.tenant_id = '${tenant_id}'`);
      
      // Insert/update the test regulation
      const result = await client.query(
        `INSERT INTO regulations (
          tenant_id, reg_id, title, revision, payload, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, NOW(), NOW()
        ) ON CONFLICT (tenant_id, reg_id) 
        DO UPDATE SET 
          title = $3,
          revision = $4,
          payload = $5,
          updated_at = NOW()
        RETURNING id, reg_id, revision`,
        [tenant_id, reg_id, title, revision, JSON.stringify(payload)]
      );
      
      // Commit transaction
      await client.query('COMMIT');
      
      // Log the injection for audit purposes
      logger.info('Test regulation injected', {
        tenant_id, 
        reg_id,
        title,
        userId: req.user?.id || 'unknown',
        ip: req.ip
      });
      
      // Return success response
      res.status(200).json({
        message: 'Test regulation injected successfully',
        result: result.rows[0],
        note: 'This change will trigger CDC and propagate through the system'
      });
    } catch (error) {
      // Rollback transaction on error
      await client.query('ROLLBACK');
      throw error;
    } finally {
      // Release client back to pool
      client.release();
    }
  } catch (error) {
    logger.error('Error injecting test regulation:', error);
    
    res.status(500).json({
      error: 'Failed to inject test regulation',
      message: error.message
    });
  }
});

export default router; 