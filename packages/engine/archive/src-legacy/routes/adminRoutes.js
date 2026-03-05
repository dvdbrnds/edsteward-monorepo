/**
 * Admin routes for application management
 * Includes endpoints for system administration and debugging
 */
import express from 'express';
import { systemTenant } from '../middleware/tenantIsolation.js';
import { verifyAdmin } from '../middleware/authentication.js';
import { upsertRegulation } from '../database/connection.js';
import { setupLogger } from '../utils/logger.js';
import { addRefreshJob } from '../queue/regulation-queue.js';

// Initialize logger
const logger = setupLogger('admin-routes');

// Create router
const router = express.Router();

/**
 * Admin endpoints require authentication and admin role
 */
router.use(verifyAdmin);

/**
 * @route GET /v1/admin/status
 * @description Get admin status and system information
 * @access Admin only
 */
router.get('/status', systemTenant, async (req, res) => {
  try {
    // Return system status information
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      version: process.env.APP_VERSION || '1.0.0'
    });
  } catch (error) {
    logger.error('Error getting admin status', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route POST /v1/admin/inject-test-reg
 * @description Inject a test regulation into the system
 * @access Admin only
 * @body {Object} regulation - Test regulation data
 */
router.post('/inject-test-reg', systemTenant, async (req, res) => {
  try {
    // Extract data from request
    const { tenant_id, reg_id, title, revision, payload = {} } = req.body;
    
    // Validate required fields
    if (!tenant_id || !reg_id || !title || !revision) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'tenant_id, reg_id, title, and revision are required'
      });
    }
    
    logger.info('Injecting test regulation', {
      tenant_id,
      reg_id,
      title,
      revision
    });
    
    // Create regulation object
    const regulation = {
      reg_id,
      title,
      revision,
      payload: typeof payload === 'object' ? payload : {}
    };
    
    // Insert into database
    const savedRegulation = await upsertRegulation(regulation, tenant_id);
    
    // Add refresh job to queue with high priority
    const job = await addRefreshJob({
      regulationId: reg_id,
      tenantId: tenant_id,
      priority: 'high',
      source: 'admin-inject'
    });
    
    // Return success response
    res.status(201).json({
      message: 'Test regulation injected successfully',
      regulation: savedRegulation,
      job_id: job.id
    });
  } catch (error) {
    logger.error('Error injecting test regulation', error);
    res.status(500).json({
      error: 'Failed to inject test regulation',
      message: error.message
    });
  }
});

/**
 * @route POST /v1/admin/simulate-cdc
 * @description Simulate a CDC event for testing
 * @access Admin only
 * @body {Object} event - CDC event data
 */
router.post('/simulate-cdc', systemTenant, async (req, res) => {
  try {
    // Extract CDC event data from request
    const { table, operation, tenant_id, data } = req.body;
    
    // Validate required fields
    if (!table || !operation || !tenant_id || !data) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'table, operation, tenant_id, and data are required'
      });
    }
    
    logger.info('Simulating CDC event', {
      table,
      operation,
      tenant_id
    });
    
    // Create CDC event object
    const cdcEvent = {
      table,
      op: operation, // 'c' for create, 'u' for update, 'd' for delete
      tenant_id,
      ...data
    };
    
    // Import dynamically to avoid circular dependencies
    const { processCdcEvent } = await import('../cdc/cdc-consumer.js');
    
    // Process the CDC event
    await processCdcEvent({
      key: Buffer.from(`${tenant_id}:${data.reg_id || 'unknown'}`),
      value: Buffer.from(JSON.stringify(cdcEvent))
    });
    
    // Return success response
    res.json({
      message: 'CDC event simulated successfully',
      event: cdcEvent
    });
  } catch (error) {
    logger.error('Error simulating CDC event', error);
    res.status(500).json({
      error: 'Failed to simulate CDC event',
      message: error.message
    });
  }
});

// Export router
export default router; 