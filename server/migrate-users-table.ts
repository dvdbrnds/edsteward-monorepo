
import { db } from "./db";
import { sql } from "drizzle-orm";

async function migrateUsersTable() {
  try {
    
    // Check if firstName column exists (trying both camelCase and snake_case)
    const checkFirstName = await db.execute(sql`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'users' AND (column_name = 'firstName' OR column_name = 'first_name')
    `);
    
    // If neither exists, add firstName
    if (checkFirstName.rows.length === 0) {
      await db.execute(sql`
        ALTER TABLE users 
        ADD COLUMN "firstName" TEXT
      `);
    } else {
      
      // If first_name exists but firstName doesn't, rename it
      if (checkFirstName.rows[0].column_name === 'first_name') {
        await db.execute(sql`
          ALTER TABLE users 
          RENAME COLUMN "first_name" TO "firstName"
        `);
      }
    }
    
    // Check for lastName column (trying both camelCase and snake_case)
    const checkLastName = await db.execute(sql`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'users' AND (column_name = 'lastName' OR column_name = 'last_name')
    `);
    
    if (checkLastName.rows.length === 0) {
      await db.execute(sql`
        ALTER TABLE users 
        ADD COLUMN "lastName" TEXT
      `);
    } else {
      
      // If last_name exists but lastName doesn't, rename it
      if (checkLastName.rows[0].column_name === 'last_name') {
        await db.execute(sql`
          ALTER TABLE users 
          RENAME COLUMN "last_name" TO "lastName"
        `);
      }
    }
    
    // Check for external_id column
    const checkExternalId = await db.execute(sql`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'external_id'
    `);
    
    if (checkExternalId.rows.length === 0) {
      await db.execute(sql`
        ALTER TABLE users 
        ADD COLUMN "external_id" TEXT UNIQUE
      `);
    } else {
    }
    
    // Check for provider_id column
    const checkProviderId = await db.execute(sql`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'provider_id'
    `);
    
    if (checkProviderId.rows.length === 0) {
      await db.execute(sql`
        ALTER TABLE users 
        ADD COLUMN "provider_id" TEXT
      `);
    } else {
    }
    
    // Check for identity_provider column
    const checkIdentityProvider = await db.execute(sql`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'identity_provider'
    `);
    
    if (checkIdentityProvider.rows.length === 0) {
      await db.execute(sql`
        ALTER TABLE users 
        ADD COLUMN "identity_provider" TEXT
      `);
    } else {
    }
    
    // Check for last_login column
    const checkLastLogin = await db.execute(sql`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'last_login'
    `);
    
    if (checkLastLogin.rows.length === 0) {
      await db.execute(sql`
        ALTER TABLE users 
        ADD COLUMN "last_login" TIMESTAMP
      `);
    } else {
    }
    
    // Check for created_at column
    const checkCreatedAt = await db.execute(sql`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'created_at'
    `);
    
    if (checkCreatedAt.rows.length === 0) {
      await db.execute(sql`
        ALTER TABLE users 
        ADD COLUMN "created_at" TIMESTAMP DEFAULT NOW()
      `);
    } else {
    }
    
    // Check for updated_at column
    const checkUpdatedAt = await db.execute(sql`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'updated_at'
    `);
    
    if (checkUpdatedAt.rows.length === 0) {
      await db.execute(sql`
        ALTER TABLE users 
        ADD COLUMN "updated_at" TIMESTAMP DEFAULT NOW()
      `);
    } else {
    }
    
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    process.exit(0);
  }
}

migrateUsersTable();
