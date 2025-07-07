import express from 'express';
import { MultiTenantDatabaseService } from '../../services/multi-tenant-database';

const router = express.Router();

// Debug endpoint to test tenant UUID mapping
router.get('/tenant-mapping/:tenantId', async (req, res) => {
  try {
    const tenantId = req.params.tenantId;
    
    // Test the tenant database service
    const configuredTenants = MultiTenantDatabaseService.getConfiguredTenants();
    
    let result = {
      inputTenantId: tenantId,
      configuredTenants: configuredTenants,
      normalizationTest: null as any,
      dbConfigExists: false,
      error: null as any
    };
    
    try {
      // Try to get tenant storage to see what happens
      const storage = MultiTenantDatabaseService.getTenantStorage(tenantId);
      result.normalizationTest = 'SUCCESS - Storage created';
      result.dbConfigExists = true;
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
      result.normalizationTest = 'FAILED';
      result.dbConfigExists = false;
    }
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ 
      error: "Debug endpoint failed", 
      details: error instanceof Error ? error.message : String(error) 
    });
  }
});

export { router as debugRouter }; 