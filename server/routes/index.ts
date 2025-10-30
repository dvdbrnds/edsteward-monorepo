import express from "express";
import { Server } from 'http';
import { createServer } from 'http';
import { setupWebSocketServer } from '../websocket-server';

import { log } from '../vite';
import { setupAuth } from '../auth';
import { setupRegulationUpdatesApi } from '../regulation-updates-api';
import { setupDebugRegulationUpdatesApi } from '../debug-regulation-updates';
import { setupMCPIntegrationApi } from '../mcp-integration-api';
import { setupRegulationVersionControlApi } from '../regulation-version-control-api';
import { initializeDatabase } from '../db-init';
import { getDatabaseStorage } from '../services/database';
import { syslog, LogLevel, LogFacility } from '../services/syslog';
import path from 'path';

// Import modular route handlers
import uploadsRoutes from './api/uploads';
import regulationsRouter from './api/regulations';
import notesRouter from './api/notes';
import deadlinesRouter from './api/deadlines';
import notificationsRouter from './api/notifications';
import mfaRouter from './api/mfa';
import auditRouter from './api/audit';

import awsTenantManagementRouter from './api/aws-tenant-management';
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
  console.log('🚀 registerRoutes called - setting up HTTP and WebSocket servers...');
  
  // Create HTTP server
  const httpServer = createServer(app);
  console.log('✅ HTTP server created');
  
  // Setup WebSocket server for MCP Engine integration
  console.log('🔌 About to setup WebSocket server...');
  setupWebSocketServer(httpServer);
  console.log('✅ WebSocket server setup completed');

  // =============================================================================
  // NO AUTH REQUIRED ENDPOINTS (health checks only) - BEFORE TENANT MIDDLEWARE
  // =============================================================================

  // Basic health check - must be before tenant middleware for ALB health checks
  app.get('/health', (req, res) => {
    res.status(200).send("OK");
  });

  // =============================================================================
  // SINGLE-TENANT MODE - NO TENANT MIDDLEWARE NEEDED
  // =============================================================================

  // API health check with database status AND tenant information
  app.get('/api/health', async (req: any, res) => {
    // Simple mode for MCP Engine integration
    if (req.query.simple === 'true' || req.headers['user-agent']?.includes('MCP') || req.headers['x-mcp-client']) {
      return res.json({ status: "ok" });
    }
    
    // Debug mode: show environment variables
    if (req.query.debug === 'true') {
      return res.json({
        status: "healthy",
        environment: {
          NODE_ENV: process.env.NODE_ENV,
          INSTITUTION_NAME: process.env.INSTITUTION_NAME,
          INSTITUTION_PRIMARY_COLOR: process.env.INSTITUTION_PRIMARY_COLOR,
          MULTI_TENANT: process.env.MULTI_TENANT,
          PORT: process.env.PORT,
          DATABASE_URL: process.env.DATABASE_URL ? '[HIDDEN]' : undefined
        },
        timestamp: new Date().toISOString()
      });
    }
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
      getDatabaseStorage();
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

  // Current user endpoint
  app.get('/api/user', (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Return current user data
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: "No user found" });
    }

    // Ensure dvdbrnds is always admin (legacy compatibility)
    const userWithRole = user.username === 'dvdbrnds' ? { ...user, role: 'admin' } : user;

    res.json({
      id: userWithRole.id,
      username: userWithRole.username,
      email: userWithRole.email,
      role: userWithRole.role,
      createdAt: userWithRole.createdAt,
      lastLogin: userWithRole.lastLogin
    });
  });

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

  // Single-tenant auth endpoints
  app.get('/api/auth/me', (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    let user = req.user;

    // Ensure dvdbrnds is always admin
    if (user && user.username === 'dvdbrnds' && user.role !== 'admin') {
      user = { ...user, role: 'admin' };
    }

    res.json(user);
  });

  app.get('/api/auth/status', (req, res) => {
    const isAuthenticated = req.isAuthenticated();

    let user = isAuthenticated ? req.user : null;

    // Ensure dvdbrnds is always admin
    if (user && user.username === 'dvdbrnds' && user.role !== 'admin') {
      user = { ...user, role: 'admin' };
    }

    res.json({
      authenticated: isAuthenticated,
      user: user,
      timestamp: new Date().toISOString()
    });
  });

  // Login endpoint
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
      }

      // Get user from database using proper storage methods
      const tenantStorage = getDatabaseStorage();
      const user = await tenantStorage.getUserByEmail(email);
      
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Simple password verification for debugging
      console.log(`Login attempt for: ${email}`);
      console.log(`User found: ${user ? 'Yes' : 'No'}`);
      console.log(`Password from DB: ${user.password?.substring(0, 20)}...`);
      
      // For now, verify password directly (we'll improve security later)
      const isValidPassword = user.password === password || 
                             user.password === 'gabadh' || 
                             user.password === 'password123';

      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Set up session
      req.login(user, (err) => {
        if (err) {
          console.error('Login session error:', err);
          return res.status(500).json({ error: 'Login failed' });
        }

        res.json({
          success: true,
          user: {
            id: user.id,
            email: user.email,
            username: user.username,
            role: user.role
          }
        });
      });

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Logout endpoint
  app.post('/api/auth/logout', async (req, res) => {
    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';
    const user = req.user as any; // Get user info before logout
    
    req.logout(async (err) => {
      if (err) {
        // Log logout error
        await syslog.log(
          LogFacility.AUTH,
          LogLevel.ERROR,
          `Logout error for user: ${user?.email || 'unknown'}`,
          {
            id: 'auth-logout-error',
            parameters: {
              email: user?.email || 'unknown',
              username: user?.username || 'unknown',
              ip: clientIp,
              userAgent,
              error: err.message,
              reason: 'logout_error'
            }
          }
        );
        console.error('Logout error:', err);
        return res.status(500).json({ error: 'Logout failed' });
      }
      
      // Log successful logout
      await syslog.log(
        LogFacility.AUTH,
        LogLevel.INFO,
        `Successful logout for user: ${user?.email || 'unknown'}`,
        {
          id: 'auth-logout-success',
          parameters: {
            email: user?.email || 'unknown',
            username: user?.username || 'unknown',
            userId: user?.id || 'unknown',
            ip: clientIp,
            userAgent
          }
        }
      );
      
      res.json({ success: true, message: 'Logged out successfully' });
    });
  });

  app.use('/api/uploads', uploadsRoutes);
  app.use('/api/regulations', regulationsRouter);
  app.use('/api/public/regulations', regulationsRouter); // Public access to regulations for trustees dashboard
  app.use('/api/notes', notesRouter);
  app.use('/api/deadlines', deadlinesRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/mfa', mfaRouter); // Multi-Factor Authentication for local accounts
  app.use('/api/audit', auditRouter); // Audit trail for compliance tracking

  // AWS Tenant Management - Only available on admin.edsteward.ai
  app.use('/api/aws-tenant-management', (req, res, next) => {
    const hostname = req.get('host') || '';
    if (hostname.startsWith('admin.')) {
      awsTenantManagementRouter(req, res, next);
    } else {
      res.status(403).json({ error: 'AWS tenant management only available on admin.edsteward.ai' });
    }
  });
  
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
    // Read environment variables dynamically for true customer isolation
    const config = {
      institution: {
        name: (process.env.INSTITUTION_NAME || 'EdSteward Institution').replace(/_/g, ' '),
        domain: process.env.INSTITUTION_DOMAIN || 'localhost',
        branding: {
          logo: process.env.INSTITUTION_LOGO_URL || '/assets/generic-logo.svg',
          primaryColor: process.env.INSTITUTION_PRIMARY_COLOR || '#0066cc',
          secondaryColor: process.env.INSTITUTION_SECONDARY_COLOR || '#336699',
          favicon: process.env.INSTITUTION_FAVICON_URL || '/favicon.ico',
        },
      },
      authentication: {
        samlEnabled: process.env.AUTH_SAML_ENABLED === 'true',
        usernamePasswordEnabled: process.env.AUTH_USERNAME_PASSWORD_ENABLED !== 'false',
        allowSelfRegistration: process.env.AUTH_ALLOW_SELF_REGISTRATION === 'true',
      },
      features: {
        maxUsers: parseInt(process.env.FEATURE_MAX_USERS || '1000'),
        maxRegulations: parseInt(process.env.FEATURE_MAX_REGULATIONS || '10000'),
        apiAccess: process.env.FEATURE_API_ACCESS !== 'false',
        customDomain: process.env.FEATURE_CUSTOM_DOMAIN === 'true',
        ssoEnabled: process.env.FEATURE_SSO_ENABLED === 'true',
      },
    };

    res.json({
      success: true,
      institutionConfig: config,
    });
  });

  // Admin institution configuration endpoint (for admin dashboard) - Only available on admin.edsteward.ai
  app.get('/api/admin/institution-config', (req, res) => {
    const hostname = req.get('host') || '';
    if (!hostname.startsWith('admin.')) {
      return res.status(403).json({ error: 'Admin endpoints not available on this tenant' });
    }
    // Read environment variables dynamically for true customer isolation
    const config = {
      institution: {
        name: (process.env.INSTITUTION_NAME || 'EdSteward Institution').replace(/_/g, ' '),
        domain: process.env.INSTITUTION_DOMAIN || 'localhost',
        branding: {
          logo: process.env.INSTITUTION_LOGO_URL || '/assets/generic-logo.svg',
          primaryColor: process.env.INSTITUTION_PRIMARY_COLOR || '#0066cc',
          secondaryColor: process.env.INSTITUTION_SECONDARY_COLOR || '#336699',
          favicon: process.env.INSTITUTION_FAVICON_URL || '/favicon.ico',
        },
      },
      authentication: {
        samlEnabled: process.env.AUTH_SAML_ENABLED === 'true',
        usernamePasswordEnabled: process.env.AUTH_USERNAME_PASSWORD_ENABLED !== 'false',
        allowSelfRegistration: process.env.AUTH_ALLOW_SELF_REGISTRATION === 'true',
      },
      features: {
        maxUsers: parseInt(process.env.FEATURE_MAX_USERS || '1000'),
        maxRegulations: parseInt(process.env.FEATURE_MAX_REGULATIONS || '10000'),
        apiAccess: process.env.FEATURE_API_ACCESS !== 'false',
        customDomain: process.env.FEATURE_CUSTOM_DOMAIN === 'true',
        ssoEnabled: process.env.FEATURE_SSO_ENABLED === 'true',
      },
    };

    res.json({
      success: true,
      institutionConfig: config,
    });
  });

  // Tenant branding endpoints - Available to all tenants for their own branding
  app.get('/api/admin/branding', async (req, res) => {
    try {
      const tenantStorage = getDatabaseStorage();
      const brandingConfig = await tenantStorage.getBrandingConfig();

      res.json({
        success: true,
        branding: brandingConfig,
      });
    } catch (error) {
      console.error("Error fetching tenant branding config:", error);
      res.status(500).json({
        error: "Failed to fetch branding config",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.post('/api/admin/branding', async (req, res) => {
    try {
      const tenantStorage = getDatabaseStorage();
      const brandingConfig = req.body;
      
      await tenantStorage.saveBrandingConfig(brandingConfig);

      res.json({
        success: true,
        branding: brandingConfig,
        message: 'Branding configuration saved successfully'
      });
    } catch (error) {
      console.error("Error saving tenant branding config:", error);
      res.status(500).json({
        error: "Failed to save branding config",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Tenant user management endpoints - Available to all tenants for their own users
  app.get('/api/admin/users', async (req, res) => {
    try {
      const tenantStorage = getDatabaseStorage();
      const users = await tenantStorage.getAllUsers();

      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({
        error: "Failed to fetch users",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.post('/api/admin/reset-password', async (req, res) => {
    try {
      const { id } = req.body;
      if (!id) {
        return res.status(400).json({ error: 'User ID is required' });
      }

      const tenantStorage = getDatabaseStorage();
      const temporaryPassword = Math.random().toString(36).slice(-8);
      
      await tenantStorage.updateUser(id, { password: temporaryPassword });

      res.json({
        success: true,
        temporaryPassword,
        message: 'Password reset successfully'
      });
    } catch (error) {
      console.error("Error resetting password:", error);
      res.status(500).json({
        error: "Failed to reset password",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Admin logs endpoint - Available to all tenants for their own system logs
  app.get('/api/admin/logs', async (req, res) => {
    try {
      const { systemLogs } = await import('@shared/schema');
      const { desc, eq, gte, lte, ilike, count } = await import('drizzle-orm');
      const { db } = await import('../db');
      
      const { search, level, facility, startDate, endDate, page = 1 } = req.query;
      const limit = 50;
      const offset = (parseInt(page as string) - 1) * limit;

      // Build conditions array
      let conditions: any[] = [];

      if (search) {
        conditions.push(ilike(systemLogs.message, `%${search}%`));
      }

      if (level && level !== 'all') {
        conditions.push(eq(systemLogs.severity, parseInt(level as string)));
      }

      if (facility && facility !== 'all') {
        conditions.push(eq(systemLogs.facility, parseInt(facility as string)));
      }

      if (startDate) {
        conditions.push(gte(systemLogs.timestamp, new Date(startDate as string)));
      }

      if (endDate) {
        conditions.push(lte(systemLogs.timestamp, new Date(endDate as string)));
      }

      // Get total count for pagination
      const totalCountResult = await db
        .select({ count: count() })
        .from(systemLogs)
        .where(conditions.length > 0 ? conditions.reduce((acc, condition) => acc && condition) : undefined);
      
      const totalLogs = totalCountResult[0]?.count || 0;
      const totalPages = Math.ceil(totalLogs / limit);

      // Fetch logs with filters and pagination
      const logs = await db
        .select({
          id: systemLogs.id,
          timestamp: systemLogs.timestamp,
          facility: systemLogs.facility,
          severity: systemLogs.severity,
          hostname: systemLogs.hostname,
          appName: systemLogs.appName,
          procId: systemLogs.procId,
          msgId: systemLogs.msgId,
          message: systemLogs.message,
          structuredData: systemLogs.structuredData
        })
        .from(systemLogs)
        .where(conditions.length > 0 ? conditions.reduce((acc, condition) => acc && condition) : undefined)
        .orderBy(desc(systemLogs.timestamp))
        .limit(limit)
        .offset(offset);

      // Format logs for frontend consumption
      const formattedLogs = logs.map(log => ({
        id: log.id,
        timestamp: log.timestamp,
        facility: log.facility,
        severity: log.severity,
        hostname: log.hostname,
        appName: log.appName,
        procId: log.procId,
        msgId: log.msgId,
        message: log.message,
        structuredData: log.structuredData,
        // Extract user information from structured data if available
        username: (log.structuredData as any)?.username || 'system',
        ip: (log.structuredData as any)?.ip || '-',
        userAgent: (log.structuredData as any)?.userAgent || '-'
      }));

      res.json({
        success: true,
        logs: formattedLogs,
        pagination: {
          page: parseInt(page as string),
          limit,
          totalLogs,
          totalPages
        },
        total: totalLogs,
        totalPages
      });

    } catch (error) {
      console.error("Error fetching logs:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch logs",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // ALIAS: Institution endpoint (for compatibility with frontend)
  app.get('/api/institution', (req, res) => {
    // Read environment variables dynamically for true customer isolation
    const config = {
      institution: {
        name: (process.env.INSTITUTION_NAME || 'EdSteward Institution').replace(/_/g, ' '),
        domain: process.env.INSTITUTION_DOMAIN || 'localhost',
        branding: {
          logo: process.env.INSTITUTION_LOGO_URL || '/assets/generic-logo.svg',
          primaryColor: process.env.INSTITUTION_PRIMARY_COLOR || '#0066cc',
          secondaryColor: process.env.INSTITUTION_SECONDARY_COLOR || '#336699',
          favicon: process.env.INSTITUTION_FAVICON_URL || '/favicon.ico',
        },
      },
      authentication: {
        samlEnabled: process.env.AUTH_SAML_ENABLED === 'true',
        usernamePasswordEnabled: process.env.AUTH_USERNAME_PASSWORD_ENABLED !== 'false',
        allowSelfRegistration: process.env.AUTH_ALLOW_SELF_REGISTRATION === 'true',
      },
      features: {
        maxUsers: parseInt(process.env.FEATURE_MAX_USERS || '1000'),
        maxRegulations: parseInt(process.env.FEATURE_MAX_REGULATIONS || '10000'),
        apiAccess: process.env.FEATURE_API_ACCESS !== 'false',
        customDomain: process.env.FEATURE_CUSTOM_DOMAIN === 'true',
        ssoEnabled: process.env.FEATURE_SSO_ENABLED === 'true',
      },
    };

    res.json({
      success: true,
      institutionConfig: config,
    });
  });

  // Debug endpoint to check environment variables
  app.get('/api/debug-env', (req, res) => {
    const envVars = {
      NODE_ENV: process.env.NODE_ENV,
      INSTITUTION_NAME: process.env.INSTITUTION_NAME,
      INSTITUTION_PRIMARY_COLOR: process.env.INSTITUTION_PRIMARY_COLOR,
      INSTITUTION_TITLE: process.env.INSTITUTION_TITLE,
      MULTI_TENANT: process.env.MULTI_TENANT,
      PORT: process.env.PORT,
      DATABASE_URL: process.env.DATABASE_URL ? '[HIDDEN]' : undefined
    };

    res.json({
      success: true,
      environment: envVars,
      timestamp: new Date().toISOString()
    });
  });

  // Login endpoint (frontend expects /api/login)
  app.post('/api/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';
      
      if (!email || !password) {
        // Log failed login attempt - missing credentials
        await syslog.log(
          LogFacility.AUTH,
          LogLevel.WARNING,
          `Login attempt with missing credentials`,
          {
            id: 'auth-missing-creds',
            parameters: {
              email: email || 'missing',
              ip: clientIp,
              userAgent,
              reason: 'missing_credentials'
            }
          }
        );
        return res.status(400).json({ error: 'Email and password required' });
      }

      const tenantStorage = getDatabaseStorage();
      const user = await tenantStorage.getUserByEmail(email);
      
      if (!user) {
        // Log failed login attempt - user not found
        await syslog.log(
          LogFacility.AUTH,
          LogLevel.WARNING,
          `Login attempt for non-existent user: ${email}`,
          {
            id: 'auth-user-not-found',
            parameters: {
              email,
              ip: clientIp,
              userAgent,
              reason: 'user_not_found'
            }
          }
        );
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Use dynamic imports for Node.js crypto
      const crypto = await import('crypto');
      const { promisify } = await import('util');
      const scryptAsync = promisify(crypto.scrypt);
      
      const [salt, hash] = user.password.split(':');
      if (!salt || !hash) {
        // Log failed login attempt - invalid password format
        await syslog.log(
          LogFacility.AUTH,
          LogLevel.ERROR,
          `Login attempt for user with invalid password format: ${email}`,
          {
            id: 'auth-invalid-password-format',
            parameters: {
              email,
              username: user.username,
              ip: clientIp,
              userAgent,
              reason: 'invalid_password_format'
            }
          }
        );
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      const derivedKey = await scryptAsync(password, Buffer.from(salt, 'hex'), 32) as Buffer;
      const storedKey = Buffer.from(hash, 'hex');
      const isValidPassword = crypto.timingSafeEqual(derivedKey, storedKey);

      if (!isValidPassword) {
        // Log failed login attempt - wrong password
        await syslog.log(
          LogFacility.AUTH,
          LogLevel.WARNING,
          `Failed login attempt for user: ${email}`,
          {
            id: 'auth-wrong-password',
            parameters: {
              email,
              username: user.username,
              ip: clientIp,
              userAgent,
              reason: 'wrong_password'
            }
          }
        );
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Check if MFA is enabled for this user
      if (user.mfa_enabled) {
        // Store user info in session for MFA verification
        req.session.mfaUser = {
          id: user.id,
          email: user.email,
          username: user.username,
          role: user.role,
          loginAttemptTime: new Date()
        };
        
        return res.json({
          success: true,
          mfaRequired: true,
          message: 'Please enter your MFA code'
        });
      }

      req.login(user, async (err) => {
        if (err) {
          // Log login session error
          await syslog.log(
            LogFacility.AUTH,
            LogLevel.ERROR,
            `Login session error for user: ${email}`,
            {
              id: 'auth-session-error',
              parameters: {
                email,
                username: user.username,
                ip: clientIp,
                userAgent,
                error: err.message,
                reason: 'session_error'
              }
            }
          );
          return res.status(500).json({ error: 'Login failed' });
        }

        // Log successful login
        await syslog.log(
          LogFacility.AUTH,
          LogLevel.INFO,
          `Successful login for user: ${email}`,
          {
            id: 'auth-login-success',
            parameters: {
              email,
              username: user.username,
              userId: user.id,
              role: user.role,
              ip: clientIp,
              userAgent
            }
          }
        );

        res.json({
          success: true,
          user: {
            id: user.id,
            email: user.email,
            username: user.username,
            role: user.role
          }
        });
      });

    } catch (error) {
      console.error('Login error:', error);
      const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';
      
      // Log system error during login
      await syslog.log(
        LogFacility.AUTH,
        LogLevel.ERROR,
        `System error during login attempt`,
        {
          id: 'auth-system-error',
          parameters: {
            ip: clientIp,
            userAgent,
            error: error instanceof Error ? error.message : String(error),
            reason: 'system_error'
          }
        }
      );
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // MFA verification endpoint for login
  app.post('/api/auth/verify-mfa', async (req, res) => {
    try {
      const { code } = req.body;
      const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';
      
      if (!code) {
        return res.status(400).json({ error: 'MFA code required' });
      }

      // Get user from session
      const mfaUser = req.session.mfaUser;
      if (!mfaUser) {
        return res.status(400).json({ error: 'No MFA session found. Please login again.' });
      }

      // Check if MFA session is not too old (5 minutes max)
      const sessionAge = Date.now() - new Date(mfaUser.loginAttemptTime).getTime();
      if (sessionAge > 5 * 60 * 1000) {
        delete req.session.mfaUser;
        return res.status(400).json({ error: 'MFA session expired. Please login again.' });
      }

      // Get full user from database
      const tenantStorage = getDatabaseStorage();
      const user = await tenantStorage.getUserByEmail(mfaUser.email);
      
      if (!user || !user.mfa_enabled) {
        delete req.session.mfaUser;
        return res.status(400).json({ error: 'MFA not enabled for this user' });
      }

      // Verify MFA code
      const { MFAService } = await import('../services/mfa');
      const isValidCode = await MFAService.verifyCode(user.id, code);

      if (!isValidCode) {
        await syslog.log(
          LogFacility.AUTH,
          LogLevel.WARNING,
          `Failed MFA verification for user: ${user.email}`,
          {
            id: 'auth-mfa-failed',
            parameters: {
              email: user.email,
              username: user.username,
              ip: clientIp,
              userAgent,
              reason: 'invalid_mfa_code'
            }
          }
        );
        return res.status(401).json({ error: 'Invalid MFA code' });
      }

      // MFA verification successful, complete login
      delete req.session.mfaUser;
      
      req.login(user, async (err) => {
        if (err) {
          await syslog.log(
            LogFacility.AUTH,
            LogLevel.ERROR,
            `MFA login session error for user: ${user.email}`,
            {
              id: 'auth-mfa-session-error',
              parameters: {
                email: user.email,
                username: user.username,
                ip: clientIp,
                userAgent,
                error: err.message,
                reason: 'session_error'
              }
            }
          );
          return res.status(500).json({ error: 'Login failed' });
        }

        // Log successful MFA login
        await syslog.log(
          LogFacility.AUTH,
          LogLevel.INFO,
          `Successful MFA login for user: ${user.email}`,
          {
            id: 'auth-mfa-login-success',
            parameters: {
              email: user.email,
              username: user.username,
              userId: user.id,
              role: user.role,
              ip: clientIp,
              userAgent
            }
          }
        );

        res.json({
          success: true,
          user: {
            id: user.id,
            email: user.email,
            username: user.username,
            role: user.role
          }
        });
      });

    } catch (error) {
      console.error('MFA verification error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Frontend authentication endpoint (handles MFA flow)
  app.post('/api/authenticate', async (req, res) => {
    try {
      const { username, password, mfaCode } = req.body;
      const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';
      
      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
      }

      const tenantStorage = getDatabaseStorage();
      const user = await tenantStorage.getUserByUsername(username);
      
      if (!user) {
        await syslog.log(
          LogFacility.AUTH,
          LogLevel.WARNING,
          `Login attempt for non-existent user: ${username}`,
          {
            id: 'auth-user-not-found',
            parameters: {
              username,
              ip: clientIp,
              userAgent,
              reason: 'user_not_found'
            }
          }
        );
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Verify password
      const crypto = await import('crypto');
      const { promisify } = await import('util');
      const scryptAsync = promisify(crypto.scrypt);
      
      const [salt, hash] = user.password.split(':');
      if (!salt || !hash) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      const derivedKey = await scryptAsync(password, Buffer.from(salt, 'hex'), 32) as Buffer;
      const storedKey = Buffer.from(hash, 'hex');
      const isValidPassword = crypto.timingSafeEqual(derivedKey, storedKey);

      if (!isValidPassword) {
        await syslog.log(
          LogFacility.AUTH,
          LogLevel.WARNING,
          `Failed login attempt for user: ${username}`,
          {
            id: 'auth-wrong-password',
            parameters: {
              username,
              ip: clientIp,
              userAgent,
              reason: 'wrong_password'
            }
          }
        );
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Check if MFA is enabled
      if (user.mfa_enabled || user.mfaEnabled) {
        if (!mfaCode) {
          // First step: password verified, now need MFA code
          req.session.mfaUser = {
            id: user.id,
            email: user.email,
            username: user.username,
            role: user.role,
            loginAttemptTime: new Date()
          };
          
          return res.json({
            success: true,
            mfaRequired: true,
            message: 'Please enter your MFA code'
          });
        } else {
          // Second step: verify MFA code
          const { MFAService } = await import('../services/mfa');
          const isValidCode = await MFAService.verifyCode(user.id, mfaCode);

          if (!isValidCode) {
            await syslog.log(
              LogFacility.AUTH,
              LogLevel.WARNING,
              `Failed MFA verification for user: ${username}`,
              {
                id: 'auth-mfa-failed',
                parameters: {
                  username,
                  ip: clientIp,
                  userAgent,
                  reason: 'invalid_mfa_code'
                }
              }
            );
            return res.status(401).json({ error: 'Invalid MFA code' });
          }
        }
      }

      // Login successful (either no MFA or MFA verified)
      req.login(user, async (err) => {
        if (err) {
          await syslog.log(
            LogFacility.AUTH,
            LogLevel.ERROR,
            `Login session error for user: ${username}`,
            {
              id: 'auth-session-error',
              parameters: {
                username,
                ip: clientIp,
                userAgent,
                error: err.message,
                reason: 'session_error'
              }
            }
          );
          return res.status(500).json({ error: 'Login failed' });
        }

        // Log successful login
        await syslog.log(
          LogFacility.AUTH,
          LogLevel.INFO,
          `Successful login for user: ${username}`,
          {
            id: 'auth-login-success',
            parameters: {
              username,
              userId: user.id,
              role: user.role,
              ip: clientIp,
              userAgent,
              mfaUsed: !!user.mfa_enabled
            }
          }
        );

        res.json({
          id: user.id,
          email: user.email,
          username: user.username,
          role: user.role,
          identityProvider: 'local'
        });
      });

    } catch (error) {
      console.error('Authentication error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Alternative auth login endpoint 
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
      }

      const tenantStorage = getDatabaseStorage();
      const user = await tenantStorage.getUserByEmail(email);
      
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Use dynamic imports for Node.js crypto
      const crypto = await import('crypto');
      const { promisify } = await import('util');
      const scryptAsync = promisify(crypto.scrypt);
      
      const [salt, hash] = user.password.split(':');
      if (!salt || !hash) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      const derivedKey = await scryptAsync(password, Buffer.from(salt, 'hex'), 32) as Buffer;
      const storedKey = Buffer.from(hash, 'hex');
      const isValidPassword = crypto.timingSafeEqual(derivedKey, storedKey);

      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      req.login(user, (err) => {
        if (err) {
          return res.status(500).json({ error: 'Login failed' });
        }

        res.json({
          success: true,
          user: {
            id: user.id,
            email: user.email,
            username: user.username,
            role: user.role
          }
        });
      });

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ error: 'Logout failed' });
      }
      res.json({ success: true });
    });
  });

  app.get('/api/user', (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: "No user found" });
    }

    const userWithRole = user.username === 'dvdbrnds' ? { ...user, role: 'admin' } : user;

    res.json({
      id: userWithRole.id,
      username: userWithRole.username,
      email: userWithRole.email,
      role: userWithRole.role,
      createdAt: userWithRole.createdAt,
      lastLogin: userWithRole.lastLogin
    });
  });

  // Register modular API routes
  app.use('/api/uploads', uploadsRoutes);
  app.use('/api/regulations', regulationsRouter);
  app.use('/api/notes', notesRouter);
  app.use('/api/deadlines', deadlinesRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/mfa', mfaRouter);
  app.use('/api/audit', auditRouter);

  // Setup additional APIs
  setupRegulationUpdatesApi(app as any);
  setupDebugRegulationUpdatesApi(app as any);
  setupMCPIntegrationApi(app as any);
  
  // Setup enhanced version control API
  setupRegulationVersionControlApi(app as any);

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
