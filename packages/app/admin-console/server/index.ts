/**
 * EdSteward Admin Console Backend v2.0
 * Rebuilt from scratch with real database-backed tenant management
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env from packages/app/.env (two directories up from admin-console/server/)
if (!process.env.DATABASE_URL) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  dotenv.config({ path: join(__dirname, '..', '..', '.env') });
}

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { createServer } from 'http';
import { Pool } from 'pg';

const APP_BASE_URL = process.env.APP_BASE_URL || 'https://moravian.edsteward.ai';

import {
  initializeAdminDatabase,
  getAllTenants,
  getTenantById,
  createTenant,
  updateTenant,
  deleteTenant,
  getTenantStats,
  checkTenantHealth,
  getTenantUsers,
  closeAllConnections,
  getAdminPool
} from './config/database-connections.js';

import {
  provisionTenant,
  testDatabaseConnection,
  createNeonDatabase,
  cloneSchemaFromTemplate,
  copyDataFromTemplate,
  createAdminUser,
  updateEcsTaskDefinition,
  deployEcsService,
  updateAndDeployEcs,
  checkEcsCredentials,
  getEcsTaskDefinition,
  // Per-tenant deployment functions
  getTenantDeploymentStatus,
  deployImageToTenant,
  listEcrImageTags,
  // Tenant deletion functions
  canDeleteTenant,
  validateDeletionRequest,
  softDeleteTenant,
  hardDeleteTenant,
  restoreTenant,
  getDeletedTenants,
  getDeletionAuditLog,
  TenantProvisioningRequest
} from './services/tenant-provisioning.js';

const app = express();
const PORT = process.env.PORT || process.env.ADMIN_PORT || 4000;
const server = createServer(app);

// =============================================================================
// MIDDLEWARE
// =============================================================================

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
    },
  },
}));

app.use(cors({
  origin: [
    'http://localhost:3001',
    'http://localhost:3002',
    'https://admin.edsteward.ai'
  ],
  credentials: true,
}));

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// =============================================================================
// AUTHENTICATION (Simple token-based for now)
// =============================================================================

// Admin users from environment variables (never hardcode credentials)
const ADMIN_CONSOLE_USERS = process.env.ADMIN_CONSOLE_USERS;
const adminUsers: Array<{ id: number; email: string; password: string; name: string; role: string }> = [];

if (ADMIN_CONSOLE_USERS) {
  try {
    const parsed = JSON.parse(ADMIN_CONSOLE_USERS);
    parsed.forEach((u: any, i: number) => {
      adminUsers.push({ id: i + 1, email: u.email, password: u.password, name: u.name || u.email, role: 'super_admin' });
    });
  } catch { /* fall through to default */ }
}

if (adminUsers.length === 0) {
  const email = process.env.ADMIN_CONSOLE_EMAIL || 'admin@edsteward.ai';
  const password = process.env.ADMIN_CONSOLE_PASSWORD;
  if (!password) {
    console.error('FATAL: ADMIN_CONSOLE_PASSWORD env var is required. Set it to secure the admin console.');
    if (process.env.NODE_ENV === 'production') process.exit(1);
    adminUsers.push({ id: 1, email, password: 'admin-dev-only', name: 'Dev Admin', role: 'super_admin' });
  } else {
    adminUsers.push({ id: 1, email, password, name: 'EdSteward Admin', role: 'super_admin' });
  }
}

// Token storage (in-memory for simplicity)
const activeTokens = new Map<string, { userId: number; expiresAt: Date }>();

function generateToken(userId: number): string {
  const token = `admin-${userId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  activeTokens.set(token, {
    userId,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
  });
  return token;
}

function validateToken(token: string): number | null {
  const session = activeTokens.get(token);
  if (!session) return null;
  if (new Date() > session.expiresAt) {
    activeTokens.delete(token);
    return null;
  }
  return session.userId;
}

// Auth middleware
function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  const userId = validateToken(token);
  if (!userId) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  
  (req as any).userId = userId;
  (req as any).user = adminUsers.find(u => u.id === userId);
  next();
}

// =============================================================================
// AUTH ROUTES
// =============================================================================

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const user = adminUsers.find(u => u.email === email && u.password === password);
  
  if (user) {
    const token = generateToken(user.id);
    console.log(`✅ Admin login: ${user.email}`);
    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role }
    });
  } else {
    console.log(`❌ Failed login attempt: ${email}`);
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  const user = (req as any).user;
  res.json({ id: user.id, email: user.email, name: user.name, role: user.role });
});

app.post('/api/auth/logout', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) activeTokens.delete(token);
  res.json({ message: 'Logged out successfully' });
});

// =============================================================================
// DASHBOARD ROUTES
// =============================================================================

app.get('/api/dashboard/stats', requireAuth, async (req, res) => {
  try {
    const tenants = await getAllTenants();
    
    // Get real stats from all active tenants
    const tenantsWithStats = await Promise.all(
      tenants.filter(t => t.status === 'active').map(async (tenant) => {
        const stats = await getTenantStats(tenant);
        return { tenant, stats };
      })
    );

    const totalUsers = tenantsWithStats.reduce((sum, t) => sum + t.stats.userCount, 0);
    const totalRegulations = tenantsWithStats.reduce((sum, t) => sum + t.stats.regulationCount, 0);

    res.json({
      totalCustomers: tenants.length,
      activeCustomers: tenants.filter(t => t.status === 'active').length,
      activeUsers: totalUsers,
      totalRegulations,
      systemStatus: 'healthy',
      tenantBreakdown: tenantsWithStats.map(t => ({
        tenantId: t.tenant.id,
        tenantName: t.tenant.name,
        ...t.stats
      }))
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
});

// =============================================================================
// TENANT/CUSTOMER ROUTES
// =============================================================================

// List all tenants
app.get('/api/customers', requireAuth, async (req, res) => {
  try {
    const tenants = await getAllTenants();
    
    // Enrich with real-time stats and health
    const enrichedTenants = await Promise.all(
      tenants.map(async (tenant) => {
        const [stats, health] = await Promise.all([
          getTenantStats(tenant),
          checkTenantHealth(tenant)
        ]);

        return {
          id: tenant.id,
          name: tenant.name,
          subdomain: tenant.subdomain,
          status: health.overall === 'unhealthy' ? 'unhealthy' : tenant.status,
          plan: tenant.plan,
          deploymentType: tenant.deployment_type,
          contactEmail: tenant.contact_email,
          userCount: stats.userCount,
          regulationCount: stats.regulationCount,
          lastActivity: stats.lastActivity,
          healthCheckUrl: tenant.health_check_url,
          createdAt: tenant.created_at,
          ssoEnabled: tenant.sso_enabled || false,
          ssoProvider: tenant.sso_provider || null,
          currentImageTag: tenant.current_image_tag || null,
          lastDeployedAt: tenant.last_deployed_at || null,
          lastDeployedBy: tenant.last_deployed_by || null,
          health: {
            overall: health.overall,
            database: health.database,
            application: health.application
          },
          error: stats.error || health.database.error || health.application.error
        };
      })
    );

    res.json(enrichedTenants);
  } catch (error) {
    console.error('Fetch customers error:', error);
    res.status(500).json({ error: 'Failed to fetch customer data' });
  }
});

// Get single tenant
app.get('/api/customers/:id', requireAuth, async (req, res) => {
  try {
    const tenant = await getTenantById(req.params.id);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const [stats, health, users] = await Promise.all([
      getTenantStats(tenant),
      checkTenantHealth(tenant),
      getTenantUsers(tenant, 20)
    ]);

    res.json({
      ...tenant,
      database_url: '[HIDDEN]', // Don't expose connection string
      stats,
      health,
      recentUsers: users
    });
  } catch (error) {
    console.error('Fetch customer error:', error);
    res.status(500).json({ error: 'Failed to fetch customer details' });
  }
});

// Create new tenant
app.post('/api/customers', requireAuth, async (req, res) => {
  try {
    const { name, subdomain, database_url, contact_email, plan, deployment_type } = req.body;

    // Validate required fields
    if (!name || !subdomain || !database_url || !contact_email) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['name', 'subdomain', 'database_url', 'contact_email']
      });
    }

    // Validate subdomain format
    if (!/^[a-z0-9-]+$/.test(subdomain)) {
      return res.status(400).json({ 
        error: 'Invalid subdomain format. Use only lowercase letters, numbers, and hyphens.'
      });
    }

    const tenant = await createTenant({
      name,
      subdomain,
      database_url,
      contact_email,
      plan: plan || 'starter',
      deployment_type: deployment_type || 'cloud',
      status: 'pending'
    });

    console.log(`✅ Created new tenant: ${tenant.name} (${tenant.subdomain})`);
    res.status(201).json(tenant);
  } catch (error: any) {
    console.error('Create tenant error:', error);
    if (error.code === '23505') { // Unique violation
      return res.status(409).json({ error: 'A tenant with this subdomain already exists' });
    }
    res.status(500).json({ error: 'Failed to create tenant' });
  }
});

// Update tenant
app.put('/api/customers/:id', requireAuth, async (req, res) => {
  try {
    const tenant = await updateTenant(req.params.id, req.body);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    console.log(`✅ Updated tenant: ${tenant.name}`);
    res.json(tenant);
  } catch (error) {
    console.error('Update tenant error:', error);
    res.status(500).json({ error: 'Failed to update tenant' });
  }
});

// Delete tenant
app.delete('/api/customers/:id', requireAuth, async (req, res) => {
  try {
    const success = await deleteTenant(req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    console.log(`🗑️ Deleted tenant: ${req.params.id}`);
    res.json({ message: 'Tenant deleted successfully' });
  } catch (error) {
    console.error('Delete tenant error:', error);
    res.status(500).json({ error: 'Failed to delete tenant' });
  }
});

// Activate tenant
app.post('/api/customers/:id/activate', requireAuth, async (req, res) => {
  try {
    const tenant = await updateTenant(req.params.id, { status: 'active' });
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    console.log(`✅ Activated tenant: ${tenant.name}`);
    res.json(tenant);
  } catch (error) {
    console.error('Activate tenant error:', error);
    res.status(500).json({ error: 'Failed to activate tenant' });
  }
});

// Check tenant health
app.get('/api/customers/:id/health', requireAuth, async (req, res) => {
  try {
    const tenant = await getTenantById(req.params.id);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    const health = await checkTenantHealth(tenant);
    res.json(health);
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ error: 'Failed to check tenant health' });
  }
});

// =============================================================================
// SSO CONFIGURATION ROUTES
// =============================================================================

// Get SSO configuration for a tenant
app.get('/api/customers/:id/sso', requireAuth, async (req, res) => {
  try {
    const tenant = await getTenantById(req.params.id);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    // Parse sso_config if it exists
    let ssoConfig = null;
    if ((tenant as any).sso_config) {
      try {
        ssoConfig = typeof (tenant as any).sso_config === 'string' 
          ? JSON.parse((tenant as any).sso_config) 
          : (tenant as any).sso_config;
      } catch (e) {
        console.warn('Failed to parse sso_config:', e);
      }
    }

    res.json({
      tenantId: tenant.id,
      tenantName: tenant.name,
      ssoEnabled: tenant.sso_enabled,
      ssoProvider: tenant.sso_provider || ssoConfig?.provider,
      // Legacy SAML fields
      saml: tenant.sso_enabled && tenant.sso_provider === 'saml' ? {
        entityId: (tenant as any).sso_entity_id,
        ssoUrl: (tenant as any).sso_sso_url,
        certificate: (tenant as any).sso_certificate ? '[CONFIGURED]' : null,
        sloUrl: ssoConfig?.saml?.sloUrl,
        eduPersonEnabled: ssoConfig?.saml?.eduPersonEnabled,
      } : null,
      // New unified config
      config: ssoConfig ? {
        provider: ssoConfig.provider,
        autoProvisioning: ssoConfig.autoProvisioning ?? true,
        defaultRole: ssoConfig.defaultRole || 'user',
        allowedDomains: ssoConfig.allowedDomains || [],
        // Provider-specific (mask sensitive fields)
        saml: ssoConfig.saml ? {
          ...ssoConfig.saml,
          certificate: ssoConfig.saml.certificate ? '[CONFIGURED]' : null,
        } : null,
        oidc: ssoConfig.oidc ? {
          ...ssoConfig.oidc,
          clientSecret: ssoConfig.oidc.clientSecret ? '[CONFIGURED]' : null,
        } : null,
        cas: ssoConfig.cas || null,
      } : null,
      // Metadata URLs for IT admins
      metadataUrls: {
        saml: `https://${tenant.subdomain}.edsteward.ai/auth/saml/metadata`,
        oidc: `https://${tenant.subdomain}.edsteward.ai/auth/oidc/discovery`,
        cas: `https://${tenant.subdomain}.edsteward.ai/auth/cas/discovery`,
      },
    });
  } catch (error) {
    console.error('Get SSO config error:', error);
    res.status(500).json({ error: 'Failed to get SSO configuration' });
  }
});

