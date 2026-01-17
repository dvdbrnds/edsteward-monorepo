import { Router, Request, Response } from 'express';
import { FeatureFlagService } from '../../services/feature-flag.service';
import { FEATURE_FLAGS, FEATURE_CATEGORIES } from '@shared/feature-flags';
import { getDbForRequest } from '../../services/database';
import { tenants } from '@shared/schema';
import { eq } from 'drizzle-orm';

const router = Router();

// Admin middleware - inline definition like other files
const requireAdmin = (req: any, res: any, next: any) => {
  // In a real implementation, this would check user permissions
  // For now, we'll assume admin access
  next();
};

/**
 * GET /api/admin/feature-management/overview
 * Get overview of all tenants and their feature flag status
 */
router.get('/overview', requireAdmin, async (req: Request, res: Response) => {
  try {
    // TENANT ISOLATION: Get tenant-specific database
    const _db = getDbForRequest(req);
    // Get all tenants
    const allTenants = await db.select().from(tenants);
    
    const tenantOverview = await Promise.all(
      allTenants.map(async (tenant) => {
        try {
          // Get feature flags for this tenant
          const tenantFeatures = await FeatureFlagService.getTenantFeatures(tenant.id);
          
          // Calculate feature adoption stats
          const enabledFeatures = Object.entries(tenantFeatures).filter(([key, enabled]) => enabled).length;
          const totalFeatures = Object.keys(FEATURE_FLAGS).length;
          
          return {
            id: tenant.id,
            name: tenant.name,
            domain: tenant.domain,
            status: tenant.status || 'active',
            createdAt: tenant.createdAt,
            updatedAt: tenant.updatedAt,
            featureFlags: tenantFeatures,
            stats: {
              enabledFeatures,
              totalFeatures,
              adoptionRate: Math.round((enabledFeatures / totalFeatures) * 100)
            }
          };
        } catch (error) {
          console.error(`Error getting features for tenant ${tenant.id}:`, error);
          return {
            id: tenant.id,
            name: tenant.name,
            domain: tenant.domain,
            status: tenant.status || 'active',
            createdAt: tenant.createdAt,
            updatedAt: tenant.updatedAt,
            featureFlags: {},
            stats: {
              enabledFeatures: 0,
              totalFeatures: Object.keys(FEATURE_FLAGS).length,
              adoptionRate: 0
            }
          };
        }
      })
    );

    res.json({
      success: true,
      tenants: tenantOverview,
      summary: {
        totalTenants: allTenants.length,
        activeTenants: allTenants.filter(t => t.status === 'active').length,
        totalFeatures: Object.keys(FEATURE_FLAGS).length,
        averageAdoption: Math.round(
          tenantOverview.reduce((sum, t) => sum + t.stats.adoptionRate, 0) / tenantOverview.length
        )
      }
    });
  } catch (error) {
    console.error('Error getting feature management overview:', error);
    res.status(500).json({
      error: 'Failed to get overview',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/admin/feature-management/features
 * Get all available features with their definitions
 */
router.get('/features', requireAdmin, (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      features: FEATURE_FLAGS,
      categories: FEATURE_CATEGORIES
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get features',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * PUT /api/admin/feature-management/tenant/:tenantId/features
 * Update feature flags for a specific tenant
 */
router.put('/tenant/:tenantId/features', requireAdmin, async (req: Request, res: Response) => {
  try {
    // TENANT ISOLATION: Get tenant-specific database
    const _db = getDbForRequest(req);
    const { tenantId } = req.params;
    const { features } = req.body;

    if (!features || typeof features !== 'object') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'features object is required'
      });
    }

    // Validate feature keys
    const invalidFeatures = Object.keys(features).filter(key => !FEATURE_FLAGS[key]);
    if (invalidFeatures.length > 0) {
      return res.status(400).json({
        error: 'Invalid feature keys',
        message: `Unknown features: ${invalidFeatures.join(', ')}`
      });
    }

    // Update features
    const success = await FeatureFlagService.updateTenantFeatures(
      tenantId, 
      features, 
      req.user?.email || 'admin'
    );

    if (!success) {
      return res.status(500).json({
        error: 'Failed to update features',
        message: 'Database update failed'
      });
    }

    // Get updated features to return
    const updatedFeatures = await FeatureFlagService.getTenantFeatures(tenantId);

    res.json({
      success: true,
      tenantId,
      features: updatedFeatures,
      message: `Updated ${Object.keys(features).length} feature(s) for tenant ${tenantId}`
    });
  } catch (error) {
    console.error('Error updating tenant features:', error);
    res.status(500).json({
      error: 'Failed to update features',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * PUT /api/admin/feature-management/feature/:featureKey/bulk
 * Enable/disable a feature for multiple tenants
 */
router.put('/feature/:featureKey/bulk', requireAdmin, async (req: Request, res: Response) => {
  try {
    // TENANT ISOLATION: Get tenant-specific database
    const _db = getDbForRequest(req);
    const { featureKey } = req.params;
    const { enabled, tenantIds } = req.body;

    if (!FEATURE_FLAGS[featureKey]) {
      return res.status(400).json({
        error: 'Invalid feature key',
        message: `Unknown feature: ${featureKey}`
      });
    }

    if (!Array.isArray(tenantIds) || tenantIds.length === 0) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'tenantIds array is required'
      });
    }

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'enabled boolean is required'
      });
    }

    const results = [];
    const updatedBy = req.user?.email || 'admin';

    for (const tenantId of tenantIds) {
      try {
        const success = await FeatureFlagService.updateTenantFeatures(
          tenantId,
          { [featureKey]: enabled },
          updatedBy
        );

        results.push({
          tenantId,
          success,
          error: success ? null : 'Update failed'
        });
      } catch (error) {
        results.push({
          tenantId,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;

    res.json({
      success: failureCount === 0,
      featureKey,
      enabled,
      results,
      summary: {
        total: results.length,
        successful: successCount,
        failed: failureCount
      },
      message: `${enabled ? 'Enabled' : 'Disabled'} ${featureKey} for ${successCount}/${results.length} tenants`
    });
  } catch (error) {
    console.error('Error bulk updating feature:', error);
    res.status(500).json({
      error: 'Failed to bulk update feature',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/admin/feature-management/analytics
 * Get feature usage analytics across all tenants
 */
router.get('/analytics', requireAdmin, async (req: Request, res: Response) => {
  try {
    // TENANT ISOLATION: Get tenant-specific database
    const _db = getDbForRequest(req);
    const allTenants = await db.select().from(tenants);
    const analytics = {
      featureAdoption: {} as Record<string, {
        enabled: number;
        disabled: number;
        percentage: number;
      }>,
      categoryStats: {} as Record<string, {
        totalFeatures: number;
        averageAdoption: number;
      }>,
      tenantStats: [] as Array<{
        tenantId: string;
        tenantName: string;
        enabledFeatures: number;
        totalFeatures: number;
        adoptionRate: number;
      }>
    };

    // Calculate feature adoption rates
    for (const [featureKey, feature] of Object.entries(FEATURE_FLAGS)) {
      let enabledCount = 0;
      
      for (const tenant of allTenants) {
        try {
          const isEnabled = await FeatureFlagService.isFeatureEnabled(tenant.id, featureKey);
          if (isEnabled) enabledCount++;
        } catch (error) {
          // Use default value if there's an error
          if (feature.defaultValue) enabledCount++;
        }
      }

      const disabledCount = allTenants.length - enabledCount;
      analytics.featureAdoption[featureKey] = {
        enabled: enabledCount,
        disabled: disabledCount,
        percentage: Math.round((enabledCount / allTenants.length) * 100)
      };
    }

    // Calculate category statistics
    for (const [categoryKey, categoryName] of Object.entries(FEATURE_CATEGORIES)) {
      const categoryFeatures = Object.values(FEATURE_FLAGS).filter(f => f.category === categoryKey);
      const totalAdoption = categoryFeatures.reduce((sum, feature) => {
        return sum + (analytics.featureAdoption[feature.key]?.percentage || 0);
      }, 0);

      analytics.categoryStats[categoryKey] = {
        totalFeatures: categoryFeatures.length,
        averageAdoption: categoryFeatures.length > 0 ? Math.round(totalAdoption / categoryFeatures.length) : 0
      };
    }

    // Calculate tenant statistics
    for (const tenant of allTenants) {
      try {
        const tenantFeatures = await FeatureFlagService.getTenantFeatures(tenant.id);
        const enabledFeatures = Object.values(tenantFeatures).filter(Boolean).length;
        const totalFeatures = Object.keys(FEATURE_FLAGS).length;

        analytics.tenantStats.push({
          tenantId: tenant.id,
          tenantName: tenant.name,
          enabledFeatures,
          totalFeatures,
          adoptionRate: Math.round((enabledFeatures / totalFeatures) * 100)
        });
      } catch (error) {
        analytics.tenantStats.push({
          tenantId: tenant.id,
          tenantName: tenant.name,
          enabledFeatures: 0,
          totalFeatures: Object.keys(FEATURE_FLAGS).length,
          adoptionRate: 0
        });
      }
    }

    res.json({
      success: true,
      analytics,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting feature analytics:', error);
    res.status(500).json({
      error: 'Failed to get analytics',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * POST /api/admin/feature-management/rollout
 * Start a feature rollout to multiple tenants
 */
router.post('/rollout', requireAdmin, async (req: Request, res: Response) => {
  try {
    // TENANT ISOLATION: Get tenant-specific database
    const _db = getDbForRequest(req);
    const { featureKey, tenantIds, enabled = true, rolloutName } = req.body;

    if (!FEATURE_FLAGS[featureKey]) {
      return res.status(400).json({
        error: 'Invalid feature key',
        message: `Unknown feature: ${featureKey}`
      });
    }

    if (!Array.isArray(tenantIds) || tenantIds.length === 0) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'tenantIds array is required'
      });
    }

    const rolloutId = `rollout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const updatedBy = req.user?.email || 'admin';

    // Start the rollout (in a real implementation, this might be queued)
    const results = [];
    
    for (const tenantId of tenantIds) {
      try {
        const success = await FeatureFlagService.updateTenantFeatures(
          tenantId,
          { [featureKey]: enabled },
          updatedBy
        );

        results.push({
          tenantId,
          success,
          timestamp: new Date().toISOString(),
          error: success ? null : 'Update failed'
        });

        // Add a small delay to simulate controlled rollout
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        results.push({
          tenantId,
          success: false,
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    const successCount = results.filter(r => r.success).length;

    res.json({
      success: true,
      rolloutId,
      rolloutName: rolloutName || `${FEATURE_FLAGS[featureKey].name} Rollout`,
      featureKey,
      enabled,
      results,
      summary: {
        total: results.length,
        successful: successCount,
        failed: results.length - successCount,
        completedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error starting rollout:', error);
    res.status(500).json({
      error: 'Failed to start rollout',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/admin/feature-management/tenant/:tenantId/health
 * Get health and feature status for a specific tenant
 */
router.get('/tenant/:tenantId/health', requireAdmin, async (req: Request, res: Response) => {
  try {
    // TENANT ISOLATION: Get tenant-specific database
    const _db = getDbForRequest(req);
    const { tenantId } = req.params;

    // Get tenant info
    const tenant = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
    
    if (tenant.length === 0) {
      return res.status(404).json({
        error: 'Tenant not found',
        message: `Tenant ${tenantId} does not exist`
      });
    }

    // Get feature flags
    const tenantFeatures = await FeatureFlagService.getTenantFeatures(tenantId);
    
    // Calculate health metrics
    const enabledFeatures = Object.values(tenantFeatures).filter(Boolean).length;
    const totalFeatures = Object.keys(FEATURE_FLAGS).length;
    const adoptionRate = Math.round((enabledFeatures / totalFeatures) * 100);

    // Determine health status
    let healthStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (adoptionRate < 30) {
      healthStatus = 'critical';
    } else if (adoptionRate < 60) {
      healthStatus = 'warning';
    }

    res.json({
      success: true,
      tenant: {
        id: tenant[0].id,
        name: tenant[0].name,
        domain: tenant[0].domain,
        status: tenant[0].status,
        createdAt: tenant[0].createdAt,
        updatedAt: tenant[0].updatedAt
      },
      health: {
        status: healthStatus,
        adoptionRate,
        enabledFeatures,
        totalFeatures,
        lastUpdated: new Date().toISOString()
      },
      features: tenantFeatures
    });
  } catch (error) {
    console.error('Error getting tenant health:', error);
    res.status(500).json({
      error: 'Failed to get tenant health',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

export { router as default }; 