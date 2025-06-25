import { Router, Response } from 'express';
import { tenantMiddleware } from '../../middleware/tenant';
import { FEATURE_FLAGS, FEATURE_CATEGORIES } from '@shared/feature-flags';
import { EdStewardTenantRequest as TenantRequest } from '../../middleware/tenantDetection';

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