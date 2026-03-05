#!/usr/bin/env node
/**
 * MCP Engine Registry API - PostgreSQL Mode
 * 
 * This starts the Registry API with PostgreSQL as the data source.
 * All regulation data comes from the mcp_engine database.
 * 
 * Usage: node start-registry-postgres.js
 */

import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import postgresRoutes from './src/server/registry-api/routes/postgres-regulations.js';
import { healthCheck } from './src/services/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3010;

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Performed-By'],
  credentials: false
}));
app.use(bodyParser.json({ limit: '50mb' }));

// Static files
app.use(express.static(path.join(__dirname, 'src/server/registry-api/public')));

// PostgreSQL routes
app.use('/', postgresRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'MCP Engine Registry API',
    version: '2.0-postgres',
    description: 'Authoritative source of truth for higher education compliance regulations',
    dataSource: 'PostgreSQL',
    endpoints: {
      health: '/health',
      regulations: '/api/regulations',
      summary: '/api/regulations/summary',
      stats: '/api/regulations/stats',
      search: '/api/regulations/search?q=QUERY',
      single: '/api/regulations/:id',
      audit: '/api/regulations/:id/audit'
    },
    timestamp: new Date().toISOString()
  });
});

// Error handling
process.on('uncaughtException', (error) => {
  console.error('[REGISTRY] Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[REGISTRY] Unhandled Rejection:', reason);
});

process.on('SIGTERM', () => {
  console.log('[REGISTRY] SIGTERM received, shutting down');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[REGISTRY] SIGINT received, shutting down');
  process.exit(0);
});

// Start server
const startServer = async () => {
  console.log('═'.repeat(60));
  console.log('    MCP ENGINE REGISTRY API - PostgreSQL Mode');
  console.log('═'.repeat(60));
  
  // Test database connection
  console.log('\n[REGISTRY] Testing database connection...');
  const dbStatus = await healthCheck();
  
  if (dbStatus.status !== 'healthy') {
    console.error('[REGISTRY] ❌ Database connection failed:', dbStatus.error);
    console.error('[REGISTRY] Please ensure PostgreSQL is running and mcp_engine database exists.');
    console.error('[REGISTRY] Run: psql mcp_engine -c "SELECT COUNT(*) FROM regulations;"');
    process.exit(1);
  }
  
  console.log(`[REGISTRY] ✅ Database connected: ${dbStatus.database}`);
  console.log(`[REGISTRY]    Regulations: ${dbStatus.regulation_count}`);
  console.log(`[REGISTRY]    Audit entries: ${dbStatus.audit_count}`);
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n[REGISTRY] ✅ Server running on http://0.0.0.0:${PORT}`);
    console.log('[REGISTRY] Data source: PostgreSQL (mcp_engine database)');
    console.log('─'.repeat(60));
    console.log('\n📋 API Endpoints:');
    console.log(`   GET  http://localhost:${PORT}/health`);
    console.log(`   GET  http://localhost:${PORT}/api/regulations`);
    console.log(`   GET  http://localhost:${PORT}/api/regulations/summary`);
    console.log(`   GET  http://localhost:${PORT}/api/regulations/:id`);
    console.log(`   GET  http://localhost:${PORT}/api/regulations/:id/audit`);
    console.log(`   POST http://localhost:${PORT}/api/regulations`);
    console.log('─'.repeat(60));
  });
};

startServer();
