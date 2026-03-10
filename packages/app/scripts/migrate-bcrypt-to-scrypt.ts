#!/usr/bin/env tsx

import { hashPassword } from '../server/auth';
import { getDatabaseStorage } from '../server/services/database';

/**
 * Migrate bcrypt passwords to scrypt format
 * This script converts all existing bcrypt password hashes to scrypt
 */

// Known passwords for migration (you'll need to update these)
const KNOWN_PASSWORDS: Record<string, string> = {
    'dvdbrnds': 'gabadhgabadh',
    'admin': 'admin123',  // Update with actual password
    'nasol': 'password123',  // Update with actual password
    // Add other users and their passwords here
};

async function migrateBcryptToScrypt() {
    console.log('🔄 Starting bcrypt to scrypt migration...');

    try {
        const storage = getDatabaseStorage();
        const users = await storage.getAllUsers();

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
                await storage.updateUser(user.id, { password: scryptHash });

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

        if (skippedCount > 0) {
            console.log('\n⚠️  Some users were skipped due to missing passwords in KNOWN_PASSWORDS');
            console.log('   Update the script with the correct passwords and run again');
        }

        console.log('\n🎉 Migration completed successfully!');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

// Run the migration
migrateBcryptToScrypt().catch(console.error); 