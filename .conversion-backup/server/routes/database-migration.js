import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { db } from '../config/database.js';
import { sql } from 'drizzle-orm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

// Database migration endpoint
router.post('/migrate', async (req, res) => {
    try {
        console.log('🚀 Starting database migration...');
        
        // Security check - only allow in development or with proper auth
        const authKey = req.headers['x-migration-key'];
        if (authKey !== 'migrate-edsteward-2025') {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Drop all existing tables for clean migration
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
        
        await db.execute(sql.raw(dropTablesSQL));
        console.log('✅ Existing tables cleaned');

        // Create schema from full_schema.sql
        console.log('🏗️ Creating database schema...');
        const schemaPath = path.join(__dirname, '../../sql_dump/full_schema.sql');
        const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
        
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

        await db.execute(sql.raw(cleanSchemaSQL));
        console.log('✅ Database schema created');

        // Insert data from complete export
        console.log('📊 Inserting data...');
        const exportPath = path.join(__dirname, '../../exports/complete_export.sql');
        const exportSQL = fs.readFileSync(exportPath, 'utf8');
        
        // Extract INSERT statements
        const insertStatements = exportSQL
            .split('\n')
            .filter(line => line.trim().startsWith('INSERT INTO'))
            .filter(line => line.trim().length > 0);

        console.log(`Found ${insertStatements.length} INSERT statements`);

        let successCount = 0;
        let errorCount = 0;
        const errors = [];

        for (let i = 0; i < insertStatements.length; i++) {
            const statement = insertStatements[i];
            try {
                await db.execute(sql.raw(statement));
                successCount++;
                if (i % 100 === 0) {
                    console.log(`✅ Processed ${i + 1}/${insertStatements.length} inserts...`);
                }
            } catch (error) {
                console.warn(`⚠️ Error with insert ${i + 1}: ${error.message.substring(0, 100)}...`);
                errorCount++;
                errors.push({ statement: i + 1, error: error.message });
                // Continue with other inserts
            }
        }

        // Verify migration
        console.log('🔍 Verifying migration...');
        const userCountResult = await db.execute(sql`SELECT COUNT(*) FROM users`);
        const regCountResult = await db.execute(sql`SELECT COUNT(*) FROM regulations`);
        
        const userCount = parseInt(userCountResult.rows[0].count);
        const regCount = parseInt(regCountResult.rows[0].count);

        // Test login with existing user
        const testUserResult = await db.execute(sql`
            SELECT id, username, role, department, email 
            FROM users 
            WHERE username = 'dvdbrnds' 
            LIMIT 1
        `);

        console.log('🎉 Database migration completed!');
        
        res.json({
            success: true,
            message: 'Database migration completed successfully',
            stats: {
                insertSuccess: successCount,
                insertErrors: errorCount,
                totalUsers: userCount,
                totalRegulations: regCount,
                testUser: testUserResult.rows[0] || null
            },
            errors: errors.slice(0, 10) // Only first 10 errors to avoid large response
        });

    } catch (error) {
        console.error('❌ Migration failed:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: 'Database migration failed'
        });
    }
});

// Simple status check
router.get('/status', async (req, res) => {
    try {
        const userCountResult = await db.execute(sql`SELECT COUNT(*) FROM users`);
        const regCountResult = await db.execute(sql`SELECT COUNT(*) FROM regulations`);
        
        res.json({
            success: true,
            stats: {
                users: parseInt(userCountResult.rows[0].count),
                regulations: parseInt(regCountResult.rows[0].count)
            }
        });
    } catch (error) {
        res.json({
            success: false,
            error: error.message,
            message: 'Database not initialized'
        });
    }
});

export default router; 