#!/usr/bin/env node

/**
 * Quick Emergency Admin Account Setup
 * Creates the emergency admin account with predefined secure values
 */

const { Pool } = require('pg');
const crypto = require('crypto');

// Load environment variables
require('dotenv').config();

async function hashPassword(password) {
  // Use scrypt for password hashing (EdSteward standard)
  const salt = crypto.randomBytes(16);
  const derivedKey = crypto.scryptSync(password, salt, 32);
  return salt.toString('hex') + ':' + derivedKey.toString('hex');
}

async function createEmergencyAdmin() {
  console.log('🚨 Creating Emergency Admin Account for HECVAT 4.0 Compliance');
  console.log('===========================================================');
  console.log('');

  // Predefined emergency admin details
  const adminDetails = {
    universityName: 'EdSteward System Administration',
    adminEmail: 'emergency-admin@edsteward.local',
    adminFirstName: 'Emergency',
    adminLastName: 'Administrator',
    username: 'emergency_admin',
    // Fixed password for easy access
    password: 'emergency123'
  };

  console.log('📋 Emergency Admin Account Details:');
  console.log(`Institution: ${adminDetails.universityName}`);
  console.log(`Email: ${adminDetails.adminEmail}`);
  console.log(`Name: ${adminDetails.adminFirstName} ${adminDetails.adminLastName}`);
  console.log(`Username: ${adminDetails.username}`);
  console.log(`Password: ${adminDetails.password}`);
  console.log('Role: Emergency Administrator');
  console.log('');

  try {
    // Connect to database
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL?.includes('neondb') ? { rejectUnauthorized: false } : false,
    });

    console.log('🔗 Connecting to database...');
    const client = await pool.connect();

    // Hash password
    console.log('🔐 Securing password...');
    const hashedPassword = await hashPassword(adminDetails.password);

    // Check if user already exists
    const existingUser = await client.query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [adminDetails.adminEmail, adminDetails.username]
    );

    if (existingUser.rows.length > 0) {
      console.log('⚠️ Emergency admin user already exists. Updating...');
      
      // Update existing user
      const result = await client.query(`
        UPDATE users SET 
          password = $1,
          "firstName" = $2,
          "lastName" = $3,
          role = $4,
          roles = $5,
          department = $6,
          identity_provider = $7,
          updated_at = NOW()
        WHERE username = $8 OR email = $9
        RETURNING id, username, email
      `, [
        hashedPassword,
        adminDetails.adminFirstName,
        adminDetails.adminLastName,
        'admin',
        '["admin"]',
        adminDetails.universityName,
        'local_emergency',
        adminDetails.username,
        adminDetails.adminEmail
      ]);

      console.log('✅ Emergency admin account updated successfully!');
    } else {
      // Insert new emergency admin user
      console.log('👤 Creating new emergency admin account...');
      const result = await client.query(`
        INSERT INTO users (
          username, 
          password, 
          email, 
          "firstName", 
          "lastName", 
          role, 
          roles,
          department,
          identity_provider,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
        RETURNING id, username, email
      `, [
        adminDetails.username,
        hashedPassword,
        adminDetails.adminEmail,
        adminDetails.adminFirstName,
        adminDetails.adminLastName,
        'admin',
        '["admin"]',
        adminDetails.universityName,
        'local_emergency'
      ]);

      console.log('✅ Emergency admin account created successfully!');
    }

    console.log('');
    console.log('🔐 EMERGENCY ADMIN CREDENTIALS');
    console.log('=============================');
    console.log(`Username: ${adminDetails.username}`);
    console.log(`Password: ${adminDetails.password}`);
    console.log(`Email: ${adminDetails.adminEmail}`);
    console.log('');
    console.log('🚨 CRITICAL NEXT STEPS:');
    console.log('1. 📝 SAVE THESE CREDENTIALS SECURELY');
    console.log('2. 🔐 Log in and set up MFA immediately');
    console.log('3. 💾 Save MFA backup codes');
    console.log('4. 🧪 Test emergency access procedure');
    console.log('5. 📚 Document in university password manager');
    console.log('');
    console.log('⚠️ SECURITY REMINDERS:');
    console.log('- This account bypasses SAML/Okta authentication');
    console.log('- Use ONLY during emergencies or SAML outages');
    console.log('- Enable MFA before using in production');
    console.log('- All actions are logged and audited');
    console.log('');

    client.release();
    await pool.end();

  } catch (error) {
    console.error('❌ Error creating emergency admin:', error.message);
    console.error('');
    console.error('🔧 Troubleshooting:');
    console.error('1. Check DATABASE_URL environment variable');
    console.error('2. Ensure database is accessible');
    console.error('3. Verify database schema is up to date');
    process.exit(1);
  }
}

// Run setup
if (require.main === module) {
  createEmergencyAdmin().catch(console.error);
}

module.exports = { createEmergencyAdmin };
