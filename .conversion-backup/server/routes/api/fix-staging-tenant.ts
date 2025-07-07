import { Router } from 'express';
import { db } from '../../db';
import { tenants } from '@shared/schema';
import { eq, or, like } from 'drizzle-orm';

const router = Router();

/**
 * POST /api/fix-staging-tenant
 * Emergency endpoint to fix the staging tenant database record
 * This corrects the staging tenant ID from 'admin' to 'staging'
 */
router.post('/fix-staging-tenant', async (req, res) => {
  try {
    console.log('🔧 [FIX-STAGING-TENANT] Starting database fix...');
    
    // Security check - only allow in development or with special header
    const isDevelopment = process.env.NODE_ENV === 'development';
    const hasAdminKey = req.headers['x-admin-key'] === process.env.ADMIN_FIX_KEY;
    
    if (!isDevelopment && !hasAdminKey) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'This endpoint requires admin authorization'
      });
    }

    // Step 1: Check current state
    console.log('🔍 [FIX-STAGING-TENANT] Checking current staging records...');
    const currentRecords = await db
      .select()
      .from(tenants)
      .where(
        or(
          eq(tenants.subdomain, 'staging'),
          eq(tenants.id, 'staging'),
          like(tenants.name, '%Staging%')
        )
      );

    console.log(`📋 [FIX-STAGING-TENANT] Found ${currentRecords.length} staging-related records`);
    currentRecords.forEach(record => {
      console.log(`   - ID: ${record.id}, Subdomain: ${record.subdomain}, Name: ${record.name}`);
    });

    // Step 2: Find the problematic record
    const stagingSubdomainRecord = currentRecords.find(r => r.subdomain === 'staging');
    let fixesApplied = [];

    if (stagingSubdomainRecord && stagingSubdomainRecord.id !== 'staging') {
      console.log(`🔧 [FIX-STAGING-TENANT] Found problematic record: subdomain='staging' but id='${stagingSubdomainRecord.id}'`);
      
      // Delete the incorrect record
      await db.delete(tenants).where(eq(tenants.subdomain, 'staging'));
      console.log('🗑️ [FIX-STAGING-TENANT] Deleted incorrect staging record');
      fixesApplied.push('Deleted incorrect staging record with wrong ID');
    }

    // Step 3: Check if correct staging record exists
    const correctRecord = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, 'staging'))
      .limit(1);

    if (correctRecord.length === 0) {
      console.log('➕ [FIX-STAGING-TENANT] Inserting correct staging tenant record...');
      
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
      
      console.log('✅ [FIX-STAGING-TENANT] Inserted correct staging tenant record');
      fixesApplied.push('Inserted correct staging tenant record');
    } else {
      console.log('ℹ️ [FIX-STAGING-TENANT] Correct staging record already exists');
    }

    // Step 4: Verify the fix
    console.log('🔍 [FIX-STAGING-TENANT] Verifying fix...');
    const finalRecords = await db
      .select()
      .from(tenants)
      .where(
        or(
          eq(tenants.subdomain, 'staging'),
          eq(tenants.id, 'staging')
        )
      );

    const correctStagingRecord = finalRecords.find(r => r.id === 'staging' && r.subdomain === 'staging');
    const success = !!correctStagingRecord;

    if (success) {
      console.log('🎉 [FIX-STAGING-TENANT] SUCCESS: Staging tenant database record is now correct!');
    } else {
      console.log('❌ [FIX-STAGING-TENANT] FAILED: Staging tenant record is still incorrect');
    }

    // Return results
    res.json({
      success,
      message: success 
        ? 'Staging tenant database record fixed successfully'
        : 'Failed to fix staging tenant database record',
      fixesApplied,
      currentState: finalRecords.map(r => ({
        id: r.id,
        subdomain: r.subdomain,
        name: r.name,
        status: r.status
      })),
      nextSteps: success ? [
        'Test staging tenant: curl -s https://staging.edsteward.ai/api/health | jq .tenant.tenantId',
        'Expected result: tenantId should now be "staging" instead of "admin"'
      ] : [
        'Check logs for errors',
        'May need manual database intervention'
      ]
    });

  } catch (error) {
    console.error('❌ [FIX-STAGING-TENANT] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Database fix failed',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router; 