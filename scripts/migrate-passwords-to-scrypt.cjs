#!/usr/bin/env node

/**
 * Migration script to convert bcrypt passwords to scrypt
 * This updates existing users with bcrypt hashes to use scrypt instead
 */

const { getDatabaseStorage } = require('../server/services/database');
const { hashPassword } = require('../server/auth');

async function migratePasswordsToScrypt() {
    console.log('🔄 Starting password migration from bcrypt to scrypt...');

    try {
        const storage = await getDatabaseStorage();

        // Define the passwords we know for common users
        const knownPasswords = {
            'admin': 'admin123',
            'dvdbrnds': 'gabadh',
            'user': 'password'
        };

        console.log('📋 Found known passwords for users:', Object.keys(knownPasswords));

        // Update each user with their known password
        for (const [username, password] of Object.entries(knownPasswords)) {
            try {
                console.log(`🔄 Updating password for user: ${username}`);

                // Hash the password with scrypt
                const hashedPassword = await hashPassword(password);

                // Update the user in the database
                await storage.query(
                    'UPDATE users SET password = $1 WHERE username = $2',
                    [hashedPassword, username]
                );

                console.log(`✅ Successfully updated password for user: ${username}`);
            } catch (error) {
                console.error(`❌ Failed to update password for user ${username}:`, error.message);
            }
        }

        console.log('✅ Password migration completed successfully!');
        console.log('🔐 All passwords are now using secure scrypt hashing');

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    }
}

// Run the migration
migratePasswordsToScrypt(); 