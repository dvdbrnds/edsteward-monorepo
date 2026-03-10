#!/usr/bin/env node

// Production password migration script
// This script runs in production to migrate bcrypt passwords to scrypt

const { scrypt, randomBytes, timingSafeEqual } = require('crypto');
const { promisify } = require('util');
const { Client } = require('pg');

const scryptAsync = promisify(scrypt);

/**
 * Hash a password using scrypt
 */
async function hashPassword(password) {
    const salt = randomBytes(16).toString('hex');
    const derivedKey = await scryptAsync(password, salt, 32);
    return `${salt}:${derivedKey.toString('hex')}`;
}

/**
 * Known passwords for migration
 */
const KNOWN_PASSWORDS = {
    'dvdbrnds': 'gabadhgabadh',
    'admin': 'admin123',
    'nasol': 'password123'
};

async function migrateBcryptToScrypt() {
    console.log('🔄 Starting production bcrypt to scrypt migration...');

    const client = new Client({
        connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_foSr6ixkzw7W@ep-weathered-term-a5rmi9cx-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require'
    });

    try {
        await client.connect();
        console.log('✅ Connected to database');

        // Get all users
        const result = await client.query('SELECT id, username, password FROM users');
        const users = result.rows;

        console.log(`📊 Found ${users.length} total users`);

        let migratedCount = 0;
        let skippedCount = 0;

        for (const user of users) {
            // Check if password is bcrypt format
            if (user.password && user.password.startsWith('$2b$')) {
                console.log(`🔍 Found bcrypt password for user: ${user.username}`);

                // Get the known password for this user
                const plainPassword = KNOWN_PASSWORDS[user.username];

                if (!plainPassword) {
                    console.warn(`⚠️  No known password for user ${user.username} - skipping`);
                    skippedCount++;
                    continue;
                }

                // Generate new scrypt hash
                const scryptHash = await hashPassword(plainPassword);

                // Update user in database
                await client.query('UPDATE users SET password = $1 WHERE id = $2', [scryptHash, user.id]);

                console.log(`✅ Migrated password for user: ${user.username}`);
                migratedCount++;
            } else {
                console.log(`✅ User ${user.username} already has scrypt password`);
            }
        }

        console.log('\n📈 Migration Summary:');
        console.log(`  ✅ Migrated: ${migratedCount} users`);
        console.log(`  ⚠️  Skipped: ${skippedCount} users`);
        console.log(`  📊 Total: ${users.length} users`);

        console.log('\n🎉 Production migration completed successfully!');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        await client.end();
    }
}

// Run the migration
migrateBcryptToScrypt().catch(console.error); 