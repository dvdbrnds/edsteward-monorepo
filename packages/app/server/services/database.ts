/**
 * Database Service - Consolidated Database Access
 * 
 * This is the PRIMARY database service. All database access should go through here.
 * Uses the pool from config/database.ts - DO NOT create additional pools!
 */

import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { 
  pool as sharedPool, 
  db as sharedDb,
  testDatabaseConnection,
  checkConnectionHealth,
  closeDatabaseConnection
} from '../config/database';
import { DatabaseStorage } from '../storage';
import * as schema from '@shared/schema';
import { getTenantDatabaseUrl, getAllTenantDatabaseUrls, isRegistryInitialized } from './tenant-registry';

// Re-export the shared pool and db for backwards compatibility
export { sharedPool as pool, sharedDb as db };

// Re-export health check functions
export { testDatabaseConnection, checkConnectionHealth };

// Default storage instance (singleton)
let storage: DatabaseStorage | null = null;

// Tenant-specific pools and storage instances (only created when multi-tenant is enabled)
const tenantPools = new Map<string, Pool>();
const tenantStorages = new Map<string, DatabaseStorage>();

// Fallback tenant database URL mapping (used when dynamic registry unavailable)
const FALLBACK_TENANT_DATABASE_URLS: Record<string, string> = {
  'moravian': process.env.MORAVIAN_DATABASE_URL || process.env.DATABASE_URL || '',
  'test': process.env.TEST_DATABASE_URL || process.env.DEV_DATABASE_URL || process.env.DATABASE_URL || '',
  'dev': process.env.DEV_DATABASE_URL || process.env.DATABASE_URL || '',
  'staging': process.env.STAGING_DATABASE_URL || process.env.DATABASE_URL || '',
  'admin': process.env.ADMIN_DATABASE_URL || process.env.DATABASE_URL || '',
  'wossamotta': process.env.WOSSAMOTTA_DATABASE_URL || process.env.DATABASE_URL || '',
  'template': process.env.TEMPLATE_DATABASE_URL || process.env.DATABASE_URL || '',
};

/**
 * Get database URL for a tenant - tries dynamic registry first, then fallback
 */
async function resolveTenantDatabaseUrl(tenantId: string): Promise<string | null> {
  // Try dynamic registry first
  if (isRegistryInitialized()) {
    const dynamicUrl = await getTenantDatabaseUrl(tenantId);
    if (dynamicUrl) {
      return dynamicUrl;
    }
  }
  
  // Fallback to hardcoded URLs
  return FALLBACK_TENANT_DATABASE_URLS[tenantId] || null;
}

/**
 * Get the shared database connection pool
 * DO NOT create new pools - use this function!
 */
export function getDatabasePool(): Pool {
  return sharedPool;
}

/**
 * Get the shared Drizzle database instance
 */
export function getDatabase() {
  return sharedDb;
}

/**
 * Get database storage instance - tenant-aware (sync version for backwards compatibility)
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

  // Try to get from dynamic registry synchronously (if already cached)
  let databaseUrl: string | null = null;
  
  // Check dynamic registry URLs (synchronous access to cached values)
  if (isRegistryInitialized()) {
    const allUrls = getAllTenantDatabaseUrls();
    databaseUrl = allUrls[tenantId] || null;
  }
  
  // Fallback to hardcoded URLs
  if (!databaseUrl) {
    databaseUrl = FALLBACK_TENANT_DATABASE_URLS[tenantId] || null;
  }
  
  if (!databaseUrl) {
    if (process.env.MULTI_TENANT === 'true') {
      console.error(`[MULTI-TENANT] REJECTED: No database URL for tenant '${tenantId}' — refusing to fall back to default DB`);
      throw new Error(`Tenant '${tenantId}' is not configured. Contact your administrator.`);
    }
    console.warn(`[SINGLE-TENANT] No database URL for tenant '${tenantId}', using default`);
    if (!storage) {
      storage = new DatabaseStorage();
    }
    return storage;
  }

  console.log(`[MULTI-TENANT] Creating storage for tenant '${tenantId}'`);

  // Create tenant-specific pool (only for tenants with different databases)
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

// Cache for tenant-specific drizzle instances
const tenantDbs = new Map<string, ReturnType<typeof drizzle>>();

/**
 * Get a tenant-specific Drizzle database instance
 * CRITICAL: Use this instead of the global 'db' in all route handlers for tenant isolation!
 * 
 * @param tenantId - The tenant identifier from req.tenantId
 * @returns A Drizzle database instance connected to the tenant's database
 */
export function getTenantDb(tenantId?: string): ReturnType<typeof drizzle> {
  // If no tenant ID or multi-tenant is disabled, use shared db
  if (!tenantId || process.env.MULTI_TENANT !== 'true') {
    return sharedDb;
  }

  // Check cache first
  if (tenantDbs.has(tenantId)) {
    return tenantDbs.get(tenantId)!;
  }

  // Get tenant-specific database URL
  let databaseUrl: string | null = null;
  
  if (isRegistryInitialized()) {
    const allUrls = getAllTenantDatabaseUrls();
    databaseUrl = allUrls[tenantId] || null;
  }
  
  if (!databaseUrl) {
    databaseUrl = FALLBACK_TENANT_DATABASE_URLS[tenantId] || null;
  }
  
  if (!databaseUrl) {
    if (process.env.MULTI_TENANT === 'true') {
      console.error(`[TENANT-DB] REJECTED: No database URL for tenant '${tenantId}' — refusing to fall back to shared DB`);
      throw new Error(`Tenant '${tenantId}' is not configured. Contact your administrator.`);
    }
    console.warn(`[TENANT-DB] No database URL for tenant '${tenantId}', using shared db`);
    return sharedDb;
  }

  console.log(`[TENANT-DB] Creating drizzle instance for tenant '${tenantId}'`);

  // Get or create tenant pool
  let tenantPool = tenantPools.get(tenantId);
  if (!tenantPool) {
    tenantPool = new Pool({
      connectionString: databaseUrl,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
    tenantPool.on('error', (err) => {
      console.error(`[TENANT-DB] Pool error for tenant '${tenantId}':`, err.message);
    });
    tenantPools.set(tenantId, tenantPool);
  }

  // Create drizzle instance for this tenant
  const tenantDb = drizzle(tenantPool, { schema });
  tenantDbs.set(tenantId, tenantDb);
  
  return tenantDb;
}

/**
 * Get tenant-specific db from Express request
 * Use this in route handlers: const db = getDbForRequest(req);
 */
export function getDbForRequest(req: { tenantId?: string }): ReturnType<typeof drizzle> {
  return getTenantDb(req.tenantId);
}

/**
 * Close all database connections (main + tenant pools)
 */
export async function closeDatabaseConnections(): Promise<void> {
  // Close main pool via config/database
  await closeDatabaseConnection();
  
  // Reset storage singleton
  storage = null;
  
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
    const client = await sharedPool.connect();
    await client.query('SELECT NOW()');
    client.release();
    return true;
  } catch (error) {
    console.error('Database connection test failed:', error);
    return false;
  }
}
