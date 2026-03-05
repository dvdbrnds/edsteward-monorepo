// Test the tenant database query function
import { getTenantStats, checkTenantHealth } from './config/database-connections.js';

async function testTenantQueries() {
  console.log('Testing tenant database queries...');
  
  try {
    console.log('\n🔍 Testing Moravian stats...');
    const moravianStats = await getTenantStats('moravian');
    console.log('Moravian stats:', moravianStats);
    
    console.log('\n🔍 Testing Moravian health...');
    const moravianHealth = await checkTenantHealth('moravian');
    console.log('Moravian health:', moravianHealth);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testTenantQueries(); 