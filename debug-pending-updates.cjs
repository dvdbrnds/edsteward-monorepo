#!/usr/bin/env node

/**
 * Debug script to check what's happening with pendingUpdates
 */

const axios = require('axios');

async function debugPendingUpdates() {
  console.log('🔍 Debugging Pending Updates Data');
  console.log('=================================');

  try {
    // Check the API endpoint directly
    console.log('\n📡 1. Checking API endpoint directly...');
    const response = await axios.get('http://localhost:3000/api/regulation-updates/pending');
    const data = response.data;
    
    console.log(`✅ API Response Status: ${response.status}`);
    console.log(`📊 Data Type: ${Array.isArray(data) ? 'Array' : typeof data}`);
    console.log(`📊 Data Length: ${Array.isArray(data) ? data.length : 'N/A'}`);
    
    if (Array.isArray(data)) {
      console.log(`\n📋 First 3 updates:`);
      data.slice(0, 3).forEach((update, index) => {
        console.log(`   ${index + 1}. ID: ${update.id}, Name: ${update.name?.substring(0, 50)}...`);
      });
      
      if (data.length > 0) {
        console.log('\n✅ DIAGNOSIS: API returns data correctly');
        console.log('🔍 ISSUE: Frontend might not be processing the data correctly');
        console.log('\n💡 NEXT STEPS:');
        console.log('   1. Check browser console for JavaScript errors');
        console.log('   2. Look for React Query errors');
        console.log('   3. Check if pendingUpdates state is being set correctly');
      } else {
        console.log('\n❌ DIAGNOSIS: No pending updates found');
        console.log('💡 This explains why Accept All button is not showing');
      }
    } else {
      console.log('\n❌ DIAGNOSIS: API is not returning an array');
      console.log('💡 This would cause pendingUpdates.length to fail');
    }
    
    // Check if the frontend is making the request
    console.log('\n📡 2. Testing frontend API call simulation...');
    const frontendResponse = await axios.get('http://localhost:3000/api/regulation-updates/pending', {
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    
    console.log(`✅ Frontend-style request: ${frontendResponse.status}`);
    console.log(`📊 Same data length: ${frontendResponse.data.length}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Data: ${JSON.stringify(error.response.data)}`);
    }
  }
}

debugPendingUpdates();
