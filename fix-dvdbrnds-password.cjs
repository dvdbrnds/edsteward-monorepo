#!/usr/bin/env node

const { Pool } = require('pg');
const crypto = require('crypto');
require('dotenv').config();

async function hashPassword(password) {
  // Use scrypt for password hashing (EdSteward standard)
  const salt = crypto.randomBytes(16);
  const derivedKey = crypto.scryptSync(password, salt, 32);
  return salt.toString('hex') + ':' + derivedKey.toString('hex');
}

async function fixDvdbrndPassword() {
  console.log('🔧 Fixing dvdbrnds password to "gabadh"');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('neondb') ? { rejectUnauthorized: false } : false,
  });

  try {
    const client = await pool.connect();
    
    // Hash the correct password
    console.log('🔐 Hashing password "gabadh"...');
    const hashedPassword = await hashPassword('gabadh');
    
    // Update dvdbrnds password
    const result = await client.query(`
      UPDATE users SET 
        password = $1,
        updated_at = NOW()
      WHERE username = $2
      RETURNING id, username, email
    `, [hashedPassword, 'dvdbrnds']);

    if (result.rows.length > 0) {
      console.log('✅ dvdbrnds password updated successfully!');
      console.log('User ID:', result.rows[0].id);
      console.log('Username:', result.rows[0].username);
      console.log('Email:', result.rows[0].email);
      console.log('');
      console.log('🔐 LOGIN CREDENTIALS:');
      console.log('Username: dvdbrnds');
      console.log('Password: gabadh');
    } else {
      console.log('❌ No dvdbrnds user found to update');
    }
    
    client.release();
    await pool.end();
  } catch (error) {
    console.error('❌ Error updating password:', error.message);
  }
}

fixDvdbrndPassword();
