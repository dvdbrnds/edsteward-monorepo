import express, { Request, Response } from "express";
import { Server } from 'http';
import { createServer } from 'http';
import { setupWebSocketServer } from '../websocket-server';
import { desc, sql, gte } from 'drizzle-orm';
import { users } from '../../shared/schema';
import { getDbForRequest } from '../services/database';
import { requireAuth, requireAdmin } from '../middleware/role-based-auth';

import { log } from '../vite';
import { setupAuth } from '../auth';
import { setupRegulationUpdatesApi } from '../regulation-updates-api';
// Debug regulation updates API removed - was for development only
import { setupMCPIntegrationApi } from '../mcp-integration-api';
import { setupRegulationVersionControlApi } from '../regulation-version-control-api';
import { initializeDatabase } from '../db-init';
import { getDatabaseStorage } from '../services/database';
import { syslog, LogLevel, LogFacility } from '../services/syslog';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const APP_ROOT = path.resolve(__dirname, '../..');

// Import modular route handlers
import uploadsRoutes from './api/uploads';
import regulationsRouter from './api/regulations';
import notesRouter from './api/notes';
import backupsRouter from './api/backups';
import { initializeBackupScheduler } from '../services/backup-service';
import deadlinesRouter from './api/deadlines';
import notificationsRouter from './api/notifications';
import notificationHistoryRouter from './api/notification-history';
import regulationNotificationsRouter from './api/regulation-notifications';
import usersRouter from './api/users';
import mfaRouter from './api/mfa';
import auditRouter from './api/audit';
import legalExportRouter from './api/legal-export';
import dataRetentionRouter from './api/data-retention';

// Note: aws-tenant-management was removed - belongs in separate admin-console app
import { debugRouter } from './api/debug';
// emergency-moravian-fix endpoint removed — no longer needed
import attestationRouter from './api/attestation';
import complianceTasksRouter from './api/compliance-tasks';
import roleAssignmentsRouter from './api/role-assignments';
import dashboardAnalyticsRouter from './api/dashboard-analytics';
import reportsRouter from './api/reports';
import executiveOrdersRouter from './api/executive-orders';
import circuitInterpretationsRouter from './api/circuit-interpretations';
import complianceRouter from './api/compliance';
import featureFlagsRouter from './api/feature-flags';
import dataExportRouter from './api/data-export';
import demoRequestsRouter from './api/demo-requests';
// database-migration endpoint removed — destructive, hardcoded auth key

// Extend session interface for testing
declare module 'express-session' {
  interface SessionData {
    testValue?: string;
  }
}

