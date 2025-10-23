#!/usr/bin/env node

const crypto = require('crypto');
const { promisify } = require('util');
require('dotenv').config();

async function testPasswordVerification() {
  const password = 'emergency123';
  const storedHash = '09ddeca914204d2bc92e192aaad97b67:5f47ab2cc46d5d88dac4f8e622ab36e755010a1a90c22a0dddbb18ec5e65e307';
  
  console.log('Testing password verification...');
  console.log('Password:', password);
  console.log('Stored hash:', storedHash);
  
  const scryptAsync = promisify(crypto.scrypt);
  
  const [salt, hash] = storedHash.split(':');
  console.log('Salt:', salt, '(length:', salt.length, ')');
  console.log('Hash:', hash, '(length:', hash.length, ')');
  
  // Try with 32 bytes (current verification logic)
  console.log('\n--- Testing with 32 bytes ---');
  try {
    const derivedKey32 = await scryptAsync(password, salt, 32);
    const storedKey = Buffer.from(hash, 'hex');
    console.log('Derived key (32):', derivedKey32.toString('hex'), '(length:', derivedKey32.length, ')');
    console.log('Stored key:', storedKey.toString('hex'), '(length:', storedKey.length, ')');
    console.log('Match (32):', crypto.timingSafeEqual(derivedKey32, storedKey));
  } catch (error) {
    console.log('Error with 32 bytes:', error.message);
  }
  
  // Try with 64 bytes (what the creation script might have used)
  console.log('\n--- Testing with 64 bytes ---');
  try {
    const derivedKey64 = await scryptAsync(password, salt, 64);
    const storedKey = Buffer.from(hash, 'hex');
    console.log('Derived key (64):', derivedKey64.toString('hex'), '(length:', derivedKey64.length, ')');
    console.log('Stored key:', storedKey.toString('hex'), '(length:', storedKey.length, ')');
    console.log('Match (64):', crypto.timingSafeEqual(derivedKey64, storedKey));
  } catch (error) {
    console.log('Error with 64 bytes:', error.message);
  }
}

testPasswordVerification();
