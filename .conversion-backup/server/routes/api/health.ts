import { Router } from 'express';
import { db } from '../../db';
import { tenants } from '@shared/schema';
import { eq } from 'drizzle-orm';

const router = Router();

router.get('/health', async (req, res) => {
  try {
    // Check if this is a fix request
    const shouldFix = req.query.fix === 'staging-tenant';
    
    if (shouldFix) {
      console.log('🔧 [HEALTH-FIX] Emergency staging tenant fix requested...');
      
      try {
        // Check current staging record
        const currentRecord = await db
          .select()
          .from(tenants)
          .where(eq(tenants.subdomain, 'staging'))
          .limit(1);
        
        if (currentRecord.length > 0 && currentRecord[0].id !== 'staging') {
          console.log(`🔧 [HEALTH-FIX] Found problematic record: id='${currentRecord[0].id}', subdomain='staging'`);
          
          // Delete incorrect record
          await db.delete(tenants).where(eq(tenants.subdomain, 'staging'));
          console.log('🗑️ [HEALTH-FIX] Deleted incorrect staging record');
          
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
          console.log('✅ [HEALTH-FIX] Inserted correct staging record');
          
          return res.json({
            status: 'healthy',
            fixApplied: true,
            message: 'Staging tenant database record has been fixed',
            timestamp: new Date().toISOString()
          });
        } else {
          console.log('ℹ️ [HEALTH-FIX] Staging record is already correct or not found');
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