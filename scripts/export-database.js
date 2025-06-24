const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Configuration - replace with your Replit database URL
const REPLIT_DATABASE_URL = process.env.REPLIT_DATABASE_URL || 'your-replit-database-url-here';

const pool = new Pool({
  connectionString: REPLIT_DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // For external connections
  }
});

// Tables to export (in dependency order)
const TABLES = [
  'users',
  'regulations', 
  'notifications',
  'deadlines',
  'guides',
  'csv_schemas',
  'validation_rules',
  'field_mappings',
  'notes',
  'evidence_files',
  'regulation_versions',
  'validation_status',
  'sync_control',
  'notification_queue',
  'version_conflicts',
  'regulation_updates'
];

async function exportTable(tableName) {
  try {
    console.log(`Exporting ${tableName}...`);
    
    // Get table structure
    const structureQuery = `
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = $1 
      ORDER BY ordinal_position;
    `;
    const structure = await pool.query(structureQuery, [tableName]);
    
    // Get data
    const dataQuery = `SELECT * FROM ${tableName} ORDER BY id;`;
    const data = await pool.query(dataQuery);
    
    let sql = `-- Export for table: ${tableName}\n`;
    sql += `-- Exported on: ${new Date().toISOString()}\n\n`;
    
    if (data.rows.length > 0) {
      const columns = Object.keys(data.rows[0]);
      sql += `-- Data for ${tableName}\n`;
      
      for (const row of data.rows) {
        const values = columns.map(col => {
          const value = row[col];
          if (value === null) return 'NULL';
          if (typeof value === 'string') {
            // Escape single quotes
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
        
        sql += `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')});\n`;
      }
    }
    
    sql += `\n`;
    return sql;
  } catch (error) {
    console.error(`Error exporting ${tableName}:`, error.message);
    return `-- Error exporting ${tableName}: ${error.message}\n\n`;
  }
}

async function exportDatabase() {
  try {
    console.log('Starting database export...');
    
    // Create exports directory
    const exportsDir = path.join(__dirname, '../exports');
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }
    
    let fullExport = `-- EdSteward Database Export\n`;
    fullExport += `-- Generated on: ${new Date().toISOString()}\n`;
    fullExport += `-- Source: Replit Database\n\n`;
    
    // Export each table
    for (const table of TABLES) {
      const tableExport = await exportTable(table);
      fullExport += tableExport;
      
      // Also save individual table files
      const tableFile = path.join(exportsDir, `${table}.sql`);
      fs.writeFileSync(tableFile, tableExport);
      console.log(`✅ Exported ${table} to ${tableFile}`);
    }
    
    // Save complete export
    const fullExportFile = path.join(exportsDir, 'complete_export.sql');
    fs.writeFileSync(fullExportFile, fullExport);
    console.log(`✅ Complete export saved to ${fullExportFile}`);
    
    console.log('\n🎉 Database export completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Set up local PostgreSQL database');
    console.log('2. Run the SQL files to import data');
    console.log('3. Update your .env with local DATABASE_URL');
    
  } catch (error) {
    console.error('Export failed:', error);
  } finally {
    await pool.end();
  }
}

// Run export
if (require.main === module) {
  exportDatabase();
}

module.exports = { exportDatabase }; 