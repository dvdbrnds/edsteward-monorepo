import { db } from '../db';
import { tenants } from '@shared/schema';

/**
 * Migration script to populate tenants table with existing hardcoded tenants
 * Run this after creating the tenants table to ensure backward compatibility
 */
export async function populateTenantsTable() {
  console.log('[MIGRATION] Starting tenants table population...');

  const existingTenants = [
    {
      id: 'admin',
      name: 'EdSteward Admin',
      domain: 'edsteward.ai',
      subdomain: 'admin',
      databaseName: 'edsteward_admin',
      status: 'active' as const,
      settings: {
        allowedDomains: ['edsteward.ai'],
        defaultRole: 'admin' as const,
        enableAutoProvisioning: false,
        region: 'us-east-1',
        timeZone: 'America/New_York',
        customBranding: {
          primaryColor: '#2563eb',
          secondaryColor: '#1e40af'
        },
        features: {
          maxUsers: 1000,
          maxRegulations: 10000,
          apiAccess: true,
          customDomain: true,
          ssoEnabled: true
        }
      }
    },
    {
      id: 'moravian',
      name: 'Moravian University',
      domain: 'moravian.edu',
      subdomain: 'moravian',
      databaseName: 'edsteward_moravian',
      status: 'active' as const,
      settings: {
        allowedDomains: ['moravian.edu'],
        defaultRole: 'user' as const,
        enableAutoProvisioning: true,
        region: 'us-east-1',
        timeZone: 'America/New_York',
        customBranding: {
          primaryColor: '#0066cc',
          secondaryColor: '#004499'
        },
        features: {
          maxUsers: 500,
          maxRegulations: 5000,
          apiAccess: true,
          customDomain: false,
          ssoEnabled: true
        }
      }
    }
  ];

  try {
    for (const tenant of existingTenants) {
      console.log(`[MIGRATION] Inserting tenant: ${tenant.name} (${tenant.id})`);
      
      // Use INSERT ... ON CONFLICT DO UPDATE to handle existing records
      await db
        .insert(tenants)
        .values(tenant)
        .onConflictDoUpdate({
          target: tenants.id,
          set: {
            name: tenant.name,
            domain: tenant.domain,
            subdomain: tenant.subdomain,
            databaseName: tenant.databaseName,
            status: tenant.status,
            settings: tenant.settings,
            updatedAt: new Date()
          }
        });
      
      console.log(`[MIGRATION] ✓ Successfully inserted/updated tenant: ${tenant.id}`);
    }

    console.log('[MIGRATION] ✓ Tenants table population completed successfully');
    
    // Verify the data was inserted
    const insertedTenants = await db.select().from(tenants);
    console.log(`[MIGRATION] ✓ Total tenants in database: ${insertedTenants.length}`);
    
    return insertedTenants;
  } catch (error) {
    console.error('[MIGRATION] ✗ Failed to populate tenants table:', error);
    throw error;
  }
}

// Run migration if this file is executed directly (ES module version)
if (import.meta.url === `file://${process.argv[1]}`) {
  populateTenantsTable()
    .then(() => {
      console.log('[MIGRATION] Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('[MIGRATION] Migration failed:', error);
      process.exit(1);
    });
} 