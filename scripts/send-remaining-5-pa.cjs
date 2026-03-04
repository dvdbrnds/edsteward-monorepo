#!/usr/bin/env node

const fs = require('fs');
const http = require('http');

const EDSTEWARD_URL = 'http://localhost:3000';
const ENHANCED_DIR = 'enhanced-regulations';

const PA_REGS = [
  { slug: 'pennsylvania-sexual-violence-education-act-article-', id: 297, name: 'Pennsylvania Sexual Violence Education Act' },
  { slug: 'pennsylvania-graduation-rates-reporting-act-88-of-', id: 300, name: 'Pennsylvania Graduation Rates Reporting Act' },
  { slug: 'pa-paeducation-1741813075070', id: 301, name: 'Pennsylvania Higher Education Standards and Guidelines' },
  { slug: 'pa-padeptEd-1741813075521', id: 302, name: 'Pennsylvania Institutional Accreditation Requirements' },
  { slug: 'pa-padeptEd-1741813212673', id: 303, name: 'Pennsylvania Student Consumer Protection Standards' }
];

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
  console.log(`[${num}/5] ${reg.name} (ID: ${reg.id})`);
  
  const filePath = `${ENHANCED_DIR}/${reg.slug}.json`;
  if (!fs.existsSync(filePath)) {
    console.log(`   ❌ File not found: ${filePath}\n`);
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
  console.log('🚨 TRANSMITTING 5 REMAINING PA REGULATIONS TO EDSTEWARD!\n');
  
  let success = 0;
  
  for (let i = 0; i < PA_REGS.length; i++) {
    if (await sendOne(PA_REGS[i], i + 1)) {
      success++;
    }
    if (i < PA_REGS.length - 1) await new Promise(r => setTimeout(r, 1000));
  }
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`✅ TRANSMITTED: ${success}/5 PA regulations`);
  console.log('═══════════════════════════════════════════════════════════════\n');
  console.log(`🎤 UPDATED PRESENTATION STATUS:`);
  console.log(`   • Federal regulations: 290`);
  console.log(`   • PA regulations: ${3 + success} (was 3, now ${3 + success})`);
  console.log(`   • Total in EdSteward: ${290 + 3 + success} regulations!`);
  console.log('');
}

main().catch(console.error);

