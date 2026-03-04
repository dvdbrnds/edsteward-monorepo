#!/usr/bin/env node

/**
 * DEMO READINESS CHECK - FRIDAY MORNING PRESENTATION
 * 
 * Validates all services are healthy and demo regulations score 85+
 */

const http = require('http');

// Service endpoints
const SERVICES = {
  'Registry API': { port: 3010, path: '/api/regulations/all' },
  'LLM Gateway': { port: 3002, path: '/api/health' },
  'Frontend': { port: 3050, path: '/' },
  'Inquisitor': { port: 3061, path: '/api/inquisitor/health' }
};

// Demo regulations to test
const DEMO_REGULATIONS = [
  { id: 223, name: 'FERPA', slug: 'family-educational-rights-and-privacy-act-ferpa' },
  { id: 7, name: 'Title IX', slug: 'title-ix-of-the-education-amendments-of-1972' },
  { id: 2, name: 'ADA', slug: 'americans-with-disabilities-act-ada' },
  { id: 78, name: 'Title IV', slug: 'title-iv-student-financial-aid' },
  { id: 6, name: 'Section 504', slug: 'section-504-of-the-rehabilitation-act-of-1973' },
  { id: 8, name: 'Title VI', slug: 'title-vi-of-the-civil-rights-act-of-1964' },
  { id: 87, name: 'HEOA', slug: 'higher-education-opportunity-act-heoa' },
  { id: 67, name: 'Drug-Free Schools', slug: 'drug-free-schools-and-communities-act' },
  { id: 55, name: 'TEACH Act', slug: 'teach-act' },
  { id: 355, name: 'Clery Act', slug: 'jeanne-clery-disclosure-of-campus-security-policy-and-campus-crime-statistics-act-clery-act' }
];

const CRITICAL_TESTS = [
  { name: 'FERPA', slug: 'family-educational-rights-and-privacy-act-ferpa' },
  { name: 'Clery Act', slug: 'jeanne-clery-disclosure-of-campus-security-policy-and-campus-crime-statistics-act-clery-act' }
];

// Helper function to make HTTP GET requests
function httpGet(port, path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: port,
      path: path,
      method: 'GET',
      timeout: 10000
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

// Helper function to make HTTP POST requests
function httpPost(port, path, postData) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(postData);
    const options = {
      hostname: 'localhost',
      port: port,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      },
      timeout: 60000 // 60 second timeout for AI analysis
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => { responseData += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(responseData);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, data: responseData });
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout after 60 seconds'));
    });

    req.write(data);
    req.end();
  });
}

// Sleep helper
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Priority 1: Health Check All Services
async function healthCheckServices() {
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('PRIORITY 1: SERVICE HEALTH CHECK');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const results = {};

  for (const [name, config] of Object.entries(SERVICES)) {
    process.stdout.write(`Checking ${name} (port ${config.port})... `);
    try {
      const response = await httpGet(config.port, config.path);
      if (response.status === 200 || response.status === 304) {
        console.log('✅ RESPONDING');
        results[name] = { status: 'healthy', port: config.port };
      } else {
        console.log(`⚠️  HTTP ${response.status}`);
        results[name] = { status: 'degraded', port: config.port, code: response.status };
      }
    } catch (error) {
      console.log(`❌ ERROR: ${error.message}`);
      results[name] = { status: 'down', port: config.port, error: error.message };
    }
  }

  return results;
}

// Priority 2: Test Demo Regulations
async function testDemoRegulations() {
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('PRIORITY 2: DEMO REGULATION VALIDATION');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const results = [];
  let passCount = 0;
  let failCount = 0;

  for (const reg of DEMO_REGULATIONS) {
    process.stdout.write(`Testing ${reg.name.padEnd(20)}... `);
    
    try {
      const response = await httpPost(3061, '/api/inquisitor/audit', {
        regulationSlug: reg.slug,
        regulationId: reg.id
      });

      if (response.data && response.data.success) {
        const audit = response.data.data;
        const score = audit.overallScore || 0;
        const certainty = audit.certaintyLevel || 'D';
        const passed = score >= 85;

        if (passed) {
          console.log(`✅ Score: ${score} (${certainty}) PASS`);
          passCount++;
        } else {
          console.log(`⚠️  Score: ${score} (${certainty}) FAIL - Below 85`);
          failCount++;
        }

        results.push({
          name: reg.name,
          id: reg.id,
          score: score,
          certainty: certainty,
          passed: passed,
          contentScore: audit.ruleBasedAnalysis?.contentQuality || 0,
          summaryScore: audit.ruleBasedAnalysis?.summaryQuality || 0,
          requirementsScore: audit.ruleBasedAnalysis?.requirementsQuality || 0,
          aiScore: audit.aiAnalysis?.overallScore || 0
        });
      } else {
        console.log(`❌ ERROR: ${response.data?.error || 'No data returned'}`);
        failCount++;
        results.push({
          name: reg.name,
          id: reg.id,
          error: response.data?.error || 'No data returned',
          passed: false
        });
      }

      await sleep(500); // Rate limiting
    } catch (error) {
      console.log(`❌ ERROR: ${error.message}`);
      failCount++;
      results.push({
        name: reg.name,
        id: reg.id,
        error: error.message,
        passed: false
      });
    }
  }

  console.log(`\n📊 Results: ${passCount} passed, ${failCount} failed out of ${DEMO_REGULATIONS.length} total\n`);
  return results;
}

