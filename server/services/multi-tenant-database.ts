import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { config } from '../config/environment';
import { DatabaseStorage } from '../storage';

interface TenantDatabaseConfig {
  tenantId: string;
  databaseUrl: string;
  poolConfig?: {
    max?: number;
    idleTimeoutMillis?: number;
    connectionTimeoutMillis?: number;
  };
}

// Tenant database configurations - each tenant gets its own database
const TENANT_DATABASE_CONFIGS: Record<string, TenantDatabaseConfig> = {
  'admin': {
    tenantId: 'admin',
    databaseUrl: process.env.ADMIN_DATABASE_URL || config.DATABASE_URL,
    poolConfig: { max: 10, idleTimeoutMillis: 30000, connectionTimeoutMillis: 10000 }
  },
  'moravian': {
    tenantId: 'moravian',
    databaseUrl: process.env.MORAVIAN_DATABASE_URL || config.DATABASE_URL,
    poolConfig: { max: 5, idleTimeoutMillis: 30000, connectionTimeoutMillis: 10000 }
  },
  'test': {
    tenantId: 'test',
    databaseUrl: process.env.TEST_DATABASE_URL || config.DATABASE_URL,
    poolConfig: { max: 3, idleTimeoutMillis: 30000, connectionTimeoutMillis: 10000 }
  }
};

// Connection pools for each tenant
const tenantPools = new Map<string, Pool>();
const tenantStorages = new Map<string, DatabaseStorage>();

export class MultiTenantDatabaseService {
  /**
   * Get or create a database pool for a specific tenant
   */
  static getTenantPool(tenantId: string): Pool {
    if (tenantPools.has(tenantId)) {
      return tenantPools.get(tenantId)!;
    }

    const config = TENANT_DATABASE_CONFIGS[tenantId];
    if (!config) {
      throw new Error(`No database configuration found for tenant: ${tenantId}`);
    }

    console.log(`[MULTI-TENANT-DB] Creating pool for tenant ${tenantId} with database: ${config.databaseUrl.split('/').pop()?.split('?')[0]}`);

    const pool = new Pool({
      connectionString: config.databaseUrl,
      ssl: config.databaseUrl.includes('neondb') ? { rejectUnauthorized: false } : false,
      ...config.poolConfig
    });

    // Handle pool errors
    pool.on('error', (err) => {
      console.error(`[MULTI-TENANT-DB] Database pool error for tenant ${tenantId}:`, err);
    });

    tenantPools.set(tenantId, pool);
    console.log(`[MULTI-TENANT-DB] ✓ Created database pool for tenant: ${tenantId}`);
    
    return pool;
  }

  /**
   * Get a tenant-specific database storage instance
   */
  static getTenantStorage(tenantId: string): DatabaseStorage {
    if (tenantStorages.has(tenantId)) {
      return tenantStorages.get(tenantId)!;
    }

    const pool = this.getTenantPool(tenantId);
    const db = drizzle(pool);
    
    // Create a tenant-specific storage instance
    const storage = new DatabaseStorage();
    // Override the db connection with tenant-specific one
    (storage as any).db = db;
    (storage as any).pool = pool;

    tenantStorages.set(tenantId, storage);
    console.log(`[MULTI-TENANT-DB] ✓ Created storage instance for tenant: ${tenantId}`);
    
    return storage;
  }

  /**
   * Add a new tenant database configuration
   */
  static addTenantConfig(tenantId: string, databaseUrl: string, poolConfig?: any): void {
    TENANT_DATABASE_CONFIGS[tenantId] = {
      tenantId,
      databaseUrl,
      poolConfig: poolConfig || { max: 5, idleTimeoutMillis: 30000, connectionTimeoutMillis: 10000 }
    };
    console.log(`[MULTI-TENANT-DB] Added configuration for tenant: ${tenantId}`);
  }

  /**
   * Remove tenant configuration and close connections
   */
  static async removeTenantConfig(tenantId: string): Promise<void> {
    // Close pool if exists
    const pool = tenantPools.get(tenantId);
    if (pool) {
      await pool.end();
      tenantPools.delete(tenantId);
    }

    // Remove storage instance
    tenantStorages.delete(tenantId);

    // Remove configuration
    delete TENANT_DATABASE_CONFIGS[tenantId];
    
    console.log(`[MULTI-TENANT-DB] Removed configuration for tenant: ${tenantId}`);
  }

  /**
   * Get all configured tenant IDs
   */
  static getConfiguredTenants(): string[] {
    return Object.keys(TENANT_DATABASE_CONFIGS);
  }

  /**
   * Test database connection for a tenant
   */
  static async testTenantConnection(tenantId: string): Promise<boolean> {
    try {
      const pool = this.getTenantPool(tenantId);
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      console.log(`[MULTI-TENANT-DB] ✓ Connection test successful for tenant: ${tenantId}`);
      return true;
    } catch (error) {
      console.error(`[MULTI-TENANT-DB] ✗ Connection test failed for tenant ${tenantId}:`, error);
      return false;
    }
  }

  /**
   * Initialize all tenant databases
   */
  static async initializeAllTenants(): Promise<void> {
    const tenantIds = this.getConfiguredTenants();
    console.log(`[MULTI-TENANT-DB] Initializing ${tenantIds.length} tenant databases...`);

    for (const tenantId of tenantIds) {
      try {
        const isHealthy = await this.testTenantConnection(tenantId);
        if (isHealthy) {
          console.log(`[MULTI-TENANT-DB] ✓ Tenant ${tenantId} initialized successfully`);
        } else {
          console.log(`[MULTI-TENANT-DB] ✗ Tenant ${tenantId} connection failed`);
        }
      } catch (error) {
        console.error(`[MULTI-TENANT-DB] ✗ Failed to initialize tenant ${tenantId}:`, error);
      }
    }
  }

  /**
   * Close all database connections
   */
  static async closeAllConnections(): Promise<void> {
    console.log('[MULTI-TENANT-DB] Closing all tenant database connections...');
    
    const closePromises = Array.from(tenantPools.entries()).map(async ([tenantId, pool]) => {
      try {
        await pool.end();
        console.log(`[MULTI-TENANT-DB] ✓ Closed connections for tenant: ${tenantId}`);
      } catch (error) {
        console.error(`[MULTI-TENANT-DB] ✗ Error closing connections for tenant ${tenantId}:`, error);
      }
    });

    await Promise.all(closePromises);
    tenantPools.clear();
    tenantStorages.clear();
  }

  /**
   * Get database statistics for all tenants
   */
  static async getTenantDatabaseStats(): Promise<Record<string, any>> {
    const stats: Record<string, any> = {};
    
    for (const tenantId of this.getConfiguredTenants()) {
      try {
        const pool = this.getTenantPool(tenantId);
        const config = TENANT_DATABASE_CONFIGS[tenantId];
        stats[tenantId] = {
          database: config.databaseUrl.split('/').pop()?.split('?')[0],
          totalConnections: pool.totalCount,
          idleConnections: pool.idleCount,
          waitingClients: pool.waitingCount,
          isHealthy: await this.testTenantConnection(tenantId)
        };
      } catch (error) {
        stats[tenantId] = { error: error instanceof Error ? error.message : String(error) };
      }
    }
    
    return stats;
  }
}

// Export the function for getting tenant storage
export function getTenantStorage(tenantId: string): DatabaseStorage {
  return MultiTenantDatabaseService.getTenantStorage(tenantId);
}

// Initialize on module load
MultiTenantDatabaseService.initializeAllTenants().catch(console.error); 