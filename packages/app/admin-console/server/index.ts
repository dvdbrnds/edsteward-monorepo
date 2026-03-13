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
  // Tenant deletion functions
  canDeleteTenant,
  validateDeletionRequest,
  softDeleteTenant,
  hardDeleteTenant,
  restoreTenant,
  getDeletedTenants,
  getDeletionAuditLog,
  TenantProvisioningRequest,
  TenantDeletionRequest
} from './services/tenant-provisioning.js';

const app = express();
const PORT = process.env.ADMIN_PORT || 4000;
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

// Admin users (TODO: Move to database with proper password hashing)
const adminUsers = [
  { id: 1, email: 'admin@edsteward.ai', password: 'admin123', name: 'EdSteward Admin', role: 'super_admin' },
  { id: 2, email: 'dvdbrnds@gmail.com', password: 'gabadhgabadh', name: 'David Brands', role: 'super_admin' }
];

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
          // SSO status
          ssoEnabled: tenant.sso_enabled || false,
          ssoProvider: tenant.sso_provider || null,
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
      await fetch('https://moravian.edsteward.ai/api/admin/tenant-registry/refresh', {
        method: 'POST',
      });
      console.log('✅ Main app tenant registry refreshed');
    } catch (refreshError) {
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
      } catch (e) {
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
        } catch (e) {
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
        } catch (e) {
          results.tests.push({ name: 'OIDC Discovery', status: 'warning', message: 'Could not reach discovery endpoint' });
        }
      } catch (e) {
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
        } catch (e) {
          results.tests.push({ name: 'CAS Server Reachable', status: 'warning', message: 'Could not reach CAS server' });
        }
      } catch (e) {
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
      await fetch('https://moravian.edsteward.ai/api/admin/tenant-registry/refresh', {
        method: 'POST',
      });
    } catch (e) {
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
// INSTITUTION ASSESSMENT ROUTES (proxy to engine Customer API)
// =============================================================================

const ENGINE_CUSTOMER_API = process.env.ENGINE_CUSTOMER_API_URL || 'http://localhost:3060';

app.get('/api/assessment/search', requireAuth, async (req: Request, res: Response) => {
  try {
    const q = req.query.q as string;
    const limit = req.query.limit || '10';
    if (!q) return res.status(400).json({ error: 'Query parameter "q" is required' });

    const response = await fetch(`${ENGINE_CUSTOMER_API}/api/assessment/search?q=${encodeURIComponent(q)}&limit=${limit}`);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Assessment search proxy error:', error);
    res.status(502).json({ error: 'Failed to reach engine assessment service' });
  }
});

app.get('/api/assessment/institution/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const response = await fetch(`${ENGINE_CUSTOMER_API}/api/assessment/institution/${req.params.id}`);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Assessment lookup proxy error:', error);
    res.status(502).json({ error: 'Failed to reach engine assessment service' });
  }
});

app.post('/api/assessment/classify', requireAuth, async (req: Request, res: Response) => {
  try {
    const response = await fetch(`${ENGINE_CUSTOMER_API}/api/assessment/classify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Assessment classify proxy error:', error);
    res.status(502).json({ error: 'Failed to reach engine assessment service' });
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

    // Re-authenticate admin
    const adminUsers = [
      { id: 1, email: 'admin@edsteward.ai', password: 'admin123', name: 'EdSteward Admin', role: 'super_admin' },
      { id: 2, email: 'dvdbrnds@gmail.com', password: 'gabadhgabadh', name: 'David Brands', role: 'super_admin' }
    ];
    const matchingAdmin = adminUsers.find(u => u.email === adminEmail);
    if (!matchingAdmin || matchingAdmin.password !== adminPassword) {
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
