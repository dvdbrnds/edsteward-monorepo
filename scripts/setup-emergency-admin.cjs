#!/usr/bin/env node

/**
 * Emergency Admin Account Setup Script
 * Creates a local administrator account for business continuity
 * Required for HECVAT 4.0 compliance - ensures access during SAML/Okta outages
 */

const { Pool } = require('pg');
const crypto = require('crypto');
const readline = require('readline');

// Load environment variables
require('dotenv').config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

function questionHidden(prompt) {
  return new Promise((resolve) => {
    process.stdout.write(prompt);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    
    let password = '';
    process.stdin.on('data', function(char) {
      char = char + '';
      switch(char) {
        case '\n':
        case '\r':
        case '\u0004':
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdout.write('\n');
          resolve(password);
          break;
        case '\u0003':
          process.exit();
          break;
        default:
          password += char;
          process.stdout.write('*');
          break;
      }
    });
  });
}

async function hashPassword(password) {
  // Use scrypt for password hashing (EdSteward standard)
  const salt = crypto.randomBytes(16);
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return salt.toString('hex') + ':' + derivedKey.toString('hex');
}

async function setupEmergencyAdmin() {
  console.log('🚨 EdSteward Emergency Admin Account Setup');
  console.log('=========================================');
  console.log('');
  console.log('This creates a local administrator account for business continuity.');
  console.log('Required for HECVAT 4.0 compliance - ensures access during SAML/Okta outages.');
  console.log('');

  // Get university information
  const universityName = await question('University/Institution name: ');
  const adminEmail = await question('Emergency admin email: ');
  const adminFirstName = await question('Admin first name: ');
  const adminLastName = await question('Admin last name: ');
  
  console.log('');
  console.log('🔐 Password Requirements:');
  console.log('- Minimum 12 characters');
  console.log('- Must include uppercase, lowercase, numbers, and symbols');
  console.log('- Will be protected with MFA');
  console.log('');
  
  let password, confirmPassword;
  do {
    password = await questionHidden('Enter secure password: ');
    confirmPassword = await questionHidden('Confirm password: ');
    
    if (password !== confirmPassword) {
      console.log('❌ Passwords do not match. Please try again.\n');
    } else if (password.length < 12) {
      console.log('❌ Password must be at least 12 characters. Please try again.\n');
    }
  } while (password !== confirmPassword || password.length < 12);

  console.log('');
  console.log('📋 Account Summary:');
  console.log(`Institution: ${universityName}`);
  console.log(`Email: ${adminEmail}`);
  console.log(`Name: ${adminFirstName} ${adminLastName}`);
  console.log(`Role: Emergency Administrator`);
  console.log('');

  const confirm = await question('Create this emergency admin account? (yes/no): ');
  if (confirm.toLowerCase() !== 'yes') {
    console.log('❌ Setup cancelled.');
    rl.close();
    return;
  }

  try {
    // Connect to database
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL?.includes('neondb') ? { rejectUnauthorized: false } : false,
    });

    console.log('\n🔗 Connecting to database...');
    const client = await pool.connect();

    // Hash password
    console.log('🔐 Securing password...');
    const hashedPassword = await hashPassword(password);

    // Create username from email (before @)
    const username = adminEmail.split('@')[0] + '_emergency';

    // Check if user already exists
    const existingUser = await client.query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [adminEmail, username]
    );

    if (existingUser.rows.length > 0) {
      console.log('❌ User with this email or username already exists.');
      client.release();
      await pool.end();
      rl.close();
      return;
    }

    // Insert emergency admin user
    console.log('👤 Creating emergency admin account...');
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
        "identityProvider",
        "createdAt",
        "updatedAt"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      RETURNING id, username, email
    `, [
      username,
      hashedPassword,
      adminEmail,
      adminFirstName,
      adminLastName,
      'admin',
      '["admin"]',
      universityName,
      'local_emergency'
    ]);

    const newUser = result.rows[0];

    console.log('');
    console.log('✅ Emergency Admin Account Created Successfully!');
    console.log('==============================================');
    console.log(`User ID: ${newUser.id}`);
    console.log(`Username: ${newUser.username}`);
    console.log(`Email: ${newUser.email}`);
    console.log(`Role: Emergency Administrator`);
    console.log('');
    console.log('🔐 IMPORTANT NEXT STEPS:');
    console.log('1. Log in with these credentials');
    console.log('2. Set up MFA (Google Authenticator) immediately');
    console.log('3. Save backup codes in a secure location');
    console.log('4. Test emergency access procedure');
    console.log('5. Document credentials in university password manager');
    console.log('');
    console.log('🚨 SECURITY REMINDERS:');
    console.log('- This account bypasses SAML/Okta authentication');
    console.log('- Use only during emergencies or SAML outages');
    console.log('- Enable MFA before using in production');
    console.log('- Regularly test emergency access procedures');
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
  }

  rl.close();
}

// Run setup
if (require.main === module) {
  setupEmergencyAdmin().catch(console.error);
}

module.exports = { setupEmergencyAdmin };
