// In Replit, ES module version of the export script
import fs from 'fs';
import { pool } from './server/db.js';

async function exportRegulations() {
  try {
    const result = await pool.query('SELECT * FROM regulations');
    fs.writeFileSync('regulations-sql-query.json', JSON.stringify(result.rows, null, 2));
    console.log(`Exported ${result.rows.length} regulations to regulations-sql-query.json`);
  } catch (error) {
    console.error('Error exporting regulations:', error);
  } finally {
    await pool.end();
  }
}

exportRegulations();