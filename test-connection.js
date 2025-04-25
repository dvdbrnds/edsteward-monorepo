/**
 * Simple test to check if server is reachable
 */
import axios from 'axios';

const TEST_URL = 'http://localhost:3010/';

async function testConnection() {
  try {
    console.log(`Testing connection to ${TEST_URL}...`);
    const response = await axios.get(TEST_URL);
    console.log('Connection successful!');
    console.log('Response:', response.data);
    return true;
  } catch (error) {
    console.error('Connection failed:', error.message);
    if (error.code) console.error('Error code:', error.code);
    return false;
  }
}

testConnection(); 