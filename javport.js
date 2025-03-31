// JavaScript version of the export script
import fs from 'fs';
import pg from 'pg';

const { Pool } = pg;

async function exportRegulations() {
  // Use the DATABASE_URL directly from environment variables
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    const result = await pool.query('SELECT * FROM regulations');
    fs.writeFileSync('regulations-js.json', JSON.stringify(result.rows, null, 2));
    console.log(`Exported ${result.rows.length} regulations to regulations-js.json`);
  } catch (error) {
    console.error('Error exporting regulations:', error);
  } finally {
    await pool.end();
  }
}

exportRegulations();