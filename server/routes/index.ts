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
import { getDatabaseStorage } from '../services/database';
import path from 'path';
import { institutionConfig } from '../config/institution';
// Tenant middleware disabled in single-tenant mode

// Import modular route handlers
import uploadsRoutes from './api/uploads';
import regulationsRouter from './api/regulations';
import notesRouter from './api/notes';
import deadlinesRouter from './api/deadlines';
import notificationsRouter from './api/notifications';
import adminRouter from './api/admin';
import { debugRouter } from './api/debug';
import { emergencyMoravianRouter } from './api/emergency-moravian-fix';
// @ts-ignore
import migrationRoutes from './database-migration.js';

// Extend session interface for testing
declare module 'express-session' {
  interface SessionData {
    testValue?: string;
  }
}

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
  
  // Single-tenant mode - no tenant middleware needed
  // app.use(tenantMiddleware);

  // API health check with database status AND tenant information
  app.get('/api/health', async (req: any, res) => {
    try {
      // Check if this is a fix request
      const shouldFix = req.query.fix === 'staging-tenant';
      
      if (shouldFix) {
        console.log('🔧 [HEALTH-FIX] Single-tenant mode - no tenant fixes needed');
        return res.json({
          status: 'healthy',
          fixApplied: false,
          message: 'Single-tenant mode - no tenant fixes needed',
          timestamp: new Date().toISOString()
        });
      }
      
      const { checkConnectionHealth } = await import('../config/database');
      const { databaseHealthMonitor } = await import('../services/database-health');
      
      const dbHealthy = await checkConnectionHealth();
      const healthStatus = databaseHealthMonitor.getHealthStatus();
      
      // Single-tenant mode - simplified tenant info
      const tenantInfo = { subdomain: null, domain: req.get('host'), method: 'single-tenant' };
      
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

  // Version endpoint to verify deployments and UUID mapping
  app.get('/version', (req, res) => {
    const deploymentInfo: any = {
      timestamp: new Date().toISOString(),
      commit: '7b3c900-uuid-fix',
      uuidMappingActive: true,
      testUUID: '3a1cbce2-0cf8-4c4f-ab96-4023eca4977d',
      shouldMapTo: 'moravian',
      server: 'production'
    };
    
    // Single-tenant mode - storage always available
    try {
      const storage = getDatabaseStorage();
      deploymentInfo.singleTenantWorking = true;
    } catch (error) {
      deploymentInfo.singleTenantWorking = false;
      deploymentInfo.error = error instanceof Error ? error.message : String(error);
    }
    
    res.json(deploymentInfo);
  });

  // =============================================================================
  // AUTHENTICATION SETUP
  // =============================================================================

  // Public branding endpoint (no auth required) for login page styling
  app.get('/api/branding', async (req, res) => {
    try {
      const tenantStorage = getDatabaseStorage();
      const brandingConfig = await tenantStorage.getBrandingConfig();

      res.json({
        success: true,
        branding: brandingConfig,
      });
    } catch (error) {
      console.error("Error fetching public branding config:", error);
      res.status(500).json({ 
        error: "Failed to fetch branding config", 
        details: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  // Setup authentication
  setupAuth(app as any);

  // =============================================================================
  // AUTHENTICATED ENDPOINTS ONLY
  // =============================================================================

  // The import for getTenantStorage is at the top of the file

  // Setup status for frontend navigation (requires auth)
  app.get('/api/setup/status', async (req, res) => {
    try {
      if (!req.isAuthenticated || !req.isAuthenticated()) {
        return res.status(401).json({ error: "Authentication required" });
      }

      // Single-tenant storage - always use main database
      const tenantStorage = getDatabaseStorage();

      log(`📋 Checking setup status for single-tenant: default`);
      
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
        tenantId: 'default'
      };
      
      log(`✅ Setup status for single-tenant default: ${JSON.stringify(setupStatus)}`);
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
  // Auth router removed - using setupAuth endpoints instead
  
  // TEMPORARY FIX: Add auth endpoints directly until router issue is resolved
  app.get('/api/auth/me', (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    let user = req.user;
    
    // Ensure dvdbrnds is always admin
    if (user && user.username === 'dvdbrnds' && user.role !== 'admin') {
      user = { ...user, role: 'admin' };
    }
    
    // Include tenant info in user response
    const userWithTenant = {
      ...user,
      tenantId: (req as any).tenantId,
      subdomain: (req as any).tenant?.subdomain
    };
    
    res.json(userWithTenant);
  });

  app.get('/api/auth/status', (req, res) => {
    const isAuthenticated = req.isAuthenticated();
    const tenantReq = req as any;
    
    let user = isAuthenticated ? req.user : null;
    
    // Ensure dvdbrnds is always admin
    if (user && user.username === 'dvdbrnds' && user.role !== 'admin') {
      user = { ...user, role: 'admin' };
    }
    
    res.json({
      authenticated: isAuthenticated,
      user: user,
      tenantId: tenantReq.tenantId || null,
      subdomain: tenantReq.tenant?.subdomain || null,
      timestamp: new Date().toISOString()
    });
  });
  
  app.use('/api/uploads', uploadsRoutes);
  app.use('/api/regulations', regulationsRouter);
  app.use('/api/notes', notesRouter);
  app.use('/api/deadlines', deadlinesRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/database-migration', migrationRoutes);
  
  // Register debug routes (no auth required for debugging)
  app.use('/api/debug', debugRouter);
  
  // Emergency bypass for Moravian tenant - only use when hostname is moravian.edsteward.ai
  app.use('/api/emergency', (req, res, next) => {
    const hostname = req.get('host') || '';
    if (hostname.startsWith('moravian.')) {
      emergencyMoravianRouter(req, res, next);
    } else {
      res.status(404).json({ error: 'Emergency endpoint only available for Moravian tenant' });
    }
  });

  // Institution configuration endpoint for client-side branding
  app.get('/api/institution-config', (req, res) => {
    const config = {
      institution: {
        name: institutionConfig.name,
        domain: institutionConfig.domain,
        branding: {
          logo: institutionConfig.branding.logo,
          primaryColor: institutionConfig.branding.primaryColor,
          secondaryColor: institutionConfig.branding.secondaryColor,
          favicon: institutionConfig.branding.favicon,
        },
      },
      authentication: {
        samlEnabled: institutionConfig.authentication.samlEnabled,
        usernamePasswordEnabled: institutionConfig.authentication.usernamePasswordEnabled,
        allowSelfRegistration: institutionConfig.authentication.allowSelfRegistration,
      },
      features: {
        maxUsers: institutionConfig.features.maxUsers,
        maxRegulations: institutionConfig.features.maxRegulations,
        apiAccess: institutionConfig.features.apiAccess,
        customDomain: institutionConfig.features.customDomain,
        ssoEnabled: institutionConfig.features.ssoEnabled,
      },
    };

    res.json({
      success: true,
      institutionConfig: config,
    });
  });

  // Setup additional APIs
  setupRegulationUpdatesApi(app as any);
  setupDebugRegulationUpdatesApi(app as any);
  setupMCPIntegrationApi(app as any);

  // Initialize database
  initializeDatabase().catch(console.error);

  // Serve static files
  app.use('/downloads', express.static(path.join(process.cwd(), 'public/downloads')));
  
  // Serve branding assets
  const assetsPath = path.join(process.cwd(), 'client/public/assets');
  app.use('/assets', express.static(assetsPath, {
    setHeaders: (res, path) => {
      // Set appropriate cache headers for assets
      if (path.endsWith('.png') || path.endsWith('.jpg') || path.endsWith('.jpeg') || path.endsWith('.svg') || path.endsWith('.ico')) {
        res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hours cache
      }
    }
  }));

  return httpServer;
}
