import 'dotenv/config';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import * as schema from "@shared/schema";
import fs from 'fs';

const { Pool } = pg;

// Get the current environment
const currentEnv = process.env.NODE_ENV || 'development';
console.log('🌍 Environment:', currentEnv);
console.log('🔗 DATABASE_URL set:', !!process.env.DATABASE_URL);
console.log('🔗 SESSION_SECRET set:', !!process.env.SESSION_SECRET);

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
  
  console.log('🔧 Detected SSL mode:', sslMode);
  
  // Create base pool configuration
  poolConfig = {
    host: url.hostname,
    port: parseInt(url.port) || 5432,
    database: url.pathname.replace('/', ''),
    user: url.username,
    password: url.password,
    // Connection pool settings
    max: 20,
    min: 2,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
  };
  
  // Handle SSL configuration properly
  // Check if this is an RDS connection (AWS managed PostgreSQL)
  const isRDS = url.hostname.includes('.rds.amazonaws.com') || url.hostname.includes('.rds.');
  
  if (sslMode === 'disable') {
    poolConfig.ssl = false;
    console.log('✅ SSL disabled');
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
      console.log('✅ Using SSL with certificate file');
    } else {
      console.log('✅ Using SSL without certificate file (managed service)');
    }
    
    if (isRDS) {
      console.log('🔒 RDS detected - forcing SSL connection');
    }
  }
  
  console.log('✅ Database configuration created successfully');
  console.log('🔗 Host:', poolConfig.host);
  console.log('🔗 Port:', poolConfig.port);
  console.log('🔗 Database:', poolConfig.database);
  console.log('🔒 SSL Mode:', sslMode);
  
} catch (error) {
  console.error('❌ Failed to parse DATABASE_URL:', error);
  
  // Check if this is an RDS connection even in fallback
  const isRDSFallback = dbUrl.includes('.rds.amazonaws.com') || dbUrl.includes('.rds.');
  
  // Fallback: create a safe configuration
  poolConfig = {
    connectionString: dbUrl.split('?')[0], // Remove all query parameters
    ssl: isRDSFallback ? { rejectUnauthorized: false } : false, // Enable SSL for RDS
    max: 20,
    min: 2,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
  };
  
  if (isRDSFallback) {
    console.log('⚠️ Using fallback configuration with SSL enabled for RDS');
  } else {
    console.log('⚠️ Using fallback configuration with SSL disabled');
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

export async function testDatabaseConnection(maxRetries: number = 3): Promise<boolean> {
  console.log('Testing database connection...');
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      console.log(`Database connection attempt ${i + 1}/${maxRetries}...`);
      
      // Use a simple query with timeout
      const client = await pool.connect();
      try {
        await client.query('SELECT 1');
        console.log("✅ Database connection successful");
        lastHealthCheck = Date.now();
        return true;
      } finally {
        client.release();
      }
    } catch (error) {
      console.log(`❌ Database connection attempt ${i + 1} failed:`);
      console.log('Error type:', typeof error);
      console.log('Error instanceof Error:', error instanceof Error);
      
      if (error instanceof Error) {
        console.log('Error message:', error.message);
        console.log('Error name:', error.name);
        console.log('Error stack:', error.stack?.substring(0, 500));
      } else {
        console.log('Error (non-Error object):', JSON.stringify(error, null, 2));
      }
      
      const errorMsg = error instanceof Error ? error.message : String(error);
      
      if (i === maxRetries - 1) {
        console.error('🚨 All database connection attempts failed');
        console.error('Error details:', errorMsg);
        throw new Error(`Database connection failed after ${maxRetries} attempts: ${errorMsg}`);
      }
      
      const waitTime = Math.min(1000 * (i + 1), 5000); // Progressive backoff, max 5s
      console.log(`⏳ Waiting ${waitTime}ms before retry...`);
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
    await testDatabaseConnection(1);
    return true;
  } catch (error) {
    console.warn('⚠️ Database health check failed:', error);
    return false;
  }
}

// Track if pool is already closed to prevent double-close errors
let isPoolClosed = false;

// Graceful shutdown
export async function closeDatabaseConnection(): Promise<void> {
  try {
    if (isPoolClosed) {
      console.log('🔌 Database pool already closed, skipping...');
      return;
    }
    
    console.log('🔌 Closing database connections...');
    await pool.end();
    isPoolClosed = true;
    console.log('✅ Database connections closed');
  } catch (error) {
    console.error('❌ Error closing database connections:', error);
  }
}

// Handle process termination
process.on('SIGTERM', closeDatabaseConnection);
process.on('SIGINT', closeDatabaseConnection);

export async function ensureDatabaseSchema(): Promise<void> {
  try {
    console.log("🔍 Checking database schema...");
    
    // Check if users table exists (as a test for schema initialization)
    const result = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `);
    
    const schemaExists = result.rows[0]?.exists;
    console.log('Schema exists:', schemaExists);
    
    if (!schemaExists) {
      console.log("📋 Database schema not found. Creating basic tables...");
      
      // Create just the essential users table for now
      console.log("👤 Creating users table...");
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
      
      console.log("✅ Essential database schema created successfully");
    } else {
      console.log("✅ Database schema already exists");
    }
  } catch (error) {
    console.error("❌ Error checking/creating database schema:", error);
    throw error;
  }
} 