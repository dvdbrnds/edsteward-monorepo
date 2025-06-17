import express from "express";
import { Server } from 'http';
import { createServer } from 'http';
import { log } from '../vite';
import { setupAuth } from '../auth';
import { setupRegulationUpdatesApi } from '../regulation-updates-api';
import { setupDebugRegulationUpdatesApi } from '../debug-regulation-updates';
import { setupMCPIntegrationApi } from '../mcp-integration-api';
import { initializeDatabase } from '../db-init';
import { storage } from '../storage';
import path from 'path';

// Import modular route handlers
import uploadsRoutes from './api/uploads';
import { regulationsRouter } from './api/regulations';
import { notesRouter } from './api/notes';
import deadlinesRouter from './api/deadlines';
import notificationsRouter from './api/notifications';
import adminRouter from './api/admin';
// @ts-ignore
import migrationRoutes from './database-migration.js';

export function registerRoutes(app: express.Application): Server {
  // Create HTTP server
  const httpServer = createServer(app);

  // =============================================================================
  // NO AUTH REQUIRED ENDPOINTS (health checks only)
  // =============================================================================
  
  // Basic health check
  app.get('/health', (req, res) => {
    res.status(200).send("OK");
  });

  // API health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      server: "running"
    });
  });

  // =============================================================================
  // AUTHENTICATION SETUP
  // =============================================================================

  // Setup authentication
  setupAuth(app as any);

  // =============================================================================
  // AUTHENTICATED ENDPOINTS ONLY
  // =============================================================================

  // Setup status for frontend navigation (requires auth)
  app.get('/api/setup/status', async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      log('📋 Checking setup status');
      
      const users = await storage.getAllUsers();
      const regulations = await storage.getRegulations();
      
      const setupStatus = {
        hasUsers: users.length > 0,
        hasRegulations: regulations.length > 0,
        hasDeadlines: true,
        isSetupComplete: users.length > 0 && regulations.length > 0,
        userCount: users.length,
        regulationCount: regulations.length,
        deadlineCount: 0
      };
      
      log(`✅ Setup status: ${JSON.stringify(setupStatus)}`);
      res.json(setupStatus);
    } catch (error) {
      log(`❌ Error checking setup status: ${error}`);
      res.status(500).json({ 
        error: "Failed to check setup status", 
        details: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  // Protected API routes (all require authentication)
  app.use('/api/uploads', uploadsRoutes);
  app.use('/api/regulations', regulationsRouter);
  app.use('/api/notes', notesRouter);
  app.use('/api/deadlines', deadlinesRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/database-migration', migrationRoutes);

  // Setup additional APIs
  setupRegulationUpdatesApi(app as any);
  setupDebugRegulationUpdatesApi(app as any);
  setupMCPIntegrationApi(app as any);

  // Initialize database
  initializeDatabase().catch(console.error);

  // Serve static files
  app.use('/downloads', express.static(path.join(process.cwd(), 'public/downloads')));

  return httpServer;
} 