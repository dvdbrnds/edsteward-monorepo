/**
 * Single-Tenant Database Service
 * Simplified database connection without multi-tenant complexity
 */

import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { config } from '../config/environment';
import { DatabaseStorage } from '../storage';
import * as schema from '@shared/schema';

let pool: Pool | null = null;
let db: ReturnType<typeof drizzle> | null = null;
let storage: DatabaseStorage | null = null;

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
      console.error('Unexpected error on idle client', err);
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
 * Get database storage instance
 */
export function getDatabaseStorage(): DatabaseStorage {
  if (!storage) {
    storage = new DatabaseStorage();
  }

  return storage;
}

/**
 * Close database connections
 */
export async function closeDatabaseConnections(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    db = null;
    storage = null;
  }
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
