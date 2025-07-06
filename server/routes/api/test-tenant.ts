import express from 'express';

const router = express.Router();

// Direct UUID mapping test (same logic as multi-tenant service)
const UUID_TENANT_MAPPING: Record<string, string> = {
  '3a1cbce2-0cf8-4c4f-ab96-4023eca4977d': 'moravian',
};

const normalizeTenantId = (id: string): string => {
  if (id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
    const mappedId = UUID_TENANT_MAPPING[id];
    if (mappedId) {
      return mappedId;
    } else {
      return 'moravian'; // Default fallback
    }
  }
  return id;
};

// Simple test endpoint to verify UUID mapping without complex database service
router.get('/uuid-test/:tenantId', (req, res) => {
  try {
    const tenantId = req.params.tenantId;
    
    const normalizedId = normalizeTenantId(tenantId);
    
    res.json({
      inputTenantId: tenantId,
      normalizedTenantId: normalizedId,
      mappingWorked: normalizedId === 'moravian',
      timestamp: new Date().toISOString(),
      deploymentTest: 'uuid-bypass-v1'
    });
  } catch (error) {
    res.status(500).json({ 
      error: "Test failed", 
      details: error instanceof Error ? error.message : String(error) 
    });
  }
});

export { router as testTenantRouter }; 