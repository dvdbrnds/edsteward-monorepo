import 'dotenv/config';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { sql } from 'drizzle-orm';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

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

// Create pool and db instances
export const pool = new Pool({ connectionString: dbUrl });
export const db = drizzle(pool, { schema });

// Export environment info for other modules
export const isDevelopment = currentEnv === 'development';
export const isProduction = currentEnv === 'production';
export const isStaging = currentEnv === 'staging';
export const isTest = currentEnv === 'test';

export async function testDatabaseConnection(maxRetries: number = 3): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await db.execute(sql`SELECT 1`);
      console.log("Database connection successful");
      return true;
    } catch (error) {
      if (i === maxRetries - 1) {
        throw new Error(`Database connection failed after ${maxRetries} attempts: ${error instanceof Error ? error.message : String(error)}`);
      }
      console.log(`Database connection attempt ${i + 1} failed, retrying...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  return false;
} 