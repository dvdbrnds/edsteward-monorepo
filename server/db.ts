import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";
import { syslog, LogFacility, LogLevel } from './services/syslog';

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
export const db = drizzle({ client: pool, schema });

// Export environment info for other modules
export const isDevelopment = currentEnv === 'development';
export const isProduction = currentEnv === 'production';
export const isStaging = currentEnv === 'staging';
export const isTest = currentEnv === 'test';

// Initialize logging after db setup
export function initializeLogging() {
  console.log(`Database connected in ${currentEnv} environment`);

  if (currentEnv === 'production') {
    syslog.log(LogFacility.LOCAL0, LogLevel.WARNING, 
      "Connecting to PRODUCTION database - ensure all operations are approved");
  }

  syslog.log(LogFacility.LOCAL0, LogLevel.INFO, 
    `Database connection initialized for ${currentEnv} environment`);
}