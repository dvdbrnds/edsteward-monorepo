
import { db } from "./db";
import { sql } from "drizzle-orm";

async function migrateUsersTable() {
  try {
    console.log("Checking users table structure...");
    
    // Check if firstName column exists
    const checkFirstName = await db.execute(sql`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'first_name'
    `);
    
    // If firstName doesn't exist but first_name does, we're good
    // If neither exists, add firstName
    if (checkFirstName.rows.length === 0) {
      console.log("Adding firstName column...");
      await db.execute(sql`
        ALTER TABLE users 
        ADD COLUMN "firstName" TEXT
      `);
      console.log("Added firstName column");
    }
    
    // Check for other required columns
    const checkLastName = await db.execute(sql`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'last_name'
    `);
    
    if (checkLastName.rows.length === 0) {
      console.log("Adding lastName column...");
      await db.execute(sql`
        ALTER TABLE users 
        ADD COLUMN "lastName" TEXT
      `);
      console.log("Added lastName column");
    }
    
    console.log("Migration completed successfully");
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    process.exit(0);
  }
}

migrateUsersTable();
