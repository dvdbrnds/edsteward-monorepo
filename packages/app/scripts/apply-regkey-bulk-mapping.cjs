/**
 * Bulk reg_key Mapping Script
 * 
 * Ingests the MCP Engine's edsteward-regkey-bulk-mapping.json and matches
 * each entry against active EdSteward regulations by:
 *   1. edstewardId (DB primary key) -- if provided and record is active
 *   2. Exact name match
 *   3. Fuzzy name match (normalized, removing common suffixes/variants)
 *   4. Statute match as tiebreaker
 * 
 * Sets reg_key, risk_score, and risk_level on matched records.
 * Reports unmatched entries for manual review.
 * 
 * Usage: DATABASE_URL=... node scripts/apply-regkey-bulk-mapping.cjs [--dry-run]
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const DRY_RUN = process.argv.includes('--dry-run');
const MAPPING_FILE = path.join(__dirname, '..', 'data', 'edsteward-regkey-bulk-mapping.json');

// Normalize a regulation name for fuzzy matching
function normalizeName(name) {
  return name
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\b(of|the|and|act|law|for|in|on|to|a|an)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Normalize a statute string for comparison
function normalizeStatute(statute) {
  if (!statute) return '';
  return statute
    .toLowerCase()
    .replace(/§+/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9 .]/g, '')
    .trim();
}

// Score how well two names match (0 = no match, 1 = exact)
function nameScore(a, b) {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (na === nb) return 1.0;
  
  // Check if one contains the other
  if (na.includes(nb) || nb.includes(na)) {
    const longer = Math.max(na.length, nb.length);
    const shorter = Math.min(na.length, nb.length);
    return shorter / longer;
  }
  
  // Word overlap (Jaccard similarity)
  const wordsA = new Set(na.split(' ').filter(w => w.length > 2));
  const wordsB = new Set(nb.split(' ').filter(w => w.length > 2));
  const intersection = [...wordsA].filter(w => wordsB.has(w)).length;
  const union = new Set([...wordsA, ...wordsB]).size;
  return union > 0 ? intersection / union : 0;
}

async function main() {
  // Load mapping file
  const mapping = JSON.parse(fs.readFileSync(MAPPING_FILE, 'utf8'));
  console.log(`Loaded ${mapping.length} entries from mapping file`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE (will update DB)'}\n`);

  const pool = new Pool({ connectionString: process.env.PROD_DB_URL || process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    // Get all EdSteward regulations (active AND inactive, for edstewardId lookups)
    const allRegs = await client.query(
      'SELECT id, name, statute, reg_key, is_current, item_id, category, topic FROM regulations ORDER BY id'
    );
    
    const activeRegs = allRegs.rows.filter(r => r.is_current);
    const allRegsById = {};
    allRegs.rows.forEach(r => { allRegsById[r.id] = r; });
    
    console.log(`EdSteward: ${activeRegs.length} active regulations, ${allRegs.rowCount} total\n`);

    // Build name index for active regs
    const nameIndex = {};
    activeRegs.forEach(r => {
      const key = normalizeName(r.name);
      if (!nameIndex[key]) nameIndex[key] = [];
      nameIndex[key].push(r);
    });

    // Track results
    const matched = [];
    const unmatched = [];
    const skippedDedup = []; // MCP entries that are dedup'd on their side (like REG-003)
    const alreadyMapped = [];
    let updated = 0;

    if (!DRY_RUN) await client.query('BEGIN');

    for (const entry of mapping) {
      let match = null;
      let matchMethod = '';
      let confidence = 0;

      // Skip entries that are dedup'd on MCP side (check if canonical exists with same statute)
      // REG-003 is Title IX duplicate -- already handled
      
      // 1. Try edstewardId first
      if (entry.edstewardId) {
        const reg = allRegsById[entry.edstewardId];
        if (reg) {
          if (reg.is_current) {
            match = reg;
            matchMethod = 'edstewardId';
            confidence = 1.0;
          } else {
            // edstewardId points to deactivated record -- find its canonical (active record with same name)
            const canonicalKey = normalizeName(reg.name);
            const candidates = nameIndex[canonicalKey];
            if (candidates && candidates.length > 0) {
              match = candidates[0];
              matchMethod = 'edstewardId→canonical';
              confidence = 0.95;
            }
          }
        }
      }

      // 2. Try exact name match
      if (!match) {
        const key = normalizeName(entry.name);
        const candidates = nameIndex[key];
        if (candidates && candidates.length === 1) {
          match = candidates[0];
          matchMethod = 'exact_name';
          confidence = 0.95;
        } else if (candidates && candidates.length > 1) {
          // Multiple matches -- use statute as tiebreaker
          const entryStatute = normalizeStatute(entry.statute);
          const statuteMatch = candidates.find(r => 
            normalizeStatute(r.statute) === entryStatute
          );
          if (statuteMatch) {
            match = statuteMatch;
            matchMethod = 'exact_name+statute';
            confidence = 0.98;
          } else {
            match = candidates[0]; // Take first (lowest id)
            matchMethod = 'exact_name (multiple, took lowest id)';
            confidence = 0.80;
          }
        }
      }

      // 3. Try fuzzy name match
      if (!match) {
        let bestScore = 0;
        let bestMatch = null;
        
        for (const reg of activeRegs) {
          const score = nameScore(entry.name, reg.name);
          if (score > bestScore) {
            bestScore = score;
            bestMatch = reg;
          }
        }
        
        if (bestScore >= 0.6) {
          match = bestMatch;
          matchMethod = `fuzzy_name (${(bestScore * 100).toFixed(0)}%)`;
          confidence = bestScore;
        }
      }

      // 4. Try statute match as last resort
      if (!match && entry.statute) {
        const entryStatute = normalizeStatute(entry.statute);
        if (entryStatute) {
          const statuteMatches = activeRegs.filter(r => 
            normalizeStatute(r.statute) === entryStatute
          );
          if (statuteMatches.length === 1) {
            match = statuteMatches[0];
            matchMethod = 'statute_only';
            confidence = 0.70;
          }
        }
      }

      if (match) {
        // Check if already has a different reg_key
        if (match.reg_key && match.reg_key !== entry.regKey) {
          alreadyMapped.push({
            regKey: entry.regKey,
            name: entry.name,
            esId: match.id,
            existingRegKey: match.reg_key,
            matchMethod,
          });
          continue;
        }

        matched.push({
          regKey: entry.regKey,
          mcpName: entry.name,
          esId: match.id,
          esName: match.name,
          matchMethod,
          confidence,
          riskScore: entry.riskScore,
          riskLevel: entry.riskLevel,
        });

        if (!DRY_RUN) {
          await client.query(
            'UPDATE regulations SET reg_key = $1, risk_score = $2, risk_level = $3 WHERE id = $4',
            [entry.regKey, entry.riskScore, entry.riskLevel, match.id]
          );
          updated++;
        }
      } else {
        unmatched.push({
          regKey: entry.regKey,
          name: entry.name,
          statute: entry.statute,
          category: entry.category,
          edstewardId: entry.edstewardId,
          riskScore: entry.riskScore,
        });
      }
    }

    if (!DRY_RUN) await client.query('COMMIT');

    // Report
    console.log('========================================');
    console.log('BULK REG_KEY MAPPING RESULTS');
    console.log('========================================');
    console.log(`Matched: ${matched.length}`);
    console.log(`Unmatched: ${unmatched.length}`);
    console.log(`Already mapped (conflict): ${alreadyMapped.length}`);
    console.log(`Updated in DB: ${updated}`);

    // Show matches by method
    const methods = {};
    matched.forEach(m => { methods[m.matchMethod] = (methods[m.matchMethod] || 0) + 1; });
    console.log('\nMatch methods:');
    Object.entries(methods).sort((a, b) => b[1] - a[1]).forEach(([m, c]) => {
      console.log(`  ${m}: ${c}`);
    });

    // Show low-confidence matches
    const lowConf = matched.filter(m => m.confidence < 0.8);
    if (lowConf.length > 0) {
      console.log(`\n⚠️  LOW CONFIDENCE MATCHES (${lowConf.length}):`);
      lowConf.forEach(m => {
        console.log(`  ${m.regKey}: "${m.mcpName}" → id=${m.esId} "${m.esName}" [${m.matchMethod}]`);
      });
    }

    // Show unmatched
    if (unmatched.length > 0) {
      console.log(`\n❌ UNMATCHED (${unmatched.length}):`);
      unmatched.forEach(m => {
        console.log(`  ${m.regKey}: "${m.name}" (statute: ${m.statute || 'none'}) [risk: ${m.riskScore}]`);
      });
    }

    // Show conflicts
    if (alreadyMapped.length > 0) {
      console.log(`\n⚡ CONFLICTS (${alreadyMapped.length}):`);
      alreadyMapped.forEach(m => {
        console.log(`  ${m.regKey}: wanted id=${m.esId} but already has ${m.existingRegKey}`);
      });
    }

    // Save results
    const resultsFile = path.join(__dirname, '..', 'data', 'regkey-mapping-results.json');
    fs.writeFileSync(resultsFile, JSON.stringify({ matched, unmatched, alreadyMapped, timestamp: new Date().toISOString() }, null, 2));
    console.log(`\nResults saved to ${resultsFile}`);

  } catch (e) {
    if (!DRY_RUN) await client.query('ROLLBACK');
    console.error('ERROR (rolled back):', e.message);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
