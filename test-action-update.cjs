const fetch = require('node-fetch');

async function testActionUpdate() {
  console.log('Testing action update endpoint...\n');
  
  const response = await fetch('http://localhost:3000/api/regulations/55/actions/attestation', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': 'connect.sid=test'
    },
    body: JSON.stringify({
      type: 'attestation',
      status: 'completed',
      required: true,
      enabled: true
    })
  });
  
  const data = await response.json();
  
  console.log('Status:', response.status);
  console.log('Response:', JSON.stringify(data, null, 2));
}

testActionUpdate().catch(console.error);






