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
import type { Regulation } from '@shared/schema';
import path from 'path';
// import { db } from '../config/database';
// import { sql } from 'drizzle-orm';

// Import modular route handlers
import publicRoutes from './api/public';
import uploadsRoutes from './api/uploads';
import { regulationsRouter } from './api/regulations';
import { notesRouter } from './api/notes';
import deadlinesRouter from './api/deadlines';
import notificationsRouter from './api/notifications';
// @ts-ignore
import migrationRoutes from './database-migration.js';

export function registerRoutes(app: express.Application): Server {
  // Create HTTP server
  const httpServer = createServer(app);

  // EMERGENCY FIX: Simple diagnostic endpoint (no database)
  app.get('/api/diagnostic', (req, res) => {
    console.log('🚨 DIAGNOSTIC ENDPOINT CALLED - NO DATABASE');
    res.json({
      success: true,
      message: 'Route registration is working!',
      timestamp: new Date().toISOString(),
      server_status: 'running'
    });
  });

  // EMERGENCY FIX: Simple database endpoint that WILL work (DISABLED FOR TESTING)
  app.get('/api/db-direct', async (req, res) => {
    try {
      console.log('🚨 EMERGENCY DB ENDPOINT CALLED - DATABASE DISABLED FOR TESTING');
      
      res.json({
        success: true,
        message: 'Database endpoint working (no DB calls for testing)!',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('🚨 EMERGENCY DB ERROR:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  });

  // EMERGENCY FIX: Database stats endpoint (DISABLED FOR TESTING)
  app.get('/api/db-stats', async (req, res) => {
    try {
      console.log('🚨 DB STATS ENDPOINT CALLED - DATABASE DISABLED FOR TESTING');
      
      res.json({
        success: true,
        stats: {
          users: 5,
          regulations: 1000,
          notes: 50,
          total_records: 1055
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('🚨 DB STATS ERROR:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // EMERGENCY FIX: Database import endpoint
  app.post('/api/db-import', async (req, res) => {
    try {
      console.log('🚨 DB IMPORT ENDPOINT CALLED');
      
      // For now, just return success - we'll implement actual import later
      res.json({
        success: true,
        message: 'Import endpoint is working - ready for implementation',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('🚨 DB IMPORT ERROR:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // PRIORITY: Register database routes FIRST before any other middleware
  console.log('🔧 Registering database routes at /api/admin/database - PRIORITY REGISTRATION');
  
  // Simple test endpoint
  app.get('/api/admin/database/test', (req, res) => {
    console.log('✅ Database test endpoint called successfully');
    res.json({ 
      message: 'Database API is working!', 
      timestamp: new Date().toISOString(),
      user: req.user ? { id: req.user.id, username: req.user.username, role: req.user.role } : null
    });
  });
  
  // Database stats endpoint
  app.get('/api/admin/database/stats', async (req, res) => {
    try {
      console.log('Database stats endpoint called');
      console.log('User:', req.user);
      
      // Return mock data for now
      const stats = {
        users: 4,
        regulations: 1000,
        notes: 50,
        guides: 10,
        deadlines: 25,
        total_records: 1089,
      };

      res.json(stats);
    } catch (error) {
      console.error('Error fetching database stats:', error);
      res.status(500).json({ error: 'Failed to fetch database statistics' });
    }
  });

  // Admin logs endpoint
  app.get('/api/admin/logs', async (req, res) => {
    try {
      console.log('Admin logs endpoint called');
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      
      // Return mock logs data for now
      const logs = {
        logs: [
          {
            id: 1,
            timestamp: new Date().toISOString(),
            level: 'info',
            message: 'Database connection established',
            source: 'database'
          },
          {
            id: 2,
            timestamp: new Date(Date.now() - 60000).toISOString(),
            level: 'info',
            message: 'Server started successfully',
            source: 'server'
          }
        ],
        pagination: {
          page,
          limit,
          total: 2,
          totalPages: 1
        }
      };

      res.json(logs);
    } catch (error) {
      console.error('Error fetching logs:', error);
      res.status(500).json({ error: 'Failed to fetch logs' });
    }
  });
  
  console.log('✅ Database routes registered successfully - PRIORITY');

  // Serve static files from public directory for downloads
  app.use('/downloads', express.static(path.join(process.cwd(), 'public/downloads')));

  // Database initialization route (for production setup)
  app.get('/api/init-db', async (req, res) => {
    console.log('🔧 Database initialization endpoint called via GET');
    try {
      console.log('Current NODE_ENV:', process.env.NODE_ENV);
      
      const result = await initializeDatabase();
      console.log('✅ Database initialization successful:', result);
      res.json(result);
    } catch (error) {
      console.error('❌ Database initialization error:', error);
      res.status(500).json({ 
        error: 'Database initialization failed',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.post('/api/init-db', async (req, res) => {
    console.log('🔧 Database initialization endpoint called via POST');
    try {
      console.log('Current NODE_ENV:', process.env.NODE_ENV);
      
      const result = await initializeDatabase();
      console.log('✅ Database initialization successful:', result);
      res.json(result);
    } catch (error) {
      console.error('❌ Database initialization error:', error);
      res.status(500).json({ 
        error: 'Database initialization failed',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Simple database initialization endpoint
  app.get('/api/init-db-simple', async (req, res) => {
    try {
      console.log('🚀 Manual database initialization requested...');
      
      // Import and run database initialization
      const { initializeDatabase } = await import('../db-init');
      const result = await initializeDatabase();
      
      console.log('✅ Database initialization completed:', result);
      res.json(result);
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Database initialization failed'
      });
    }
  });

  // Setup modular API routes
  app.use('/api/public', publicRoutes);
  
  // EMERGENCY: Create /api/public-regulations endpoint that bypasses ALL middleware
  app.get('/api/public-regulations', async (req, res) => {
    try {
      console.log('🚨 EMERGENCY /api/public-regulations endpoint called');
      const regulations = await storage.getRegulations();
      console.log(`✅ Found ${regulations.length} regulations`);

      // Return complete regulation data (same as public endpoint)
      const publicRegulations = regulations.map(reg => ({
        id: reg.id,
        itemId: reg.itemId,
        name: reg.name,
        topic: reg.topic,
        statute: reg.statute,
        statuteIds: reg.statuteIds,
        summary: reg.summary,
        requirements: reg.requirements,
        category: reg.category,
        jurisdiction: reg.jurisdiction,
        isApplicable: reg.isApplicable,
        effectiveDate: reg.effectiveDate,
        lastUpdated: reg.lastUpdated,
        lastVerified: reg.lastVerified,
        nextReviewDate: reg.nextReviewDate,
        agency_name: reg.agency_name,
        agency_department: reg.agency_department,
        agency_url: reg.agency_url,
        regulationUrl: reg.regulationUrl,
        requirementsUrl: reg.requirementsUrl,
        submissionGuidelines: reg.submissionGuidelines,
        regulationText: reg.regulationText,
        complianceNotes: reg.complianceNotes,
        sections: reg.sections
      }));

      return res.json(publicRegulations);
    } catch (error) {
      console.error('❌ Error in emergency public regulations endpoint:', error);
      return res.status(500).json({ 
        error: "Failed to fetch regulations", 
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // EMERGENCY: Create /api/public-regulations/:id endpoint
  app.get('/api/public-regulations/:regulationId', async (req, res) => {
    try {
      const regulationId = parseInt(req.params.regulationId);
      
      if (isNaN(regulationId)) {
        return res.status(400).json({ error: "Invalid regulation ID" });
      }
      
      console.log(`🚨 EMERGENCY Fetching regulation ${regulationId}`);
      const regulation = await storage.getRegulation(regulationId);
      
      if (!regulation) {
        return res.status(404).json({ error: "Regulation not found" });
      }
      
      console.log(`✅ Found regulation: ${regulation.name || regulation.topic}`);
      res.json(regulation);
    } catch (error) {
      console.error(`❌ Error fetching regulation ${req.params.regulationId}:`, error);
      res.status(500).json({ 
        error: "Failed to fetch regulation", 
        details: error instanceof Error ? error.message : String(error) 
      });
    }
  });
  
  // CRITICAL: Add /api/regulations endpoints BEFORE auth middleware for frontend compatibility
  app.get('/api/regulations', async (req, res) => {
    try {
      console.log('🔧 Direct /api/regulations endpoint called (BEFORE AUTH)');
      const regulations = await storage.getRegulations();
      console.log(`✅ Found ${regulations.length} regulations`);

      // Return complete regulation data (same as public endpoint)
      const publicRegulations = regulations.map(reg => ({
        id: reg.id,
        itemId: reg.itemId,
        name: reg.name,
        topic: reg.topic,
        statute: reg.statute,
        statuteIds: reg.statuteIds,
        summary: reg.summary,
        requirements: reg.requirements,
        category: reg.category,
        jurisdiction: reg.jurisdiction,
        isApplicable: reg.isApplicable,
        effectiveDate: reg.effectiveDate,
        lastUpdated: reg.lastUpdated,
        lastVerified: reg.lastVerified,
        nextReviewDate: reg.nextReviewDate,
        agency_name: reg.agency_name,
        agency_department: reg.agency_department,
        agency_url: reg.agency_url,
        regulationUrl: reg.regulationUrl,
        requirementsUrl: reg.requirementsUrl,
        submissionGuidelines: reg.submissionGuidelines,
        regulationText: reg.regulationText,
        complianceNotes: reg.complianceNotes,
        sections: reg.sections
      }));

      return res.json(publicRegulations);
    } catch (error) {
      console.error('❌ Error in direct regulations endpoint:', error);
      return res.status(500).json({ 
        error: "Failed to fetch regulations", 
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Add individual regulation endpoint BEFORE auth middleware
  app.get('/api/regulations/:regulationId', async (req, res) => {
    try {
      const regulationId = parseInt(req.params.regulationId);
      
      if (isNaN(regulationId)) {
        return res.status(400).json({ error: "Invalid regulation ID" });
      }
      
      console.log(`🔧 Fetching regulation ${regulationId} (BEFORE AUTH)`);
      const regulation = await storage.getRegulation(regulationId);
      
      if (!regulation) {
        return res.status(404).json({ error: "Regulation not found" });
      }
      
      console.log(`✅ Found regulation: ${regulation.name || regulation.topic}`);
      res.json(regulation);
    } catch (error) {
      console.error(`❌ Error fetching regulation ${req.params.regulationId}:`, error);
      res.status(500).json({ 
        error: "Failed to fetch regulation", 
        details: error instanceof Error ? error.message : String(error) 
      });
    }
  });
  
  app.use('/api/uploads', uploadsRoutes);
  app.use('/api/migration', migrationRoutes);
  app.use('/api/deadlines', deadlinesRouter);
  app.use('/api/notifications', notificationsRouter);
  
  // Mount authenticated routes (these will be for admin functions)
  // app.use('/api/admin/regulations', regulationsRouter); // REMOVED - conflicts with non-auth endpoint
  app.use('/api/notes', notesRouter);
  
  // Setup existing auth routes 
  setupAuth(app as any);
  
  // Setup regulation updates API routes
  setupRegulationUpdatesApi(app as any);
  
  // Setup MCP integration API routes
  setupMCPIntegrationApi(app as any);
  
  // Setup debug endpoints for regulation updates
  setupDebugRegulationUpdatesApi(app as any);

  // Evidence files endpoint (MUST be before catch-all auth middleware)
  app.get('/api/regulations/:regulationId/evidence', async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      const regulationId = parseInt(req.params.regulationId);
      
      if (isNaN(regulationId)) {
        return res.status(400).json({ error: "Invalid regulation ID" });
      }
      
      console.log(`🔧 Fetching evidence files for regulation ${regulationId}`);
      const evidenceFiles = await storage.getEvidenceFilesByRegulation(regulationId);
      
      console.log(`✅ Found ${evidenceFiles.length} evidence files`);
      res.json(evidenceFiles);
    } catch (error) {
      console.error(`❌ Error fetching evidence files for regulation ${req.params.regulationId}:`, error);
      res.status(500).json({ 
        error: "Failed to fetch evidence files", 
        details: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  // Test route to verify API handling
  app.get("/api/test", (req, res) => {
    res.json({ status: "ok", message: "API is working" });
  });

  // 🚨 EMERGENCY DATABASE ENDPOINTS - ADDED RIGHT AFTER WORKING /api/test
  app.get("/api/db-direct", (req, res) => {
    console.log('🚨 EMERGENCY DB ENDPOINT CALLED - WORKING LOCATION!');
    res.json({
      success: true,
      message: 'Database endpoint working from correct location!',
      timestamp: new Date().toISOString(),
      location: 'Added right after /api/test endpoint'
    });
  });

  app.get("/api/db-stats", (req, res) => {
    console.log('🚨 DB STATS ENDPOINT CALLED - WORKING LOCATION!');
    res.json({
      success: true,
      stats: {
        users: 5,
        regulations: 1000,
        notes: 50,
        total_records: 1055
      },
      timestamp: new Date().toISOString(),
      location: 'Added right after /api/test endpoint'
    });
  });

  app.get("/api/diagnostic", (req, res) => {
    console.log('🚨 DIAGNOSTIC ENDPOINT CALLED - WORKING LOCATION!');
    res.json({
      success: true,
      message: 'Route registration is working from correct location!',
      timestamp: new Date().toISOString(),
      server_status: 'running',
      location: 'Added right after /api/test endpoint'
    });
  });

  // Debug route to list all registered routes
  app.get("/api/debug/routes", (req, res) => {
    const routes: any[] = [];
    app._router.stack.forEach((middleware: any) => {
      if (middleware.route) {
        routes.push({
          path: middleware.route.path,
          methods: Object.keys(middleware.route.methods)
        });
      } else if (middleware.name === 'router') {
        middleware.handle.stack.forEach((handler: any) => {
          if (handler.route) {
            routes.push({
              path: handler.route.path,
              methods: Object.keys(handler.route.methods)
            });
          }
        });
      }
    });
    res.json({ routes });
  });

  // Simple health check for ALB (no database dependency)
  app.get("/health", (req, res) => {
    res.status(200).send("OK");
  });

  // Comprehensive health check with database status (DISABLED FOR TESTING)
  app.get("/api/health", async (req, res) => {
    try {
      console.log('Health check endpoint called - DATABASE DISABLED FOR TESTING');
      
      res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        database: {
          connected: false,
          message: "Database calls disabled for testing"
        }
      });
    } catch (error) {
      console.error('Health check failed:', error);
      res.status(500).json({
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
        database: {
          connected: false
        }
      });
    }
  });

  // Add setup status endpoint that frontend navigation expects
  app.get('/api/setup/status', async (req, res) => {
    try {
      console.log('🔧 Setup status endpoint called');
      
      // Check if we have users and regulations
      const users = await storage.getAllUsers();
      const regulations = await storage.getRegulations();
      const deadlines = await storage.getDeadlines();
      
      const setupStatus = {
        hasUsers: users.length > 0,
        hasRegulations: regulations.length > 0,
        hasDeadlines: deadlines.length > 0,
        isSetupComplete: users.length > 0 && regulations.length > 0,
        userCount: users.length,
        regulationCount: regulations.length,
        deadlineCount: deadlines.length
      };
      
      console.log(`✅ Setup status: ${JSON.stringify(setupStatus)}`);
      res.json(setupStatus);
    } catch (error) {
      console.error('❌ Error checking setup status:', error);
      res.status(500).json({ 
        error: "Failed to check setup status", 
        details: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  return httpServer;
} 