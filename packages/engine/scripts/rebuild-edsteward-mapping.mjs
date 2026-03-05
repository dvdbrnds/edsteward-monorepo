#!/usr/bin/env node
/**
 * Rebuild EdSteward ID Mapping
 * 
 * Matches ALL MCP Engine regulations to EdSteward's numeric IDs using:
 *   1. reg_key exact match (REG-001 → REG-251)
 *   2. Exact name match (case-insensitive)
 *   3. Fuzzy name match (normalized, stripped punctuation)
 *   4. item_id / slug match
 * 
 * Writes updated mapping to data/edsteward-regkey-bulk-mapping.json
 */

import fs from 'fs';
import path from 'path';

const API_KEY = process.env.MCP_API_KEY || 'mcp_e8dcc41247c6a154c0f8db78565dda6628b936cdfb01ef81e6e5ed0349d9d585';
const EDSTEWARD_URL = 'https://moravian.edsteward.ai';
const REGISTRY_URL = 'http://localhost:3010';

function normalize(str) {
  return (str || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')  // strip punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  console.log('=== EdSteward ID Mapping Rebuild ===\n');

  // 1. Fetch all EdSteward regulations
  console.log('Fetching EdSteward regulations...');
  let edstewardRegs = [];
  
  // EdSteward might paginate - fetch multiple pages
  for (let page = 1; page <= 5; page++) {
    const resp = await fetch(`${EDSTEWARD_URL}/api/regulations?page=${page}&limit=300`, {
      headers: { 'X-MCP-API-Key': API_KEY }
    });
    const data = await resp.json();
    if (Array.isArray(data) && data.length > 0) {
      edstewardRegs = edstewardRegs.concat(data);
      if (data.length < 300) break; // last page
    } else {
      break;
    }
  }
  console.log(`  EdSteward: ${edstewardRegs.length} regulations\n`);

  // 2. Build EdSteward lookup indexes
  const byRegKey = new Map();
  const byNameExact = new Map();
  const byNameNorm = new Map();
  const byItemId = new Map();

  for (const reg of edstewardRegs) {
    if (reg.reg_key) byRegKey.set(reg.reg_key, reg);
    const nameExact = (reg.name || '').toLowerCase().trim();
    if (nameExact) byNameExact.set(nameExact, reg);
    const nameNorm = normalize(reg.name);
    if (nameNorm) byNameNorm.set(nameNorm, reg);
    if (reg.item_id) byItemId.set(reg.item_id.toLowerCase(), reg);
  }

  // 3. Fetch MCP Engine regulations from registry
  console.log('Fetching MCP Engine regulations...');
  const registryResp = await fetch(`${REGISTRY_URL}/api/regulations`);
  const mcpRegs = await registryResp.json();
  console.log(`  MCP Engine: ${mcpRegs.length} regulations\n`);

  // 4. Load existing mapping
  const mappingPath = path.resolve(process.cwd(), 'data', 'edsteward-regkey-bulk-mapping.json');
  const existingMapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
  const existingByRegKey = new Map();
  for (const entry of existingMapping) {
    existingByRegKey.set(entry.regKey, entry);
  }

  // 5. Match each MCP Engine regulation to EdSteward
  let matched = 0;
  let unmatched = 0;
  const unmatchedList = [];
  const updatedMapping = [];

  for (const mcpReg of mcpRegs) {
    const regKey = mcpReg.regKey || mcpReg.reg_key;
    const existing = existingByRegKey.get(regKey) || {};
    
    let edstewardId = null;
    let matchMethod = null;

    // If existing mapping already has a valid edstewardId, keep it
    if (existing.edstewardId != null) {
      edstewardId = existing.edstewardId;
      matchMethod = 'existing';
    }

    // Method 1: reg_key exact match
    if (edstewardId === null && regKey) {
      const esReg = byRegKey.get(regKey);
      if (esReg) {
        edstewardId = esReg.id;
        matchMethod = 'regKey';
      }
    }

    // Method 2: Exact name match
    if (edstewardId === null) {
      const nameExact = (mcpReg.name || '').toLowerCase().trim();
      const esReg = byNameExact.get(nameExact);
      if (esReg) {
        edstewardId = esReg.id;
        matchMethod = 'exactName';
      }
    }

    // Method 3: Normalized name match
    if (edstewardId === null) {
      const nameNorm = normalize(mcpReg.name);
      const esReg = byNameNorm.get(nameNorm);
      if (esReg) {
        edstewardId = esReg.id;
        matchMethod = 'normalizedName';
      }
    }

    // Method 4: item_id / slug match
    if (edstewardId === null) {
      const slug = (mcpReg.regulationId || mcpReg.item_id || '').toLowerCase();
      const esReg = byItemId.get(slug);
      if (esReg) {
        edstewardId = esReg.id;
        matchMethod = 'itemId';
      }
    }

    // Method 5: Partial name containment (both directions)
    if (edstewardId === null) {
      const mcpNorm = normalize(mcpReg.name);
      for (const [esNorm, esReg] of byNameNorm) {
        if (mcpNorm.length > 10 && esNorm.length > 10) {
          if (esNorm.includes(mcpNorm) || mcpNorm.includes(esNorm)) {
            edstewardId = esReg.id;
            matchMethod = 'partialName';
            break;
          }
        }
      }
    }

    // Method 6: Word-overlap scoring
    if (edstewardId === null) {
      const mcpWords = new Set(normalize(mcpReg.name).split(' ').filter(w => w.length > 3));
      let bestScore = 0;
      let bestReg = null;
      
      for (const esReg of edstewardRegs) {
        const esWords = new Set(normalize(esReg.name).split(' ').filter(w => w.length > 3));
        const intersection = [...mcpWords].filter(w => esWords.has(w));
        const score = intersection.length / Math.max(mcpWords.size, esWords.size);
        if (score > 0.6 && score > bestScore) {
          bestScore = score;
          bestReg = esReg;
        }
      }
      
      if (bestReg) {
        edstewardId = bestReg.id;
        matchMethod = `wordOverlap(${(bestScore * 100).toFixed(0)}%)`;
      }
    }

    if (edstewardId !== null) {
      matched++;
    } else {
      unmatched++;
      unmatchedList.push(`${regKey} → ${mcpReg.name}`);
    }

    updatedMapping.push({
      regKey: regKey,
      mcpDbId: mcpReg.id || existing.mcpDbId || null,
      itemId: mcpReg.regulationId || existing.itemId || null,
      name: mcpReg.name || existing.name || null,
      statute: mcpReg.statute || existing.statute || null,
      category: mcpReg.category || existing.category || null,
      topic: mcpReg.topic || existing.topic || null,
      jurisdictionSource: mcpReg.jurisdictionSource || mcpReg.jurisdiction_source || existing.jurisdictionSource || null,
      stateCode: mcpReg.stateCode || mcpReg.state_code || existing.stateCode || null,
      riskScore: mcpReg.riskAssessment?.riskScore || existing.riskScore || null,
      riskLevel: mcpReg.riskAssessment?.riskLevel || existing.riskLevel || null,
      edstewardId: edstewardId,
      matchMethod: matchMethod
    });

    if (matchMethod && matchMethod !== 'existing') {
      process.stdout.write(`  ✅ ${regKey} → ES#${edstewardId} (${matchMethod})\n`);
    }
  }

  // 6. Write updated mapping
  fs.writeFileSync(mappingPath, JSON.stringify(updatedMapping, null, 2) + '\n');

  // 7. Summary
  console.log('\n=== RESULTS ===');
  console.log(`Total MCP regulations: ${mcpRegs.length}`);
  console.log(`Matched to EdSteward: ${matched}`);
  console.log(`Unmatched:            ${unmatched}`);
  
  if (unmatchedList.length > 0) {
    console.log('\n⚠️  UNMATCHED REGULATIONS:');
    unmatchedList.forEach(u => console.log(`  ❌ ${u}`));
  } else {
    console.log('\n🎉 ALL REGULATIONS MAPPED SUCCESSFULLY');
  }
  
  console.log(`\nMapping saved to: ${mappingPath}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
