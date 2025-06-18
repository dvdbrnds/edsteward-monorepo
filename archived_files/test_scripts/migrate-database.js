import pkg from 'pg';
const { Client } = pkg;
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function migrateDatabase() {
    console.log('🚀 Starting database migration to AWS RDS...');
    
    // Database connection configuration (matching the ECS task definition)
    const dbConfig = {
        host: 'edsteward-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com',
        port: 5432,
        database: 'edsteward',
        user: 'postgres',
        password: 'FZ2Pk9ij4ow2yStKrJiZD7vfUW9emT+PtVrM2VV536s=',
        ssl: {
            rejectUnauthorized: false
        }
    };

    const client = new Client(dbConfig);

    try {
        // Connect to database
        console.log('📡 Connecting to AWS RDS...');
        await client.connect();
        console.log('✅ Connected to database successfully!');

        // First, drop existing tables if they exist (clean slate)
        console.log('🧹 Cleaning existing tables...');
        const dropTablesSQL = `
            DROP TABLE IF EXISTS comments CASCADE;
            DROP TABLE IF EXISTS deadlines CASCADE;
            DROP TABLE IF EXISTS evidence_files CASCADE;
            DROP TABLE IF EXISTS guides CASCADE;
            DROP TABLE IF EXISTS notes CASCADE;
            DROP TABLE IF EXISTS notifications CASCADE;
            DROP TABLE IF EXISTS regulation_updates CASCADE;
            DROP TABLE IF EXISTS regulation_versions CASCADE;
            DROP TABLE IF EXISTS regulations CASCADE;
            DROP TABLE IF EXISTS session CASCADE;
            DROP TABLE IF EXISTS system_logs CASCADE;
            DROP TABLE IF EXISTS users CASCADE;
            DROP TABLE IF EXISTS validation_status CASCADE;
            DROP TABLE IF EXISTS validation_rules CASCADE;
            DROP TABLE IF EXISTS field_mappings CASCADE;
            DROP TABLE IF EXISTS csv_schemas CASCADE;
            DROP TABLE IF EXISTS sync_control CASCADE;
            DROP TABLE IF EXISTS notification_queue CASCADE;
            DROP TABLE IF EXISTS version_conflicts CASCADE;
            
            -- Drop sequences
            DROP SEQUENCE IF EXISTS comments_id_seq CASCADE;
            DROP SEQUENCE IF EXISTS deadlines_id_seq CASCADE;
            DROP SEQUENCE IF EXISTS evidence_files_id_seq CASCADE;
            DROP SEQUENCE IF EXISTS guides_id_seq CASCADE;
            DROP SEQUENCE IF EXISTS notes_id_seq CASCADE;
            DROP SEQUENCE IF EXISTS notifications_id_seq CASCADE;
            DROP SEQUENCE IF EXISTS regulations_id_seq CASCADE;
            DROP SEQUENCE IF EXISTS system_logs_id_seq CASCADE;
            DROP SEQUENCE IF EXISTS users_id_seq CASCADE;
        `;
        
        await client.query(dropTablesSQL);
        console.log('✅ Existing tables cleaned');

        // Read the complete export file
        console.log('📖 Reading complete database export...');
        const exportFilePath = path.join(__dirname, 'exports', 'complete_export.sql');
        
        if (!fs.existsSync(exportFilePath)) {
            throw new Error(`Export file not found: ${exportFilePath}`);
        }
        
        const sqlContent = fs.readFileSync(exportFilePath, 'utf8');
        console.log(`✅ Loaded ${(sqlContent.length / 1024 / 1024).toFixed(2)}MB of SQL data`);

        // Clean the SQL content to work with PostgreSQL
        console.log('🧹 Processing SQL content...');
        let cleanSQL = sqlContent
            // Remove comments and export headers
            .replace(/-- RegulatoryTrackr Database Export.*?\n/g, '')
            .replace(/-- Generated on:.*?\n/g, '')
            .replace(/-- Source:.*?\n/g, '')
            .replace(/-- Export for table:.*?\n/g, '')
            .replace(/-- Exported on:.*?\n/g, '')
            .replace(/-- Data for.*?\n/g, '')
            // Handle sequences properly
            .replace(/RESTART WITH \d+/g, '')
            // Clean up any problematic whitespace
            .replace(/\n\s*\n/g, '\n')
            .trim();

        // First create the schema from the schema file
        console.log('🏗️ Creating database schema...');
        const schemaFilePath = path.join(__dirname, 'sql_dump', 'full_schema.sql');
        const schemaSQL = fs.readFileSync(schemaFilePath, 'utf8');
        
        // Clean schema SQL
        let cleanSchemaSQL = schemaSQL
            .replace(/SET.*?;/g, '')
            .replace(/SELECT pg_catalog\.set_config.*?;/g, '')
            .replace(/ALTER .* OWNER TO .*?;/g, '')
            .replace(/COMMENT ON.*?;/g, '')
            .replace(/GRANT.*?;/g, '')
            .replace(/REVOKE.*?;/g, '')
            .replace(/\n\s*\n/g, '\n')
            .trim();

        await client.query(cleanSchemaSQL);
        console.log('✅ Database schema created');

        // Now insert the data
        console.log('📊 Inserting data...');
        
        // Split SQL into individual INSERT statements
        const insertStatements = cleanSQL
            .split('\n')
            .filter(line => line.trim().startsWith('INSERT INTO'))
            .filter(line => line.trim().length > 0);

        console.log(`Found ${insertStatements.length} INSERT statements to execute`);

        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < insertStatements.length; i++) {
            const statement = insertStatements[i];
            try {
                await client.query(statement);
                successCount++;
                if (i % 100 === 0) {
                    console.log(`✅ Processed ${i + 1}/${insertStatements.length} inserts...`);
                }
            } catch (error) {
                console.warn(`⚠️ Error with insert ${i + 1}: ${error.message.substring(0, 100)}...`);
                errorCount++;
                // Continue with other inserts even if one fails
            }
        }

        console.log(`✅ Data migration completed: ${successCount} successful, ${errorCount} errors`);

        // Verify the migration
        console.log('🔍 Verifying migration...');
        const userCount = await client.query('SELECT COUNT(*) FROM users');
        const regCount = await client.query('SELECT COUNT(*) FROM regulations');
        
        console.log(`✅ Migration verification:`);
        console.log(`   - Users: ${userCount.rows[0].count}`);
        console.log(`   - Regulations: ${regCount.rows[0].count}`);

        // Test login with existing user
        const testUser = await client.query(`
            SELECT id, username, role, department, email 
            FROM users 
            WHERE username = 'dvdbrnds' 
            LIMIT 1
        `);
        
        if (testUser.rows.length > 0) {
            console.log('✅ Test user found:', testUser.rows[0]);
        } else {
            console.log('⚠️ Test user not found, checking all users...');
            const allUsers = await client.query('SELECT username, role FROM users LIMIT 5');
            console.log('Available users:', allUsers.rows);
        }

        console.log('🎉 Database migration completed successfully!');
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        await client.end();
    }
}

// Run the migration
migrateDatabase().catch(console.error); 