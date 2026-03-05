import { Router } from 'express';
import { tenantMiddleware, requireTenant, TenantFinder, TenantManager, ConsolidatedTenantRequest as TenantRequest, Tenant, LegacyTenantConfig as TenantConfig, tenantToLegacyConfig } from '../../middleware/tenant';
import { createTenantDatabase, runTenantMigrations } from '../../services/tenantDatabase.js';
import { eq } from 'drizzle-orm';
import { getDbForRequest } from '../../services/database';
import { tenants } from '@shared/schema';

const router = Router();

// Apply new tenant middleware to all routes
router.use(tenantMiddleware);

/**
 * Check if user is admin
 */
function isAdmin(user: any): boolean {
  return user?.email?.endsWith('@edsteward.ai') || user?.role === 'admin';
}

/**
 * Admin middleware
 */
function requireAdmin(req: TenantRequest, res: any, next: any) {
  if (!isAdmin(req.user)) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Admin access required'
    });
  }
  next();
}

/**
 * GET /api/tenants - List all tenants (admin only)
 */
router.get('/', requireAdmin, (req: TenantRequest, res) => {
  try {
    const tenants = TenantManager.getAllTenants();
    res.json({
      success: true,
      tenants: tenants.map(t => ({
        id: t.id,
        name: t.name,
        domain: t.domain,
        database: t.database,
        hasSaml: !!t.samlConfig
      }))
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to list tenants',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/tenants/:tenantId - Get specific tenant (admin or own tenant)
 */
router.get('/:tenantId', (req: TenantRequest, res) => {
  try {
    const { tenantId } = req.params;
    
    // Check if user can access this tenant
    if (!isAdmin(req.user) && req.tenantId !== tenantId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Cannot access other tenant information'
      });
    }

    const tenant = TenantManager.getTenant(tenantId);
    if (!tenant) {
      return res.status(404).json({
        error: 'Tenant not found',
        message: `Tenant ${tenantId} does not exist`
      });
    }

    res.json({
      success: true,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        domain: tenant.domain,
        database: tenant.database,
        hasSaml: !!tenant.samlConfig,
        settings: tenant.settings || {}
      }
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get tenant',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * POST /api/tenants - Create new tenant (admin only)
 */
router.post('/', requireAdmin, async (req: TenantRequest, res) => {
  try {
    // TENANT ISOLATION: Get tenant-specific database
    const _db = getDbForRequest(req);
    const { tenantId, name, domain, samlConfig, settings } = req.body;

    // Validate required fields
    if (!tenantId || !name || !domain) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'tenantId, name, and domain are required'
      });
    }

    // Check if tenant already exists
    if (TenantManager.getTenant(tenantId)) {
      return res.status(409).json({
        error: 'Tenant already exists',
        message: `Tenant ${tenantId} already exists`
      });
    }

    // Create tenant configuration
    const tenantConfig: TenantConfig = {
      id: tenantId,
      name,
      domain,
      database: `edsteward_${tenantId}`,
      samlConfig,
      settings
    };

    // Create tenant database
    await createTenantDatabase(tenantConfig);

    // Register tenant
    TenantManager.registerTenant(tenantConfig);

    res.status(201).json({
      success: true,
      message: `Tenant ${tenantId} created successfully`,
      tenant: {
        id: tenantConfig.id,
        name: tenantConfig.name,
        domain: tenantConfig.domain,
        database: tenantConfig.database
      }
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to create tenant',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * PUT /api/tenants/:tenantId - Update tenant (admin only)
 */
router.put('/:tenantId', requireAdmin, (req: TenantRequest, res) => {
  try {
    const { tenantId } = req.params;
    const updates = req.body;

    // Don't allow changing ID or database name
    delete updates.id;
    delete updates.database;

    const success = TenantManager.updateTenant(tenantId, updates);
    
    if (!success) {
      return res.status(404).json({
        error: 'Tenant not found',
        message: `Tenant ${tenantId} does not exist`
      });
    }

    const updatedTenant = TenantManager.getTenant(tenantId);
    
    res.json({
      success: true,
      message: `Tenant ${tenantId} updated successfully`,
      tenant: updatedTenant
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to update tenant',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * POST /api/tenants/:tenantId/migrate - Run migrations for tenant (admin only)
 */
router.post('/:tenantId/migrate', requireAdmin, async (req: TenantRequest, res) => {
  try {
    // TENANT ISOLATION: Get tenant-specific database
    const _db = getDbForRequest(req);
    const { tenantId } = req.params;
    
    const tenantConfig = TenantManager.getTenant(tenantId);
    if (!tenantConfig) {
      return res.status(404).json({
        error: 'Tenant not found',
        message: `Tenant ${tenantId} does not exist`
      });
    }

    await runTenantMigrations(tenantConfig);

    res.json({
      success: true,
      message: `Migrations completed for tenant ${tenantId}`
    });

  } catch (error) {
    res.status(500).json({
      error: 'Migration failed',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/tenants/current - Get current user's tenant context
 */
router.get('/current/context', (req: TenantRequest, res) => {
  res.json({
    success: true,
    context: {
      tenantId: req.tenantId || null,
      tenantName: req.tenantConfig?.name || null,
      userEmail: req.user?.email || null,
      isAdmin: isAdmin(req.user)
    }
  });
});

/**
 * POST /api/tenants/select - Select tenant for session (for users with access to multiple tenants)
 */
router.post('/select', (req: TenantRequest, res) => {
  try {
    const { tenantId } = req.body;

    if (!tenantId) {
      return res.status(400).json({
        error: 'Missing tenantId',
        message: 'tenantId is required'
      });
    }

    const tenantConfig = TenantManager.getTenant(tenantId);
    if (!tenantConfig) {
      return res.status(404).json({
        error: 'Tenant not found',
        message: `Tenant ${tenantId} does not exist`
      });
    }

    // For now, allow any authenticated user to select any tenant
    // In production, you'd validate user has access to the tenant
    req.session.selectedTenant = tenantId;

    res.json({
      success: true,
      message: `Tenant ${tenantId} selected`,
      tenant: {
        id: tenantConfig.id,
        name: tenantConfig.name,
        domain: tenantConfig.domain
      }
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to select tenant',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * PUT /api/tenants/:tenantId/institution-config - Update institution configuration
 */
router.put('/:tenantId/institution-config', async (req: TenantRequest, res) => {
  try {
    // TENANT ISOLATION: Get tenant-specific database
    const _db = getDbForRequest(req);
    const { tenantId } = req.params;
    const { primaryTypes, hideNonApplicable, allowUsersToToggle } = req.body;
    
    // Check if user can access this tenant
    if (!isAdmin(req.user) && req.tenantId !== tenantId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Cannot update other tenant configuration'
      });
    }

    // Validate institution types
    if (!Array.isArray(primaryTypes)) {
      return res.status(400).json({
        error: 'Invalid data',
        message: 'primaryTypes must be an array'
      });
    }

    // Get current tenant from database
    const currentTenant = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
    
    if (currentTenant.length === 0) {
      return res.status(404).json({
        error: 'Tenant not found',
        message: `Tenant ${tenantId} does not exist`
      });
    }

    const tenant = currentTenant[0];
    const currentSettings = tenant.settings || {};
    
    // Update institution configuration
    const updatedSettings = {
      ...currentSettings,
      institutionConfig: {
        primaryTypes,
        hideNonApplicable: hideNonApplicable ?? true,
        allowUsersToToggle: allowUsersToToggle ?? true
      }
    };

    // Update tenant in database
    await db.update(tenants)
      .set({
        settings: updatedSettings,
        updatedAt: new Date()
      })
      .where(eq(tenants.id, tenantId));

    // Update in-memory tenant cache if using TenantManager
    const tenantConfig = TenantManager.getTenant(tenantId);
    if (tenantConfig) {
      TenantManager.updateTenant(tenantId, {
        settings: updatedSettings
      });
    }

    res.json({
      success: true,
      message: 'Institution configuration updated successfully',
      institutionConfig: {
        primaryTypes,
        hideNonApplicable,
        allowUsersToToggle
      }
    });

  } catch (error) {
    console.error('Error updating institution configuration:', error);
    res.status(500).json({
      error: 'Failed to update institution configuration',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/tenants/:tenantId/institution-config - Get institution configuration
 */
router.get('/:tenantId/institution-config', (req: TenantRequest, res) => {
  try {
    const { tenantId } = req.params;
    
    // Check if user can access this tenant
    if (!isAdmin(req.user) && req.tenantId !== tenantId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Cannot access other tenant configuration'
      });
    }

    const tenant = TenantManager.getTenant(tenantId);
    if (!tenant) {
      return res.status(404).json({
        error: 'Tenant not found',
        message: `Tenant ${tenantId} does not exist`
      });
    }

    const institutionConfig = tenant.settings?.institutionConfig || {
      primaryTypes: [],
      hideNonApplicable: true,
      allowUsersToToggle: true
    };

    res.json({
      success: true,
      institutionConfig
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get institution configuration',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router; 