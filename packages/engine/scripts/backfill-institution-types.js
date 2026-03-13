/**
 * Backfill applicableInstitutions on enhanced regulation JSON files.
 * 
 * Classification logic:
 * - Most regulations apply to "all-institutions" (any institution receiving federal funds or operating as an employer)
 * - Some regulations only apply to specific institution types or characteristics
 * - Regulations marked with specific types will ONLY show for institutions with those types
 * - "all-institutions" means it shows for everyone regardless of their configuration
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REGULATIONS_DIR = path.join(__dirname, '..', 'enhanced-regulations');

// Regulations with restricted applicability.
// Key = regex pattern to match filename. Value = array of applicable types.
// IMPORTANT: Do NOT combine "all-institutions" with specific types.
// "all-institutions" = applies to everyone. Specific types = only those types.
// Everything NOT listed here defaults to ["all-institutions"].
const RESTRICTED_APPLICABILITY = {
  // Athletics-only regulations (only institutions with intercollegiate athletics programs)
  'equity-in-athletics-disclosure-act': ['intercollegiate-athletics'],
  
  // Research-specific regulations (only research-intensive institutions)
  'animal-welfare-act': ['research-intensive'],
  'bayh-dole-act': ['research-intensive'],
  'cooperative-research-and-technology': ['research-intensive'],
  'nsf-grant-term': ['research-intensive'],
  'protection-of-human-subjects': ['research-intensive'],
  'public-health-service-policies-on-research': ['research-intensive'],
  'responsibility-of-applicants-for-promoting-objecti': ['research-intensive'],
  'national-science-foundation-research-misconduct': ['research-intensive'],
  'clinical-trials-financial-disclosures': ['research-intensive', 'medical-health-programs'],
  
  // Export control (primarily research institutions, but applies to anyone with controlled items)
  'arms-export-control-act': ['research-intensive'],
  'export-administration-act': ['research-intensive'],
  'export-administration-regulations': ['research-intensive'],
  'international-traffic-in-arms-regulations': ['research-intensive'],
  'atomic-energy-act': ['research-intensive'],
  
  // Medical/health-specific regulations
  'osha-bloodborne-pathogens': ['medical-health-programs'],
  'food-and-drug-administration': ['medical-health-programs', 'research-intensive'],
  
  // Title IV specific (institutions participating in federal student aid)
  'higher-education-act': ['title-iv-participant'],
  'student-right-to-know-act': ['title-iv-participant'],
  'student-loan-default': ['title-iv-participant'],
  'contracts-with-third-party-servicers': ['title-iv-participant'],
  'department-of-education-general-administrative': ['title-iv-participant'],
  'teacher-preparation-programs': ['title-iv-participant'],
  
  // Campus safety (residential + Title IV — Clery geography expands for residential campuses)
  'campus-sex-crimes-prevention': ['residential-campus', 'title-iv-participant'],
  
  // Distance education specific
  'higher-education-act-state-authorization': ['title-iv-participant', 'online-distance-ed'],
  
  // These apply broadly to all institution types
  'drug-free-workplace-act': ['all-institutions'],
  'pennsylvania-': ['all-institutions'],
  'new-jersey-': ['all-institutions'],
};

function getApplicableInstitutions(filename) {
  const slug = filename.replace('.json', '');
  
  for (const [pattern, types] of Object.entries(RESTRICTED_APPLICABILITY)) {
    if (slug.startsWith(pattern) || slug.includes(pattern)) {
      return types;
    }
  }
  
  return ['all-institutions'];
}

async function backfill() {
  const files = fs.readdirSync(REGULATIONS_DIR).filter(f => f.endsWith('.json'));
  console.log(`Processing ${files.length} regulation files...`);
  
  let updated = 0;
  let skipped = 0;
  const stats = {};
  
  for (const file of files) {
    const filePath = path.join(REGULATIONS_DIR, file);
    const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    
    const types = getApplicableInstitutions(file);
    
    // Track stats
    const key = JSON.stringify(types.sort());
    stats[key] = (stats[key] || 0) + 1;
    
    // Add applicableInstitutions to the top level
    if (JSON.stringify(content.applicableInstitutions) === JSON.stringify(types)) {
      skipped++;
      continue;
    }
    
    content.applicableInstitutions = types;
    
    fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n');
    updated++;
  }
  
  console.log(`\nResults:`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Skipped (already correct): ${skipped}`);
  console.log(`\nApplicability distribution:`);
  for (const [types, count] of Object.entries(stats).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${types}: ${count} regulations`);
  }
}

backfill().catch(console.error);
