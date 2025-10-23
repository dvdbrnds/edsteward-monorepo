#!/usr/bin/env node

const crypto = require('crypto');

// Test salt generation and conversion
console.log('Testing salt generation...');

const salt = crypto.randomBytes(16);
console.log('Salt buffer:', salt);
console.log('Salt hex:', salt.toString('hex'));
console.log('Salt hex length:', salt.toString('hex').length);

// Test with the stored salt
const storedSaltHex = '09ddeca914204d2bc92e192aaad97b67';
console.log('\nStored salt hex:', storedSaltHex);
console.log('Stored salt hex length:', storedSaltHex.length);

// Convert back to buffer
const storedSaltBuffer = Buffer.from(storedSaltHex, 'hex');
console.log('Stored salt buffer:', storedSaltBuffer);
console.log('Stored salt buffer length:', storedSaltBuffer.length);

// Test scrypt with both formats
const password = 'emergency123';

console.log('\n--- Testing scrypt with hex salt ---');
const derivedKey1 = crypto.scryptSync(password, storedSaltHex, 32);
console.log('Derived key (hex salt):', derivedKey1.toString('hex'));

console.log('\n--- Testing scrypt with buffer salt ---');
const derivedKey2 = crypto.scryptSync(password, storedSaltBuffer, 32);
console.log('Derived key (buffer salt):', derivedKey2.toString('hex'));
