const https = require('https');

const data = JSON.stringify({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 1000,
  messages: [{
    role: 'user',
    content: 'Say hello in one sentence.'
  }]
});

const options = {
  hostname: 'api.anthropic.com',
  port: 443,
  path: '/v1/messages',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': process.env.MCP_REGULATION_ENHANCEMENT_KEY,
    'anthropic-version': '2023-06-01',
    'Content-Length': data.length
  }
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', body);
    try {
      const json = JSON.parse(body);
      console.log('\nParsed:', JSON.stringify(json, null, 2));
    } catch (e) {
      console.log('\nCould not parse as JSON');
    }
  });
});

req.on('error', (e) => {
  console.error('Request error:', e);
});

req.write(data);
req.end();
