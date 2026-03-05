#!/usr/bin/env node

/**
 * Send All 295 Federal Regulations to EdSteward
 * Transmits all production-ready regulations with enhanced content
 */

import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

const EDSTEWARD_URL = process.env.EDSTEWARD_URL || 'http://localhost:3000';
const LLM_GATEWAY_URL = 'http://localhost:3002';
const BATCH_SIZE = 10; // Send in batches to avoid overwhelming EdSteward
const BATCH_DELAY = 5000; // 5 seconds between batches

/**
 * Get all federal regulations from audit report
 */
async function getAllFederalRegulations() {
  const auditData = JSON.parse(fs.readFileSync('comprehensive-audit-report.json', 'utf8'));
  return auditData.details
    .filter(reg => (reg.jurisdiction || 'unknown') !== 'pennsylvania')
    .map((reg, index) => ({
      slug: reg.slug,
      edstewardId: index + 1, // EdSteward IDs 1-295 for federal regulations
      score: reg.score
    }));
}

/**
 * Fetch regulation data from LLM Gateway
 */
async function fetchRegulationData(slug) {
  try {
    const response = await fetch(`${LLM_GATEWAY_URL}/api/llm/cfr/${slug}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    if (!data.success || !data.data) {
      throw new Error('No data returned');
    }
    return data.data;
  } catch (error) {
    console.error(`   ❌ Failed to fetch ${slug}: ${error.message}`);
    return null;
  }
}

/**
 * Send regulation to EdSteward
 */
async function sendToEdSteward(regulation, regulationData) {
  const payload = {
    regulationId: regulation.edstewardId,
    name: regulationData.name || regulationData.title || regulation.slug,
    originalContent: '',
    updatedContent: regulationData.fullText || regulationData.content || regulationData.regulation_text || '',
    summary: regulationData.summary || regulationData.description || '',
    requirements: regulationData.requirements || [],
    reportingRequirements: regulationData.reportingRequirements || [],
    metadata: {
      source: 'MCP Engine - AI Enhanced',
      lastUpdated: new Date().toISOString(),
      version: '1.0',
      score: regulation.score || 85,
      enhanced: true
    }
  };

  try {
    const response = await fetch(`${EDSTEWARD_URL}/api/regulation-updates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return { success: true, ...payload };
  } catch (error) {
    console.error(`   ❌ Failed to send ${regulation.slug}: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Main transmission function
 */
async function sendAllRegulations() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('SENDING ALL 295 FEDERAL REGULATIONS TO EDSTEWARD');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('');

  // Get all regulations
  console.log('📋 Loading regulations...');
  const regulations = await getAllFederalRegulations();
  console.log(`   Found: ${regulations.length} federal regulations`);
  console.log('');

  // Stats
  let sent = 0;
  let failed = 0;
  const results = [];

  // Process in batches
  const batches = [];
  for (let i = 0; i < regulations.length; i += BATCH_SIZE) {
    batches.push(regulations.slice(i, i + BATCH_SIZE));
  }

  console.log(`📦 Processing ${batches.length} batches (${BATCH_SIZE} per batch)...`);
  console.log('');

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Batch ${batchIndex + 1}/${batches.length}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    for (const regulation of batch) {
      const index = sent + failed + 1;
      process.stdout.write(`[${index}/${regulations.length}] ${regulation.slug}...`);

      // Fetch data
      const data = await fetchRegulationData(regulation.slug);
      if (!data) {
        failed++;
        console.log(` ❌ Failed to fetch`);
        results.push({ regulation: regulation.slug, success: false, error: 'Fetch failed' });
        continue;
      }

      // Send to EdSteward
      const result = await sendToEdSteward(regulation, data);
      if (result.success) {
        sent++;
        console.log(` ✅ Sent (ID: ${regulation.edstewardId})`);
        results.push({ regulation: regulation.slug, success: true, edstewardId: regulation.edstewardId });
      } else {
        failed++;
        console.log(` ❌ Failed to send`);
        results.push({ regulation: regulation.slug, success: false, error: result.error });
      }

      // Small delay between regulations
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Delay between batches
    if (batchIndex < batches.length - 1) {
      console.log('');
      console.log(`⏸️  Pausing ${BATCH_DELAY/1000}s before next batch...`);
      console.log('');
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
    }
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('TRANSMISSION COMPLETE');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('');
  console.log(`📊 Results:`);
  console.log(`   ✅ Sent: ${sent}/${regulations.length} (${Math.round(sent/regulations.length*100)}%)`);
  console.log(`   ❌ Failed: ${failed}/${regulations.length} (${Math.round(failed/regulations.length*100)}%)`);
  console.log('');

  // Save detailed results
  const reportFile = `edsteward-transmission-${Date.now()}.json`;
  fs.writeFileSync(reportFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    total: regulations.length,
    sent: sent,
    failed: failed,
    successRate: Math.round(sent/regulations.length*100),
    results: results
  }, null, 2));

  console.log(`📝 Detailed report saved: ${reportFile}`);
  console.log('');

  if (sent === regulations.length) {
    console.log('🎉 SUCCESS: All 295 regulations transmitted to EdSteward!');
  } else {
    console.log(`⚠️  ${failed} regulations failed - check report for details`);
  }

  return sent === regulations.length;
}

// Run transmission
sendAllRegulations()
  .then(success => {
    console.log(`\n🎯 Transmission completed ${success ? 'successfully' : 'with errors'}`);
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Transmission failed:', error);
    process.exit(1);
  });

