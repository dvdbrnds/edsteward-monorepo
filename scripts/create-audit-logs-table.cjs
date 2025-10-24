#!/usr/bin/env node

/**
 * Create audit_logs table for compliance action tracking
 * This script creates the audit_logs table with proper indexes for performance
 */

const { Client } = require('pg');

// Ensure DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

async function createAuditLogsTable() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Create audit_logs table
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        action TEXT NOT NULL,
        user_id INTEGER REFERENCES users(id),
        user_email TEXT,
        ip_address TEXT,
        user_agent TEXT,
        timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        
        -- Change tracking
        previous_values JSONB,
        new_values JSONB,
        changes JSONB,
        
        -- Context and metadata
        regulation_id INTEGER REFERENCES regulations(id),
        session_id TEXT,
        request_id TEXT,
        metadata JSONB,
        
        -- Compliance specific fields
        compliance_impact TEXT,
        risk_level TEXT
      );
    `;

    await client.query(createTableSQL);
    console.log('✅ Created audit_logs table');

    // Create indexes for performance
    const indexes = [
      'CREATE INDEX IF NOT EXISTS audit_logs_entity_type_idx ON audit_logs(entity_type);',
      'CREATE INDEX IF NOT EXISTS audit_logs_entity_id_idx ON audit_logs(entity_id);',
      'CREATE INDEX IF NOT EXISTS audit_logs_user_id_idx ON audit_logs(user_id);',
      'CREATE INDEX IF NOT EXISTS audit_logs_timestamp_idx ON audit_logs(timestamp);',
      'CREATE INDEX IF NOT EXISTS audit_logs_regulation_id_idx ON audit_logs(regulation_id);',
      'CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON audit_logs(action);',
      'CREATE INDEX IF NOT EXISTS audit_logs_compliance_impact_idx ON audit_logs(compliance_impact);',
      'CREATE INDEX IF NOT EXISTS audit_logs_risk_level_idx ON audit_logs(risk_level);'
    ];

    for (const indexSQL of indexes) {
      await client.query(indexSQL);
    }
    console.log('✅ Created audit_logs indexes');

    // Add constraints for enum-like fields
    const constraints = [
      `ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_action_check 
       CHECK (action IN ('create', 'update', 'delete', 'view'));`,
      
      `ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_compliance_impact_check 
       CHECK (compliance_impact IS NULL OR compliance_impact IN ('high', 'medium', 'low'));`,
       
      `ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_risk_level_check 
       CHECK (risk_level IS NULL OR risk_level IN ('critical', 'high', 'medium', 'low'));`
    ];

    for (const constraintSQL of constraints) {
      await client.query(constraintSQL);
    }
    console.log('✅ Added audit_logs constraints');

    // Insert a test audit log entry
    const testInsert = `
      INSERT INTO audit_logs (
        entity_type, entity_id, action, user_email, 
        metadata, compliance_impact, risk_level
      ) VALUES (
        'system', 'audit_table_creation', 'create', 'system@edsteward.ai',
        '{"message": "Audit logs table created successfully", "version": "1.0"}',
        'low', 'low'
      );
    `;

    await client.query(testInsert);
    console.log('✅ Added initial audit log entry');

    // Verify table creation
    const countResult = await client.query('SELECT COUNT(*) FROM audit_logs;');
    console.log(`📊 Audit logs table created with ${countResult.rows[0].count} entries`);

    console.log('\n🎉 Audit logs table setup completed successfully!');
    console.log('\n📋 Table Features:');
    console.log('   • Complete change tracking (before/after values)');
    console.log('   • User attribution and session tracking');
    console.log('   • IP address and user agent logging');
    console.log('   • Compliance impact and risk level classification');
    console.log('   • Optimized indexes for fast querying');
    console.log('   • Foreign key relationships to users and regulations');

  } catch (error) {
    console.error('❌ Error creating audit_logs table:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run the migration
createAuditLogsTable();
