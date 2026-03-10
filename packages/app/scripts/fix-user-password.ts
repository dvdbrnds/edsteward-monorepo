#!/usr/bin/env npx tsx

/**
 * Emergency script to fix user password after bcrypt to scrypt migration
 * This script updates the dvdbrnds user password to use the new scrypt hash format
 */

import { sql } from 'drizzle-orm';
import { db } from '../server/config/database';
import { hashPassword } from '../server/auth';

async function fixUserPassword() {
    console.log('🔧 Starting emergency password fix for dvdbrnds user...');

    try {
        // First, check if the user exists
        const userResult = await db.execute(sql`
      SELECT id, username, password 
      FROM users 
      WHERE username = 'dvdbrnds'
    `);

        if (userResult.rows.length === 0) {
            console.log('👤 User dvdbrnds not found, creating new user...');

            // Create user with scrypt hash
            const hashedPassword = await hashPassword('gabadhgabadh');

            await db.execute(sql`
        INSERT INTO users (username, password, email, role, "firstName", "lastName", department)
        VALUES ('dvdbrnds', ${hashedPassword}, 'dvdbrnds@moravian.edu', 'admin', 'David', 'Brandes', 'IT')
      `);

            console.log('✅ User dvdbrnds created successfully with scrypt password');
        } else {
            const user = userResult.rows[0];
            console.log(`👤 Found user: ${user.username}`);
            console.log(`🔑 Current password hash: ${user.password.substring(0, 20)}...`);

            // Check if it's an old bcrypt hash
            if (user.password.startsWith('$2b$')) {
                console.log('⚠️  Detected old bcrypt hash, updating to scrypt...');

                // Update password to scrypt hash
                const hashedPassword = await hashPassword('gabadhgabadh');

                await db.execute(sql`
          UPDATE users 
          SET password = ${hashedPassword}, updated_at = NOW()
          WHERE username = 'dvdbrnds'
        `);

                console.log('✅ Password updated to scrypt hash successfully');
            } else if (user.password.includes(':')) {
                console.log('✅ Password already uses scrypt format');
            } else {
                console.log('⚠️  Unknown password format, updating to scrypt...');

                // Update password to scrypt hash
                const hashedPassword = await hashPassword('gabadhgabadh');

                await db.execute(sql`
          UPDATE users 
          SET password = ${hashedPassword}, updated_at = NOW()
          WHERE username = 'dvdbrnds'
        `);

                console.log('✅ Password updated to scrypt hash successfully');
            }
        }

        // Verify the fix by checking the updated user
        const verifyResult = await db.execute(sql`
      SELECT id, username, password, role, email 
      FROM users 
      WHERE username = 'dvdbrnds'
    `);

        if (verifyResult.rows.length > 0) {
            const user = verifyResult.rows[0];
            console.log('🔍 Verification:');
            console.log(`  - Username: ${user.username}`);
            console.log(`  - Role: ${user.role}`);
            console.log(`  - Email: ${user.email}`);
            console.log(`  - Password hash format: ${user.password.includes(':') ? 'scrypt' : 'unknown'}`);
            console.log(`  - Password hash: ${user.password.substring(0, 20)}...`);
        }

        console.log('🎉 Password fix completed successfully!');

    } catch (error) {
        console.error('❌ Error fixing password:', error);
        throw error;
    }
}

// Run the fix
fixUserPassword()
    .then(() => {
        console.log('✅ Script completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Script failed:', error);
        process.exit(1);
    }); 