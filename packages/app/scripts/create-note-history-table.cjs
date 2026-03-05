#!/usr/bin/env node

const { Client } = require('pg');

async function createNoteHistoryTable() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Create note_history table
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS note_history (
        id SERIAL PRIMARY KEY,
        note_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        previous_title TEXT,
        previous_content TEXT,
        previous_category TEXT,
        previous_is_private BOOLEAN,
        new_title TEXT,
        new_content TEXT,
        new_category TEXT,
        new_is_private BOOLEAN,
        change_reason TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `;

    await client.query(createTableQuery);
    console.log('✅ note_history table created successfully');

    // Create indexes for better performance
    const createIndexQueries = [
      'CREATE INDEX IF NOT EXISTS idx_note_history_note_id ON note_history(note_id);',
      'CREATE INDEX IF NOT EXISTS idx_note_history_user_id ON note_history(user_id);',
      'CREATE INDEX IF NOT EXISTS idx_note_history_created_at ON note_history(created_at);'
    ];

    for (const query of createIndexQueries) {
      await client.query(query);
    }
    console.log('✅ Indexes created successfully');

    // Check if table exists and show structure
    const checkQuery = `
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'note_history' 
      ORDER BY ordinal_position;
    `;
    
    const result = await client.query(checkQuery);
    console.log('\n📋 note_history table structure:');
    result.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type} ${row.is_nullable === 'NO' ? '(NOT NULL)' : ''}`);
    });

  } catch (error) {
    console.error('❌ Error creating note_history table:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

createNoteHistoryTable();
