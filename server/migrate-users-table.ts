
import { db } from "./db";
import { sql } from "drizzle-orm";

async function migrateUsersTable() {
  try {
    console.log("Checking users table structure...");
    
    // Check if firstName column exists (trying both camelCase and snake_case)
    const checkFirstName = await db.execute(sql`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'users' AND (column_name = 'firstName' OR column_name = 'first_name')
    `);
    
    // If neither exists, add firstName
    if (checkFirstName.rows.length === 0) {
      console.log("Adding firstName column...");
      await db.execute(sql`
        ALTER TABLE users 
        ADD COLUMN "firstName" TEXT
      `);
      console.log("Added firstName column");
    } else {
      console.log("firstName column already exists as:", checkFirstName.rows[0].column_name);
      
      // If first_name exists but firstName doesn't, rename it
      if (checkFirstName.rows[0].column_name === 'first_name') {
        console.log("Renaming first_name to firstName...");
        await db.execute(sql`
          ALTER TABLE users 
          RENAME COLUMN "first_name" TO "firstName"
        `);
        console.log("Renamed first_name to firstName");
      }
    }
    
    // Check for lastName column (trying both camelCase and snake_case)
    const checkLastName = await db.execute(sql`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'users' AND (column_name = 'lastName' OR column_name = 'last_name')
    `);
    
    if (checkLastName.rows.length === 0) {
      console.log("Adding lastName column...");
      await db.execute(sql`
        ALTER TABLE users 
        ADD COLUMN "lastName" TEXT
      `);
      console.log("Added lastName column");
    } else {
      console.log("lastName column already exists as:", checkLastName.rows[0].column_name);
      
      // If last_name exists but lastName doesn't, rename it
      if (checkLastName.rows[0].column_name === 'last_name') {
        console.log("Renaming last_name to lastName...");
        await db.execute(sql`
          ALTER TABLE users 
          RENAME COLUMN "last_name" TO "lastName"
        `);
        console.log("Renamed last_name to lastName");
      }
    }
    
    // Check for external_id column
    const checkExternalId = await db.execute(sql`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'external_id'
    `);
    
    if (checkExternalId.rows.length === 0) {
      console.log("Adding external_id column...");
      await db.execute(sql`
        ALTER TABLE users 
        ADD COLUMN "external_id" TEXT UNIQUE
      `);
      console.log("Added external_id column");
    } else {
      console.log("external_id column already exists");
    }
    
    // Check for provider_id column
    const checkProviderId = await db.execute(sql`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'provider_id'
    `);
    
    if (checkProviderId.rows.length === 0) {
      console.log("Adding provider_id column...");
      await db.execute(sql`
        ALTER TABLE users 
        ADD COLUMN "provider_id" TEXT
      `);
      console.log("Added provider_id column");
    } else {
      console.log("provider_id column already exists");
    }
    
    console.log("Migration completed successfully");
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    process.exit(0);
  }
}

migrateUsersTable();
