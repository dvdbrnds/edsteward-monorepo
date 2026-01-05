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
            if (success) {
            } else {
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
    pool.on('connect', (client) => {
    });
    
    pool.on('acquire', (client) => {
    });
    
    pool.on('remove', (client) => {
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