// Update SSO configuration for a tenant
app.put('/api/customers/:id/sso', requireAuth, async (req, res) => {
  try {
    const tenantId = req.params.id;
    const { provider, enabled, config } = req.body;

    // Validate provider
    const validProviders = ['saml', 'oidc', 'cas'];
    if (provider && !validProviders.includes(provider)) {
      return res.status(400).json({ 
        error: `Invalid provider. Must be one of: ${validProviders.join(', ')}` 
      });
    }

    // Validate required fields based on provider
    if (enabled && provider === 'saml') {
      if (!config?.saml?.entityId || !config?.saml?.ssoUrl || !config?.saml?.certificate) {
        return res.status(400).json({
          error: 'SAML requires: entityId, ssoUrl, certificate',
          required: ['config.saml.entityId', 'config.saml.ssoUrl', 'config.saml.certificate']
        });
      }
    }

    if (enabled && provider === 'oidc') {
      if (!config?.oidc?.issuerUrl || !config?.oidc?.clientId || !config?.oidc?.clientSecret) {
        return res.status(400).json({
          error: 'OIDC requires: issuerUrl, clientId, clientSecret',
          required: ['config.oidc.issuerUrl', 'config.oidc.clientId', 'config.oidc.clientSecret']
        });
      }
    }

    if (enabled && provider === 'cas') {
      if (!config?.cas?.serverUrl) {
        return res.status(400).json({
          error: 'CAS requires: serverUrl',
          required: ['config.cas.serverUrl']
        });
      }
    }

    // Build sso_config object
    const ssoConfig = {
      provider: provider,
      autoProvisioning: config?.autoProvisioning ?? true,
      defaultRole: config?.defaultRole || 'user',
      allowedDomains: config?.allowedDomains || [],
      saml: config?.saml || null,
      oidc: config?.oidc || null,
      cas: config?.cas || null,
    };

    // Update tenant with SSO config
    const adminPool = getAdminPool();
    
    // For SAML, also update legacy fields for backward compatibility
    if (provider === 'saml' && config?.saml) {
      await adminPool.query(`
        UPDATE tenants SET
          sso_enabled = $1,
          sso_provider = $2,
          sso_entity_id = $3,
          sso_sso_url = $4,
          sso_certificate = $5,
          sso_config = $6,
          updated_at = NOW()
        WHERE id = $7
      `, [
        enabled,
        provider,
        config.saml.entityId,
        config.saml.ssoUrl,
        config.saml.certificate,
        JSON.stringify(ssoConfig),
        tenantId
      ]);
    } else {
      // For OIDC/CAS, only use sso_config
      await adminPool.query(`
        UPDATE tenants SET
          sso_enabled = $1,
          sso_provider = $2,
          sso_config = $3,
          updated_at = NOW()
        WHERE id = $4
      `, [
        enabled,
        provider,
        JSON.stringify(ssoConfig),
        tenantId
      ]);
    }

    // Trigger tenant registry refresh in main app
    try {
      await fetch(`${APP_BASE_URL}/api/admin/tenant-registry/refresh`, {
        method: 'POST',
      });
      console.log('✅ Main app tenant registry refreshed');
    } catch {
      console.warn('⚠️ Could not refresh main app tenant registry');
    }

    console.log(`✅ Updated SSO config for tenant ${tenantId}: provider=${provider}, enabled=${enabled}`);
    
    res.json({
      success: true,
      tenantId,
      ssoEnabled: enabled,
      ssoProvider: provider,
      message: `SSO configuration ${enabled ? 'enabled' : 'disabled'} for ${provider}`,
    });

  } catch (error) {
    console.error('Update SSO config error:', error);
    res.status(500).json({ error: 'Failed to update SSO configuration' });
  }
});

