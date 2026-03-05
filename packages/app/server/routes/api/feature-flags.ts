import { Router, Response } from 'express';
import { tenantMiddleware, ConsolidatedTenantRequest as TenantRequest } from '../../middleware/tenant';
import { FEATURE_FLAGS, FEATURE_CATEGORIES } from '@shared/feature-flags';

const router = Router();

// Apply tenant middleware to all routes
router.use(tenantMiddleware);

/**
 * GET /api/feature-flags - Get all available feature flags
 */
router.get('/', (req: TenantRequest, res: Response) => {
  try {
    res.json({
      success: true,
      features: FEATURE_FLAGS,
      categories: FEATURE_CATEGORIES
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get feature flags',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/feature-flags/tenant - Get tenant-specific feature flag configuration
 */
router.get('/tenant', (req: TenantRequest, res) => {
  try {
    const tenantId = req.tenantId || 'admin';
    
    // For now, return default values since we're focusing on the frontend
    // In production, this would read from the tenant settings in the database
    const tenantFeatures: Record<string, boolean> = {};
    
    // Apply defaults for features not explicitly set
    Object.entries(FEATURE_FLAGS).forEach(([key, flag]) => {
      tenantFeatures[key] = flag.defaultValue;
    });

    res.json({
      success: true,
      tenantId,
      features: tenantFeatures,
      availableFeatures: FEATURE_FLAGS
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get tenant feature flags',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/feature-flags/categories/:category - Get features by category
 */
router.get('/categories/:category', (req: TenantRequest, res) => {
  try {
    const { category } = req.params;
    
    if (!FEATURE_CATEGORIES[category as keyof typeof FEATURE_CATEGORIES]) {
      return res.status(404).json({
        error: 'Category not found',
        message: `Category '${category}' does not exist`
      });
    }

    const features = Object.values(FEATURE_FLAGS).filter(flag => flag.category === category);

    res.json({
      success: true,
      category,
      categoryName: FEATURE_CATEGORIES[category as keyof typeof FEATURE_CATEGORIES],
      features
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get features by category',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * PUT /api/feature-flags/tenant - Update tenant-specific feature flags
 */
router.put('/tenant', (req: TenantRequest, res) => {
  try {
    const tenantId = req.tenantId || 'admin';
    const { features } = req.body;

    if (!features || typeof features !== 'object') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'features must be an object mapping feature keys to boolean values'
      });
    }

    // Validate that all provided keys are real feature flags
    for (const key of Object.keys(features)) {
      if (!FEATURE_FLAGS[key]) {
        return res.status(400).json({
          error: 'Unknown feature flag',
          message: `Feature flag '${key}' does not exist`
        });
      }
      if (typeof features[key] !== 'boolean') {
        return res.status(400).json({
          error: 'Invalid value',
          message: `Feature flag '${key}' must be a boolean value`
        });
      }
    }

    // In production, this would persist to the database via FeatureFlagService.updateTenantFeatures()
    // For now, merge with defaults and return the updated config
    const updatedFeatures: Record<string, boolean> = {};
    Object.entries(FEATURE_FLAGS).forEach(([key, flag]) => {
      updatedFeatures[key] = features[key] !== undefined ? features[key] : flag.defaultValue;
    });

    res.json({
      success: true,
      tenantId,
      features: updatedFeatures,
      message: 'Feature flags updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to update feature flags',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * POST /api/feature-flags/check - Check multiple features at once
 */
router.post('/check', (req: TenantRequest, res) => {
  try {
    const { features } = req.body;
    
    if (!Array.isArray(features)) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'features must be an array of feature keys'
      });
    }

    const tenantId = req.tenantId || 'admin';
    const results: Record<string, boolean> = {};

    // For now, return default values
    // In production, this would check tenant-specific settings
    features.forEach((featureKey: string) => {
      const feature = FEATURE_FLAGS[featureKey];
      results[featureKey] = feature ? feature.defaultValue : false;
    });

    res.json({
      success: true,
      tenantId,
      results
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to check features',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router; 