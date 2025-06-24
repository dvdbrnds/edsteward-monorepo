#!/usr/bin/env node

const bcrypt = require('bcryptjs');
const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
const { eq } = require('drizzle-orm');
const { pgTable, serial, text, timestamp, boolean } = require('drizzle-orm/pg-core');

// Define users table schema inline
const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("user"),
  department: text("department"),
  email: text("email"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  externalId: text("external_id"),
  providerId: text("provider_id"),
  identityProvider: text("identity_provider"),
  lastLogin: timestamp("last_login"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Staging database connection
const STAGING_DATABASE_URL = 'postgresql://edsteward_staging_owner:gXJPTHFPIlte@ep-bitter-cell-a5b6k5aq.us-east-1.aws.neon.tech/edsteward_staging?sslmode=require';

async function fixStagingAuth() {
  console.log('🔧 Fixing staging authentication...');
  
  const sql = postgres(STAGING_DATABASE_URL);
  const db = drizzle(sql);
  
  try {
    // Get all users
    const allUsers = await db.select().from(users);
    console.log(`📊 Found ${allUsers.length} users in staging database`);
    
    for (const user of allUsers) {
      // Check if password is properly hashed (bcrypt hashes start with $2b$)
      if (!user.password || !user.password.startsWith('$2b$')) {
        console.log(`🔑 Fixing password for user: ${user.username}`);
        
        // Set a default password (gabadh) for all users in staging
        const hashedPassword = await bcrypt.hash('gabadh', 10);
        
        await db.update(users)
          .set({ password: hashedPassword })
          .where(eq(users.id, user.id));
          
        console.log(`✅ Updated password for ${user.username}`);
      } else {
        console.log(`✅ Password already properly hashed for ${user.username}`);
      }
    }
    
    console.log('🎉 Staging authentication fix completed!');
    console.log('📝 All users now have password: gabadh');
    
  } catch (error) {
    console.error('❌ Error fixing staging auth:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

// Run the fix
fixStagingAuth().catch(console.error); 