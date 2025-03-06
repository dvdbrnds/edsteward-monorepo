import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Get the current environment
const currentEnv = process.env.NODE_ENV || 'development';

// Create pool and db instances
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle({ client: pool, schema });

// After db is initialized, we can safely log
console.log(`Database connected in ${currentEnv} environment`);

// Export environment info for other modules
export const isDevelopment = currentEnv === 'development';
export const isProduction = currentEnv === 'production';
export const isStaging = currentEnv === 'staging';
export const isTest = currentEnv === 'test';