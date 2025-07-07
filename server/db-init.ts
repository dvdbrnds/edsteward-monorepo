import { db } from './config/database';
import { sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { getDatabaseStorage } from './services/database';

export async function initializeDatabase() {
  console.log('🚀 Starting database initialization...');
  
  try {
    // Test database connection first
    await db.execute(sql`SELECT 1`);
    console.log('✅ Database connection successful');

    // Check if users table exists and has data
    const userCheck = await db.execute(sql`
      SELECT COUNT(*) as count FROM information_schema.tables 
      WHERE table_name = 'users'
    `);
    
    if (userCheck.rows[0]?.count === '0') {
      console.log('📋 Creating database schema...');
      
      // Create essential tables
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(255) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          email VARCHAR(255) NOT NULL,
          role VARCHAR(50) DEFAULT 'user',
          department VARCHAR(255),
          "firstName" VARCHAR(255),
          "lastName" VARCHAR(255),
          external_id VARCHAR(255) UNIQUE,
          provider_id VARCHAR(255),
          identity_provider VARCHAR(255),
          last_login TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `);

      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS regulations (
          id SERIAL PRIMARY KEY,
          title VARCHAR(500) NOT NULL,
          description TEXT,
          category VARCHAR(255),
          status VARCHAR(50) DEFAULT 'active',
          effective_date DATE,
          review_date DATE,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `);

      console.log('✅ Database schema created');
    }

    // Check if we have users
    const existingUsers = await db.execute(sql`SELECT COUNT(*) as count FROM users`);
    const userCount = parseInt(existingUsers.rows[0]?.count || '0');
    
    if (userCount === 0) {
      console.log('👤 Creating essential users...');
      
      // Create admin user
      await db.execute(sql`
        INSERT INTO users (username, password, email, role, "firstName", "lastName", department)
        VALUES ('admin', 'admin123', 'admin@edsteward.ai', 'admin', 'Admin', 'User', 'IT')
      `);

      // Create your user account
      await db.execute(sql`
        INSERT INTO users (username, password, email, role, "firstName", "lastName", department)
        VALUES ('dvdbrnds', 'password', 'dvdbrnds@moravian.edu', 'admin', 'David', 'Bernards', 'IT')
      `);

      // Create test user from your exports
      await db.execute(sql`
        INSERT INTO users (username, password, email, role, "firstName", "lastName", department)
        VALUES ('nasol', 'password', 'nasol@moravian.edu', 'user', 'Nick', 'Asol', 'Compliance')
      `);

      console.log('✅ Essential users created');
    }

    // Try to load data from exports if available
    try {
      const exportPath = path.join(process.cwd(), 'exports/complete_export.sql');
      if (fs.existsSync(exportPath)) {
        console.log('📊 Loading data from exports...');
        const exportSQL = fs.readFileSync(exportPath, 'utf8');
        
        // Extract and execute INSERT statements
        const insertStatements = exportSQL
          .split('\n')
          .filter(line => line.trim().startsWith('INSERT INTO'))
          .slice(0, 50); // Limit to first 50 to avoid timeout

        let successCount = 0;
        for (const statement of insertStatements) {
          try {
            await db.execute(sql.raw(statement));
            successCount++;
          } catch (error) {
            // Continue on errors - some inserts might conflict
          }
        }
        
        console.log(`✅ Loaded ${successCount} records from exports`);
      }
    } catch (error) {
      console.log('⚠️ Could not load export data, continuing with basic setup');
    }

    // Final verification
    const finalUserCount = await db.execute(sql`SELECT COUNT(*) as count FROM users`);
    const finalRegCount = await db.execute(sql`SELECT COUNT(*) as count FROM regulations`);
    
    // Single-tenant mode - database already initialized
    console.log('✅ Single-tenant database ready');

    console.log('🎉 Database initialization completed!');
    console.log(`📊 Users: ${finalUserCount.rows[0]?.count}, Regulations: ${finalRegCount.rows[0]?.count}`);
    
    return {
      success: true,
      message: 'Database initialized successfully',
      stats: {
        users: parseInt(finalUserCount.rows[0]?.count || '0'),
        regulations: parseInt(finalRegCount.rows[0]?.count || '0')
      }
    };

  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
} 