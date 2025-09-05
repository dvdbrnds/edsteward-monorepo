#!/usr/bin/env node

/**
 * Quick script to create EdSteward client-side records for Pennsylvania regulations
 * This will register all PA regulations so they show up in the EdSteward client
 */

import https from 'https';

// Pennsylvania regulations that need EdSteward records
const paRegulations = [
  {
    id: 297,
    name: 'Pennsylvania Sexual Violence Education Act',
    slug: 'pennsylvania-sexual-violence-education-act',
    description: 'Pennsylvania law requiring sexual violence education and prevention programs'
  },
  {
    id: 298,
    name: 'Pennsylvania Higher Education Gift Disclosure Act',
    slug: 'pennsylvania-higher-education-gift-disclosure-act', 
    description: 'Pennsylvania law requiring disclosure of gifts to higher education institutions'
  },
  {
    id: 299,
    name: 'Pennsylvania English Fluency in Higher Education Act',
    slug: 'pennsylvania-english-fluency-in-higher-education-a',
    description: 'Pennsylvania law establishing English fluency requirements for higher education'
  },
  {
    id: 300,
    name: 'Pennsylvania Graduation Rates Reporting Act 88',
    slug: 'pennsylvania-graduation-rates-reporting-act-88-of-',
    description: 'Pennsylvania law requiring reporting of graduation rates'
  }
];

async function createEdStewardRecord(regulation) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      id: regulation.id,
      name: regulation.name,
      slug: regulation.slug,
      description: regulation.description,
      type: 'state_regulation',
      state: 'Pennsylvania',
      category: 'education',
      status: 'active',
      created_by: 'MCP-Engine-Auto-Registration',
      metadata: {
        source: 'MCP Engine Pennsylvania Regulation Service',
        auto_created: true,
        created_at: new Date().toISOString()
      }
    });

    const options = {
      hostname: 'moravian.edsteward.ai',
      port: 443,
      path: '/api/regulations',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'MCP-Engine-PA-Registration/1.0'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log(`✅ Created EdSteward record for ${regulation.name} (ID: ${regulation.id})`);
        console.log(`   Status: ${res.statusCode}`);
        if (data) {
          try {
            const response = JSON.parse(data);
            console.log(`   Response: ${JSON.stringify(response, null, 2)}`);
          } catch (e) {
            console.log(`   Raw response: ${data}`);
          }
        }
        resolve({ regulation, status: res.statusCode, data });
      });
    });

    req.on('error', (error) => {
      console.error(`❌ Failed to create record for ${regulation.name}:`, error.message);
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

async function main() {
  console.log('🚀 Creating EdSteward records for Pennsylvania regulations...\n');
  
  for (const regulation of paRegulations) {
    try {
      await createEdStewardRecord(regulation);
      console.log(''); // Empty line for readability
      
      // Small delay to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`Failed to create record for ${regulation.name}:`, error.message);
    }
  }
  
  console.log('🎉 Pennsylvania regulation registration complete!');
  console.log('\n📋 Next steps:');
  console.log('1. Verify records appear in EdSteward client');
  console.log('2. Test regulation updates from MCP Engine');
  console.log('3. Check WebSocket notifications are working');
}

main().catch(console.error);


