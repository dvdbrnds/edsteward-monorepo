/**
 * Multi-Tenant Database Service
 * Provides tenant-aware database connections with automatic routing
 */

import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { config } from '../config/environment';
import { DatabaseStorage } from '../storage';
import * as schema from '@shared/schema';

// Default (single-tenant) pool and storage
let pool: Pool | null = null;
let db: ReturnType<typeof drizzle> | null = null;
let storage: DatabaseStorage | null = null;

// Tenant-specific pools and storage instances
const tenantPools = new Map<string, Pool>();
const tenantStorages = new Map<string, DatabaseStorage>();

// Tenant database URL mapping
const TENANT_DATABASE_URLS: Record<string, string> = {
  'moravian': process.env.MORAVIAN_DATABASE_URL || process.env.DATABASE_URL || '',
  'test': process.env.TEST_DATABASE_URL || process.env.DEV_DATABASE_URL || process.env.DATABASE_URL || '',
  'dev': process.env.DEV_DATABASE_URL || process.env.DATABASE_URL || '',
  'staging': process.env.STAGING_DATABASE_URL || process.env.DATABASE_URL || '',
  'admin': process.env.ADMIN_DATABASE_URL || process.env.DATABASE_URL || '',
  'wossamotta': process.env.WOSSAMOTTA_DATABASE_URL || process.env.DATABASE_URL || '',
};

/**
 * Get database connection pool
 */
export function getDatabasePool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: config.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    pool.on('error', (err) => {
      console.error('🚨 Database pool error detected:', err);
      console.error('Error details:', {
        message: err.message,
        code: (err as any).code,
        errno: (err as any).errno,
        syscall: (err as any).syscall
      });
      
      // Don't let database errors crash the server
      
      // Attempt to recover the connection pool
      setTimeout(() => {
        try {
          // Force a connection test to see if we can recover
          testConnection().then(success => {
            if (!success) {
              console.warn('⚠️  Database pool recovery failed, but server continues');
            }
          }).catch(recoveryError => {
            console.warn('⚠️  Database pool recovery error:', recoveryError);
          });
        } catch (syncError) {
          console.warn('⚠️  Database pool recovery sync error:', syncError);
        }
      }, 5000);
    });
    
    // Add connection event handlers
    pool.on('connect', (_client) => {
    });
    
    pool.on('acquire', (_client) => {
    });
    
    pool.on('remove', (_client) => {
    });
  }

  return pool;
}

/**
 * Get Drizzle database instance
 */
export function getDatabase() {
  if (!db) {
    const pool = getDatabasePool();
    db = drizzle(pool, { schema });
  }

  return db;
}

/**
 * Get database storage instance - tenant-aware
 * @param tenantId - Optional tenant identifier for multi-tenant routing
 */
export function getDatabaseStorage(tenantId?: string): DatabaseStorage {
  // If no tenant ID or multi-tenant is disabled, use default storage
  if (!tenantId || process.env.MULTI_TENANT !== 'true') {
    if (!storage) {
      storage = new DatabaseStorage();
    }
    return storage;
  }

  // Check if we already have a storage instance for this tenant
  if (tenantStorages.has(tenantId)) {
    return tenantStorages.get(tenantId)!;
  }

  // Get the tenant-specific database URL
  const databaseUrl = TENANT_DATABASE_URLS[tenantId];
  if (!databaseUrl) {
    console.warn(`[MULTI-TENANT] No database URL for tenant '${tenantId}', using default`);
    if (!storage) {
      storage = new DatabaseStorage();
    }
    return storage;
  }

  console.log(`[MULTI-TENANT] Creating storage for tenant '${tenantId}'`);

  // Create tenant-specific pool
  const tenantPool = new Pool({
    connectionString: databaseUrl,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  tenantPool.on('error', (err) => {
    console.error(`[MULTI-TENANT] Pool error for tenant '${tenantId}':`, err.message);
  });

  tenantPools.set(tenantId, tenantPool);

  // Create tenant-specific storage with the tenant's database connection
  const tenantDb = drizzle(tenantPool, { schema });
  
  // Pass custom database and pool via constructor
  const tenantStorage = new DatabaseStorage(tenantDb, tenantPool);

  tenantStorages.set(tenantId, tenantStorage);
  
  console.log(`[MULTI-TENANT] Storage created for tenant '${tenantId}'`);
  return tenantStorage;
}

/**
 * Get storage for a specific tenant (explicit multi-tenant call)
 */
export function getTenantStorage(tenantId: string): DatabaseStorage {
  return getDatabaseStorage(tenantId);
}

/**
 * Get storage from Express request (auto-detects tenant)
 * Use this in route handlers: const storage = getStorageForRequest(req);
 */
export function getStorageForRequest(req: { tenantId?: string }): DatabaseStorage {
  return getDatabaseStorage(req.tenantId);
}

/**
 * Close database connections
 */
export async function closeDatabaseConnections(): Promise<void> {
  // Close default pool
  if (pool) {
    await pool.end();
    pool = null;
    db = null;
    storage = null;
  }
  
  // Close all tenant pools
  for (const [tenantId, tenantPool] of tenantPools.entries()) {
    console.log(`[MULTI-TENANT] Closing pool for tenant '${tenantId}'`);
    await tenantPool.end();
  }
  tenantPools.clear();
  tenantStorages.clear();
}

/**
 * Test database connection
 */
export async function testConnection(): Promise<boolean> {
  try {
    const pool = getDatabasePool();
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    return true;
  } catch (error) {
    console.error('Database connection test failed:', error);
    return false;
  }
}
