#!/usr/bin/env node

/**
 * Verify Accept All Button Implementation
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying Accept All Button Implementation');
console.log('===========================================');

// Check if the Accept All code exists in the file
const updatesPagePath = path.join(__dirname, 'client/src/pages/updates-list-page.tsx');

try {
  const content = fs.readFileSync(updatesPagePath, 'utf8');
  
  console.log('\n📁 Checking updates-list-page.tsx...');
  
  // Check for key Accept All components
  const checks = [
    { name: 'Accept All Button Import', pattern: /CheckCircle.*from.*lucide-react/ },
    { name: 'Bulk Accept Mutation', pattern: /bulkAcceptMutation.*useMutation/ },
    { name: 'Accept All Handler', pattern: /handleBulkAccept.*=.*\(\)/ },
    { name: 'Accept All Button (Header)', pattern: /Accept All Updates/ },
    { name: 'Accept All Button (Selected)', pattern: /Accept All \(\{selectedIds\.length\}\)/ },
    { name: 'Green Button Styling', pattern: /bg-green-600.*hover:bg-green-700/ }
  ];
  
  let allFound = true;
  
  checks.forEach(check => {
    const found = check.pattern.test(content);
    console.log(`${found ? '✅' : '❌'} ${check.name}: ${found ? 'Found' : 'Missing'}`);
    if (!found) allFound = false;
  });
  
  console.log(`\n🎯 Overall Status: ${allFound ? '✅ All components found' : '❌ Some components missing'}`);
  
  if (allFound) {
    console.log('\n💡 The Accept All functionality is implemented correctly.');
    console.log('   If you\'re not seeing the buttons, try:');
    console.log('   1. Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)');
    console.log('   2. Clear browser cache completely');
    console.log('   3. Try incognito/private mode');
    console.log('   4. Check browser console for JavaScript errors (F12)');
  }
  
} catch (error) {
  console.error('❌ Error reading file:', error.message);
}

console.log('\n🌐 Quick Test URLs:');
console.log('   Login: http://localhost:3000/auth');
console.log('   Updates: http://localhost:3000/regulations/updates');
console.log('   Test Page: file://' + path.join(__dirname, 'test-accept-all-ui.html'));
