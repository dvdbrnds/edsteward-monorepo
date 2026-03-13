/**
 * Sync applicableInstitutions from enhanced regulation JSON files to the app database.
 * Matches on regulation slug/name to find the corresponding DB record.
 * 
 * Usage: npx tsx scripts/sync-institution-types-to-db.ts [DATABASE_URL]
 */

import fs from 'fs';
import path from 'path';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL = process.argv[2] || process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('ERROR: No DATABASE_URL provided. Pass as argument or set in .env');
  process.exit(1);
}

const REGULATIONS_DIR = path.join(import.meta.dirname, '..', '..', 'engine', 'enhanced-regulations');

async function sync() {
  const pool = new pg.Pool({ connectionString: DATABASE_URL });
  
  try {
    // Load all regulation files
    const files = fs.readdirSync(REGULATIONS_DIR).filter(f => f.endsWith('.json'));
    console.log(`Loaded ${files.length} regulation files`);
    
    // Build slug -> applicableInstitutions map
    const typeMap = new Map<string, string[]>();
    for (const file of files) {
      const content = JSON.parse(fs.readFileSync(path.join(REGULATIONS_DIR, file), 'utf-8'));
      const slug = file.replace('.json', '');
      typeMap.set(slug, content.applicableInstitutions || ['all-institutions']);
    }
    
    // Fetch all regulations from DB
    const { rows: dbRegs } = await pool.query('SELECT id, name, reg_key FROM regulations');
    console.log(`Found ${dbRegs.length} regulations in database`);
    
    let updated = 0;
    let notFound = 0;
    
    for (const dbReg of dbRegs) {
      const regKey = dbReg.reg_key || '';
      const normalizedName = dbReg.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || '';
      
      let types = typeMap.get(regKey) || typeMap.get(normalizedName);
      
      // Fuzzy match: try matching as a prefix of any file slug
      if (!types) {
        for (const [fileSlug, fileTypes] of typeMap.entries()) {
          if (regKey && fileSlug.startsWith(regKey)) {
            types = fileTypes;
            break;
          }
          if (normalizedName.length > 15 && fileSlug.startsWith(normalizedName.substring(0, 30))) {
            types = fileTypes;
            break;
          }
        }
      }
      
      if (!types) {
        // Default to all-institutions for unmatched regulations
        types = ['all-institutions'];
        notFound++;
      }
      
      await pool.query(
        'UPDATE regulations SET applicable_institutions = $1 WHERE id = $2',
        [JSON.stringify(types), dbReg.id]
      );
      updated++;
    }
    
    console.log(`\nResults:`);
    console.log(`  Updated: ${updated}`);
    console.log(`  Matched from files: ${updated - notFound}`);
    console.log(`  Defaulted to all-institutions: ${notFound}`);
    
    // Verify
    const { rows: verify } = await pool.query(
      "SELECT COUNT(*), applicable_institutions::text FROM regulations GROUP BY applicable_institutions::text ORDER BY COUNT(*) DESC LIMIT 20"
    );
    console.log('\nDB distribution:');
    for (const row of verify) {
      console.log(`  ${row.applicable_institutions || 'NULL'}: ${row.count}`);
    }
    
  } finally {
    await pool.end();
  }
}

sync().catch(console.error);