// Priority 3: Inquisitor Reliability Test
async function testInquisitorReliability() {
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('PRIORITY 3: INQUISITOR RELIABILITY TEST');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const results = {};

  for (const test of CRITICAL_TESTS) {
    console.log(`\nTesting ${test.name} - Running 3 consecutive audits:`);
    const scores = [];
    let allPassed = true;

    for (let i = 1; i <= 3; i++) {
      process.stdout.write(`  Run ${i}/3... `);
      const startTime = Date.now();

      try {
        const response = await httpPost(3061, '/api/inquisitor/audit', {
          regulationSlug: test.slug
        });

        const duration = Date.now() - startTime;

        if (response.data && response.data.success) {
          const score = response.data.data.overallScore || 0;
          scores.push(score);
          console.log(`✅ Score: ${score} (${duration}ms)`);
        } else {
          console.log(`❌ FAILED: ${response.data?.error || 'No data'}`);
          allPassed = false;
        }
      } catch (error) {
        console.log(`❌ ERROR: ${error.message}`);
        allPassed = false;
      }

      await sleep(1000); // Wait between runs
    }

    // Calculate consistency
    if (scores.length === 3) {
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      const variance = Math.max(...scores) - Math.min(...scores);
      console.log(`  📊 Average: ${avg.toFixed(1)}, Variance: ${variance}, Consistency: ${variance <= 5 ? '✅ GOOD' : '⚠️ HIGH'}`);
      
      results[test.name] = {
        passed: allPassed,
        scores: scores,
        average: avg,
        variance: variance
      };
    } else {
      results[test.name] = {
        passed: false,
        error: 'Did not complete all 3 runs'
      };
    }
  }

  return results;
}

// Priority 4: USC/CFR Endpoint Verification
async function testEndpoints() {
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('PRIORITY 4: USC/CFR ENDPOINT VERIFICATION');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const tests = [
    { name: 'USC FERPA', path: '/api/llm/usc/20/1232g' },
    { name: 'CFR FERPA', path: '/api/llm/cfr/family-educational-rights-and-privacy-act-ferpa' },
    { name: 'CFR Clery', path: '/api/llm/cfr/jeanne-clery-disclosure-of-campus-security-policy-and-campus-crime-statistics-act-clery-act' }
  ];

  const results = {};

  for (const test of tests) {
    process.stdout.write(`Testing ${test.name.padEnd(15)}... `);
    
    try {
      const response = await httpGet(3002, test.path);
      
      if (response.status === 200 && response.data.success) {
        const data = response.data.data;
        const hasContent = data.fullText && data.fullText.length > 100;
        const hasMetadata = data.metadata && data.metadata.confidence;
        
        if (hasContent && hasMetadata) {
          console.log(`✅ Content: ${data.fullText.length} chars, Confidence: ${data.metadata.confidence}%`);
          results[test.name] = { status: 'pass', contentLength: data.fullText.length, confidence: data.metadata.confidence };
        } else {
          console.log(`⚠️  Missing content or metadata`);
          results[test.name] = { status: 'incomplete', hasContent, hasMetadata };
        }
      } else {
        console.log(`❌ HTTP ${response.status}`);
        results[test.name] = { status: 'fail', code: response.status };
      }
    } catch (error) {
      console.log(`❌ ERROR: ${error.message}`);
      results[test.name] = { status: 'error', error: error.message };
    }
  }

  return results;
}

// Main execution
async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║     DEMO READINESS CHECK - FRIDAY MORNING PRESENTATION            ║');
  console.log('║     EdSteward Counsel Demo - Service Validation                   ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝');

  const report = {
    timestamp: new Date().toISOString(),
    services: null,
    demoRegulations: null,
    reliability: null,
    endpoints: null,
    criticalIssues: []
  };

  try {
    // 1. Health checks
    report.services = await healthCheckServices();
    
    // Check for down services
    for (const [name, result] of Object.entries(report.services)) {
      if (result.status === 'down') {
        report.criticalIssues.push(`${name} is DOWN on port ${result.port}`);
      }
    }

    // 2. Demo regulations
    report.demoRegulations = await testDemoRegulations();
    
    // Check for failed regulations
    const failedRegs = report.demoRegulations.filter(r => !r.passed);
    if (failedRegs.length > 0) {
      report.criticalIssues.push(`${failedRegs.length} demo regulations failed quality check`);
    }

    // 3. Reliability tests
    report.reliability = await testInquisitorReliability();
    
    // Check for reliability issues
    for (const [name, result] of Object.entries(report.reliability)) {
      if (!result.passed || (result.variance && result.variance > 5)) {
        report.criticalIssues.push(`${name} reliability test failed or inconsistent`);
      }
    }

    // 4. Endpoint tests
    report.endpoints = await testEndpoints();
    
    // Check for endpoint failures
    for (const [name, result] of Object.entries(report.endpoints)) {
      if (result.status !== 'pass') {
        report.criticalIssues.push(`${name} endpoint test failed`);
      }
    }

    // Final summary
    console.log('\n═══════════════════════════════════════════════════════════════════');
    console.log('DEMO READINESS SUMMARY');
    console.log('═══════════════════════════════════════════════════════════════════\n');

    if (report.criticalIssues.length === 0) {
      console.log('✅ ALL CHECKS PASSED - SYSTEM IS DEMO READY\n');
      console.log('🎯 Demo Status: 🟢 GREEN - READY FOR COUNSEL PRESENTATION');
    } else {
      console.log('⚠️  CRITICAL ISSUES DETECTED:\n');
      report.criticalIssues.forEach((issue, i) => {
        console.log(`   ${i + 1}. ${issue}`);
      });
      console.log('\n🎯 Demo Status: 🟡 YELLOW - NEEDS ATTENTION BEFORE DEMO');
    }

    // Save full report
    const fs = require('fs');
    fs.writeFileSync(
      'demo-readiness-report.json',
      JSON.stringify(report, null, 2)
    );
    console.log('\n📄 Full report saved to: demo-readiness-report.json\n');

  } catch (error) {
    console.error('\n❌ FATAL ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();

