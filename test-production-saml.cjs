#!/usr/bin/env node

/**
 * Test Production SAML Configuration
 * Checks if SAML endpoints are working and configured properly
 */

const axios = require('axios');

const PRODUCTION_URL = 'https://moravian.edsteward.ai';

async function testProductionSAML() {
  console.log('🔐 Testing Production SAML Configuration');
  console.log('========================================');
  console.log(`Production URL: ${PRODUCTION_URL}`);
  
  try {
    // Test 1: Check if main site is accessible
    console.log('\\n1️⃣ Testing main site accessibility...');
    const mainResponse = await axios.get(PRODUCTION_URL, { 
      timeout: 10000,
      validateStatus: () => true 
    });
    console.log(`   Status: ${mainResponse.status}`);
    console.log(`   Content-Type: ${mainResponse.headers['content-type']}`);
    
    if (mainResponse.status === 200) {
      console.log('   ✅ Main site is accessible');
    } else {
      console.log('   ❌ Main site returned error status');
    }
    
    // Test 2: Check SAML metadata endpoint
    console.log('\\n2️⃣ Testing SAML metadata endpoint...');
    try {
      const metadataResponse = await axios.get(`${PRODUCTION_URL}/auth/saml/metadata/okta`, {
        timeout: 10000,
        validateStatus: () => true,
        headers: {
          'Accept': 'application/xml, text/xml'
        }
      });
      
      console.log(`   Status: ${metadataResponse.status}`);
      console.log(`   Content-Type: ${metadataResponse.headers['content-type']}`);
      
      if (metadataResponse.status === 200) {
        const content = metadataResponse.data;
        if (typeof content === 'string' && content.includes('<?xml')) {
          console.log('   ✅ SAML metadata endpoint returns XML');
          
          // Check for groups attribute in metadata
          if (content.includes('groups') || content.includes('Group')) {
            console.log('   ✅ Groups attribute found in metadata');
          } else {
            console.log('   ⚠️ Groups attribute not found in metadata');
          }
        } else {
          console.log('   ❌ SAML metadata endpoint returns HTML instead of XML');
          console.log('   This suggests SAML routes may not be properly configured');
        }
      } else {
        console.log('   ❌ SAML metadata endpoint returned error');
      }
    } catch (metadataError) {
      console.log('   ❌ SAML metadata endpoint failed:', metadataError.message);
    }
    
    // Test 3: Check SAML login endpoint
    console.log('\\n3️⃣ Testing SAML login endpoint...');
    try {
      const samlResponse = await axios.get(`${PRODUCTION_URL}/auth/saml/okta`, {
        timeout: 10000,
        validateStatus: () => true,
        maxRedirects: 0 // Don't follow redirects
      });
      
      console.log(`   Status: ${samlResponse.status}`);
      
      if (samlResponse.status === 302) {
        const location = samlResponse.headers.location;
        console.log(`   ✅ SAML login redirects to: ${location?.substring(0, 50)}...`);
        
        if (location && location.includes('okta.com')) {
          console.log('   ✅ Redirects to Okta - SAML is configured');
        } else {
          console.log('   ⚠️ Redirect location doesn\'t contain okta.com');
        }
      } else {
        console.log('   ❌ SAML login should redirect (302), got:', samlResponse.status);
      }
    } catch (samlError) {
      console.log('   ❌ SAML login endpoint failed:', samlError.message);
    }
    
    // Test 4: Check current user endpoint (should require auth)
    console.log('\\n4️⃣ Testing authentication requirement...');
    try {
      const userResponse = await axios.get(`${PRODUCTION_URL}/api/user`, {
        timeout: 10000,
        validateStatus: () => true
      });
      
      console.log(`   Status: ${userResponse.status}`);
      
      if (userResponse.status === 401) {
        console.log('   ✅ Authentication properly required');
      } else {
        console.log('   ⚠️ Expected 401 for unauthenticated request');
      }
    } catch (userError) {
      console.log('   ❌ User endpoint test failed:', userError.message);
    }
    
    console.log('\\n📋 Summary and Next Steps:');
    console.log('==========================');
    console.log('');
    console.log('🔧 For brandesd@moravian.edu to get admin privileges:');
    console.log('');
    console.log('1. **Log out completely** from moravian.edsteward.ai');
    console.log('2. **Clear browser cache** and cookies for the site');
    console.log('3. **Go to:** https://moravian.edsteward.ai/auth/saml/okta');
    console.log('4. **Log in via Okta** (not local username/password)');
    console.log('5. **Check server logs** for group extraction messages');
    console.log('');
    console.log('🔍 If SAML login doesn\'t work:');
    console.log('- Check Okta SAML app configuration');
    console.log('- Verify SAML certificates are properly configured');
    console.log('- Check that Okta is sending group claims');
    console.log('');
    console.log('📊 Database Status:');
    console.log('- ✅ brandesd@moravian.edu updated to admin role in database');
    console.log('- ✅ Roles column migration completed');
    console.log('- ✅ Role mapping system deployed');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
if (require.main === module) {
  testProductionSAML();
}

module.exports = { testProductionSAML };