// Test SSO configuration (validates settings)
app.post('/api/customers/:id/sso/test', requireAuth, async (req, res) => {
  try {
    const tenant = await getTenantById(req.params.id);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const results: any = {
      tenantId: tenant.id,
      tests: [],
    };

    // Parse sso_config
    let ssoConfig = null;
    if ((tenant as any).sso_config) {
      try {
        ssoConfig = typeof (tenant as any).sso_config === 'string' 
          ? JSON.parse((tenant as any).sso_config) 
          : (tenant as any).sso_config;
      } catch {
        results.tests.push({ name: 'Parse Config', status: 'failed', error: 'Invalid sso_config JSON' });
        return res.json(results);
      }
    }

    if (!tenant.sso_enabled) {
      results.tests.push({ name: 'SSO Enabled', status: 'skipped', message: 'SSO is not enabled' });
      return res.json(results);
    }

    results.tests.push({ name: 'SSO Enabled', status: 'passed' });

    const provider = tenant.sso_provider || ssoConfig?.provider;

    // Provider-specific tests
    if (provider === 'saml') {
      // Test SAML certificate format
      const cert = (tenant as any).sso_certificate || ssoConfig?.saml?.certificate;
      if (cert) {
        if (cert.includes('BEGIN CERTIFICATE')) {
          results.tests.push({ name: 'SAML Certificate Format', status: 'passed' });
        } else {
          results.tests.push({ name: 'SAML Certificate Format', status: 'warning', message: 'Certificate may not be in PEM format' });
        }
      } else {
        results.tests.push({ name: 'SAML Certificate', status: 'failed', error: 'No certificate configured' });
      }

      // Test SSO URL accessibility
      const ssoUrl = (tenant as any).sso_sso_url || ssoConfig?.saml?.ssoUrl;
      if (ssoUrl) {
        try {
          const urlObj = new URL(ssoUrl);
          results.tests.push({ name: 'SAML SSO URL Format', status: 'passed', url: urlObj.origin });
        } catch {
          results.tests.push({ name: 'SAML SSO URL Format', status: 'failed', error: 'Invalid URL format' });
        }
      }
    }

    if (provider === 'oidc' && ssoConfig?.oidc) {
      // Test issuer URL
      try {
        const issuerUrl = ssoConfig.oidc.issuerUrl;
        const urlObj = new URL(issuerUrl);
        results.tests.push({ name: 'OIDC Issuer URL Format', status: 'passed', url: urlObj.origin });

        // Try to fetch .well-known/openid-configuration
        try {
          const discoveryUrl = `${issuerUrl.replace(/\/$/, '')}/.well-known/openid-configuration`;
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          
          const response = await fetch(discoveryUrl, { signal: controller.signal });
          clearTimeout(timeoutId);
          
          if (response.ok) {
            results.tests.push({ name: 'OIDC Discovery', status: 'passed', url: discoveryUrl });
          } else {
            results.tests.push({ name: 'OIDC Discovery', status: 'warning', message: `HTTP ${response.status}` });
          }
        } catch {
          results.tests.push({ name: 'OIDC Discovery', status: 'warning', message: 'Could not reach discovery endpoint' });
        }
      } catch {
        results.tests.push({ name: 'OIDC Issuer URL', status: 'failed', error: 'Invalid URL format' });
      }

      // Check client credentials
      if (ssoConfig.oidc.clientId) {
        results.tests.push({ name: 'OIDC Client ID', status: 'passed' });
      } else {
        results.tests.push({ name: 'OIDC Client ID', status: 'failed', error: 'Missing client ID' });
      }
      if (ssoConfig.oidc.clientSecret) {
        results.tests.push({ name: 'OIDC Client Secret', status: 'passed' });
      } else {
        results.tests.push({ name: 'OIDC Client Secret', status: 'failed', error: 'Missing client secret' });
      }
    }

    if (provider === 'cas' && ssoConfig?.cas) {
      // Test CAS server URL
      try {
        const serverUrl = ssoConfig.cas.serverUrl;
        const urlObj = new URL(serverUrl);
        results.tests.push({ name: 'CAS Server URL Format', status: 'passed', url: urlObj.origin });

        // Try to reach CAS server
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          
          const response = await fetch(serverUrl, { signal: controller.signal });
          clearTimeout(timeoutId);
          
          results.tests.push({ name: 'CAS Server Reachable', status: 'passed', httpStatus: response.status });
        } catch {
          results.tests.push({ name: 'CAS Server Reachable', status: 'warning', message: 'Could not reach CAS server' });
        }
      } catch {
        results.tests.push({ name: 'CAS Server URL', status: 'failed', error: 'Invalid URL format' });
      }
    }

    // Overall status
    const hasFailures = results.tests.some((t: any) => t.status === 'failed');
    const hasWarnings = results.tests.some((t: any) => t.status === 'warning');
    results.overall = hasFailures ? 'failed' : hasWarnings ? 'warning' : 'passed';

    res.json(results);

  } catch (error) {
    console.error('Test SSO config error:', error);
    res.status(500).json({ error: 'Failed to test SSO configuration' });
  }
});

// Disable SSO for a tenant
app.delete('/api/customers/:id/sso', requireAuth, async (req, res) => {
  try {
    const tenantId = req.params.id;
    const adminPool = getAdminPool();
    
    await adminPool.query(`
      UPDATE tenants SET
        sso_enabled = FALSE,
        sso_provider = NULL,
        sso_config = '{}',
        updated_at = NOW()
      WHERE id = $1
    `, [tenantId]);

    // Refresh main app
    try {
      await fetch(`${APP_BASE_URL}/api/admin/tenant-registry/refresh`, {
        method: 'POST',
      });
    } catch {
      // Non-critical
    }

    console.log(`🔒 Disabled SSO for tenant ${tenantId}`);
    res.json({ success: true, message: 'SSO disabled for tenant' });

  } catch (error) {
    console.error('Disable SSO error:', error);
    res.status(500).json({ error: 'Failed to disable SSO' });
  }
});

// =============================================================================
// INSTITUTION ASSESSMENT (self-contained — calls College Scorecard API directly)
// =============================================================================

const SCORECARD_API = 'https://api.data.gov/ed/collegescorecard/v1/schools';
const SCORECARD_KEY = process.env.COLLEGE_SCORECARD_API_KEY || 'DEMO_KEY';

const SCORECARD_FIELDS = [
  'id', 'school.name', 'school.city', 'school.state', 'school.zip',
  'school.school_url', 'school.ownership', 'school.carnegie_basic',
  'school.carnegie_size_setting', 'school.religious_affiliation',
  'school.degrees_awarded.predominant', 'school.degrees_awarded.highest',
  'school.online_only', 'school.main_campus', 'school.branches',
  'school.accreditor', 'school.accreditor_code',
  'school.title_iv.approval_date', 'school.under_investigation',
  'latest.student.size', 'latest.student.enrollment.all',
  'latest.admissions.admission_rate.overall',
  'latest.cost.tuition.in_state', 'latest.cost.tuition.out_of_state',
  'latest.aid.pell_grant_rate', 'latest.aid.federal_loan_rate',
  'latest.completion.rate_suppressed.overall',
  'latest.student.retention_rate.four_year.full_time',
  'latest.student.retention_rate.lt_four_year.full_time',
  'latest.repayment.3_yr_repayment.overall',
  'latest.aid.median_debt.completers.overall',
].join(',');

const OWNERSHIP_MAP: Record<number, string> = { 1: 'Public', 2: 'Private nonprofit', 3: 'Private for-profit' };

const CARNEGIE_MAP: Record<number, string> = {
  15: 'Doctoral Universities: Very High Research Activity', 16: 'Doctoral Universities: High Research Activity',
  17: 'Doctoral/Professional Universities', 18: "Master's Colleges & Universities: Larger Programs",
  19: "Master's Colleges & Universities: Medium Programs", 20: "Master's Colleges & Universities: Smaller Programs",
  21: "Baccalaureate Colleges: Arts & Sciences Focus", 22: "Baccalaureate Colleges: Diverse Fields",
  23: "Baccalaureate/Associate's Colleges",
  24: "Associate's Colleges: High Transfer-High Traditional", 25: "Associate's Colleges: High Transfer-Mixed Traditional",
  26: "Associate's Colleges: High Transfer-High Nontraditional",
  33: 'Special Focus: Theological Seminaries', 34: 'Special Focus: Medical Schools & Centers',
  35: 'Special Focus: Health Professions Schools', 36: 'Special Focus: Engineering Schools',
  37: 'Special Focus: Technology-Related Schools', 38: 'Special Focus: Business & Management Schools',
  39: 'Special Focus: Arts, Music & Design Schools', 40: 'Special Focus: Law Schools',
  41: 'Special Focus: Other', [-2]: 'Not applicable / Not classified',
};

