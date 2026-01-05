import 'dotenv/config';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import * as schema from "@shared/schema";
import fs from 'fs';

const { Pool } = pg;

// Get the current environment
const currentEnv = process.env.NODE_ENV || 'development';

// Environment-specific database URLs
const dbUrls = {
  production: process.env.DATABASE_URL,
  staging: currentEnv === 'staging' ? process.env.DATABASE_URL : null,
  development: process.env.DATABASE_URL,
  test: currentEnv === 'test' ? process.env.DATABASE_URL : null
};

// Get the appropriate DATABASE_URL based on environment
const dbUrl = dbUrls[currentEnv as keyof typeof dbUrls];

if (!dbUrl) {
  throw new Error(
    `Database URL must be set for ${currentEnv} environment. Check environment variables.`
  );
}

// CRITICAL FIX: Parse the URL and create proper SSL configuration
// This avoids the pg-connection-string library trying to read SSL cert files from malformed paths
let poolConfig: any;

try {
  // Parse the database URL
  const url = new URL(dbUrl);
  const urlParams = new URLSearchParams(url.search);
  
  // Extract SSL mode from URL parameters
  const sslMode = urlParams.get('sslmode') || 'prefer';
  
  
  // Create base pool configuration
  poolConfig = {
    host: url.hostname,
    port: parseInt(url.port) || 5432,
    database: url.pathname.replace('/', ''),
    user: url.username,
    password: url.password,
    // Connection pool settings - more resilient for Neon
    max: 10, // Reduced max connections for Neon
    min: 1,  // Reduced min connections
    connectionTimeoutMillis: 30000, // Increased from 10s to 30s for Neon
    idleTimeoutMillis: 60000, // Increased from 30s to 60s
    acquireTimeoutMillis: 30000, // New: time to wait for connection from pool
    createTimeoutMillis: 30000, // New: time to wait for new connection creation
    destroyTimeoutMillis: 5000, // New: time to wait for connection destruction
    reapIntervalMillis: 1000, // New: how often to check for idle connections
    createRetryIntervalMillis: 200, // New: wait between connection creation retries
    keepAlive: true,
    keepAliveInitialDelayMillis: 30000, // Increased from 10s to 30s
    // Add query timeout for individual queries
    query_timeout: 60000, // 60 second query timeout
    // Add statement timeout (PostgreSQL setting)
    statement_timeout: 30000, // 30 second statement timeout
  };
  
  // Handle SSL configuration properly
  // Check if this is an RDS connection (AWS managed PostgreSQL)
  const isRDS = url.hostname.includes('.rds.amazonaws.com') || url.hostname.includes('.rds.');
  
  if (sslMode === 'disable') {
    poolConfig.ssl = false;
  } else if (sslMode === 'require' || sslMode === 'prefer' || isRDS) {
    // For RDS or managed PostgreSQL services, we typically need SSL
    // but we don't need to specify certificate files
    poolConfig.ssl = {
      rejectUnauthorized: false, // For managed services, we trust the certificate
    };
    
    // Only add certificate file if it actually exists
    const certPath = '/app/ssl/rds-ca-2019-root.pem';
    if (fs.existsSync(certPath)) {
      poolConfig.ssl.ca = fs.readFileSync(certPath);
    } else {
    }
    
    if (isRDS) {
    }
  }
  
  
} catch (error) {
  console.error('❌ Failed to parse DATABASE_URL:', error);
  
  // Check if this is an RDS connection even in fallback
  const isRDSFallback = dbUrl.includes('.rds.amazonaws.com') || dbUrl.includes('.rds.');
  
  // Fallback: create a safe configuration
  poolConfig = {
    connectionString: dbUrl.split('?')[0], // Remove all query parameters
    ssl: isRDSFallback ? { rejectUnauthorized: false } : false, // Enable SSL for RDS
    // Connection pool settings - more resilient for Neon
    max: 10, // Reduced max connections for Neon
    min: 1,  // Reduced min connections
    connectionTimeoutMillis: 30000, // Increased from 10s to 30s for Neon
    idleTimeoutMillis: 60000, // Increased from 30s to 60s
    acquireTimeoutMillis: 30000, // New: time to wait for connection from pool
    createTimeoutMillis: 30000, // New: time to wait for new connection creation
    destroyTimeoutMillis: 5000, // New: time to wait for connection destruction
    reapIntervalMillis: 1000, // New: how often to check for idle connections
    createRetryIntervalMillis: 200, // New: wait between connection creation retries
    keepAlive: true,
    keepAliveInitialDelayMillis: 30000, // Increased from 10s to 30s
    // Add query timeout for individual queries
    query_timeout: 60000, // 60 second query timeout
    // Add statement timeout (PostgreSQL setting)
    statement_timeout: 30000, // 30 second statement timeout
  };
  
  if (isRDSFallback) {
  } else {
  }
}

