/**
 * Database Migration: Add Email Attestation Tables
 * 
 * This script adds:
 * 1. attestation_tokens table for one-click email attestation
 * 2. risk_level column to regulations table
 * 3. email_attestation_enabled column to regulations table
 * 4. attestation_frequency column to regulations table
 */

const { Pool } = require('pg');

async function runMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_foSr6ixkzw7W@ep-weathered-term-a5rmi9cx-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require'
  });

  try {
    console.log('🚀 Starting email attestation migration...\n');

    // 1. Add risk_level column to regulations
    console.log('📋 Adding risk_level column to regulations table...');
    try {
      await pool.query(`
        ALTER TABLE regulations 
        ADD COLUMN IF NOT EXISTS risk_level TEXT DEFAULT 'medium'
      `);
      console.log('   ✅ risk_level column added');
    } catch (e) {
      if (e.message.includes('already exists')) {
        console.log('   ⏩ risk_level column already exists, skipping');
      } else {
        throw e;
      }
    }

    // 2. Add email_attestation_enabled column to regulations
    console.log('📋 Adding email_attestation_enabled column to regulations table...');
    try {
      await pool.query(`
        ALTER TABLE regulations 
        ADD COLUMN IF NOT EXISTS email_attestation_enabled BOOLEAN DEFAULT false
      `);
      console.log('   ✅ email_attestation_enabled column added');
    } catch (e) {
      if (e.message.includes('already exists')) {
        console.log('   ⏩ email_attestation_enabled column already exists, skipping');
      } else {
        throw e;
      }
    }

    // 3. Add attestation_frequency column to regulations
    console.log('📋 Adding attestation_frequency column to regulations table...');
    try {
      await pool.query(`
        ALTER TABLE regulations 
        ADD COLUMN IF NOT EXISTS attestation_frequency TEXT DEFAULT 'annual'
      `);
      console.log('   ✅ attestation_frequency column added');
    } catch (e) {
      if (e.message.includes('already exists')) {
        console.log('   ⏩ attestation_frequency column already exists, skipping');
      } else {
        throw e;
      }
    }

    // 4. Create attestation_tokens table
    console.log('📋 Creating attestation_tokens table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS attestation_tokens (
        id SERIAL PRIMARY KEY,
        token TEXT NOT NULL UNIQUE,
        regulation_id INTEGER NOT NULL REFERENCES regulations(id),
        user_id INTEGER NOT NULL REFERENCES users(id),
        attestation_type TEXT NOT NULL DEFAULT 'quarterly',
        attestation_statement TEXT NOT NULL,
        attestation_period TEXT,
        expires_at TIMESTAMP NOT NULL,
        used_at TIMESTAMP,
        used_ip TEXT,
        used_user_agent TEXT,
        email_sent_at TIMESTAMP,
        email_sent_to TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        created_by INTEGER REFERENCES users(id)
      )
    `);
    console.log('   ✅ attestation_tokens table created');

    // 5. Create index on token for fast lookups
    console.log('📋 Creating indexes...');
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_attestation_tokens_token ON attestation_tokens(token)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_attestation_tokens_regulation ON attestation_tokens(regulation_id)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_attestation_tokens_user ON attestation_tokens(user_id)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_attestation_tokens_expires ON attestation_tokens(expires_at)
    `);
    console.log('   ✅ Indexes created');

    // 6. Set some initial low-risk regulations
    console.log('\n📋 Setting initial risk levels for sample regulations...');
    
    // Low-risk regulations (typically annual attestation, rarely change)
    const lowRiskKeywords = [
      'Drug-Free',
      'Smoking',
      'Campus Safety',
      'FERPA', // Annual training attestation
      'ADA Grievance', // Policy exists attestation
    ];

    for (const keyword of lowRiskKeywords) {
      const result = await pool.query(`
        UPDATE regulations 
        SET risk_level = 'low', email_attestation_enabled = true, attestation_frequency = 'annual'
        WHERE name ILIKE $1 AND risk_level = 'medium'
        RETURNING id, name
      `, [`%${keyword}%`]);
      
      if (result.rowCount > 0) {
        console.log(`   ✅ Set ${result.rowCount} "${keyword}" regulations to low-risk`);
      }
    }

    // High-risk regulations (require in-person attestation)
    const highRiskKeywords = [
      'Title IX',
      'Clery',
      'HIPAA',
      'Financial Aid',
    ];

    for (const keyword of highRiskKeywords) {
      const result = await pool.query(`
        UPDATE regulations 
        SET risk_level = 'high', email_attestation_enabled = false
        WHERE name ILIKE $1 AND risk_level = 'medium'
        RETURNING id, name
      `, [`%${keyword}%`]);
      
      if (result.rowCount > 0) {
        console.log(`   ✅ Set ${result.rowCount} "${keyword}" regulations to high-risk`);
      }
    }

    // Show summary
    console.log('\n📊 Migration Summary:');
    const summary = await pool.query(`
      SELECT 
        risk_level,
        COUNT(*) as count,
        SUM(CASE WHEN email_attestation_enabled THEN 1 ELSE 0 END) as email_enabled
      FROM regulations
      GROUP BY risk_level
      ORDER BY risk_level
    `);
    
    console.log('   Risk Level Distribution:');
    for (const row of summary.rows) {
      console.log(`   - ${row.risk_level}: ${row.count} regulations (${row.email_enabled} with email attestation)`);
    }

    console.log('\n✅ Email attestation migration completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Restart the server to pick up schema changes');
    console.log('   2. Configure email settings in admin panel');
    console.log('   3. Use admin panel to send attestation requests');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

runMigration().catch(console.error);

