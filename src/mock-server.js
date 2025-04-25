import express from 'express';
import cors from 'cors';
import { setupLogger } from './utils/logger.js';

const logger = setupLogger('mock-server');
const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Log all requests
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  logger.info('Health check requested');
  res.json({
    status: 'healthy',
    version: '1.0.0',
    uptime: '0h 10m',
    timestamp: new Date().toISOString()
  });
});

// Compliance query endpoint
app.post('/compliance/query', (req, res) => {
  const { query, regulationId } = req.body;
  
  if (!query) {
    logger.error('Missing query in request body');
    return res.status(400).json({
      error: 'Missing query in request body'
    });
  }
  
  logger.info(`Processing compliance query: ${query}`);
  
  // Mock response
  setTimeout(() => {
    res.json({
      result: Math.random() > 0.3 ? 'compliant' : 'non_compliant',
      confidence: (0.7 + Math.random() * 0.3).toFixed(2),
      timestamp: new Date().toISOString(),
      processingTime: '235ms',
      regulation: regulationId || 'default',
      details: {
        analysis: 'The document was analyzed for compliance with relevant regulations.',
        findings: Math.random() > 0.5 ? [
          { type: 'info', text: 'Privacy policy present' },
          { type: 'warning', text: 'Data retention policy could be more specific' }
        ] : []
      }
    });
  }, 500); // Simulate processing time
});

// Start server
app.listen(PORT, () => {
  logger.info(`Mock server running on port ${PORT}`);
}); 