const RELIGIOUS_MAP: Record<number, string> = {
  22: 'American Baptist', 24: 'American Lutheran', 27: 'Baptist', 30: 'Church of Christ',
  33: 'Church of God', 34: 'Churches of Christ', 36: 'Christian Church (Disciples of Christ)',
  37: 'Evangelical Christian', 40: 'Evangelical Lutheran Church', 44: 'Moravian Church',
  48: 'Methodist', 52: 'Pentecostal Holiness Church', 54: 'Presbyterian Church (USA)',
  55: 'Protestant Episcopal', 58: 'Religious Society of Friends', 60: 'Roman Catholic',
  61: 'Seventh Day Adventist', 65: 'United Methodist', 66: 'United Church of Christ',
  67: 'Wesleyan', 71: 'Assemblies of God', 73: 'Christian Reformed',
  79: 'Jewish', 80: 'Latter Day Saints', 81: 'Lutheran Church - Missouri Synod',
  84: 'Other Protestant', 88: 'Undenominational', 91: 'Not applicable',
  92: 'Southern Baptist', 95: 'Non-denominational', 97: 'Christian',
  99: 'Other (non-religious)', 100: 'Interdenominational', 101: 'Muslim',
};

function classifyFromScorecard(data: any) {
  const ownership = data['school.ownership'];
  const carnegie = data['school.carnegie_basic'];
  const religious = data['school.religious_affiliation'];
  const predominant = data['school.degrees_awarded.predominant'];
  const highest = data['school.degrees_awarded.highest'];
  const onlineOnly = data['school.online_only'];
  const titleIvDate = data['school.title_iv.approval_date'];
  const size = data['latest.student.size'];

  let primaryType: string;
  if (ownership === 3) primaryType = 'private-for-profit';
  else if (ownership === 1) primaryType = (predominant <= 2 || (carnegie >= 24 && carnegie <= 32)) ? 'public-2year' : 'public-4year';
  else primaryType = (predominant <= 2 || (carnegie >= 24 && carnegie <= 32)) ? 'private-nonprofit-2year' : 'private-nonprofit-4year';

  const characteristics: string[] = [];
  if (religious && religious !== 91 && religious !== 99) characteristics.push('religious-affiliation');
  if (carnegie === 15 || carnegie === 16) characteristics.push('research-intensive');
  if (highest >= 4 || carnegie === 17 || (carnegie >= 18 && carnegie <= 20)) characteristics.push('graduate-professional');
  if (carnegie === 34 || carnegie === 35) characteristics.push('medical-health-programs');
  if (onlineOnly === 1) characteristics.push('online-distance-ed');
  if (titleIvDate) characteristics.push('title-iv-participant');
  if (size >= 500 && predominant >= 3 && !onlineOnly) characteristics.push('residential-campus');

  return { primaryType, characteristics };
}

function mapScorecardResult(r: any) {
  const classification = classifyFromScorecard(r);
  return {
    id: r.id, name: r['school.name'], city: r['school.city'], state: r['school.state'],
    zip: r['school.zip'], website: r['school.school_url'],
    ownership: OWNERSHIP_MAP[r['school.ownership']] || 'Unknown', ownershipCode: r['school.ownership'],
    carnegieClassification: CARNEGIE_MAP[r['school.carnegie_basic']] || 'Not classified',
    carnegieCode: r['school.carnegie_basic'],
    religiousAffiliation: RELIGIOUS_MAP[r['school.religious_affiliation']] || null,
    religiousAffiliationCode: r['school.religious_affiliation'],
    predominantDegree: r['school.degrees_awarded.predominant'],
    highestDegree: r['school.degrees_awarded.highest'],
    accreditor: r['school.accreditor'], titleIvApprovalDate: r['school.title_iv.approval_date'],
    onlineOnly: r['school.online_only'] === 1, mainCampus: r['school.main_campus'] === 1,
    branches: r['school.branches'], studentSize: r['latest.student.size'],
    admissionRate: r['latest.admissions.admission_rate.overall'],
    tuitionInState: r['latest.cost.tuition.in_state'], tuitionOutOfState: r['latest.cost.tuition.out_of_state'],
    pellGrantRate: r['latest.aid.pell_grant_rate'],
    federalLoanRate: r['latest.aid.federal_loan_rate'],
    completionRate: r['latest.completion.rate_suppressed.overall'],
    retentionRate: r['latest.student.retention_rate.four_year.full_time']
      ?? r['latest.student.retention_rate.lt_four_year.full_time'],
    repaymentRate: r['latest.repayment.3_yr_repayment.overall'],
    medianDebt: r['latest.aid.median_debt.completers.overall'],
    underInvestigation: r['school.under_investigation'],
    accreditorCode: r['school.accreditor_code'],
    classification, allTypes: [classification.primaryType, ...classification.characteristics],
  };
}

async function getRegulationCountForTypes(types: string[]): Promise<{ total: number; applicable: number }> {
  const pool = getAdminPool();
  try {
    const totalRes = await pool.query('SELECT COUNT(*) as count FROM regulations');
    const total = parseInt(totalRes.rows[0].count);

    const placeholders = types.map((_, i) => `$${i + 1}`).join(', ');
    const applicableRes = await pool.query(
      `SELECT COUNT(*) as count FROM regulations
       WHERE applicable_institutions IS NULL
       OR applicable_institutions::jsonb @> '"all-institutions"'::jsonb
       OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(applicable_institutions::jsonb) elem WHERE elem IN (${placeholders}))`,
      types
    );
    return { total, applicable: parseInt(applicableRes.rows[0].count) };
  } catch (error) {
    console.error('Regulation count query error:', error);
    return { total: 0, applicable: 0 };
  }
}

