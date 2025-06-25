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
import { tenantMiddleware, TenantFinder } from '../middleware/tenant';

// Import modular route handlers
import uploadsRoutes from './api/uploads';
import { regulationsRouter } from './api/regulations';
import { notesRouter } from './api/notes';
import deadlinesRouter from './api/deadlines';
import notificationsRouter from './api/notifications';
import adminRouter from './api/admin';
import tenantsRouter from './api/tenants';
import fixStagingTenantRouter from './api/fix-staging-tenant';
import { registerDebugRoutes } from './api/debug';
// @ts-ignore
import migrationRoutes from './database-migration.js';

export function registerRoutes(app: express.Application): Server {
  // Create HTTP server
  const httpServer = createServer(app);

  // =============================================================================
  // NO AUTH REQUIRED ENDPOINTS (health checks only) - BEFORE TENANT MIDDLEWARE
  // =============================================================================
  
  // Basic health check - must be before tenant middleware for ALB health checks
  app.get('/health', (req, res) => {
    res.status(200).send("OK");
  });

  // =============================================================================
  // APPLY TENANT MIDDLEWARE GLOBALLY
  // =============================================================================
  
  // Apply tenant middleware to all routes for consistent tenant detection
  app.use(tenantMiddleware);

  // API health check with database status AND tenant information
  app.get('/api/health', async (req: any, res) => {
    try {
      // Check if this is a fix request
      const shouldFix = req.query.fix === 'staging-tenant';
      
      if (shouldFix) {
        console.log('🔧 [HEALTH-FIX] Emergency staging tenant fix requested...');
        
        try {
          const { db } = await import('../db');
          const { tenants } = await import('@shared/schema');
          const { eq } = await import('drizzle-orm');
          
          // Check current staging record
          const currentRecord = await db
            .select()
            .from(tenants)
            .where(eq(tenants.subdomain, 'staging'))
            .limit(1);
          
          if (currentRecord.length > 0 && currentRecord[0].id !== 'staging') {
            console.log(`🔧 [HEALTH-FIX] Found problematic record: id='${currentRecord[0].id}', subdomain='staging'`);
            
            // Delete incorrect record
            await db.delete(tenants).where(eq(tenants.subdomain, 'staging'));
            console.log('🗑️ [HEALTH-FIX] Deleted incorrect staging record');
            
            // Insert correct record
            await db.insert(tenants).values({
              id: 'staging',
              name: 'EdSteward Staging Environment',
              domain: 'staging.edsteward.ai',
              subdomain: 'staging',
              databaseName: 'edsteward_staging',
              status: 'active',
              settings: {
                allowedDomains: ['edsteward.ai', 'staging.edsteward.ai'],
                defaultRole: 'admin',
                enableAutoProvisioning: true,
                features: {
                  apiAccess: true,
                  customDomain: false,
                  ssoEnabled: false,
                  maxUsers: 1000,
                  maxRegulations: 10000
                }
              }
            });
            console.log('✅ [HEALTH-FIX] Inserted correct staging record');
            
            return res.json({
              status: 'healthy',
              fixApplied: true,
              message: 'Staging tenant database record has been fixed',
              timestamp: new Date().toISOString()
            });
          } else {
            console.log('ℹ️ [HEALTH-FIX] Staging record is already correct or not found');
            return res.json({
              status: 'healthy',
              fixApplied: false,
              message: 'Staging tenant record is already correct',
              timestamp: new Date().toISOString()
            });
          }
        } catch (fixError) {
          console.error('❌ [HEALTH-FIX] Fix failed:', fixError);
          return res.status(500).json({
            status: 'error',
            fixApplied: false,
            error: 'Database fix failed',
            message: fixError instanceof Error ? fixError.message : String(fixError),
            timestamp: new Date().toISOString()
          });
        }
      }
      
      const { checkConnectionHealth } = await import('../config/database');
      const { databaseHealthMonitor } = await import('../services/database-health');
      
      const dbHealthy = await checkConnectionHealth();
      const healthStatus = databaseHealthMonitor.getHealthStatus();
      
      // Extract tenant information from request
      const tenantInfo = TenantFinder.extractTenantFromRequest(req);
      
      const response = {
        status: dbHealthy ? "healthy" : "degraded",
        timestamp: new Date().toISOString(),
        server: "running",
        database: {
          connected: dbHealthy,
          monitoring: healthStatus.isMonitoring,
          consecutiveFailures: healthStatus.consecutiveFailures,
          maxFailures: healthStatus.maxFailures
        },
        tenant: {
          detected: !!req.tenant,
          tenantId: req.tenantId || null,
          tenantName: req.tenant?.name || null,
          subdomain: req.tenant?.subdomain || tenantInfo.subdomain || null,
          domain: req.tenant?.domain || tenantInfo.domain || null,
          detectionMethod: tenantInfo.method,
          status: req.tenant?.status || null
        }
      };
      
      res.status(dbHealthy ? 200 : 503).json(response);
    } catch (error) {
      res.status(503).json({
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        server: "running",
        database: {
          connected: false,
          error: error instanceof Error ? error.message : String(error)
        },
        tenant: {
          detected: false,
          error: "Could not detect tenant during health check"
        }
      });
    }
  });

  // =============================================================================
  // AUTHENTICATION SETUP
  // =============================================================================

  // Setup authentication
  setupAuth(app as any);

  // =============================================================================
  // AUTHENTICATED ENDPOINTS ONLY
  // =============================================================================

  // Helper function to get tenant-aware storage
  async function getTenantStorage(tenantId: string) {
    // For now, return the default storage - will be improved with proper tenant isolation
    return storage;
  }

  // Setup status for frontend navigation (requires auth)
  app.get('/api/setup/status', async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      // Get tenant-aware storage for data isolation
      const tenantReq = req as any;
      const tenantStorage = tenantReq.tenantId ? await getTenantStorage(tenantReq.tenantId) : storage;

      log(`📋 Checking setup status for tenant: ${tenantReq.tenantId || 'default'}`);
      
      const users = await tenantStorage.getAllUsers();
      const regulations = await tenantStorage.getRegulations();
      
      const setupStatus = {
        hasUsers: users.length > 0,
        hasRegulations: regulations.length > 0,
        hasDeadlines: true,
        isSetupComplete: users.length > 0 && regulations.length > 0,
        userCount: users.length,
        regulationCount: regulations.length,
        deadlineCount: 0,
        tenantId: tenantReq.tenantId || 'default'
      };
      
      log(`✅ Setup status for tenant ${tenantReq.tenantId || 'default'}: ${JSON.stringify(setupStatus)}`);
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
  app.use('/api/tenants', tenantsRouter);
  app.use('/api/database-migration', migrationRoutes);
  
  // Emergency fix endpoint (development only or with admin key)
  app.use('/api', fixStagingTenantRouter);

  // Register debug routes (no auth required for debugging)
  registerDebugRoutes(app as any);

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