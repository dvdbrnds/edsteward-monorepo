
import { db } from "./db";

async function createNotesTable() {
  try {
    
    // Check if the table already exists
    const tableExists = await db.execute(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'notes'
      );
    `);
    
    if (tableExists.rows[0].exists) {
      return;
    }
    
    // Create the notes table
    await db.execute(`
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
    
  } catch (error) {
    console.error("Error creating notes table:", error);
    throw error;
  }
}

// Run the migration
createNotesTable()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  });
