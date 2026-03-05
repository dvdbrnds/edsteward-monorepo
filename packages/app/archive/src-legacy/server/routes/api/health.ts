import { Router } from 'express';
import { getDbForRequest } from '../../services/database';
import { tenants } from '@shared/schema';
import { eq } from 'drizzle-orm';

const router = Router();

router.get('/health', async (req, res) => {
  try {
    // TENANT ISOLATION: Get tenant-specific database
    const db = getDbForRequest(req);
    // Check if this is a fix request
    const shouldFix = req.query.fix === 'staging-tenant';
    
    if (shouldFix) {
      
      try {
        // Check current staging record
        const currentRecord = await db
          .select()
          .from(tenants)
          .where(eq(tenants.subdomain, 'staging'))
          .limit(1);
        
        if (currentRecord.length > 0 && currentRecord[0].id !== 'staging') {
          
          // Delete incorrect record
          await db.delete(tenants).where(eq(tenants.subdomain, 'staging'));
          
          // Insert correct record
          await db.insert(tenants).values({
            id: 'staging',
            name: 'EdSteward Staging Environment',
            domain: 'staging.edsteward.ai',
            subdomain: 'staging',
            databaseName: 'edsteward_staging',
            status: 'active',
            settings: {
              allowedDomains: ['edsteward.ai', 'staging.edsteward.ai'],
              defaultRole: 'admin',
              enableAutoProvisioning: true,
              features: {
                apiAccess: true,
                customDomain: false,
                ssoEnabled: false,
                maxUsers: 1000,
                maxRegulations: 10000
              }
            }
          });
          
          return res.json({
            status: 'healthy',
            fixApplied: true,
            message: 'Staging tenant database record has been fixed',
            timestamp: new Date().toISOString()
          });
        } else {
          return res.json({
            status: 'healthy',
            fixApplied: false,
            message: 'Staging tenant record is already correct',
            timestamp: new Date().toISOString()
          });
        }
      } catch (fixError) {
        console.error('❌ [HEALTH-FIX] Fix failed:', fixError);
        return res.status(500).json({
          status: 'error',
          fixApplied: false,
          error: 'Database fix failed',
          message: fixError instanceof Error ? fixError.message : String(fixError),
          timestamp: new Date().toISOString()
        });
      }
    }

    // Regular health check continues here...
    // ... existing health check code ...
  } catch (error) {
    console.error('❌ [HEALTH-CHECK] Health check failed:', error);
    return res.status(500).json({
      status: 'error',
      error: 'Health check failed',
      message: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    });
  }
});

export default router; 