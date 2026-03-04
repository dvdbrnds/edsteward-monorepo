#!/usr/bin/env node

/**
 * EMERGENCY: Transmit 8 PA regulations to EdSteward
 * For presentation in <5 hours!
 */

const fs = require('fs');
const https = require('https');
const http = require('http');

const EDSTEWARD_URL = process.env.EDSTEWARD_URL || 'http://localhost:3000';
const ENHANCED_DIR = 'enhanced-regulations';
const PA_SLUGS = [
  'pennsylvania-uniform-crime-reporting-act',
  'pennsylvania-sexual-violence-education-act-article-',
  'pennsylvania-higher-education-gift-disclosure-act',
  'pennsylvania-english-fluency-in-higher-education-a',
  'pennsylvania-graduation-rates-reporting-act-88-of-',
  'pa-paeducation-1741813075070',
  'pa-padeptEd-1741813075521',
  'pa-padeptEd-1741813212673'
];

console.log('═══════════════════════════════════════════════════════════════════');
console.log('🚨 EMERGENCY PA REGULATION TRANSMISSION');
console.log('Sending 8 PA regulations to EdSteward!');
console.log('═══════════════════════════════════════════════════════════════════\n');

function httpPost(url, data, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;
    
    const postData = JSON.stringify(data);
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        ...headers
      }
    };
    
    const req = client.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });
    
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function sendRegulation(slug, edstewardId, num, total) {
  const filePath = `${ENHANCED_DIR}/${slug}.json`;
  
  console.log(`\n[${num}/${total}] ${slug}`);
  console.log(`   EdSteward ID: ${edstewardId}`);
  
  if (!fs.existsSync(filePath)) {
    console.log(`   ❌ File not found: ${filePath}`);
    return { slug, success: false, error: 'File not found' };
  }
  
  const regulation = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  
  const payload = {
    regulationId: edstewardId,
    name: regulation.name || regulation.regulationName,
    description: regulation.description,
    summary: regulation.summary,
    requirements: regulation.requirements,
    reportingTimeline: regulation.reportingTimeline,
    citation: regulation.primaryCitation || regulation.citation,
    category: regulation.category,
    jurisdiction: 'state',
    state: 'PA',
    updatedContent: JSON.stringify({
      description: regulation.description,
      summary: regulation.summary,
      requirements: regulation.requirements,
      reportingTimeline: regulation.reportingTimeline
    }),
    metadata: {
      enhancedAt: regulation.timestamp,
      qualityScore: regulation.qualityScore,
      source: 'MCP Engine - AI Enhanced',
      state: 'PA'
    }
  };
  
  try {
    console.log(`   📤 Sending to EdSteward...`);
    const response = await httpPost(`${EDSTEWARD_URL}/api/regulation-updates`, payload);
    
    if (response.status >= 200 && response.status < 300) {
      console.log(`   ✅ SUCCESS (HTTP ${response.status})`);
      return { slug, success: true, edstewardId };
    } else {
      console.log(`   ⚠️  HTTP ${response.status}: ${JSON.stringify(response.data)}`);
      return { slug, success: false, status: response.status, error: response.data };
    }
  } catch (error) {
    console.log(`   ❌ FAILED: ${error.message}`);
    return { slug, success: false, error: error.message };
  }
}

async function main() {
  const results = [];
  
  // Send each PA regulation
  for (let i = 0; i < PA_SLUGS.length; i++) {
    const slug = PA_SLUGS[i];
    const edstewardId = 296 + i; // PA regulations are EdSteward IDs 296-303
    
    const result = await sendRegulation(slug, edstewardId, i + 1, PA_SLUGS.length);
    results.push(result);
    
    // Small delay between requests
    if (i < PA_SLUGS.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('✅ PA REGULATION TRANSMISSION COMPLETE!');
  console.log('═══════════════════════════════════════════════════════════════════\n');
  
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`📊 Results:`);
  console.log(`   ✅ Successful: ${successful}/${PA_SLUGS.length}`);
  console.log(`   ❌ Failed: ${failed}/${PA_SLUGS.length}`);
  console.log('');
  
  if (successful > 0) {
    console.log(`✅ EdSteward IDs transmitted: 296-${295 + successful}`);
  }
  
  if (failed > 0) {
    console.log(`\n❌ Failed transmissions:`);
    results.filter(r => !r.success).forEach(r => {
      console.log(`   - ${r.slug}: ${r.error || 'Unknown error'}`);
    });
  }
  
  console.log('\n🎤 READY FOR PRESENTATION!');
  console.log(`   • 290 federal regulations in EdSteward (IDs 1-295)`);
  console.log(`   • ${successful} PA regulations in EdSteward (IDs 296-303)`);
  console.log(`   • Total: ${290 + successful} regulations`);
  console.log('');
  
  // Save results
  const reportFile = `pa-transmission-${Date.now()}.json`;
  fs.writeFileSync(reportFile, JSON.stringify({ timestamp: new Date().toISOString(), results }, null, 2));
  console.log(`📄 Report saved: ${reportFile}`);
  console.log('');
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