export function registerRoutes(app: express.Application): Server {
  
  // Create HTTP server
  const httpServer = createServer(app);
  
  // Setup WebSocket server for MCP Engine integration
  setupWebSocketServer(httpServer);

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

      // Determine tenant detection method
      const isMultiTenant = process.env.MULTI_TENANT === 'true';
      const detectionMethod = req.tenant ? 
        (req.tenantContext?.detectionMethod || 'subdomain') : 
        (isMultiTenant ? 'not-detected' : 'single-tenant');

      const effectiveStatus = healthStatus.warming
        ? "warming_up"
        : dbHealthy ? "healthy" : "degraded";

      const response = {
        status: effectiveStatus,
        timestamp: new Date().toISOString(),
        server: "running",
        multiTenant: isMultiTenant,
        database: {
          connected: dbHealthy,
          monitoring: healthStatus.isMonitoring,
          consecutiveFailures: healthStatus.consecutiveFailures,
          maxFailures: healthStatus.maxFailures,
          warming: healthStatus.warming,
        },
        tenant: {
          detected: !!req.tenant,
          tenantId: req.tenantId || null,
          tenantName: req.tenant?.name || null,
          subdomain: req.tenant?.subdomain || null,
          domain: req.get('host') || null,
          detectionMethod: detectionMethod,
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
      getDatabaseStorage(req.tenantId);
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
      // Use tenant-aware storage for proper isolation
      const tenantStorage = getDatabaseStorage(req.tenantId);
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

  // Serve branding assets from the database (public, no auth — needed for login page)
  app.get('/api/branding/:assetType(logo|favicon)', async (req, res) => {
    try {
      const tenantStorage = getDatabaseStorage(req.tenantId);
      const asset = await tenantStorage.getBrandingAsset(req.params.assetType);
      if (!asset) {
        return res.status(404).send();
      }
      res.set('Content-Type', asset.mimeType);
      res.set('Cache-Control', 'public, max-age=86400');
      res.send(asset.data);
    } catch {
      res.status(404).send();
    }
  });

  // Serve uploaded files from the database (authenticated)
  app.get('/api/files/:fileKey', async (req: any, res) => {
    try {
      const tenantStorage = getDatabaseStorage(req.tenantId);
      const file = await tenantStorage.getFile(req.params.fileKey);
      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }
      res.set('Content-Type', file.mimeType);
      res.set('Content-Disposition', `inline; filename="${file.filename}"`);
      res.set('Cache-Control', 'private, max-age=3600');
      res.send(file.data);
    } catch {
      res.status(404).json({ error: 'File not found' });
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

    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin
    });
  });


  // Setup status for frontend navigation (requires auth)
  app.get('/api/setup/status', async (req, res) => {
    try {
      if (!req.isAuthenticated || !req.isAuthenticated()) {
        return res.status(401).json({ error: "Authentication required" });
      }

      // Single-tenant storage - always use main database
      const tenantStorage = getDatabaseStorage(req.tenantId);

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

    res.json(req.user);
  });

  app.get('/api/auth/status', (req, res) => {
    const isAuthenticated = req.isAuthenticated();

    res.json({
      authenticated: isAuthenticated,
      user: isAuthenticated ? req.user : null,
      timestamp: new Date().toISOString()
    });
  });

  // Login endpoint - REMOVED duplicate with plaintext password comparison
  // The proper scrypt-based login is defined later in this file

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
  app.use('/api/backups', backupsRouter);
  app.use('/api/regulations', regulationsRouter);
  app.use('/api/public/regulations', regulationsRouter); // Public access to regulations for trustees dashboard
  app.use('/api/notes', notesRouter);
  app.use('/api/deadlines', deadlinesRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/notification-history', notificationHistoryRouter);
  app.use('/api/regulation-notifications', regulationNotificationsRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/mfa', mfaRouter); // Multi-Factor Authentication for local accounts
  app.use('/api/audit', auditRouter); // Audit trail for compliance tracking
  app.use('/api/legal-export', legalExportRouter); // Legal discovery/subpoena export
  app.use('/api/admin/data-retention', dataRetentionRouter); // HECVAT data retention compliance
  app.use('/api/attestation', attestationRouter); // Email attestation for low-risk regulations
  app.use('/api/compliance-tasks', complianceTasksRouter); // Complex regulation task management
  app.use('/api/role-assignments', roleAssignmentsRouter); // Role-to-person mapping for auto-assignment
  app.use('/api/dashboard-analytics', dashboardAnalyticsRouter); // Executive dashboard analytics
  app.use('/api/reports', reportsRouter); // Compliance reports and exports
  app.use('/api/executive-orders', executiveOrdersRouter); // Executive Order tracking (MCP Engine Jan 2026)
  app.use('/api/circuit-interpretations', circuitInterpretationsRouter); // Federal circuit court interpretations (Mar 2026)
  app.use('/api/compliance', complianceRouter); // HECVAT compliance reports for tenants
  app.use('/api/feature-flags', featureFlagsRouter); // Feature flag management
  app.use('/api/my-data', dataExportRouter); // Self-service data export (HECVAT PRIV-03)
  app.use('/api/demo-requests', demoRequestsRouter); // Public demo request form from edsteward.com

  // Active users — check who's online before deploying
  app.get('/api/admin/active-users', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const db = getDbForRequest(req);
      const minutes = parseInt(req.query.minutes as string) || 15;
      const cutoff = new Date(Date.now() - minutes * 60 * 1000);

      const activeUsers = await db.select({
        id: users.id,
        username: users.username,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        role: users.role,
        lastActiveAt: users.lastActiveAt,
        lastLogin: users.lastLogin,
      })
      .from(users)
      .where(gte(users.lastActiveAt, cutoff))
      .orderBy(desc(users.lastActiveAt));

      const allRecent = await db.select({
        id: users.id,
        username: users.username,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
        lastActiveAt: users.lastActiveAt,
      })
      .from(users)
      .where(sql`${users.lastActiveAt} IS NOT NULL`)
      .orderBy(desc(users.lastActiveAt))
      .limit(20);

      res.json({
        activeNow: activeUsers,
        activeCount: activeUsers.length,
        windowMinutes: minutes,
        recentUsers: allRecent,
        checkedAt: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('Error fetching active users:', error);
      res.status(500).json({ error: 'Failed to fetch active users' });
    }
  });

  // Note: AWS Tenant Management was removed - belongs in separate admin-console app at admin.edsteward.ai
  
  // database-migration endpoint removed for security

  // Register debug routes (no auth required for debugging)
  app.use('/api/debug', debugRouter);

  // Emergency endpoint removed — multi-tenant routing is stable now

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
    // Allow localhost for development
    if (!hostname.startsWith('admin.') && !hostname.startsWith('localhost')) {
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

  // Institution type configuration endpoints (persisted per-tenant)
  app.get('/api/institution-config/types', async (req, res) => {
    try {
      const tenantId = req.tenantId || 'default';
      const tenantStorage = getDatabaseStorage(req.tenantId);
      const config = await tenantStorage.getInstitutionConfig(tenantId);
      if (config) {
        res.json({
          success: true,
          config: {
            primaryType: config.primaryType,
            characteristics: config.characteristics || [],
            hideNonApplicable: config.hideNonApplicable,
            allowUsersToToggle: config.allowUsersToToggle,
          },
        });
      } else {
        // Fall back to tenant registry defaults
        const tenant = (req as any).tenant;
        const defaults = tenant?.settings?.institutionConfig;
        res.json({
          success: true,
          config: {
            primaryType: defaults?.primaryType || null,
            characteristics: defaults?.characteristics || [],
            hideNonApplicable: defaults?.hideNonApplicable ?? true,
            allowUsersToToggle: defaults?.allowUsersToToggle ?? true,
          },
        });
      }
    } catch (error) {
      console.error('Error fetching institution config:', error);
      res.status(500).json({ error: 'Failed to fetch institution configuration' });
    }
  });

  app.put('/api/institution-config/types', async (req, res) => {
    try {
      const { primaryType, characteristics, hideNonApplicable, allowUsersToToggle } = req.body;
      const tenantStorage = getDatabaseStorage(req.tenantId);
      const config = await tenantStorage.upsertInstitutionConfig({
        tenantId: req.tenantId || 'default',
        primaryType: primaryType || null,
        characteristics: characteristics || [],
        hideNonApplicable: hideNonApplicable ?? true,
        allowUsersToToggle: allowUsersToToggle ?? true,
      });
      res.json({ success: true, config });
    } catch (error) {
      console.error('Error saving institution config:', error);
      res.status(500).json({ error: 'Failed to save institution configuration' });
    }
  });

  // Tenant branding endpoints - Available to all tenants for their own branding
  app.get('/api/admin/branding', async (req, res) => {
    try {
      // Use tenant-aware storage for proper isolation
      const tenantStorage = getDatabaseStorage(req.tenantId);
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
      // Use tenant-aware storage for proper isolation
      const tenantStorage = getDatabaseStorage(req.tenantId);
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
      const tenantStorage = getDatabaseStorage(req.tenantId);
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

      const tenantStorage = getDatabaseStorage(req.tenantId);
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

  // Delete user endpoint
  app.delete('/api/admin/users/:id', async (req: any, res) => {
    try {
      // Check if user is admin
      if (!req.user || req.user.role?.toLowerCase() !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const userId = parseInt(req.params.id);
      if (isNaN(userId)) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }

      // Prevent deleting yourself
      if (req.user.id === userId) {
        return res.status(400).json({ error: 'Cannot delete your own account' });
      }

      const { users, regulations } = await import('@shared/schema');
      const { db } = await import('../db');
      const { eq } = await import('drizzle-orm');

      // Check if user is assigned as owner of any regulations
      const ownedRegs = await db.select().from(regulations).where(eq(regulations.ownerId, userId));
      if (ownedRegs.length > 0) {
        return res.status(400).json({ 
          error: `Cannot delete user - they are Primary DRI for ${ownedRegs.length} regulation(s). Reassign those first.` 
        });
      }

      // Delete the user
      await db.delete(users).where(eq(users.id, userId));

      res.json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({
        error: "Failed to delete user",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Email configuration endpoints
  app.get('/api/admin/email-config', async (req, res) => {
    try {
      const { emailConfigs } = await import('@shared/schema');
      const { db } = await import('../db');
      
      const configs = await db.select().from(emailConfigs).limit(1);
      
      if (configs.length === 0) {
        return res.json(null);
      }
      
      const config = configs[0];
      // Return config without password for security
      res.json({
        host: config.smtpHost,
        port: config.smtpPort,
        username: config.smtpUser,
        password: '********', // Mask password
        from: config.fromEmail,
        secure: config.smtpSecure
      });
    } catch (error) {
      console.error("Error fetching email config:", error);
      res.status(500).json({
        error: "Failed to fetch email configuration",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.post('/api/admin/email-config', async (req, res) => {
    try {
      const { emailConfigs } = await import('@shared/schema');
      const { db } = await import('../db');
      const { eq } = await import('drizzle-orm');
      
      const { host, port, username, password, from, secure = true } = req.body;
      
      // Validate required fields
      if (!host || !port || !username || !from) {
        return res.status(400).json({
          error: "Missing required fields: host, port, username, from"
        });
      }
      
      // Check if config exists
      const existing = await db.select().from(emailConfigs).limit(1);
      
      if (existing.length > 0) {
        // Update existing config
        const updateData: any = {
          smtpHost: host,
          smtpPort: port,
          smtpUser: username,
          fromEmail: from,
          smtpSecure: secure,
          updatedAt: new Date(),
          updatedBy: req.user?.id || 1
        };
        
        // Only update password if not masked
        if (password && password !== '********') {
          updateData.smtpPass = password;
        }
        
        await db.update(emailConfigs)
          .set(updateData)
          .where(eq(emailConfigs.id, existing[0].id));
          
        res.json({ success: true, message: "Email configuration updated" });
      } else {
        // Create new config
        if (!password || password === '********') {
          return res.status(400).json({
            error: "Password is required for new configuration"
          });
        }
        
        await db.insert(emailConfigs).values({
          smtpHost: host,
          smtpPort: port,
          smtpUser: username,
          smtpPass: password,
          fromEmail: from,
          smtpSecure: secure,
          updatedBy: req.user?.id || 1
        });
        
        res.json({ success: true, message: "Email configuration created" });
      }
    } catch (error) {
      console.error("Error saving email config:", error);
      res.status(500).json({
        error: "Failed to save email configuration",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Test email endpoint
  app.post('/api/admin/email-config/test', async (req, res) => {
    try {
      const { emailService } = await import('../services/email');
      const { to } = req.body;
      
      if (!to) {
        return res.status(400).json({ error: "Recipient email address is required" });
      }
      
      const testSubject = "🧪 EdSteward Test Email";
      const testContent = `
        <h2>✅ Email Configuration Test</h2>
        <p>This is a test email from EdSteward Compliance Management System.</p>
        <p>If you received this email, your SMTP configuration is working correctly!</p>
        <div style="background-color: #f0f9ff; border-left: 4px solid #0284c7; padding: 15px; margin: 20px 0;">
          <p><strong>Test Details:</strong></p>
          <ul>
            <li>Sent at: ${new Date().toLocaleString()}</li>
            <li>Recipient: ${to}</li>
          </ul>
        </div>
        <p style="font-size: 12px; color: #6c757d;">
          🔧 EdSteward Compliance Management System
        </p>
      `;
      
      const success = await emailService.sendEmail(to, testSubject, testContent);
      
      if (success) {
        res.json({ success: true, message: `Test email sent to ${to}` });
      } else {
        res.status(500).json({ error: "Failed to send test email. Check SMTP configuration." });
      }
    } catch (error) {
      console.error("Error sending test email:", error);
      res.status(500).json({
        error: "Failed to send test email",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Email delivery issues — bounced/failed emails from email_delivery_log
  app.get('/api/admin/email-delivery-issues', async (req, res) => {
    try {
      const { emailDeliveryLog, users: usersTable, regulations, complianceTasks } = await import('@shared/schema');
      const { desc, eq, or, sql, and, gte } = await import('drizzle-orm');
      const { db } = await import('../db');

      const { status = 'all', limit = '50', offset = '0', days = '30' } = req.query as Record<string, string>;

      const sinceDate = new Date();
      sinceDate.setDate(sinceDate.getDate() - parseInt(days));

      const conditions = [gte(emailDeliveryLog.sentAt, sinceDate)];
      if (status === 'bounced') {
        conditions.push(eq(emailDeliveryLog.status, 'bounced'));
      } else if (status === 'failed') {
        conditions.push(eq(emailDeliveryLog.status, 'failed'));
      } else {
        conditions.push(or(eq(emailDeliveryLog.status, 'bounced'), eq(emailDeliveryLog.status, 'failed'))!);
      }

      const issues = await db
        .select()
        .from(emailDeliveryLog)
        .where(and(...conditions))
        .orderBy(desc(emailDeliveryLog.sentAt))
        .limit(parseInt(limit))
        .offset(parseInt(offset));

      // Enrich with user and entity info
      const enriched = await Promise.all(issues.map(async (issue) => {
        let userName: string | null = null;
        let entityName: string | null = null;

        if (issue.recipientUserId) {
          try {
            const [user] = await db.select({ firstName: usersTable.firstName, lastName: usersTable.lastName })
              .from(usersTable).where(eq(usersTable.id, issue.recipientUserId)).limit(1);
            if (user) userName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || null;
          } catch { /* skip */ }
        }

        if (issue.relatedEntityType === 'regulation' && issue.relatedEntityId) {
          try {
            const result = await db.execute(sql`SELECT name FROM regulations WHERE id = ${issue.relatedEntityId} LIMIT 1`);
            entityName = (result.rows[0] as any)?.name || null;
          } catch { /* skip */ }
        } else if (issue.relatedEntityType === 'compliance_task' && issue.relatedEntityId) {
          try {
            const result = await db.execute(sql`SELECT title FROM compliance_tasks WHERE id = ${issue.relatedEntityId} LIMIT 1`);
            entityName = (result.rows[0] as any)?.title || null;
          } catch { /* skip */ }
        }

        return { ...issue, userName, entityName };
      }));

      // Get summary counts
      const [totalBounced] = await db.select({ count: sql<number>`count(*)` })
        .from(emailDeliveryLog)
        .where(and(eq(emailDeliveryLog.status, 'bounced'), gte(emailDeliveryLog.sentAt, sinceDate)));
      const [totalFailed] = await db.select({ count: sql<number>`count(*)` })
        .from(emailDeliveryLog)
        .where(and(eq(emailDeliveryLog.status, 'failed'), gte(emailDeliveryLog.sentAt, sinceDate)));
      const [totalDelivered] = await db.select({ count: sql<number>`count(*)` })
        .from(emailDeliveryLog)
        .where(and(eq(emailDeliveryLog.status, 'delivered'), gte(emailDeliveryLog.sentAt, sinceDate)));

      res.json({
        issues: enriched,
        summary: {
          bounced: Number(totalBounced?.count ?? 0),
          failed: Number(totalFailed?.count ?? 0),
          delivered: Number(totalDelivered?.count ?? 0),
          periodDays: parseInt(days),
        },
        total: enriched.length,
        offset: parseInt(offset),
        limit: parseInt(limit),
      });
    } catch (error) {
      console.error("Error fetching email delivery issues:", error);
      res.status(500).json({
        error: "Failed to fetch email delivery issues",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Mark delivery issue as resolved — resets user email_status to 'valid'
  app.post('/api/admin/email-delivery-issues/:id/resolve', async (req, res) => {
    try {
      const { emailDeliveryLog, users: usersTable } = await import('@shared/schema');
      const { eq } = await import('drizzle-orm');
      const { db } = await import('../db');

      const issueId = parseInt(req.params.id);
      const [issue] = await db.select().from(emailDeliveryLog).where(eq(emailDeliveryLog.id, issueId)).limit(1);

      if (!issue) {
        return res.status(404).json({ error: 'Delivery log entry not found' });
      }

      // Update log status
      await db.update(emailDeliveryLog)
        .set({ status: 'sent', statusUpdatedAt: new Date(), errorMessage: 'Manually resolved by admin' })
        .where(eq(emailDeliveryLog.id, issueId));

      // Reset user email status if they were flagged
      if (issue.recipientUserId) {
        await db.update(usersTable)
          .set({ emailStatus: 'valid', updatedAt: new Date() })
          .where(eq(usersTable.id, issue.recipientUserId));
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error resolving delivery issue:", error);
      res.status(500).json({ error: "Failed to resolve delivery issue" });
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

  // ===== TENANT REGISTRY ENDPOINTS =====
  // These endpoints allow the admin console to manage the dynamic tenant registry
  // Protected by either: (a) authenticated admin user, or (b) shared secret for service-to-service calls
  const requireRegistryAuth = (req: Request, res: Response, next: Function) => {
    const secret = req.headers['x-registry-secret'] as string;
    if (secret && secret === process.env.REGISTRY_API_SECRET) {
      return next();
    }
    if (req.isAuthenticated?.() && req.user?.role === 'admin') {
      return next();
    }
    return res.status(401).json({ error: 'Unauthorized: admin auth or registry secret required' });
  };
  
  // Get tenant registry status
  app.get('/api/admin/tenant-registry/status', requireRegistryAuth, async (req, res) => {
    try {
      const { getRegistryStats, getAllCachedTenants } = await import('../services/tenant-registry');
      const stats = getRegistryStats();
      const tenants = getAllCachedTenants();
      
      res.json({
        success: true,
        stats,
        tenantCount: tenants.length,
        tenants: tenants.map(t => ({
          id: t.id,
          name: t.name,
          subdomain: t.subdomain,
          status: t.status,
        })),
      });
    } catch (error) {
      console.error("Error getting tenant registry status:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get tenant registry status",
      });
    }
  });

  // Refresh tenant registry (called after new tenant is created)
  app.post('/api/admin/tenant-registry/refresh', requireRegistryAuth, async (req, res) => {
    try {
      const { refreshAllTenants, getRegistryStats } = await import('../services/tenant-registry');
      
      await refreshAllTenants();
      const stats = getRegistryStats();
      
      console.log('[TENANT-REGISTRY] Manual refresh triggered via API');
      
      res.json({
        success: true,
        message: 'Tenant registry refreshed successfully',
        stats,
      });
    } catch (error) {
      console.error("Error refreshing tenant registry:", error);
      res.status(500).json({
        success: false,
        error: "Failed to refresh tenant registry",
      });
    }
  });

  // Invalidate specific tenant cache (for updates)
  app.post('/api/admin/tenant-registry/invalidate/:tenantId', requireRegistryAuth, async (req, res) => {
    try {
      const { invalidateTenantCache } = await import('../services/tenant-registry');
      const { tenantId } = req.params;
      
      invalidateTenantCache(tenantId);
      
      res.json({
        success: true,
        message: `Cache invalidated for tenant: ${tenantId}`,
      });
    } catch (error) {
      console.error("Error invalidating tenant cache:", error);
      res.status(500).json({
        success: false,
        error: "Failed to invalidate tenant cache",
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

      const tenantStorage = getDatabaseStorage(req.tenantId);
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
        return res.status(401).json({ error: 'No account found with that username. Please check your username and try again.' });
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
        return res.status(401).json({ error: 'Account configuration error. Please contact your administrator.' });
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
        return res.status(401).json({ error: 'Incorrect password. Please check your password and try again.' });
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

      // CRITICAL: Attach tenantId to user for session serialization
      const tenantId = req.tenantId || 'default';
      (user as any)._tenantId = tenantId;
      console.log(`[AUTH] routes/index.ts login successful for '${user.username}' in tenant '${tenantId}'`);

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
      const tenantStorage = getDatabaseStorage(req.tenantId);
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
      
      // CRITICAL: Attach tenantId to user for session serialization
      (user as any)._tenantId = req.tenantId || 'default';

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

      const tenantStorage = getDatabaseStorage(req.tenantId);
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
        return res.status(401).json({ error: 'No account found with that username. Please check your username and try again.' });
      }

      // Verify password
      const crypto = await import('crypto');
      const { promisify } = await import('util');
      const scryptAsync = promisify(crypto.scrypt);
      
      const [salt, hash] = user.password.split(':');
      if (!salt || !hash) {
        return res.status(401).json({ error: 'Account configuration error. Please contact your administrator.' });
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
        return res.status(401).json({ error: 'Incorrect password. Please check your password and try again.' });
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
      // CRITICAL: Attach tenantId to user for session serialization
      (user as any)._tenantId = req.tenantId || 'default';

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
          firstName: user.firstName,
          lastName: user.lastName,
          department: user.department,
          identityProvider: 'local'
        });
      });

    } catch (error) {
      console.error('Authentication error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Primary login endpoint - uses scrypt password verification
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
      }

      const tenantStorage = getDatabaseStorage(req.tenantId);
      const user = await tenantStorage.getUserByEmail(email);
      
      if (!user) {
        return res.status(401).json({ error: 'No account found with that email address. Please check your email and try again.' });
      }

      // Use dynamic imports for Node.js crypto
      const crypto = await import('crypto');
      const { promisify } = await import('util');
      const scryptAsync = promisify(crypto.scrypt);
      
      const [salt, hash] = user.password.split(':');
      if (!salt || !hash) {
        return res.status(401).json({ error: 'Account configuration error. Please contact your administrator.' });
      }
      
      const derivedKey = await scryptAsync(password, Buffer.from(salt, 'hex'), 32) as Buffer;
      const storedKey = Buffer.from(hash, 'hex');
      const isValidPassword = crypto.timingSafeEqual(derivedKey, storedKey);

      if (!isValidPassword) {
        return res.status(401).json({ error: 'Incorrect password. Please check your password and try again.' });
      }

      // CRITICAL: Attach tenantId to user for session serialization
      (user as any)._tenantId = req.tenantId || 'default';

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

  // Duplicate logout removed - using the logged version earlier in file

  app.get('/api/user', (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: "No user found" });
    }

    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin
    });
  });

  // Additional modular API routes are already registered above

  // Setup additional APIs
  setupRegulationUpdatesApi(app as any);
  setupMCPIntegrationApi(app as any);
  
  // Setup enhanced version control API
  setupRegulationVersionControlApi(app as any);

  // Initialize database
  initializeDatabase().catch(console.error);

  // Initialize backup scheduler (production only by default)
  initializeBackupScheduler();

  // Serve static files
  app.use('/downloads', express.static(path.join(APP_ROOT, 'public/downloads')));
  
  // Evidence files are now served from the database via /api/files/:fileKey

  // Serve branding assets
  const assetsPath = path.join(APP_ROOT, 'client/public/assets');
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
