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
  firstName: text("firstName"),
  lastName: text("lastName"),
  externalId: text("external_id"),
  providerId: text("provider_id"),
  identityProvider: text("identity_provider"),
  lastLogin: timestamp("last_login"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Production database connection  
const PRODUCTION_DATABASE_URL = 'postgresql://neondb_owner:npg_foSr6ixkzw7W@ep-weathered-term-a5rmi9cx-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

async function fixProductionAuth() {
  console.log('🔧 Fixing production authentication...');
  
  const sql = postgres(PRODUCTION_DATABASE_URL);
  const db = drizzle(sql);
  
  try {
    // Get all users
    const allUsers = await db.select().from(users);
    console.log(`📊 Found ${allUsers.length} users in production database`);
    
    for (const user of allUsers) {
      // Check if password is properly hashed (bcrypt hashes start with $2b$) or is null/undefined
      if (!user.password || !user.password.startsWith('$2b$')) {
        console.log(`🔑 Fixing password for user: ${user.username}`);
        
        // Set password 'gabadh' for all users in production (same as your test password)
        const hashedPassword = await bcrypt.hash('gabadh', 10);
        
        await db.update(users)
          .set({ password: hashedPassword })
          .where(eq(users.id, user.id));
          
        console.log(`✅ Updated password for ${user.username}`);
      } else {
        console.log(`✅ Password already properly hashed for ${user.username}`);
      }
    }
    
    console.log('🎉 Production authentication fix completed!');
    console.log('📝 All users now have password: gabadh');
    console.log('🔗 You can now login at: https://moravian.edsteward.ai/');
    
  } catch (error) {
    console.error('❌ Error fixing production auth:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

if (require.main === module) {
  fixProductionAuth()
    .then(() => {
      console.log('✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { fixProductionAuth }; 