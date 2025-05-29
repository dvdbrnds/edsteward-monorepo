import pkg from 'pg';
const { Pool } = pkg;
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration - use your Replit database URL
const REPLIT_DATABASE_URL = process.env.REPLIT_DATABASE_URL || 'your-replit-database-url-here';

const pool = new Pool({
  connectionString: REPLIT_DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function exportRegulationsFixed() {
  try {
    console.log('Exporting regulations with column mapping...');
    
    // Get the structure of regulations table in Replit
    const structureQuery = `
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'regulations'
      ORDER BY ordinal_position;
    `;
    const structure = await pool.query(structureQuery);
    console.log('Available columns:', structure.rows.map(r => r.column_name));
    
    // Select only columns that exist in both schemas (excluding state_code, state_agency)
    const compatibleColumns = [
      'id', 'name', 'item_id', 'topic', 'statute', 'statute_ids', 'summary', 
      'requirements', 'category', 'jurisdiction', 'dro', 'is_applicable',
      'origination_date', 'effective_date', 'last_updated', 'last_verified',
      'next_review_date', 'version_number', 'previous_version_id', 'version_date',
      'change_summary', 'is_current', 'version_metadata', 'filing_deadlines',
      'reporting_frequency', 'agency_url', 'agency_name', 'agency_contact',
      'agency_department', 'regulation_url', 'requirements_url', 'submission_guide_url',
      'forms_url', 'submission_guidelines', 'regulation_text', 'applicable_forms',
      'related_regulations', 'compliance_notes', 'verification_method',
      'notification_schedule', 'notification_override', 'sections', 'sources', 'actions'
    ];
    
    // Check which columns actually exist in the source table
    const existingColumns = structure.rows.map(r => r.column_name);
    const validColumns = compatibleColumns.filter(col => existingColumns.includes(col));
    
    console.log('Using columns:', validColumns);
    
    // Build the query
    const selectQuery = `SELECT ${validColumns.join(', ')} FROM regulations ORDER BY id;`;
    console.log('Query:', selectQuery);
    
    const data = await pool.query(selectQuery);
    console.log(`Found ${data.rows.length} regulations`);
    
    if (data.rows.length === 0) {
      console.log('No regulations found to export');
      return;
    }
    
    // Create the SQL insert statements
    let sql = `-- Fixed regulations export\n`;
    sql += `-- Exported on: ${new Date().toISOString()}\n\n`;
    
    for (const row of data.rows) {
      const values = validColumns.map(col => {
        const value = row[col];
        if (value === null) return 'NULL';
        if (typeof value === 'string') {
          return `'${value.replace(/'/g, "''")}'`;
        }
        if (value instanceof Date) {
          return `'${value.toISOString()}'`;
        }
        if (typeof value === 'object') {
          return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
        }
        return value;
      });
      
      sql += `INSERT INTO regulations (${validColumns.join(', ')}) VALUES (${values.join(', ')});\n`;
    }
    
    // Create exports directory
    const exportsDir = path.join(__dirname, '../exports');
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }
    
    const outputFile = path.join(exportsDir, 'regulations_fixed.sql');
    fs.writeFileSync(outputFile, sql);
    console.log(`✅ Fixed regulations export saved to ${outputFile}`);
    
  } catch (error) {
    console.error('Export failed:', error);
  } finally {
    await pool.end();
  }
}

// Run export
exportRegulationsFixed(); 