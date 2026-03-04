/**
 * Simple admin server for testing the CDC pipeline
 * This is a lightweight version of the main application with admin routes only
 */
import { createExpressApp, startServer } from './core/server-factory.js';
import express from 'express';

// Create router for admin routes
const adminRouter = express.Router();

// Admin inject test regulation endpoint
adminRouter.post('/inject-test-reg', (req, res) => {
  try {
    const { tenant_id, reg_id, title, revision, payload = {} } = req.body;
    
    // Log the request
    console.log('Test regulation injection request:', {
      tenant_id,
      reg_id,
      title,
      revision
    });
    
    // Simulate successful response
    res.status(201).json({
      message: 'Test regulation injected successfully',
      regulation: {
        id: Math.floor(Math.random() * 1000),
        tenant_id,
        reg_id,
        title,
        revision,
        payload,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      job_id: `${tenant_id}:${reg_id}`
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Log request details middleware
const requestLogger = (req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  
  if (req.method === 'POST' || req.method === 'PUT') {
    console.log('Headers:', req.headers);
    console.log('Body:', req.body);
  }
  
  next();
};

// Start the application
async function startAdminServer() {
  const { app } = await createExpressApp({
    name: 'simple-admin',
    routes: [
      { path: '/v1/admin', router: adminRouter }
    ],
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization']
    },
    middleware: [requestLogger]
  });

  const PORT = process.env.PORT || 3000;
  startServer(app, {
    port: PORT,
    name: 'simple-admin',
    onReady: () => {
      console.log(`Health check: http://localhost:${PORT}/health`);
      console.log(`Test endpoint: http://localhost:${PORT}/v1/admin/inject-test-reg`);
    }
  });
}

// Start if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startAdminServer();
} 