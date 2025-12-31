#!/usr/bin/env node
/**
 * Migration: Add escalation fields to compliance_tasks table
 * 
 * Adds:
 * - escalation_email: Email address for task escalation
 * - escalation_name: Name/title of escalation contact
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function migrate() {
  const client = await pool.connect();
  
  try {
    console.log('🔌 Connected to database');
    console.log('📋 Adding escalation fields to compliance_tasks table...\n');

    // Check if columns already exist
    const checkColumns = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'compliance_tasks' 
      AND column_name IN ('escalation_email', 'escalation_name')
    `);

    const existingColumns = checkColumns.rows.map(r => r.column_name);

    if (!existingColumns.includes('escalation_email')) {
      await client.query(`
        ALTER TABLE compliance_tasks 
        ADD COLUMN escalation_email TEXT
      `);
      console.log('✅ Added escalation_email column');
    } else {
      console.log('⏭️  escalation_email column already exists');
    }

    if (!existingColumns.includes('escalation_name')) {
      await client.query(`
        ALTER TABLE compliance_tasks 
        ADD COLUMN escalation_name TEXT
      `);
      console.log('✅ Added escalation_name column');
    } else {
      console.log('⏭️  escalation_name column already exists');
    }

    console.log('\n🎉 Migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();








