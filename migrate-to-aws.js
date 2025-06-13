import pkg from 'pg';
const { Client } = pkg;
import fs from 'fs';
import path from 'path';

async function migrateToAWS() {
    console.log('🚀 Starting AWS RDS migration...');
    
    // Database connection configuration
    const client = new Client({
        host: 'edsteward-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com',
        port: 5432,
        database: 'edsteward',
        user: 'postgres',
        password: 'FZ2Pk9ij4ow2yStKrJiZD7vfUW9emT+PtVrM2VV536s=',
        ssl: {
            rejectUnauthorized: false
        }
    });

    try {
        // Connect to database
        console.log('📡 Connecting to AWS RDS...');
        await client.connect();
        console.log('✅ Connected to database successfully!');

        // Drop existing tables
        console.log('🧹 Cleaning existing tables...');
        const dropSQL = `
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
        `;
        
        await client.query(dropSQL);
        console.log('✅ Existing tables cleaned');

        // Create schema
        console.log('🏗️ Creating database schema...');
        const schemaSQL = fs.readFileSync('sql_dump/full_schema.sql', 'utf8');
        
        // Clean schema SQL for PostgreSQL
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

        // Insert data
        console.log('📊 Inserting data...');
        const exportSQL = fs.readFileSync('exports/complete_export.sql', 'utf8');
        
        // Extract INSERT statements
        const insertStatements = exportSQL
            .split('\n')
            .filter(line => line.trim().startsWith('INSERT INTO'))
            .filter(line => line.trim().length > 0);

        console.log(`Found ${insertStatements.length} INSERT statements`);

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
            }
        }

        // Verify migration
        console.log('🔍 Verifying migration...');
        const userResult = await client.query('SELECT COUNT(*) FROM users');
        const regResult = await client.query('SELECT COUNT(*) FROM regulations');
        
        const userCount = parseInt(userResult.rows[0].count);
        const regCount = parseInt(regResult.rows[0].count);

        // Test specific user
        const testUser = await client.query(`
            SELECT id, username, role, department, email 
            FROM users 
            WHERE username = 'dvdbrnds' 
            LIMIT 1
        `);

        console.log('🎉 Migration completed successfully!');
        console.log(`📊 Users: ${userCount}, Regulations: ${regCount}`);
        console.log(`✅ Insert success: ${successCount}, errors: ${errorCount}`);
        
        if (testUser.rows.length > 0) {
            console.log('👤 Test user found:', testUser.rows[0]);
        }

    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await client.end();
        console.log('🔌 Database connection closed');
    }
}

migrateToAWS().catch(console.error); 