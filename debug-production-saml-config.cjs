#!/usr/bin/env node

/**
 * Debug Production SAML Configuration
 * Checks what environment variables and SAML settings are needed
 */

console.log('🔍 SAML Configuration Debug Guide');
console.log('=================================');
console.log('');

console.log('📋 Required Environment Variables for SAML:');
console.log('');
console.log('1. OKTA_SSO_URL - Okta Single Sign-On URL');
console.log('   Example: https://your-domain.okta.com/app/your-app-id/sso/saml');
console.log('');
console.log('2. OKTA_CERT - Okta SAML Certificate (base64 encoded)');
console.log('   Example: MIICXjCCAcegAwIBAgIBADANBgkqhkiG9w0BAQ...');
console.log('');
console.log('3. OKTA_SLO_URL - Okta Single Logout URL (optional)');
console.log('   Example: https://your-domain.okta.com/app/your-app-id/slo/saml');
console.log('');
console.log('4. BASE_URL - EdSteward base URL');
console.log('   Should be: https://moravian.edsteward.ai');
console.log('');
console.log('5. SAML_SP_ENTITY_ID - Service Provider Entity ID');
console.log('   Should be: urn:edsteward:sp');
console.log('');

console.log('🔧 Immediate Fix Options:');
console.log('');
console.log('**Option 1: Quick Admin Access (Temporary)**');
console.log('Since the database is already updated, you can:');
console.log('1. Go to: https://moravian.edsteward.ai');
console.log('2. Log in with: brandesd@moravian.edu / [your password]');
console.log('3. You should now have admin privileges');
console.log('');
console.log('**Option 2: Fix SAML Configuration (Permanent)**');
console.log('1. Check ECS task definition environment variables');
console.log('2. Ensure OKTA_SSO_URL and OKTA_CERT are set');
console.log('3. Redeploy with proper SAML configuration');
console.log('');

console.log('🚀 AWS ECS Environment Variable Check:');
console.log('Run this command to check current environment variables:');
console.log('');
console.log('aws ecs describe-task-definition \\');
console.log('  --task-definition edsteward-saml-step3:13 \\');
console.log('  --query "taskDefinition.containerDefinitions[0].environment"');
console.log('');

console.log('📝 Expected SAML Flow:');
console.log('1. User goes to /auth/saml/okta');
console.log('2. Server redirects to Okta with SAML request');
console.log('3. User authenticates with Okta');
console.log('4. Okta sends SAML response with groups to /auth/saml/callback/okta');
console.log('5. Server extracts groups, maps to roles, updates user');
console.log('6. User is logged in with proper role');
console.log('');

console.log('🎯 Current Status:');
console.log('✅ Role mapping code deployed');
console.log('✅ Database migration completed');
console.log('✅ User updated to admin in database');
console.log('❌ SAML endpoints not working (missing env vars?)');
console.log('');

console.log('💡 Quick Test:');
console.log('Try logging in with local credentials first to verify admin access works,');
console.log('then we can fix the SAML configuration for future logins.');
