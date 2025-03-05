import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

// Get the appropriate DATABASE_URL based on environment
const dbUrl = process.env.NODE_ENV === 'staging' 
  ? process.env.STAGING_DATABASE_URL 
  : process.env.DATABASE_URL;

if (!dbUrl) {
  throw new Error(
    "Database URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: dbUrl });
export const db = drizzle({ client: pool, schema });