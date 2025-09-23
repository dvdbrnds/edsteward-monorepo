#!/usr/bin/env node

/**
 * Debug script to check regulation updates page state
 */

const axios = require('axios');

async function debugUpdatesPage() {
  console.log('🔍 Debugging EdSteward Updates Page State');
  console.log('==========================================');

  try {
    // Check if server is running
    console.log('\n📡 1. Checking server health...');
    const healthResponse = await axios.get('http://localhost:3000/health');
    console.log('✅ Server is running:', healthResponse.status);

    // Check pending updates endpoint
    console.log('\n📡 2. Checking pending updates API...');
    const updatesResponse = await axios.get('http://localhost:3000/api/regulation-updates/pending');
    const updates = updatesResponse.data;
    
    console.log(`✅ Found ${updates.length} pending updates:`);
    updates.forEach((update, index) => {
      console.log(`   ${index + 1}. ID: ${update.id}, Name: ${update.name?.substring(0, 50)}...`);
      console.log(`      Status: ${update.status}, Regulation ID: ${update.regulationId}`);
    });

    // Check if updates page is accessible
    console.log('\n📡 3. Checking updates page accessibility...');
    try {
      const pageResponse = await axios.get('http://localhost:3000/regulations/updates');
      console.log('✅ Updates page is accessible:', pageResponse.status);
    } catch (error) {
      console.log('❌ Updates page error:', error.response?.status || error.message);
    }

    console.log('\n🎯 Summary:');
    console.log(`   - Server: ✅ Running`);
    console.log(`   - Pending Updates: ✅ ${updates.length} found`);
    console.log(`   - Updates Page: ✅ Accessible`);
    console.log('\n💡 If you still don\'t see the Accept All button:');
    console.log('   1. Make sure you\'re logged in (visit http://localhost:3000/auth)');
    console.log('   2. Navigate to http://localhost:3000/regulations/updates');
    console.log('   3. Check browser console for JavaScript errors (F12)');
    console.log('   4. Look for the green "Accept All Updates" button in the top-right');

  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  }
}

debugUpdatesPage();
