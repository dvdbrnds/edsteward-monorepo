require('dotenv/config');
const { Pool } = require('pg');

// Production database configuration
const PRODUCTION_DATABASE_URL = 'postgresql://postgres:EdSteward2024!Secure@edsteward-public-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com:5432/edsteward?sslmode=require';

// Create pool with SSL for RDS - accept self-signed certificates
const pool = new Pool({
  connectionString: PRODUCTION_DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
    requestCert: false,
    agent: false
  },
  max: 20,
  connectionTimeoutMillis: 10000,
});

async function checkTableExists(client, tableName) {
  try {
    const result = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = $1
      ) as exists
    `, [tableName]);
    return result.rows[0]?.exists === true;
  } catch (error) {
    console.error(`Error checking table ${tableName}:`, error.message);
    return false;
  }
}

async function createUsersTable(client) {
  console.log('📋 Creating users table...');
  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      department TEXT,
      email TEXT NOT NULL,
      "firstName" TEXT,
      "lastName" TEXT,
      external_id TEXT UNIQUE,
      provider_id TEXT,
      identity_provider TEXT,
      last_login TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
}

async function createRegulationsTable(client) {
  console.log('📋 Creating regulations table...');
  await client.query(`
    CREATE TABLE IF NOT EXISTS regulations (
      id SERIAL PRIMARY KEY,
      item_id TEXT NOT NULL,
      name TEXT NOT NULL,
      topic TEXT NOT NULL,
      statute TEXT NOT NULL,
      statute_ids TEXT,
      summary TEXT,
      requirements TEXT,
      category TEXT NOT NULL,
      jurisdiction TEXT NOT NULL DEFAULT 'federal',
      dro TEXT NOT NULL DEFAULT '',
      is_applicable BOOLEAN NOT NULL DEFAULT true,
      origination_date TIMESTAMP,
      effective_date TIMESTAMP,
      last_updated TIMESTAMP,
      last_verified TIMESTAMP,
      next_review_date TIMESTAMP,
      version_number INTEGER NOT NULL DEFAULT 1,
      previous_version_id INTEGER REFERENCES regulations(id),
      version_date TIMESTAMP NOT NULL DEFAULT NOW(),
      change_summary TEXT,
      is_current BOOLEAN NOT NULL DEFAULT true,
      version_metadata JSONB,
      filing_deadlines JSONB,
      reporting_frequency TEXT,
      agency_url TEXT,
      agency_name TEXT,
      agency_contact TEXT,
      agency_department TEXT,
      regulation_url TEXT,
      requirements_url TEXT,
      submission_guide_url TEXT,
      forms_url TEXT,
      submission_guidelines TEXT,
      regulation_text TEXT,
      applicable_forms JSONB,
      related_regulations JSONB,
      compliance_notes TEXT,
      verification_method TEXT,
      notification_schedule JSONB,
      sources JSONB,
      actions JSONB,
      user_id INTEGER,
      created_at TIMESTAMP DEFAULT NOW(),
      location TEXT,
      state TEXT,
      agency_code TEXT
    );
  `);
}

async function createNotesTable(client) {
  console.log('📋 Creating notes table...');
  await client.query(`
    CREATE TABLE IF NOT EXISTS notes (
      id SERIAL PRIMARY KEY,
      regulation_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'general',
      status TEXT NOT NULL DEFAULT 'active',
      is_private BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
}

async function createEvidenceFilesTable(client) {
  console.log('📋 Creating evidence_files table...');
  await client.query(`
    CREATE TABLE IF NOT EXISTS evidence_files (
      id SERIAL PRIMARY KEY,
      regulation_id INTEGER NOT NULL,
      file_name TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      file_type TEXT NOT NULL,
      description TEXT,
      uploaded_by INTEGER NOT NULL,
      uploaded_at TIMESTAMP NOT NULL DEFAULT NOW(),
      status TEXT NOT NULL DEFAULT 'pending',
      storage_path TEXT NOT NULL,
      is_official BOOLEAN NOT NULL DEFAULT false
    );
  `);
}

async function createNotificationsTable(client) {
  console.log('📋 Creating notifications table...');
  await client.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      regulation_id INTEGER,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'info',
      is_read BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      read_at TIMESTAMP
    );
  `);
}

async function createDeadlinesTable(client) {
  console.log('📋 Creating deadlines table...');
  await client.query(`
    CREATE TABLE IF NOT EXISTS deadlines (
      id SERIAL PRIMARY KEY,
      regulation_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      due_date TIMESTAMP NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_by INTEGER NOT NULL,
      assigned_to INTEGER,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
}

async function createGuidesTable(client) {
  console.log('📋 Creating guides table...');
  await client.query(`
    CREATE TABLE IF NOT EXISTS guides (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      category TEXT NOT NULL,
      created_by INTEGER NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
}

async function createEmailConfigsTable(client) {
  console.log('📋 Creating email_configs table...');
  await client.query(`
    CREATE TABLE IF NOT EXISTS email_configs (
      id SERIAL PRIMARY KEY,
      smtp_host TEXT NOT NULL,
      smtp_port INTEGER NOT NULL,
      smtp_user TEXT NOT NULL,
      smtp_password TEXT NOT NULL,
      from_email TEXT NOT NULL,
      from_name TEXT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
}

async function createTwilioConfigsTable(client) {
  console.log('📋 Creating twilio_configs table...');
  await client.query(`
    CREATE TABLE IF NOT EXISTS twilio_configs (
      id SERIAL PRIMARY KEY,
      account_sid TEXT NOT NULL,
      auth_token TEXT NOT NULL,
      phone_number TEXT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
}

async function createSystemLogsTable(client) {
  console.log('📋 Creating system_logs table...');
  await client.query(`
    CREATE TABLE IF NOT EXISTS system_logs (
      id SERIAL PRIMARY KEY,
      level TEXT NOT NULL,
      message TEXT NOT NULL,
      meta JSONB,
      timestamp TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
}

async function runMigration() {
  console.log('🚀 Starting Production Database Migration...');
  console.log('🎯 Target: AWS RDS PostgreSQL');
  console.log('📋 Environment: production');
  
  const client = await pool.connect();
  
  try {
    // Test connection first
    console.log('🔗 Testing database connection...');
    await client.query('SELECT 1');
    console.log('✅ Database connection successful');

    // Create tables in order (respecting foreign key dependencies)
    const tables = [
      { name: 'users', create: createUsersTable },
      { name: 'regulations', create: createRegulationsTable },
      { name: 'notes', create: createNotesTable },
      { name: 'evidence_files', create: createEvidenceFilesTable },
      { name: 'notifications', create: createNotificationsTable },
      { name: 'deadlines', create: createDeadlinesTable },
      { name: 'guides', create: createGuidesTable },
      { name: 'email_configs', create: createEmailConfigsTable },
      { name: 'twilio_configs', create: createTwilioConfigsTable },
      { name: 'system_logs', create: createSystemLogsTable },
    ];

    console.log('📊 Checking existing tables...');
    
    let createdCount = 0;
    let existingCount = 0;

    for (const table of tables) {
      const exists = await checkTableExists(client, table.name);
      if (exists) {
        console.log(`✅ Table '${table.name}' already exists`);
        existingCount++;
      } else {
        console.log(`🆕 Creating table '${table.name}'...`);
        await table.create(client);
        console.log(`✅ Table '${table.name}' created successfully`);
        createdCount++;
      }
    }

    // Add any missing columns to existing tables
    console.log('🔧 Checking for missing columns...');
    
    // Add actions column to regulations if it doesn't exist
    try {
      await client.query(`
        ALTER TABLE regulations ADD COLUMN IF NOT EXISTS actions JSONB;
      `);
      console.log('✅ Added actions column to regulations table');
    } catch (error) {
      console.log('ℹ️ Actions column already exists or error adding it:', error.message);
    }

    // Verify final state
    console.log('🔍 Verifying migration results...');
    
    for (const table of tables) {
      const exists = await checkTableExists(client, table.name);
      if (!exists) {
        throw new Error(`Table '${table.name}' was not created successfully`);
      }
    }

    // Get table counts for verification
    const userCount = await client.query('SELECT COUNT(*) as count FROM users');
    const regCount = await client.query('SELECT COUNT(*) as count FROM regulations');
    const noteCount = await client.query('SELECT COUNT(*) as count FROM notes');

    console.log('🎉 Migration completed successfully!');
    console.log(`📊 Migration Summary:`);
    console.log(`   - Tables created: ${createdCount}`);
    console.log(`   - Tables existing: ${existingCount}`);
    console.log(`   - Total tables: ${tables.length}`);
    console.log(`📊 Data Summary:`);
    console.log(`   - Users: ${userCount.rows[0]?.count || 0}`);
    console.log(`   - Regulations: ${regCount.rows[0]?.count || 0}`);
    console.log(`   - Notes: ${noteCount.rows[0]?.count || 0}`);

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Full error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
    console.log('🔚 Database connection closed');
  }
}

// Run migration
runMigration()
  .then(() => {
    console.log('✅ Migration script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Migration script failed:', error);
    process.exit(1);
  }); 