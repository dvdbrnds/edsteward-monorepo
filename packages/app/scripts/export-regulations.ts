import fs from 'fs';
import { db, pool } from '../server/db';
import { regulations } from '@shared/schema';

async function exportRegulations() {
  try {
    console.log("Fetching regulations from database...");
    
    // Using the Drizzle ORM
    const result = await db.select().from(regulations);
    
    console.log(`Retrieved ${result.length} regulations, writing to file...`);
    fs.writeFileSync('regulations.json', JSON.stringify(result, null, 2));
    
    console.log(`Exported ${result.length} regulations to regulations.json`);
  } catch (error) {
    console.error('Error exporting regulations:', error);
  } finally {
    // Close the pool
    await pool.end();
  }
}

// Execute the function
exportRegulations();