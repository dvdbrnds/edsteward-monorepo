#!/usr/bin/env node

const { Pool } = require('pg');
require('dotenv').config();

async function checkPassword() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('neondb') ? { rejectUnauthorized: false } : false,
  });

  try {
    const client = await pool.connect();
    
    // Check current password hash
    const result = await client.query(
      'SELECT id, username, length(password) as password_length, password FROM users WHERE username = $1',
      ['emergency_admin']
    );
    
    if (result.rows.length > 0) {
      const user = result.rows[0];
      console.log('Current emergency_admin data:');
      console.log('ID:', user.id);
      console.log('Username:', user.username);
      console.log('Password length:', user.password_length);
      console.log('Password hash:', user.password);
      
      // Check if it's in the expected format (salt:hash)
      const parts = user.password.split(':');
      console.log('Password parts:', parts.length);
      if (parts.length === 2) {
        console.log('Salt length:', parts[0].length);
        console.log('Hash length:', parts[1].length);
      }
    } else {
      console.log('No emergency_admin user found');
    }
    
    client.release();
    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkPassword();
