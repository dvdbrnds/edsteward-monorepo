import { db } from './config/database';
import { sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { getDatabaseStorage } from './services/database';
import bcrypt from 'bcrypt';

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
      console.log('📋 Creating database schema from init_schema.sql...');
      
      // Load complete schema from file
      const schemaPath = path.join(process.cwd(), 'sql_dump/init_schema.sql');
      if (fs.existsSync(schemaPath)) {
        const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
        
        // Clean and execute schema
        const cleanSchemaSQL = schemaSQL
          .replace(/SET.*?;/g, '')
          .replace(/SELECT pg_catalog\.set_config.*?;/g, '')
          .replace(/ALTER .* OWNER TO .*?;/g, '')
          .replace(/COMMENT ON.*?;/g, '')
          .replace(/GRANT.*?;/g, '')
          .replace(/REVOKE.*?;/g, '')
          .replace(/\n\s*\n/g, '\n')
          .trim();

        await db.execute(sql.raw(cleanSchemaSQL));
        console.log('✅ Complete database schema created from init_schema.sql');
      } else {
        console.log('⚠️ init_schema.sql not found, creating minimal schema');
        // Fallback to essential tables only
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS users (
            id serial PRIMARY KEY,
            username text UNIQUE NOT NULL,
            password text NOT NULL,
            email text NOT NULL,
            role text DEFAULT 'user',
            department text,
            "firstName" text,
            "lastName" text,
            external_id text UNIQUE,
            provider_id text,
            identity_provider text,
            last_login timestamp,
            created_at timestamp DEFAULT NOW(),
            updated_at timestamp DEFAULT NOW()
          );
        `);
      }
    }

    // Check if we have users
    const existingUsers = await db.execute(sql`SELECT COUNT(*) as count FROM users`);
    const userCount = parseInt(existingUsers.rows[0]?.count || '0');
    
    if (userCount === 0) {
      console.log('👤 Creating essential users...');
      
      // Hash passwords properly
      const adminPassword = await bcrypt.hash('admin123', 10);
      const dvdbrndSPassword = await bcrypt.hash('gabadh', 10);
      const userPassword = await bcrypt.hash('password', 10);
      
      // Create admin user
      await db.execute(sql`
        INSERT INTO users (username, password, email, role, "firstName", "lastName", department)
        VALUES ('admin', ${adminPassword}, 'admin@edsteward.ai', 'admin', 'Admin', 'User', 'IT')
      `);

      // Create your user account
      await db.execute(sql`
        INSERT INTO users (username, password, email, role, "firstName", "lastName", department)
        VALUES ('dvdbrnds', ${dvdbrndSPassword}, 'dvdbrnds@moravian.edu', 'admin', 'David', 'Bernards', 'IT')
      `);

      // Create test user from your exports
      await db.execute(sql`
        INSERT INTO users (username, password, email, role, "firstName", "lastName", department)
        VALUES ('nasol', ${userPassword}, 'nasol@moravian.edu', 'user', 'Nick', 'Asol', 'Compliance')
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