/**
 * Migration: Add Compliance Tasks Tables
 * 
 * Creates tables for complex regulation workflow management:
 * - compliance_tasks: Hierarchical task management with per-task DRIs
 * - task_evidence: Evidence uploads for tasks
 * - task_activity: Activity log for comments, status changes, nudges
 */

const { Client } = require('pg');

async function migrate() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_foSr6ixkzw7W@ep-weathered-term-a5rmi9cx-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require'
  });

  try {
    await client.connect();
    console.log('🔌 Connected to database');

    // Create compliance_tasks table
    console.log('📋 Creating compliance_tasks table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS compliance_tasks (
        id SERIAL PRIMARY KEY,
        regulation_id INTEGER NOT NULL REFERENCES regulations(id) ON DELETE CASCADE,
        parent_task_id INTEGER REFERENCES compliance_tasks(id) ON DELETE CASCADE,
        
        -- Task details
        title TEXT NOT NULL,
        description TEXT,
        instructions TEXT,
        
        -- Assignment
        assigned_to INTEGER REFERENCES users(id),
        assigned_role TEXT,
        
        -- Scheduling
        due_date TIMESTAMP,
        recurring_schedule TEXT,
        reminder_days INTEGER DEFAULT 30,
        
        -- Status tracking
        status TEXT NOT NULL DEFAULT 'pending',
        priority TEXT DEFAULT 'medium',
        completed_at TIMESTAMP,
        completed_by INTEGER REFERENCES users(id),
        
        -- Evidence requirements
        evidence_required BOOLEAN DEFAULT false,
        evidence_type TEXT DEFAULT 'none',
        evidence_instructions TEXT,
        
        -- Ordering and display
        sort_order INTEGER DEFAULT 0,
        is_template BOOLEAN DEFAULT false,
        
        -- Metadata
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        created_by INTEGER REFERENCES users(id),
        metadata JSONB
      )
    `);
    console.log('✅ compliance_tasks table created');

    // Create indexes for compliance_tasks
    console.log('📇 Creating indexes for compliance_tasks...');
    await client.query('CREATE INDEX IF NOT EXISTS compliance_tasks_regulation_id_idx ON compliance_tasks(regulation_id)');
    await client.query('CREATE INDEX IF NOT EXISTS compliance_tasks_parent_task_id_idx ON compliance_tasks(parent_task_id)');
    await client.query('CREATE INDEX IF NOT EXISTS compliance_tasks_assigned_to_idx ON compliance_tasks(assigned_to)');
    await client.query('CREATE INDEX IF NOT EXISTS compliance_tasks_status_idx ON compliance_tasks(status)');
    await client.query('CREATE INDEX IF NOT EXISTS compliance_tasks_due_date_idx ON compliance_tasks(due_date)');
    console.log('✅ Indexes created');

    // Create task_evidence table
    console.log('📎 Creating task_evidence table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS task_evidence (
        id SERIAL PRIMARY KEY,
        task_id INTEGER NOT NULL REFERENCES compliance_tasks(id) ON DELETE CASCADE,
        
        -- File details
        file_name TEXT NOT NULL,
        file_type TEXT,
        file_size INTEGER,
        file_url TEXT,
        
        -- For link-type evidence
        link_url TEXT,
        link_title TEXT,
        
        -- Metadata
        description TEXT,
        uploaded_by INTEGER NOT NULL REFERENCES users(id),
        uploaded_at TIMESTAMP NOT NULL DEFAULT NOW(),
        
        -- Verification
        verified BOOLEAN DEFAULT false,
        verified_by INTEGER REFERENCES users(id),
        verified_at TIMESTAMP
      )
    `);
    console.log('✅ task_evidence table created');

    await client.query('CREATE INDEX IF NOT EXISTS task_evidence_task_id_idx ON task_evidence(task_id)');

    // Create task_activity table
    console.log('📝 Creating task_activity table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS task_activity (
        id SERIAL PRIMARY KEY,
        task_id INTEGER NOT NULL REFERENCES compliance_tasks(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id),
        
        activity_type TEXT NOT NULL,
        content TEXT,
        
        -- For status changes
        previous_value TEXT,
        new_value TEXT,
        
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log('✅ task_activity table created');

    await client.query('CREATE INDEX IF NOT EXISTS task_activity_task_id_idx ON task_activity(task_id)');
    await client.query('CREATE INDEX IF NOT EXISTS task_activity_created_at_idx ON task_activity(created_at)');

    // Verify tables were created
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('compliance_tasks', 'task_evidence', 'task_activity')
      ORDER BY table_name
    `);
    
    console.log('\n🎉 Migration complete! Tables created:');
    tables.rows.forEach(row => console.log(`   ✓ ${row.table_name}`));

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

migrate().catch(console.error);