// Create the connection pool
export const pool = new Pool(poolConfig);

export const db = drizzle(pool, { schema });

// Export environment info for other modules
export const isDevelopment = currentEnv === 'development';
export const isProduction = currentEnv === 'production';
export const isStaging = currentEnv === 'staging';
export const isTest = currentEnv === 'test';

// Add connection health monitoring
let lastHealthCheck = 0;
const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds

export async function testDatabaseConnection(maxRetries: number = 5): Promise<boolean> {
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      
      // Use a simple query with timeout
      const client = await pool.connect();
      try {
        // Set a shorter statement timeout for the test query
        await client.query('SET statement_timeout = 15000'); // 15 seconds
        await client.query('SELECT 1');
        lastHealthCheck = Date.now();
        return true;
      } finally {
        client.release();
      }
    } catch (error) {
      
      if (error instanceof Error) {
        
        // Log specific error types
        if (error.message.includes('ETIMEDOUT')) {
        } else if (error.message.includes('ECONNREFUSED')) {
        } else if (error.message.includes('ENOTFOUND')) {
        } else if (error.message.includes('timeout')) {
        }
        
        // Only log stack trace for non-timeout errors
        if (!error.message.includes('timeout') && !error.message.includes('ETIMEDOUT')) {
        }
      } else {
      }
      
      const errorMsg = error instanceof Error ? error.message : String(error);
      
      if (i === maxRetries - 1) {
        console.error('🚨 All database connection attempts failed');
        console.error('Error details:', errorMsg);
        throw new Error(`Database connection failed after ${maxRetries} attempts: ${errorMsg}`);
      }
      
      // Exponential backoff with jitter: 2^i * 1000ms + random(0-1000ms)
      const baseWaitTime = Math.pow(2, i) * 1000;
      const jitter = Math.random() * 1000;
      const waitTime = Math.min(baseWaitTime + jitter, 30000); // Max 30 seconds
      
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  return false;
}

// Health check function
export async function checkConnectionHealth(): Promise<boolean> {
  const now = Date.now();
  if (now - lastHealthCheck < HEALTH_CHECK_INTERVAL) {
    return true; // Recently checked, assume healthy
  }
  
  try {
    // Use a more lenient health check - try twice before giving up
    await testDatabaseConnection(2);
    return true;
  } catch (error) {
    console.warn('⚠️ Database health check failed:', 
      error instanceof Error ? error.message : String(error));
    return false;
  }
}

// Track if pool is already closed to prevent double-close errors
let isPoolClosed = false;

// Graceful shutdown
export async function closeDatabaseConnection(): Promise<void> {
  try {
    if (isPoolClosed) {
      return;
    }
    
    await pool.end();
    isPoolClosed = true;
  } catch (error) {
    console.error('❌ Error closing database connections:', error);
  }
}

// Handle process termination
process.on('SIGTERM', closeDatabaseConnection);
process.on('SIGINT', closeDatabaseConnection);

export async function ensureDatabaseSchema(): Promise<void> {
  try {
    
    // Check if users table exists (as a test for schema initialization)
    const result = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `);
    
    const schemaExists = result.rows[0]?.exists;
    
    if (!schemaExists) {
      
      // Create just the essential users table for now
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS users (
          id serial PRIMARY KEY,
          username text NOT NULL UNIQUE,
          password text NOT NULL,
          role text NOT NULL DEFAULT 'user',
          department text,
          email text NOT NULL,
          "firstName" text,
          "lastName" text,
          external_id text UNIQUE,
          provider_id text,
          identity_provider text,
          last_login timestamp,
          created_at timestamp NOT NULL DEFAULT now(),
          updated_at timestamp NOT NULL DEFAULT now()
        );
      `);
      
    } else {
    }
  } catch (error) {
    console.error("❌ Error checking/creating database schema:", error);
    throw error;
  }
} 