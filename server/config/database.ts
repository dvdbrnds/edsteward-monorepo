import 'dotenv/config';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { sql } from 'drizzle-orm';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

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

// Create pool and db instances
export const pool = new Pool({ connectionString: dbUrl });
export const db = drizzle(pool, { schema });

// Export environment info for other modules
export const isDevelopment = currentEnv === 'development';
export const isProduction = currentEnv === 'production';
export const isStaging = currentEnv === 'staging';
export const isTest = currentEnv === 'test';

export async function testDatabaseConnection(maxRetries: number = 3): Promise<boolean> {
  console.log('Testing database connection with URL:', dbUrl?.replace(/:[^:]*@/, ':***@'));
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      console.log(`Database connection attempt ${i + 1}/${maxRetries}...`);
      await db.execute(sql`SELECT 1`);
      console.log("✅ Database connection successful");
      return true;
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
        console.error('Database URL format:', dbUrl?.replace(/:[^:]*@/, ':***@'));
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
    console.error("🚨 Failed to ensure database schema:", error);
    // Don't throw - let the app continue and see if it works anyway
    console.log("⚠️  Continuing startup despite schema check failure...");
  }
} 