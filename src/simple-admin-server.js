/**
 * Simple admin server for testing the CDC pipeline
 * This is a lightweight version of the main application with admin routes only
 */
import express from 'express';
import cors from 'cors';
import { setupLogger } from './utils/logger.js';

// Initialize logger
const logger = setupLogger('simple-admin');

// Create Express app
const app = express();

// CORS middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Parse JSON body
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// Admin inject test regulation endpoint
app.post('/v1/admin/inject-test-reg', (req, res) => {
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

// Log request details
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  
  if (req.method === 'POST' || req.method === 'PUT') {
    console.log('Headers:', req.headers);
    console.log('Body:', req.body);
  }
  
  next();
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Simple admin server started on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Test endpoint: http://localhost:${PORT}/v1/admin/inject-test-reg`);
}); 