app.get('/api/assessment/search', requireAuth, async (req: Request, res: Response) => {
  try {
    const q = req.query.q as string;
    const limit = req.query.limit || '10';
    if (!q) return res.status(400).json({ error: 'Query parameter "q" is required' });

    const url = `${SCORECARD_API}?school.name=${encodeURIComponent(q)}&fields=${SCORECARD_FIELDS}&api_key=${SCORECARD_KEY}&per_page=${limit}&sort=latest.student.size:desc`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Scorecard API: ${response.status}`);
    const data = await response.json();

    res.json({ success: true, total: data.metadata.total, results: data.results.map(mapScorecardResult) });
  } catch (error: any) {
    console.error('Assessment search error:', error);
    res.status(500).json({ error: 'Failed to search institutions', details: error.message });
  }
});

app.get('/api/assessment/institution/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const url = `${SCORECARD_API}?id=${req.params.id}&fields=${SCORECARD_FIELDS}&api_key=${SCORECARD_KEY}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Scorecard API: ${response.status}`);
    const data = await response.json();
    if (data.results.length === 0) return res.status(404).json({ error: 'Institution not found' });

    const institution = mapScorecardResult(data.results[0]);
    const regulations = await getRegulationCountForTypes(institution.allTypes);
    res.json({ success: true, institution, regulations });
  } catch (error: any) {
    console.error('Assessment lookup error:', error);
    res.status(500).json({ error: 'Failed to look up institution', details: error.message });
  }
});

app.post('/api/assessment/classify', requireAuth, async (req: Request, res: Response) => {
  try {
    const { types } = req.body;
    if (!types || !Array.isArray(types)) return res.status(400).json({ error: '"types" array is required' });
    const regulations = await getRegulationCountForTypes(types);
    res.json({ success: true, regulations });
  } catch (error: any) {
    console.error('Assessment classify error:', error);
    res.status(500).json({ error: 'Failed to classify', details: error.message });
  }
});

// =============================================================================
// WEBSITE COMPLIANCE SCAN
// =============================================================================

import { crawlWebsite } from './services/website-scanner.js';
import { analyzeCompliance } from './services/compliance-analyzer.js';
import { generateExternalIndicators, analyzeAccessibilityFromHtml } from './services/external-checks.js';

app.post('/api/assessment/compliance-scan', requireAuth, async (req: Request, res: Response) => {
  try {
    const { websiteUrl, institutionTypes, institutionName, institutionData } = req.body;
    if (!websiteUrl) return res.status(400).json({ error: '"websiteUrl" is required' });
    if (!institutionTypes || !Array.isArray(institutionTypes)) {
      return res.status(400).json({ error: '"institutionTypes" array is required' });
    }
    if (!institutionName) return res.status(400).json({ error: '"institutionName" is required' });

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({ error: 'ANTHROPIC_API_KEY not configured — compliance scanning unavailable' });
    }

    console.log(`\n🔍 Starting compliance scan for ${institutionName} (${websiteUrl})`);
    console.log(`   Institution types: ${institutionTypes.join(', ')}`);

    const crawlResult = await crawlWebsite(websiteUrl);
    console.log(`   Crawled ${crawlResult.pagesScanned} pages in ${crawlResult.durationMs}ms`);

    if (crawlResult.pagesScanned === 0) {
      return res.status(422).json({
        error: 'Could not crawl the institution website',
        details: crawlResult.errors,
      });
    }

    // Run website compliance analysis and external checks in parallel
    const [report, accessibilityResult] = await Promise.all([
      analyzeCompliance(
        crawlResult.pages,
        institutionName,
        institutionTypes,
        websiteUrl,
        { pagesScanned: crawlResult.pagesScanned, durationMs: crawlResult.durationMs },
      ),
      Promise.resolve(
        analyzeAccessibilityFromHtml(
          crawlResult.pages
            .filter(p => p.rawHtml)
            .slice(0, 10)
            .map(p => ({ url: p.url, html: p.rawHtml }))
        )
      ),
    ]);

    // Generate external indicators from College Scorecard data + accessibility
    if (institutionData) {
      const externalResult = generateExternalIndicators(institutionData, accessibilityResult);
      report.externalIndicators = externalResult.indicators;
      report.accessibilityScore = externalResult.accessibilityScore;
      report.financialHealthScore = externalResult.financialHealthScore;
      report.externalSummary = {
        totalChecks: externalResult.summary.totalChecks,
        passing: externalResult.summary.passing,
        warnings: externalResult.summary.warnings,
        failing: externalResult.summary.failing,
      };
      console.log(`   External checks: ${externalResult.summary.passing} pass, ${externalResult.summary.warnings} warn, ${externalResult.summary.failing} fail | Accessibility: ${externalResult.accessibilityScore}/100`);
    }

    console.log(`   Analysis complete: ${report.overallGrade} (${report.overallScore}%) — ${report.compliantCount} compliant, ${report.partialCount} partial, ${report.nonCompliantCount} non-compliant`);

    res.json({ success: true, report });
  } catch (error: any) {
    console.error('Compliance scan error:', error);
    res.status(500).json({ error: 'Compliance scan failed', details: error.message });
  }
});

// =============================================================================
// USER ROUTES (Cross-tenant)
// =============================================================================

app.get('/api/users', requireAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const tenants = await getAllTenants();
    
    const allUsers = await Promise.all(
      tenants.filter(t => t.status === 'active').map(t => getTenantUsers(t, limit))
    );

    const users = allUsers
      .flat()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);

    res.json(users);
  } catch (error) {
    console.error('Fetch users error:', error);
    res.status(500).json({ error: 'Failed to fetch user data' });
  }
});

// =============================================================================
// TENANT PROVISIONING ROUTES
// =============================================================================

// Full automated provisioning (all 7 steps)
app.post('/api/provisioning/full', requireAuth, async (req, res) => {
  try {
    const request: TenantProvisioningRequest = req.body;

    // Validate required fields (contactEmail is now optional)
    if (!request.name || !request.subdomain || !request.adminUser) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['name', 'subdomain', 'adminUser']
      });
    }

    // Validate subdomain format
    if (!/^[a-z0-9-]+$/.test(request.subdomain)) {
      return res.status(400).json({
        error: 'Invalid subdomain format. Use only lowercase letters, numbers, and hyphens.'
      });
    }

    const RESERVED_SUBDOMAINS = [
      'www', 'api', 'admin', 'staging', 'template', 'test', 'dev',
      'mail', 'smtp', 'ftp', 'ssh', 'ns1', 'ns2', 'cdn', 'assets',
      'static', 'docs', 'help', 'support', 'status', 'blog',
    ];
    if (RESERVED_SUBDOMAINS.includes(request.subdomain)) {
      return res.status(400).json({
        error: `"${request.subdomain}" is a reserved subdomain and cannot be used.`
      });
    }

    // Check if subdomain already exists
    const existing = await getTenantById(request.subdomain);
    if (existing) {
      return res.status(409).json({ error: 'A tenant with this subdomain already exists' });
    }

    console.log(`\n🚀 Starting full tenant provisioning for: ${request.name} (${request.subdomain})`);
    
    const result = await provisionTenant(request, getAdminPool());
    
    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error: any) {
    console.error('Provisioning error:', error);
    res.status(500).json({ error: error.message || 'Provisioning failed' });
  }
});

// Step 1: Create Neon database only
app.post('/api/provisioning/create-database', requireAuth, async (req, res) => {
  try {
    const { subdomain } = req.body;
    
    if (!subdomain) {
      return res.status(400).json({ error: 'Subdomain is required' });
    }

    console.log(`📦 Creating database for: ${subdomain}`);
    const result = await createNeonDatabase(subdomain);
    
    res.json({
      success: true,
      projectId: result.projectId,
      connectionUri: result.connectionUri,
      message: `Database created: edsteward-${subdomain}`
    });
  } catch (error: any) {
    console.error('Database creation error:', error);
    res.status(500).json({ error: error.message || 'Failed to create database' });
  }
});

// Step 2 & 3: Clone schema and data from template
app.post('/api/provisioning/clone-template', requireAuth, async (req, res) => {
  try {
    const { databaseUrl } = req.body;
    
    if (!databaseUrl) {
      return res.status(400).json({ error: 'Database URL is required' });
    }

    console.log('📋 Cloning from template...');
    
    // Clone schema
    await cloneSchemaFromTemplate(databaseUrl);
    
    // Copy data
    const dataResult = await copyDataFromTemplate(databaseUrl);
    
    res.json({
      success: true,
      regulationsCount: dataResult.regulationsCount,
      tasksCount: dataResult.tasksCount,
      message: `Cloned ${dataResult.regulationsCount} regulations and ${dataResult.tasksCount} tasks`
    });
  } catch (error: any) {
    console.error('Clone error:', error);
    res.status(500).json({ error: error.message || 'Failed to clone template' });
  }
});

// Step 4: Create admin user
app.post('/api/provisioning/create-user', requireAuth, async (req, res) => {
  try {
    const { databaseUrl, user } = req.body;
    
    if (!databaseUrl || !user) {
      return res.status(400).json({ error: 'Database URL and user data are required' });
    }

    console.log(`👤 Creating admin user: ${user.username}`);
    const result = await createAdminUser(databaseUrl, user);
    
    res.json({
      success: true,
      userId: result.userId,
      message: `Admin user created: ${user.username}`
    });
  } catch (error: any) {
    console.error('User creation error:', error);
    res.status(500).json({ error: error.message || 'Failed to create user' });
  }
});

// Test database connection
app.post('/api/provisioning/test-connection', requireAuth, async (req, res) => {
  try {
    const { databaseUrl } = req.body;
    
    if (!databaseUrl) {
      return res.status(400).json({ error: 'Database URL is required' });
    }

    const result = await testDatabaseConnection(databaseUrl);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get template info
app.get('/api/provisioning/template-info', requireAuth, async (req, res) => {
  try {
    const templateUrl = process.env.TEMPLATE_DATABASE_URL;
    
    if (!templateUrl) {
      return res.status(500).json({ error: 'Template database not configured' });
    }

    const connectionResult = await testDatabaseConnection(templateUrl);
    
    res.json({
      configured: true,
      connected: connectionResult.success,
      tables: connectionResult.tables,
      message: connectionResult.message
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// =============================================================================
// ECS MANAGEMENT ROUTES
// =============================================================================

// Check ECS credentials status
app.get('/api/ecs/status', requireAuth, async (req, res) => {
  try {
    const credentials = checkEcsCredentials();
    
    res.json({
      configured: credentials.configured,
      credentialMethod: credentials.method,
      missing: credentials.missing,
      cluster: process.env.ECS_CLUSTER || 'edsteward-cluster',
      service: process.env.ECS_SERVICE || 'edsteward-service',
      taskFamily: process.env.ECS_TASK_FAMILY || 'edsteward-saml-step3',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get current ECS task definition
app.get('/api/ecs/task-definition', requireAuth, async (req, res) => {
  try {
    const taskDef = await getEcsTaskDefinition();
    
    // Extract relevant info without sensitive data
    const envVars = taskDef.containerDefinitions[0].environment?.map((e: any) => ({
      name: e.name,
      // Mask sensitive values
      value: e.name.includes('PASSWORD') || e.name.includes('SECRET') || e.name.includes('KEY')
        ? '***MASKED***'
        : e.value.substring(0, 50) + (e.value.length > 50 ? '...' : '')
    })) || [];
    
    res.json({
      family: taskDef.family,
      revision: taskDef.revision,
      taskDefinitionArn: taskDef.taskDefinitionArn,
      cpu: taskDef.cpu,
      memory: taskDef.memory,
      containerCount: taskDef.containerDefinitions?.length || 0,
      environmentVariables: envVars,
      registeredAt: taskDef.registeredAt,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update ECS task definition with new database URL
app.post('/api/ecs/update-task-definition', requireAuth, async (req, res) => {
  try {
    const { subdomain, databaseUrl } = req.body;
    
    if (!subdomain || !databaseUrl) {
      return res.status(400).json({ 
        error: 'Both subdomain and databaseUrl are required' 
      });
    }

    console.log(`📋 Updating ECS task definition for tenant: ${subdomain}`);
    
    const result = await updateEcsTaskDefinition(subdomain, databaseUrl);
    
    if (!result.success) {
      return res.status(500).json({ 
        success: false, 
        error: result.message 
      });
    }

    res.json({
      success: true,
      taskDefinitionArn: result.taskDefinitionArn,
      revision: result.revision,
      message: result.message,
      environmentVariable: `${subdomain.toUpperCase()}_DATABASE_URL`,
    });
  } catch (error: any) {
    console.error('ECS update error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Deploy ECS service with updated task definition
app.post('/api/ecs/deploy', requireAuth, async (req, res) => {
  try {
    const { taskDefinitionArn } = req.body;

    console.log(`🚀 Deploying ECS service${taskDefinitionArn ? ` with ${taskDefinitionArn}` : ''}`);
    
    const result = await deployEcsService(taskDefinitionArn);
    
    if (!result.success) {
      return res.status(500).json({ 
        success: false, 
        error: result.message 
      });
    }

    res.json({
      success: true,
      message: result.message,
    });
  } catch (error: any) {
    console.error('ECS deploy error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Full ECS update: update task definition and deploy
app.post('/api/ecs/update-and-deploy', requireAuth, async (req, res) => {
  try {
    const { subdomain, databaseUrl } = req.body;
    
    if (!subdomain || !databaseUrl) {
      return res.status(400).json({ 
        error: 'Both subdomain and databaseUrl are required' 
      });
    }

    console.log(`🚀 Full ECS update and deploy for tenant: ${subdomain}`);
    
    const result = await updateAndDeployEcs(subdomain, databaseUrl);
    
    if (!result.success) {
      return res.status(500).json({ 
        success: false, 
        error: result.message 
      });
    }

    res.json({
      success: true,
      taskDefinitionArn: result.taskDefinitionArn,
      revision: result.revision,
      message: result.message,
      environmentVariable: `${subdomain.toUpperCase()}_DATABASE_URL`,
      note: 'New tasks will be running within 2-3 minutes',
    });
  } catch (error: any) {
    console.error('ECS update and deploy error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================================================
// PER-TENANT DEPLOYMENT ROUTES
// =============================================================================

// List available ECR image tags (deployable versions)
app.get('/api/ecr/images', requireAuth, async (req, res) => {
  try {
    const result = await listEcrImageTags();
    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }
    res.json({ success: true, images: result.tags });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get deployment status for a specific tenant
app.get('/api/customers/:id/deployment', requireAuth, async (req, res) => {
  try {
    const tenant = await getTenantById(req.params.id);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const cluster = tenant.ecs_cluster || process.env.ECS_CLUSTER || 'edsteward-cluster';
    const service = tenant.ecs_service || process.env.ECS_SERVICE || 'edsteward-service';
    const taskFamily = tenant.ecs_task_family || process.env.ECS_TASK_FAMILY || 'edsteward-saml-production';

    const status = await getTenantDeploymentStatus(cluster, service, taskFamily);

    res.json({
      ...status,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        subdomain: tenant.subdomain,
      },
      config: {
        cluster,
        service,
        taskFamily,
        hasOwnInfra: !!(tenant.ecs_service),
      },
      dbTracking: {
        currentImageTag: tenant.current_image_tag,
        lastDeployedAt: tenant.last_deployed_at,
        lastDeployedBy: tenant.last_deployed_by,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Deploy a specific image tag to a tenant
app.post('/api/customers/:id/deploy', requireAuth, async (req, res) => {
  try {
    const { imageTag } = req.body;
    if (!imageTag) {
      return res.status(400).json({ error: 'imageTag is required' });
    }

    const tenant = await getTenantById(req.params.id);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const cluster = tenant.ecs_cluster || process.env.ECS_CLUSTER || 'edsteward-cluster';
    const service = tenant.ecs_service || process.env.ECS_SERVICE || 'edsteward-service';
    const taskFamily = tenant.ecs_task_family || process.env.ECS_TASK_FAMILY || 'edsteward-saml-production';
    const adminEmail = (req as any).adminUser?.email || 'unknown';

    console.log(`\n🚀 DEPLOY REQUEST: ${imageTag} -> ${tenant.name} (${service})`);
    console.log(`   By: ${adminEmail}`);

    const result = await deployImageToTenant(cluster, service, taskFamily, imageTag);

    if (!result.success) {
      return res.status(500).json({ success: false, error: result.message });
    }

    // Record deployment in database
    const adminPool = getAdminPool();
    await adminPool.query(
      `UPDATE tenants SET current_image_tag = $1, last_deployed_at = NOW(), last_deployed_by = $2, updated_at = NOW() WHERE id = $3`,
      [imageTag, adminEmail, tenant.id]
    );

    res.json({
      success: true,
      taskDefinitionArn: result.taskDefinitionArn,
      revision: result.revision,
      message: result.message,
      deployment: {
        tenant: tenant.name,
        imageTag,
        deployedBy: adminEmail,
        deployedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Per-tenant deploy error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update a tenant's ECS infrastructure configuration
app.put('/api/customers/:id/deployment-config', requireAuth, async (req, res) => {
  try {
    const { ecsCluster, ecsService, ecsTaskFamily } = req.body;
    const tenant = await getTenantById(req.params.id);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const updates: any = {};
    if (ecsCluster !== undefined) updates.ecs_cluster = ecsCluster;
    if (ecsService !== undefined) updates.ecs_service = ecsService;
    if (ecsTaskFamily !== undefined) updates.ecs_task_family = ecsTaskFamily;

    const updated = await updateTenant(req.params.id, updates);
    res.json({ success: true, tenant: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================================================
// TENANT DELETION ROUTES (WITH SAFEGUARDS)
// =============================================================================

// Check if a tenant can be deleted
app.get('/api/tenants/:tenantId/can-delete', requireAuth, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const result = canDeleteTenant(tenantId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get list of deleted tenants (for recovery)
app.get('/api/tenants/deleted', requireAuth, async (req, res) => {
  try {
    const adminPool = getAdminPool();
    const result = await getDeletedTenants(adminPool);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get deletion audit log
app.get('/api/tenants/deletion-audit-log', requireAuth, async (req, res) => {
  try {
    const log = getDeletionAuditLog();
    res.json({ 
      entries: log,
      count: log.length 
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Validate deletion request (pre-check before actual deletion)
app.post('/api/tenants/:tenantId/validate-deletion', requireAuth, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { confirmationPhrase, reason, acknowledgeDataLoss } = req.body;
    const adminEmail = (req as any).adminUser?.email || 'unknown';
    
    // First check if tenant can be deleted at all
    const canDelete = canDeleteTenant(tenantId);
    if (!canDelete.canDelete) {
      return res.status(403).json({
        valid: false,
        errors: [canDelete.reason],
        protectionLevel: canDelete.protectionLevel,
      });
    }
    
    // Validate the request
    const validation = validateDeletionRequest({
      tenantId,
      confirmationPhrase: confirmationPhrase || '',
      adminPassword: 'validation-only', // Not checking password on validation
      reason: reason || '',
      acknowledgeDataLoss: acknowledgeDataLoss || false,
    }, adminEmail);
    
    res.json({
      ...validation,
      protectionLevel: canDelete.protectionLevel,
      requiredConfirmations: canDelete.requiredConfirmations,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Soft delete a tenant (recommended - data preserved for 30 days)
app.post('/api/tenants/:tenantId/soft-delete', requireAuth, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { confirmationPhrase, adminPassword, reason, acknowledgeDataLoss } = req.body;
    const adminUser = (req as any).user;
    const adminEmail = adminUser?.email || 'unknown';
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`⚠️  SOFT DELETE REQUEST for tenant: ${tenantId}`);
    console.log(`   Requested by: ${adminEmail}`);
    console.log(`   Reason: ${reason}`);
    console.log(`${'='.repeat(60)}\n`);
    
    // Check if tenant can be deleted
    const canDelete = canDeleteTenant(tenantId);
    if (!canDelete.canDelete) {
      return res.status(403).json({
        success: false,
        error: canDelete.reason,
        protectionLevel: canDelete.protectionLevel,
      });
    }
    
    // Validate request
    const validation = validateDeletionRequest({
      tenantId,
      confirmationPhrase,
      adminPassword,
      reason,
      acknowledgeDataLoss,
    }, adminEmail);
    
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        errors: validation.errors,
      });
    }
    
    // Re-authenticate admin
    const matchingAdmin = adminUsers.find(u => u.email === adminEmail);
    if (!matchingAdmin || matchingAdmin.password !== adminPassword) {
      return res.status(401).json({
        success: false,
        error: 'Invalid admin password. Re-authentication failed.',
      });
    }
    
    // Perform soft delete
    const adminPool = getAdminPool();
    const result = await softDeleteTenant(tenantId, adminPool, adminEmail, reason);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error: any) {
    console.error('Soft delete error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Hard delete a tenant (PERMANENT - requires extra confirmation)
app.post('/api/tenants/:tenantId/hard-delete', requireAuth, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { 
      confirmationPhrase, 
      adminPassword, 
      reason, 
      acknowledgeDataLoss,
      deleteNeonDatabase,  // Default false - keep DB for recovery
      secondConfirmation 
    } = req.body;
    const adminUser = (req as any).user;
    const adminEmail = adminUser?.email || 'unknown';
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🚨 HARD DELETE REQUEST for tenant: ${tenantId}`);
    console.log(`   Requested by: ${adminEmail}`);
    console.log(`   Reason: ${reason}`);
    console.log(`   ⚠️  THIS WILL PERMANENTLY DESTROY ALL DATA`);
    console.log(`${'='.repeat(60)}\n`);
    
    // Check if tenant can be deleted
    const canDelete = canDeleteTenant(tenantId);
    if (!canDelete.canDelete) {
      return res.status(403).json({
        success: false,
        error: canDelete.reason,
        protectionLevel: canDelete.protectionLevel,
      });
    }
    
    // Extra confirmation for high-protection tenants
    if (canDelete.protectionLevel === 'high' && secondConfirmation !== 'I UNDERSTAND THIS IS PERMANENT') {
      return res.status(400).json({
        success: false,
        error: 'High-protection tenant requires additional confirmation. Please set secondConfirmation to "I UNDERSTAND THIS IS PERMANENT"',
        protectionLevel: 'high',
      });
    }
    
    // Validate request
    const validation = validateDeletionRequest({
      tenantId,
      confirmationPhrase,
      adminPassword,
      reason,
      acknowledgeDataLoss,
      deleteNeonDatabase: deleteNeonDatabase === true,
    }, adminEmail);
    
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        errors: validation.errors,
      });
    }
    
    // Re-authenticate admin
    const matchingAdmin = adminUsers.find(u => u.email === adminEmail);
    if (!matchingAdmin || matchingAdmin.password !== adminPassword) {
      return res.status(401).json({
        success: false,
        error: 'Invalid admin password. Re-authentication failed.',
      });
    }
    
    // Perform hard delete
    const adminPool = getAdminPool();
    const result = await hardDeleteTenant({
      tenantId,
      confirmationPhrase,
      adminPassword,
      reason,
      acknowledgeDataLoss,
      deleteNeonDatabase: deleteNeonDatabase === true, // Default: keep database
    }, adminPool, adminEmail);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error: any) {
    console.error('Hard delete error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Restore a soft-deleted tenant
app.post('/api/tenants/:tenantId/restore', requireAuth, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const adminEmail = (req as any).adminUser?.email || 'unknown';
    
    console.log(`\n♻️  RESTORE REQUEST for tenant: ${tenantId} by ${adminEmail}\n`);
    
    const adminPool = getAdminPool();
    const result = await restoreTenant(tenantId, adminPool, adminEmail);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error: any) {
    console.error('Restore error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// =============================================================================
// SYSTEM ROUTES
// =============================================================================

app.get('/health', (_req, res) => { res.json({ status: 'ok' }); });
app.get('/api/health', (req, res) => {
  const ecsCredentials = checkEcsCredentials();
  
  res.json({
    status: 'healthy',
    service: 'admin-console',
    version: '2.3.0',
    timestamp: new Date().toISOString(),
    features: ['tenant-provisioning', 'health-monitoring', 'user-management', 'ecs-management'],
    ecs: {
      configured: ecsCredentials.configured,
      credentialMethod: ecsCredentials.method,
      cluster: process.env.ECS_CLUSTER || 'edsteward-cluster',
      service: process.env.ECS_SERVICE || 'edsteward-service',
    }
  });
});

// =============================================================================
// DATA SYNC ROUTES
// =============================================================================

// Get sync preview - shows what would be synced without doing it
app.get('/api/sync/preview', requireAuth, async (req, res) => {
  try {
    // Source is the main DATABASE_URL (dev environment)
    const sourceUrl = process.env.DATABASE_URL;
    if (!sourceUrl) {
      return res.status(500).json({ error: 'Source DATABASE_URL not configured' });
    }

    // Get template tenant database URL
    const templateTenant = await getTenantById('template');
    if (!templateTenant) {
      return res.status(404).json({ error: 'Template tenant not found' });
    }

    const sourcePool = new Pool({
      connectionString: sourceUrl,
      ssl: sourceUrl.includes('neon.tech') ? { rejectUnauthorized: false } : false,
      max: 2,
    });

    const templatePool = new Pool({
      connectionString: templateTenant.database_url,
      ssl: templateTenant.database_url.includes('neon.tech') ? { rejectUnauthorized: false } : false,
      max: 2,
    });

    try {
      // Get counts from source
      const sourceCounts = await Promise.all([
        sourcePool.query('SELECT COUNT(*) as count FROM regulations'),
        sourcePool.query('SELECT COUNT(*) as count FROM compliance_tasks WHERE assigned_to IS NULL'),
        sourcePool.query('SELECT COUNT(*) as count FROM guides'),
        sourcePool.query('SELECT COUNT(*) as count FROM deadlines'),
      ]);

      // Get counts from template
      const templateCounts = await Promise.all([
        templatePool.query('SELECT COUNT(*) as count FROM regulations'),
        templatePool.query('SELECT COUNT(*) as count FROM compliance_tasks WHERE assigned_to IS NULL'),
        templatePool.query('SELECT COUNT(*) as count FROM guides'),
        templatePool.query('SELECT COUNT(*) as count FROM deadlines'),
      ]);

      res.json({
        source: {
          name: 'Development Environment',
          url: sourceUrl.replace(/:[^:@]+@/, ':****@'), // Hide password
          counts: {
            regulations: parseInt(sourceCounts[0].rows[0].count),
            complianceTasks: parseInt(sourceCounts[1].rows[0].count),
            guides: parseInt(sourceCounts[2].rows[0].count),
            deadlines: parseInt(sourceCounts[3].rows[0].count),
          }
        },
        template: {
          name: 'EdSteward Template',
          url: templateTenant.database_url.replace(/:[^:@]+@/, ':****@'),
          counts: {
            regulations: parseInt(templateCounts[0].rows[0].count),
            complianceTasks: parseInt(templateCounts[1].rows[0].count),
            guides: parseInt(templateCounts[2].rows[0].count),
            deadlines: parseInt(templateCounts[3].rows[0].count),
          }
        }
      });
    } finally {
      await sourcePool.end();
      await templatePool.end();
    }
  } catch (error) {
    console.error('Sync preview error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get sync preview' });
  }
});

// Execute sync from dev to template
app.post('/api/sync/dev-to-template', requireAuth, async (req, res) => {
  try {
    const { adminPassword, confirmSync } = req.body;
    const adminUser = (req as any).user;
    const adminEmail = adminUser?.email || 'unknown';

    // Validate request
    if (!confirmSync) {
      return res.status(400).json({ error: 'You must confirm the sync operation' });
    }

    // Re-authenticate admin using the same env-based user list
    const syncSecret = process.env.ADMIN_SYNC_SECRET || process.env.ADMIN_CONSOLE_PASSWORD;
    if (!syncSecret) {
      return res.status(500).json({ error: 'ADMIN_SYNC_SECRET or ADMIN_CONSOLE_PASSWORD must be set for sync operations' });
    }
    if (adminPassword !== syncSecret) {
      return res.status(401).json({ error: 'Invalid admin password' });
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔄 SYNC DEV TO TEMPLATE requested by ${adminEmail}`);
    console.log(`${'='.repeat(60)}\n`);

    // Source is the main DATABASE_URL (dev environment)
    const sourceUrl = process.env.DATABASE_URL;
    if (!sourceUrl) {
      return res.status(500).json({ error: 'Source DATABASE_URL not configured' });
    }

    // Get template tenant database URL
    const templateTenant = await getTenantById('template');
    if (!templateTenant) {
      return res.status(404).json({ error: 'Template tenant not found' });
    }

    const sourcePool = new Pool({
      connectionString: sourceUrl,
      ssl: sourceUrl.includes('neon.tech') ? { rejectUnauthorized: false } : false,
      max: 5,
    });

    const templatePool = new Pool({
      connectionString: templateTenant.database_url,
      ssl: templateTenant.database_url.includes('neon.tech') ? { rejectUnauthorized: false } : false,
      max: 5,
    });

    const results: any = {
      startedAt: new Date().toISOString(),
      syncedBy: adminEmail,
      tables: {},
      errors: [],
    };

    try {
      // SYNC REGULATIONS
      console.log('📋 Syncing regulations...');
      try {
        // Get all regulations from source
        const sourceRegs = await sourcePool.query('SELECT * FROM regulations');
        
        // Clear and insert into template (within transaction)
        await templatePool.query('BEGIN');
        await templatePool.query('DELETE FROM regulations');
        
        for (const reg of sourceRegs.rows) {
          const columns = Object.keys(reg).filter(k => reg[k] !== null);
          const values = columns.map(k => reg[k]);
          const placeholders = columns.map((_, i) => `$${i + 1}`);
          
          await templatePool.query(
            `INSERT INTO regulations (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) ON CONFLICT (id) DO NOTHING`,
            values
          );
        }
        await templatePool.query('COMMIT');
        
        results.tables.regulations = { synced: sourceRegs.rows.length, status: 'success' };
        console.log(`   ✅ Synced ${sourceRegs.rows.length} regulations`);
      } catch (err) {
        await templatePool.query('ROLLBACK');
        results.tables.regulations = { error: err instanceof Error ? err.message : 'Unknown error', status: 'failed' };
        results.errors.push(`regulations: ${err instanceof Error ? err.message : 'Unknown error'}`);
        console.log(`   ❌ Failed to sync regulations: ${err}`);
      }

      // SYNC COMPLIANCE TASKS (templates only - where assigned_to IS NULL)
      console.log('📝 Syncing compliance task templates...');
      try {
        const sourceTasks = await sourcePool.query('SELECT * FROM compliance_tasks WHERE assigned_to IS NULL');
        
        await templatePool.query('BEGIN');
        await templatePool.query('DELETE FROM compliance_tasks WHERE assigned_to IS NULL');
        
        for (const task of sourceTasks.rows) {
          const columns = Object.keys(task).filter(k => task[k] !== null);
          const values = columns.map(k => task[k]);
          const placeholders = columns.map((_, i) => `$${i + 1}`);
          
          await templatePool.query(
            `INSERT INTO compliance_tasks (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) ON CONFLICT (id) DO NOTHING`,
            values
          );
        }
        await templatePool.query('COMMIT');
        
        results.tables.complianceTasks = { synced: sourceTasks.rows.length, status: 'success' };
        console.log(`   ✅ Synced ${sourceTasks.rows.length} compliance task templates`);
      } catch (err) {
        await templatePool.query('ROLLBACK');
        results.tables.complianceTasks = { error: err instanceof Error ? err.message : 'Unknown error', status: 'failed' };
        results.errors.push(`complianceTasks: ${err instanceof Error ? err.message : 'Unknown error'}`);
        console.log(`   ❌ Failed to sync compliance tasks: ${err}`);
      }

      // SYNC GUIDES
      console.log('📚 Syncing guides...');
      try {
        const sourceGuides = await sourcePool.query('SELECT * FROM guides');
        
        await templatePool.query('BEGIN');
        await templatePool.query('DELETE FROM guides');
        
        for (const guide of sourceGuides.rows) {
          const columns = Object.keys(guide).filter(k => guide[k] !== null);
          const values = columns.map(k => guide[k]);
          const placeholders = columns.map((_, i) => `$${i + 1}`);
          
          await templatePool.query(
            `INSERT INTO guides (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) ON CONFLICT (id) DO NOTHING`,
            values
          );
        }
        await templatePool.query('COMMIT');
        
        results.tables.guides = { synced: sourceGuides.rows.length, status: 'success' };
        console.log(`   ✅ Synced ${sourceGuides.rows.length} guides`);
      } catch (err) {
        await templatePool.query('ROLLBACK');
        results.tables.guides = { error: err instanceof Error ? err.message : 'Unknown error', status: 'failed' };
        results.errors.push(`guides: ${err instanceof Error ? err.message : 'Unknown error'}`);
        console.log(`   ❌ Failed to sync guides: ${err}`);
      }

      // SYNC DEADLINES
      console.log('📅 Syncing deadlines...');
      try {
        const sourceDeadlines = await sourcePool.query('SELECT * FROM deadlines');
        
        await templatePool.query('BEGIN');
        await templatePool.query('DELETE FROM deadlines');
        
        for (const deadline of sourceDeadlines.rows) {
          const columns = Object.keys(deadline).filter(k => deadline[k] !== null);
          const values = columns.map(k => deadline[k]);
          const placeholders = columns.map((_, i) => `$${i + 1}`);
          
          await templatePool.query(
            `INSERT INTO deadlines (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) ON CONFLICT (id) DO NOTHING`,
            values
          );
        }
        await templatePool.query('COMMIT');
        
        results.tables.deadlines = { synced: sourceDeadlines.rows.length, status: 'success' };
        console.log(`   ✅ Synced ${sourceDeadlines.rows.length} deadlines`);
      } catch (err) {
        await templatePool.query('ROLLBACK');
        results.tables.deadlines = { error: err instanceof Error ? err.message : 'Unknown error', status: 'failed' };
        results.errors.push(`deadlines: ${err instanceof Error ? err.message : 'Unknown error'}`);
        console.log(`   ❌ Failed to sync deadlines: ${err}`);
      }

      results.completedAt = new Date().toISOString();
      results.success = results.errors.length === 0;

      console.log(`\n${'='.repeat(60)}`);
      console.log(`🔄 SYNC ${results.success ? 'COMPLETED' : 'COMPLETED WITH ERRORS'}`);
      console.log(`${'='.repeat(60)}\n`);

      res.json(results);

    } finally {
      await sourcePool.end();
      await templatePool.end();
    }

  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Sync failed' });
  }
});

// =============================================================================
// ERROR HANDLER
// =============================================================================

// In production, serve the built frontend static files and SPA fallback
if (process.env.NODE_ENV === 'production') {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const staticDir = join(__dirname, '..', 'public');
  app.use(express.static(staticDir));
  app.get('*', (_req: Request, res: Response) => {
    res.sendFile(join(staticDir, 'index.html'));
  });
}

app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// =============================================================================
// STARTUP
// =============================================================================

async function startServer() {
  try {
    console.log('🚀 Starting EdSteward Admin Console v2.0...');
    
    // Initialize database
    await initializeAdminDatabase();
    console.log('✅ Database initialized');

    // Start server
    server.listen(PORT, () => {
      console.log(`
╔════════════════════════════════════════════════════════════╗
║         EdSteward Admin Console v2.0                       ║
╠════════════════════════════════════════════════════════════╣
║  🌐 API Server:    http://localhost:${PORT}                   ║
║  🔐 Auth:          admin@edsteward.ai / admin123           ║
║  📊 Endpoints:     /api/customers, /api/dashboard/stats    ║
║  💾 Database:      Real tenant data from Neon              ║
╚════════════════════════════════════════════════════════════╝
      `);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down...');
  await closeAllConnections();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Shutting down...');
  await closeAllConnections();
  process.exit(0);
});

startServer();
