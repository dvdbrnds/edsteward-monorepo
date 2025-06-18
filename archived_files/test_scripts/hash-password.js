#!/usr/bin/env node
/**
 * Generate password hashes using the exact same method as auth.ts
 */

import { scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString("hex")}.${salt}`;
}

async function main() {
  console.log('🔐 Generating password hashes using Node.js scrypt...\n');
  
  try {
    const adminHash = await hashPassword('admin123');
    const testHash = await hashPassword('test123');
    
    console.log('👤 developer user (admin123):');
    console.log(`   Hash: ${adminHash}\n`);
    
    console.log('👤 testuser user (test123):');
    console.log(`   Hash: ${testHash}\n`);
    
    console.log('📋 SQL to update users:');
    console.log(`UPDATE users SET password = '${adminHash}' WHERE username = 'developer';`);
    console.log(`UPDATE users SET password = '${testHash}' WHERE username = 'testuser';`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

main(); 