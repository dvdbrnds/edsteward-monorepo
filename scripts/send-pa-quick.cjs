#!/usr/bin/env node

/**
 * EMERGENCY: Send 3 enhanced PA regulations to EdSteward
 * FAST - presentation in <5 hours!
 */

const fs = require('fs');
const http = require('http');

const EDSTEWARD_URL = 'http://localhost:3000';
const ENHANCED_DIR = 'enhanced-regulations';

// Only the 3 that were successfully enhanced
const PA_REGS = [
  { slug: 'pennsylvania-uniform-crime-reporting-act', id: 296, name: 'Pennsylvania Uniform Crime Reporting Act' },
  { slug: 'pennsylvania-higher-education-gift-disclosure-act', id: 298, name: 'Pennsylvania Higher Education Gift Disclosure Act' },
  { slug: 'pennsylvania-english-fluency-in-higher-education-a', id: 299, name: 'Pennsylvania English Fluency in Higher Education Act' }
];

console.log('🚨 EMERGENCY: Sending 3 PA regulations to EdSteward!\n');

function httpPost(url, data) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const postData = JSON.stringify(data);
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 80,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = http.request(options, (res) => {
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

async function sendOne(reg, num) {
  console.log(`[${num}/3] ${reg.name} (ID: ${reg.id})`);
  
  const filePath = `${ENHANCED_DIR}/${reg.slug}.json`;
  if (!fs.existsSync(filePath)) {
    console.log(`   ❌ File not found\n`);
    return false;
  }
  
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const enhanced = data.enhanced || {};
  
  const payload = {
    regulationId: reg.id,
    name: reg.name,
    originalContent: enhanced.fullText || '',
    description: enhanced.fullText || '',
    summary: enhanced.summary || '',
    requirements: enhanced.requirements || '',
    reportingTimeline: enhanced.reportingRequirements || '',
    category: 'State Regulation - Pennsylvania',
    updatedContent: JSON.stringify({
      description: enhanced.fullText,
      summary: enhanced.summary,
      requirements: enhanced.requirements
    }),
    metadata: {
      state: 'PA',
      jurisdiction: 'state',
      enhancedAt: data.audit?.timestamp || new Date().toISOString(),
      qualityScore: data.audit?.score || 0,
      source: 'MCP Engine - AI Enhanced'
    }
  };
  
  try {
    const response = await httpPost(`${EDSTEWARD_URL}/api/regulation-updates`, payload);
    
    if (response.status >= 200 && response.status < 300) {
      console.log(`   ✅ SUCCESS (HTTP ${response.status})\n`);
      return true;
    } else {
      console.log(`   ⚠️  HTTP ${response.status}\n`);
      return false;
    }
  } catch (error) {
    console.log(`   ❌ FAILED: ${error.message}\n`);
    return false;
  }
}

async function main() {
  let success = 0;
  
  for (let i = 0; i < PA_REGS.length; i++) {
    if (await sendOne(PA_REGS[i], i + 1)) {
      success++;
    }
    if (i < PA_REGS.length - 1) await new Promise(r => setTimeout(r, 1000));
  }
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`✅ TRANSMITTED: ${success}/3 PA regulations`);
  console.log('═══════════════════════════════════════════════════════════════\n');
  console.log(`🎤 PRESENTATION STATUS:`);
  console.log(`   • 290 federal regulations in EdSteward`);
  console.log(`   • ${success} PA regulations in EdSteward`);
  console.log(`   • Total: ${290 + success} regulations READY!`);
  console.log('');
}

main().catch(console.error);

