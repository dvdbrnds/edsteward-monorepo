import https from 'https';

// Test login endpoint to see current error
const postData = JSON.stringify({
  username: 'dvdbrnds',
  password: 'test123'
});

const options = {
  hostname: 'edsteward.ai',
  port: 443,
  path: '/api/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log('🔍 Testing production login endpoint...');
console.log('Expected: SSL authentication error should be resolved');
console.log('Current issue: "no encryption" in RDS connection');
console.log('');

const req = https.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log(`Headers:`, JSON.stringify(res.headers, null, 2));
  
  let responseBody = '';
  res.on('data', (chunk) => {
    responseBody += chunk;
  });
  
  res.on('end', () => {
    console.log('Response:', responseBody);
    
    if (responseBody.includes('no pg_hba.conf entry')) {
      console.log('\n❌ SSL ISSUE STILL EXISTS');
      console.log('The SSL task definition is not active yet.');
      console.log('Next steps:');
      console.log('1. Force ECS deployment');
      console.log('2. Wait 2-3 minutes');
      console.log('3. Check CloudWatch logs');
    } else if (responseBody.includes('User not found') || responseBody.includes('Invalid credentials')) {
      console.log('\n✅ SSL FIXED - USER ACCOUNT ISSUE');
      console.log('Database SSL connection is working!');
      console.log('Your local user account does not exist in production.');
      console.log('Next steps:');
      console.log('1. Go to https://edsteward.ai/register');
      console.log('2. Create your account in production database');
    } else {
      console.log('\n🔄 OTHER RESPONSE - Check logs for details');
    }
  });
});

req.on('error', (e) => {
  console.error(`Request error: ${e.message}`);
});

req.write(postData);
req.end(); 